"""Invoice photo handler"""

import io
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

router = Router()


@router.message(F.photo)
async def handle_invoice_photo(message: types.Message):
    """Handle invoice photo uploads"""
    user = message.from_user
    logger.info(f"User {user.id} sent a photo for processing")
    
    # Send processing message
    processing_msg = await message.answer(
        get_text("invoice_processing"),
        parse_mode="Markdown"
    )
    
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
        
        if not result or not result.get('products'):
            await processing_msg.edit_text(
                "❌ Could not extract products from the invoice.\n"
                "Please make sure the photo is clear and contains product information.",
                parse_mode="Markdown"
            )
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
            # Always use unit_price for comparison (price per unit)
            # This ensures we compare like-for-like prices
            unit_price = item.get('unit_price', 0)
            if unit_price == 0:
                # Fallback: calculate unit price from total price if available
                total_price = item.get('total_price', 0)
                quantity = item.get('quantity', 1)
                if total_price > 0 and quantity > 0:
                    unit_price = total_price / quantity
            
            product_supplier_pairs.append((
                item['name'],
                None,  # Don't match by supplier, just compare all prices
                unit_price,
                item.get('unit', '')  # Include unit for comparison
            ))
        
        # Log request data
        logger.info(f"Sending {len(product_supplier_pairs)} items for comparison")
        for idx, item in enumerate(product_supplier_pairs):
            logger.info(f"Item {idx}: {item[0]} - Price: {item[2]}")
        
        # Compare prices
        api_response = await db.compare_prices_bulk(product_supplier_pairs)
        
        # Log API response for debugging
        logger.info(f"API comparison response: {len(api_response) if api_response else 0} items")
        
        if not api_response:
            logger.error("API returned empty response")
            await processing_msg.edit_text(
                "❌ Failed to compare prices. Please try again later.",
                parse_mode="Markdown"
            )
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
                f"Confidence: {result.get('confidence', 'N/A')}"
            )
            await message.answer(debug_info, parse_mode="Markdown")
        
    except Exception as e:
        logger.error(f"Error processing invoice: {e}", exc_info=True)
        await processing_msg.edit_text(
            get_text("error", error="Failed to process invoice"),
            parse_mode="Markdown"
        )


@router.message(F.document)
async def handle_invoice_document(message: types.Message):
    """Handle invoice documents (PDF, images)"""
    document = message.document
    
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
    else:
        await message.answer(
            "❌ Unsupported file type.\n"
            "Please send invoices as photos.",
            parse_mode="Markdown"
        )