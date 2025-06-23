"""Configuration management for Monito Web Telegram Bot"""

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
import os


class Settings(BaseSettings):
    """Bot configuration settings"""
    
    # Telegram Bot
    bot_token: str = Field(..., env="BOT_TOKEN")
    
    # Database (not needed when using API)
    database_url: Optional[str] = Field(default=None, env="DATABASE_URL")
    
    # OpenAI
    openai_api_key: str = Field(..., env="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4o-mini", env="OPENAI_MODEL")
    
    # Redis (optional)
    redis_url: Optional[str] = Field(default=None, env="REDIS_URL")
    
    # Bot Settings
    bot_language: str = Field(default="en", env="BOT_LANGUAGE")
    max_products_per_query: int = Field(default=10, env="MAX_PRODUCTS_PER_QUERY")
    ocr_timeout_seconds: int = Field(default=30, env="OCR_TIMEOUT_SECONDS")
    enable_ocr_cache: bool = Field(default=True, env="ENABLE_OCR_CACHE")
    
    # API Configuration
    monito_api_url: str = Field(default="http://localhost:3000/api/bot", env="MONITO_API_URL")
    bot_api_key: str = Field(..., env="BOT_API_KEY")
    
    # Logging
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    log_file: str = Field(default="bot.log", env="LOG_FILE")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Create global settings instance
settings = Settings()


# Language configurations
LANGUAGES = {
    "en": {
        "welcome": "👋 Welcome to Monito Web Price Bot!\n\n"
                  "I can help you:\n"
                  "• Check product prices across suppliers\n"
                  "• Analyze invoices for better prices\n\n"
                  "Commands:\n"
                  "/price [product] - Get prices for a product\n"
                  "/help - Show this message\n\n"
                  "You can also send me a photo of an invoice!",
        
        "price_query": "🔍 Searching for *{product}*...",
        
        "price_result": "📊 *{product}*\n\n"
                       "Best prices:\n{prices}\n\n"
                       "Average: {avg_price}\n"
                       "Suppliers: {supplier_count}",
        
        "no_results": "❌ No results found for *{product}*\n"
                     "Try a different search term.",
        
        "invoice_processing": "📄 Processing invoice...\n"
                            "This may take a few seconds.",
        
        "invoice_result": "📄 *Invoice Analysis*\n\n"
                         "Supplier: {supplier}\n"
                         "Date: {date}\n\n"
                         "{comparisons}\n\n"
                         "💰 Potential savings: {savings}",
        
        "error": "❌ An error occurred: {error}",
        
        "help": "/price [product] - Get product prices\n"
               "/help - Show help message\n\n"
               "Send a photo of an invoice for price analysis!"
    },
    
    "ru": {
        "welcome": "👋 Добро пожаловать в Monito Web Price Bot!\n\n"
                  "Я могу помочь вам:\n"
                  "• Проверить цены на продукты у разных поставщиков\n"
                  "• Проанализировать накладные для поиска лучших цен\n\n"
                  "Команды:\n"
                  "/price [продукт] - Получить цены на продукт\n"
                  "/help - Показать это сообщение\n\n"
                  "Вы также можете отправить мне фото накладной!",
        
        "price_query": "🔍 Ищу {product}...",
        
        "price_result": "📊 *{product}*\n\n"
                       "Лучшие цены:\n{prices}\n\n"
                       "Средняя: {avg_price}\n"
                       "Поставщиков: {supplier_count}",
        
        "no_results": "❌ Ничего не найдено для {product}\n"
                     "Попробуйте другой поисковый запрос.",
        
        "invoice_processing": "📄 Обрабатываю накладную...\n"
                            "Это может занять несколько секунд.",
        
        "invoice_result": "📄 *Анализ накладной*\n\n"
                         "Поставщик: {supplier}\n"
                         "Дата: {date}\n\n"
                         "{comparisons}\n\n"
                         "💰 Потенциальная экономия: {savings}",
        
        "error": "❌ Произошла ошибка: {error}",
        
        "help": "/price [продукт] - Получить цены на продукт\n"
               "/help - Показать справку\n\n"
               "Отправьте фото накладной для анализа цен!"
    }
}


def get_text(key: str, lang: str = None, **kwargs) -> str:
    """Get localized text by key"""
    lang = lang or settings.bot_language
    texts = LANGUAGES.get(lang, LANGUAGES["en"])
    text = texts.get(key, f"Missing translation: {key}")
    
    if kwargs:
        text = text.format(**kwargs)
    
    return text