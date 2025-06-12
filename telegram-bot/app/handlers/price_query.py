"""Price query command handler"""

from aiogram import Router, types, F
from aiogram.filters import Command
from loguru import logger

from ..config import get_text
from ..database_api import db_api as db
from ..utils.formatting import format_product_prices

router = Router()


@router.message(Command("price"))
async def cmd_price_with_args(message: types.Message):
    """Handle /price command with arguments"""
    # Extract product name from command
    args = message.text.split(maxsplit=1)
    if len(args) < 2:
        await message.answer(
            "Please specify a product name.\n"
            "Example: `/price tomato`",
            parse_mode="Markdown"
        )
        return
    
    product_query = args[1].strip()
    await search_and_send_prices(message, product_query)


@router.message(F.text & ~F.text.startswith("/"))
async def handle_text_query(message: types.Message):
    """Handle plain text messages as product searches"""
    product_query = message.text.strip()
    
    # Ignore very short queries
    if len(product_query) < 2:
        return
    
    await search_and_send_prices(message, product_query)


async def search_and_send_prices(message: types.Message, product_query: str):
    """Search for product and send price information"""
    user = message.from_user
    logger.info(f"User {user.id} searching for: {product_query}")
    
    # Send searching message
    searching_msg = await message.answer(
        get_text("price_query", product=product_query),
        parse_mode="Markdown"
    )
    
    try:
        # Search products in database
        products = await db.search_products(product_query)
        
        if not products:
            await searching_msg.edit_text(
                get_text("no_results", product=product_query),
                parse_mode="Markdown"
            )
            return
        
        # Format and send results
        results = []
        for product in products[:3]:  # Show top 3 matches
            results.append(format_product_prices(product))
        
        result_text = "\n\n---\n\n".join(results)
        
        # If text is too long, send multiple messages
        if len(result_text) > 4000:
            await searching_msg.delete()
            for product in products[:3]:
                await message.answer(
                    format_product_prices(product),
                    parse_mode="Markdown"
                )
        else:
            await searching_msg.edit_text(
                result_text,
                parse_mode="Markdown"
            )
        
        # Log successful search
        logger.info(f"Found {len(products)} products for query: {product_query}")
        
    except Exception as e:
        logger.error(f"Error searching products: {e}")
        await searching_msg.edit_text(
            get_text("error", error="Failed to search products"),
            parse_mode="Markdown"
        )