"""Invoice photo handler with integrated monitoring"""

import io
import time
from datetime import datetime
from typing import List, Tuple

from aiogram import Router, types, F
from aiogram.types import BufferedInputFile
from loguru import logger
from PIL import Image

from ..config import get_text
from ..database_api import db_api as db
from ..ocr.pipeline import OCRPipeline
from ..utils.formatting import format_comparison_report, format_price

# Импорт системы мониторинга
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../monitoring')))

try:
    from metrics_collector import (
        start_processing, 
        record_ocr_completion, 
        record_api_completion, 
        record_financial_summary, 
        record_error, 
        finish_processing,
        add_user_restaurant_mapping
    )
    MONITORING_ENABLED = True
    logger.info("Monitoring system initialized successfully")
except ImportError as e:
    logger.warning(f"Monitoring system not available: {e}")
    MONITORING_ENABLED = False

router = Router()

# Маппинг user_id к названиям ресторанов
USER_RESTAURANT_MAPPING = {
    # Примеры маппинга - добавьте реальные user_id и названия ресторанов
    # 123456789: "Ресторан 'Солнечный'",
    # 987654321: "Кафе 'Уютное место'",
    # 555666777: "Бистро 'Быстрый обед'",
}

def get_restaurant_name(user_id: int) -> str:
    """Получение названия ресторана по user_id"""
    return USER_RESTAURANT_MAPPING.get(user_id, f"User_{user_id}")

def safe_monitoring_call(func, *args, **kwargs):
    """Безопасный вызов функций мониторинга"""
    if not MONITORING_ENABLED:
        return None
    try:
        return func(*args, **kwargs)
    except Exception as e:
        logger.warning(f"Monitoring call failed: {e}")
        return None

@router.message(F.photo)
async def handle_invoice_photo(message: types.Message):
    """Handle invoice photo uploads with monitoring"""
    user = message.from_user
    user_id = user.id
    restaurant_name = get_restaurant_name(user_id)
    
    logger.info(f"User {user_id} ({restaurant_name}) sent a photo for processing")
    
    # Начать мониторинг обработки
    metrics = safe_monitoring_call(start_processing, user_id)
    
    # Добавить маппинг пользователя к ресторану в систему мониторинга
    if MONITORING_ENABLED and user_id in USER_RESTAURANT_MAPPING:
        safe_monitoring_call(add_user_restaurant_mapping, user_id, USER_RESTAURANT_MAPPING[user_id])
    
    # Send processing message
    processing_msg = await message.answer(
        get_text("invoice_processing"),
        parse_mode="Markdown"
    )
    
    ocr_start_time = time.time()
    api_start_time = None
    
    try:
        # Get the largest photo
        photo = message.photo[-1]
        
        # Download photo
        file = await message.bot.get_file(photo.file_id)
        photo_bytes = await message.bot.download_file(file.file_path)
        
        # Convert to PIL Image
        image = Image.open(io.BytesIO(photo_bytes.getvalue()))
        
        # Initialize OCR pipeline
        ocr = OCRPipeline()
        
        # Process invoice
        logger.info("Starting OCR processing...")
        result = await ocr.process_invoice(image)
        
        # Записать завершение OCR
        ocr_duration = time.time() - ocr_start_time
        ocr_confidence = result.get('confidence') if result else None
        supplier_name = result.get('supplier_name', 'Unknown Supplier') if result else None
        invoice_date = result.get('date', datetime.now().strftime('%Y-%m-%d')) if result else None
        products_count = len(result.get('products', [])) if result else 0
        
        safe_monitoring_call(
            record_ocr_completion,
            user_id,
            ocr_duration,
            products_count,
            ocr_confidence,
            supplier_name,
            invoice_date
        )
        
        if not result or not result.get('products'):
            error_msg = "Could not extract products from the invoice"
            safe_monitoring_call(record_error, user_id, error_msg)
            
            await processing_msg.edit_text(
                "❌ Could not extract products from the invoice.\n"
                "Please make sure the photo is clear and contains product information.",
                parse_mode="Markdown"
            )
            
            # Завершить мониторинг с ошибкой
            safe_monitoring_call(finish_processing, user_id)
            return
        
        # Extract supplier name
        supplier_name = result.get('supplier_name', 'Unknown Supplier')
        invoice_date = result.get('date', datetime.now().strftime('%Y-%m-%d'))
        
        # Log OCR result for debugging
        logger.info(f"OCR result: {len(result.get('products', []))} products extracted")
        for idx, item in enumerate(result.get('products', [])):
            logger.info(f"OCR Item {idx}: {item.get('name')} - Qty: {item.get('quantity')} - Unit Price: {item.get('unit_price')} - Total: {item.get('total_price')}")
        
        # Prepare products for comparison - no supplier check needed
        product_supplier_pairs = []
        for item in result['products']:
            # Приоритет OCR total: используем total_price если доступно, иначе unit_price
            price_to_use = item.get('total_price', 0)
            quantity = item.get('quantity', 1) or 1
            
            # Если total_price недоступно, используем unit_price
            if price_to_use == 0:
                unit_price = item.get('unit_price', 0)
                if unit_price > 0:
                    price_to_use = unit_price
            
            # Если у нас есть и total_price и quantity > 1, рассчитаем unit_price для сравнения
            if quantity > 1 and price_to_use > 0:
                unit_price_for_comparison = price_to_use / quantity
            else:
                unit_price_for_comparison = price_to_use
            
            product_supplier_pairs.append((
                item['name'],
                None,  # Don't match by supplier, just compare all prices
                unit_price_for_comparison,
                item.get('unit', '')  # Include unit for comparison
            ))
        
        # Log request data
        logger.info(f"Sending {len(product_supplier_pairs)} items for comparison")
        for idx, item in enumerate(product_supplier_pairs):
            logger.info(f"Item {idx}: {item[0]} - Price: {item[2]}")
        
        # Начать отслеживание API вызова
        api_start_time = time.time()
        
        # Compare prices
        api_response = await db.compare_prices_bulk(product_supplier_pairs)
        
        # Записать завершение API вызова
        api_duration = time.time() - api_start_time
        products_compared = len(api_response) if api_response else 0
        products_not_found = len([r for r in api_response if r.get('status') == 'not_found']) if api_response else 0
        
        safe_monitoring_call(
            record_api_completion,
            user_id,
            api_duration,
            products_compared,
            products_not_found
        )
        
        # Log API response for debugging
        logger.info(f"API comparison response: {len(api_response) if api_response else 0} items")
        
        if not api_response:
            error_msg = "API returned empty response"
            logger.error(error_msg)
            safe_monitoring_call(record_error, user_id, error_msg)
            
            await processing_msg.edit_text(
                "❌ Failed to compare prices. Please try again later.",
                parse_mode="Markdown"
            )
            
            # Завершить мониторинг с ошибкой
            safe_monitoring_call(finish_processing, user_id)
            return
            
        for idx, comp in enumerate(api_response):
            logger.info(f"Item {idx}: {comp.get('product_name')} - Status: {comp.get('status')}")
        
        # Transform API response to expected format
        comparison_data = {
            'comparisons': [],
            'total_current': 0,
            'total_savings': 0,
            'total_savings_percent': 0
        }
        
        not_found_items = []
        
        for i, comp in enumerate(api_response):
            if comp.get('status') == 'not_found':
                not_found_items.append({
                    'product_name': comp['product_name'],
                    'scanned_price': comp['scanned_price']
                })
                continue
                
            analysis = comp.get('price_analysis', {})
            scanned_price = comp['scanned_price']
            status = comp.get('status', 'unknown')
            
            # Get quantity from original OCR data
            quantity = 1  # default
            if i < len(result['products']):
                quantity = result['products'][i].get('quantity', 1) or 1
                
                # Используем OCR total_price если доступно
                ocr_total_price = result['products'][i].get('total_price', 0)
                if ocr_total_price > 0:
                    # Пересчитаем unit_price на основе OCR total
                    scanned_price = ocr_total_price / quantity
                    logger.info(f"Using OCR total price: {ocr_total_price} for {quantity} units = {scanned_price} per unit")
                
            min_price = analysis.get('min_price', scanned_price)
            
            # Get better deals from API response
            better_deals = analysis.get('better_deals', [])
            has_better_deals = analysis.get('has_better_deals', False)
            is_suspiciously_low = analysis.get('is_suspiciously_low', False)
            
            # Handle suspiciously low prices differently
            if status == 'suspiciously_low' or is_suspiciously_low:
                max_price = analysis.get('max_price') or min_price or scanned_price
                best_supplier = f'⚠️ Price too low (market range: {min_price or scanned_price:,.0f} - {max_price:,.0f})'
                can_optimize = False  # Don't suggest optimization for suspiciously low prices
                savings = 0
                savings_percent = 0
            else:
                # Find best supplier from better deals
                best_supplier = better_deals[0]['supplier'] if better_deals else 'Current price is best'
                can_optimize = has_better_deals
                savings = better_deals[0]['savings'] if better_deals else 0
                savings_percent = better_deals[0]['savings_percent'] if better_deals else 0
            
            comparison_data['comparisons'].append({
                'product_name': comp['product_name'],
                'current_price': scanned_price,
                'best_price': min_price,
                'best_supplier': best_supplier,
                'can_optimize': can_optimize,
                'savings': savings,
                'savings_percent': savings_percent,
                'better_deals': better_deals,  # Include all better deals
                'quantity': quantity
            })
            
            # Calculate total based on quantity * unit_price
            item_total = scanned_price * quantity
            comparison_data['total_current'] += item_total
            comparison_data['total_savings'] += savings * quantity
        
        # Calculate total savings percentage
        if comparison_data['total_current'] > 0:
            comparison_data['total_savings_percent'] = (
                comparison_data['total_savings'] / comparison_data['total_current'] * 100
            )
        
        # Записать финансовую сводку
        safe_monitoring_call(
            record_financial_summary,
            user_id,
            comparison_data['total_current'],
            comparison_data['total_savings'],
            comparison_data['total_savings_percent']
        )
        
        # Format and send report
        report = format_comparison_report(comparison_data, supplier_name)
        
        # Note: not_found_items are now handled within the format_comparison_report function
        # with the 🆕 badge instead of a separate section
        
        # Limit total message length
        if len(report) > 4000:
            report = report[:3900] + "\n\n<i>... message truncated due to length</i>"
        
        # Use HTML parsing instead of MarkdownV2 for better compatibility
        try:
            await processing_msg.edit_text(
                report,
                parse_mode="MarkdownV2"
            )
        except Exception as e:
            logger.warning(f"MarkdownV2 failed: {e}, falling back to plain text")
            await processing_msg.edit_text(report, parse_mode=None)
        
        # Log successful processing
        logger.info(f"Successfully processed invoice with {len(result['products'])} products")
        
        # Send debug info if needed
        if message.text and "debug" in message.text.lower():
            debug_info = (
                f"*Debug Information:*\n"
                f"Supplier: {supplier_name}\n"
                f"Date: {invoice_date}\n"
                f"Products found: {len(result['products'])}\n"
                f"Processing time: {result.get('processing_time', 'N/A')}s\n"
                f"Confidence: {result.get('confidence', 'N/A')}\n"
                f"Restaurant: {restaurant_name}\n"
                f"OCR Duration: {ocr_duration:.2f}s\n"
                f"API Duration: {api_duration:.2f}s"
            )
            await message.answer(debug_info, parse_mode="Markdown")
        
        # Завершить мониторинг успешно
        final_metrics = safe_monitoring_call(finish_processing, user_id)
        if final_metrics:
            logger.info(f"Processing metrics saved for user {user_id}: "
                       f"total duration: {final_metrics.total_duration:.2f}s, "
                       f"products: {final_metrics.products_extracted}, "
                       f"savings: {final_metrics.total_savings:.2f}")
        
    except Exception as e:
        logger.error(f"Error processing invoice: {e}", exc_info=True)
        
        # Записать ошибку в мониторинг
        error_msg = f"Error processing invoice: {str(e)}"
        safe_monitoring_call(record_error, user_id, error_msg)
        
        await processing_msg.edit_text(
            get_text("error", error="Failed to process invoice"),
            parse_mode="Markdown"
        )
        
        # Завершить мониторинг с ошибкой
        safe_monitoring_call(finish_processing, user_id)


@router.message(F.document)
async def handle_invoice_document(message: types.Message):
    """Handle invoice documents (PDF, images) with monitoring"""
    user = message.from_user
    user_id = user.id
    document = message.document
    
    logger.info(f"User {user_id} sent a document: {document.file_name}")
    
    # Начать мониторинг (для документов тоже отслеживаем)
    metrics = safe_monitoring_call(start_processing, user_id)
    
    try:
        # Check if it's an image or PDF
        if document.mime_type and (
            document.mime_type.startswith('image/') or 
            document.mime_type == 'application/pdf'
        ):
            await message.answer(
                "📄 Document received!\n"
                "Currently, only photo invoices are supported.\n"
                "Please send the invoice as a photo.",
                parse_mode="Markdown"
            )
            
            # Записать как "неподдерживаемый тип файла"
            safe_monitoring_call(record_error, user_id, f"Unsupported document type: {document.mime_type}")
            
        else:
            await message.answer(
                "❌ Unsupported file type.\n"
                "Please send invoices as photos.",
                parse_mode="Markdown"
            )
            
            # Записать как "неподдерживаемый тип файла"
            safe_monitoring_call(record_error, user_id, f"Unsupported file type: {document.mime_type}")
    
    except Exception as e:
        logger.error(f"Error handling document: {e}", exc_info=True)
        safe_monitoring_call(record_error, user_id, f"Error handling document: {str(e)}")
    
    finally:
        # Завершить мониторинг
        safe_monitoring_call(finish_processing, user_id)


# Новая функция для получения статистики мониторинга
async def get_monitoring_stats(days: int = 7) -> dict:
    """Получить статистику мониторинга за указанное количество дней"""
    if not MONITORING_ENABLED:
        return {"error": "Monitoring not enabled"}
    
    try:
        from metrics_collector import get_statistics
        return get_statistics(days)
    except Exception as e:
        logger.error(f"Error getting monitoring stats: {e}")
        return {"error": str(e)}


# Функция для добавления маппинга пользователя к ресторану
def add_restaurant_mapping(user_id: int, restaurant_name: str):
    """Добавить маппинг пользователя к ресторану"""
    USER_RESTAURANT_MAPPING[user_id] = restaurant_name
    if MONITORING_ENABLED:
        safe_monitoring_call(add_user_restaurant_mapping, user_id, restaurant_name)
    logger.info(f"Added restaurant mapping: {user_id} -> {restaurant_name}")


# Функция для получения текущих активных сессий
async def get_active_sessions() -> dict:
    """Получить информацию об активных сессиях обработки"""
    if not MONITORING_ENABLED:
        return {"error": "Monitoring not enabled"}
    
    try:
        from metrics_collector import metrics_collector
        active_sessions = metrics_collector.get_active_sessions()
        return {
            "active_sessions_count": len(active_sessions),
            "sessions": {
                user_id: {
                    "restaurant_name": session.restaurant_name,
                    "processing_start": session.processing_start,
                    "duration_so_far": time.time() - session.processing_start
                }
                for user_id, session in active_sessions.items()
            }
        }
    except Exception as e:
        logger.error(f"Error getting active sessions: {e}")
        return {"error": str(e)}