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
from ..utils.formatting import format_comparison_report

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
        
        # Find supplier in database
        supplier = await db.find_supplier_by_name(supplier_name) if supplier_name != 'Unknown Supplier' else None
        
        # Prepare products for comparison
        product_supplier_pairs = []
        for item in result['products']:
            product_supplier_pairs.append((
                item['name'],
                supplier['id'] if supplier else None,
                item.get('total_price', item.get('unit_price', 0))
            ))
        
        # Compare prices
        comparison = await db.compare_prices_bulk(product_supplier_pairs)
        
        # Format and send report
        report = format_comparison_report(comparison, supplier_name)
        await processing_msg.edit_text(
            report,
            parse_mode="Markdown"
        )
        
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