"""Start command handler"""

from aiogram import Router, types
from aiogram.filters import CommandStart, Command
from loguru import logger

from ..config import get_text

router = Router()


@router.message(CommandStart())
async def cmd_start(message: types.Message):
    """Handle /start command"""
    user = message.from_user
    logger.info(f"User {user.id} ({user.username}) started the bot")
    
    # Send welcome message
    await message.answer(
        get_text("welcome"),
        parse_mode="Markdown"
    )


@router.message(Command("help"))
async def cmd_help(message: types.Message):
    """Handle /help command"""
    await message.answer(
        get_text("help"),
        parse_mode="Markdown"
    )