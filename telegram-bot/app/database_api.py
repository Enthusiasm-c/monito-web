"""Database API client for Telegram bot - uses Monito Web API instead of direct DB connection"""

import aiohttp
import os
from typing import List, Dict, Any, Optional
from loguru import logger


class DatabaseAPI:
    """API client for Monito Web database operations"""
    
    def __init__(self):
        from .config import settings
        self.base_url = settings.monito_api_url
        self.api_key = settings.bot_api_key
        self.session = None
    
    async def init(self):
        """Initialize HTTP session"""
        if not self.session:
            self.session = aiohttp.ClientSession(
                headers={'X-Bot-API-Key': self.api_key}
            )
    
    async def close(self):
        """Close HTTP session"""
        if self.session:
            await self.session.close()
    
    async def search_products(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search for products by name"""
        await self.init()
        
        try:
            async with self.session.get(
                f"{self.base_url}/products/search",
                params={'q': query, 'limit': limit}
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('products', [])
                else:
                    logger.error(f"API error: {response.status}")
                    return []
        except Exception as e:
            logger.error(f"Failed to search products: {e}")
            return []
    
    async def find_supplier_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Find supplier by name"""
        await self.init()
        
        try:
            async with self.session.get(
                f"{self.base_url}/suppliers/search",
                params={'name': name}
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('supplier')
                else:
                    logger.error(f"API error: {response.status}")
                    return None
        except Exception as e:
            logger.error(f"Failed to find supplier: {e}")
            return None
    
    async def compare_prices_bulk(self, items: List[tuple]) -> List[Dict[str, Any]]:
        """Compare multiple product prices"""
        await self.init()
        
        # Convert tuples to API format
        api_items = []
        for item in items:
            if len(item) == 4:
                # New format with unit
                product_name, supplier_id, scanned_price, unit = item
                api_items.append({
                    'product_name': product_name,
                    'supplier_id': supplier_id,
                    'scanned_price': float(scanned_price),
                    'unit': unit
                })
            else:
                # Old format without unit
                product_name, supplier_id, scanned_price = item
                api_items.append({
                    'product_name': product_name,
                    'supplier_id': supplier_id,
                    'scanned_price': float(scanned_price)
                })
        
        try:
            async with self.session.post(
                f"{self.base_url}/prices/compare",
                json={'items': api_items}
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('comparisons', [])
                else:
                    logger.error(f"API error: {response.status}")
                    return []
        except Exception as e:
            logger.error(f"Failed to compare prices: {e}")
            return []


# Create global instance
db_api = DatabaseAPI()