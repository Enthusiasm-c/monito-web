"""Logging setup utilities"""

import sys
from loguru import logger


def setup_logging(level: str = "INFO", log_file: str = None):
    """Configure logging for the bot"""
    # Remove default logger
    logger.remove()
    
    # Console logger with color
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level=level,
        colorize=True
    )
    
    # File logger if specified
    if log_file:
        logger.add(
            log_file,
            format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
            level=level,
            rotation="10 MB",
            retention="7 days",
            compression="zip"
        )
    
    logger.info(f"Logging configured: level={level}, file={log_file or 'None'}")