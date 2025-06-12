"""Main bot entry point"""

import asyncio
import sys
from pathlib import Path

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from loguru import logger

from .config import settings
from .database_api import db_api as db
from .handlers import start, price_query, invoice_scan
from .utils.logging import setup_logging


async def on_startup(bot: Bot):
    """Actions to perform on bot startup"""
    logger.info("Starting Monito Web Price Bot...")
    
    # Initialize API client
    await db.init()
    logger.info("API client initialized")
    
    # Get bot info
    bot_info = await bot.get_me()
    logger.info(f"Bot started: @{bot_info.username} ({bot_info.id})")


async def on_shutdown(bot: Bot):
    """Actions to perform on bot shutdown"""
    logger.info("Shutting down bot...")
    
    # Close API client
    await db.close()
    
    logger.info("Bot shutdown complete")


async def main():
    """Main bot function"""
    # Setup logging
    setup_logging(settings.log_level, settings.log_file)
    
    # Create bot instance
    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(
            parse_mode=ParseMode.MARKDOWN,
            link_preview_is_disabled=True
        )
    )
    
    # Create dispatcher
    dp = Dispatcher()
    
    # Register startup/shutdown handlers
    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)
    
    # Register command handlers
    dp.include_router(start.router)
    dp.include_router(price_query.router)
    dp.include_router(invoice_scan.router)
    
    # Start polling
    try:
        logger.info("Starting bot polling...")
        await dp.start_polling(
            bot,
            allowed_updates=dp.resolve_used_update_types(),
            drop_pending_updates=True
        )
    except Exception as e:
        logger.error(f"Bot polling failed: {e}")
        raise
    finally:
        await bot.session.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Bot stopped by user")
    except Exception as e:
        logger.error(f"Bot crashed: {e}")
        sys.exit(1)