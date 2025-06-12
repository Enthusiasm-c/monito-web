"""Database connection and queries for Monito Web Bot"""

import asyncpg
from typing import List, Dict, Any, Optional
from loguru import logger
from .config import settings


class Database:
    """PostgreSQL database connection manager"""
    
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
    
    async def connect(self):
        """Create connection pool"""
        try:
            self.pool = await asyncpg.create_pool(
                settings.database_url,
                min_size=5,
                max_size=20,
                command_timeout=60
            )
            logger.info("Database connection pool created")
        except Exception as e:
            logger.error(f"Failed to create database pool: {e}")
            raise
    
    async def disconnect(self):
        """Close connection pool"""
        if self.pool:
            await self.pool.close()
            logger.info("Database connection pool closed")
    
    async def search_products(self, query: str, limit: int = None) -> List[Dict[str, Any]]:
        """
        Search for products by name (fuzzy search)
        Returns products with best prices from each supplier
        """
        limit = limit or settings.max_products_per_query
        
        async with self.pool.acquire() as conn:
            # Search in both standardizedName and name fields
            rows = await conn.fetch("""
                WITH product_matches AS (
                    SELECT DISTINCT 
                        p.id,
                        p.name,
                        p.standardized_name,
                        p.category,
                        p.unit,
                        p.standardized_unit,
                        -- Calculate similarity score
                        GREATEST(
                            similarity(LOWER(p.standardized_name), LOWER($1)),
                            similarity(LOWER(p.name), LOWER($1))
                        ) as score
                    FROM products p
                    WHERE 
                        p.standardized_name ILIKE '%' || $1 || '%'
                        OR p.name ILIKE '%' || $1 || '%'
                        OR soundex(p.standardized_name) = soundex($1)
                    ORDER BY score DESC
                    LIMIT $2
                ),
                product_prices AS (
                    SELECT 
                        pm.*,
                        pr.amount as price,
                        s.name as supplier_name,
                        s.id as supplier_id,
                        ROW_NUMBER() OVER (
                            PARTITION BY pm.id 
                            ORDER BY pr.amount ASC
                        ) as price_rank
                    FROM product_matches pm
                    JOIN prices pr ON pm.id = pr.product_id
                    JOIN suppliers s ON pr.supplier_id = s.id
                    WHERE pr.is_active = true
                )
                SELECT 
                    pp.id,
                    pp.name,
                    pp.standardized_name,
                    pp.category,
                    pp.unit,
                    pp.standardized_unit,
                    pp.score,
                    ARRAY_AGG(
                        jsonb_build_object(
                            'supplier_name', pp.supplier_name,
                            'supplier_id', pp.supplier_id,
                            'price', pp.price,
                            'rank', pp.price_rank
                        ) ORDER BY pp.price ASC
                    ) as prices
                FROM product_prices pp
                GROUP BY 
                    pp.id, pp.name, pp.standardized_name, 
                    pp.category, pp.unit, pp.standardized_unit, pp.score
                ORDER BY pp.score DESC, pp.standardized_name
            """, query, limit)
            
            return [dict(row) for row in rows]
    
    async def get_product_prices(self, product_id: str) -> List[Dict[str, Any]]:
        """Get all prices for a specific product"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT 
                    pr.amount as price,
                    s.name as supplier_name,
                    s.id as supplier_id,
                    s.email as supplier_email,
                    s.phone as supplier_phone,
                    u.original_name as source_file,
                    pr.updated_at
                FROM prices pr
                JOIN suppliers s ON pr.supplier_id = s.id
                LEFT JOIN uploads u ON pr.upload_id = u.id
                WHERE pr.product_id = $1 AND pr.is_active = true
                ORDER BY pr.amount ASC
            """, product_id)
            
            return [dict(row) for row in rows]
    
    async def get_supplier_products(self, supplier_name: str) -> List[Dict[str, Any]]:
        """Get all products from a specific supplier"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT 
                    p.id,
                    p.name,
                    p.standardized_name,
                    p.category,
                    p.unit,
                    pr.amount as price
                FROM products p
                JOIN prices pr ON p.id = pr.product_id
                JOIN suppliers s ON pr.supplier_id = s.id
                WHERE LOWER(s.name) = LOWER($1) AND pr.is_active = true
                ORDER BY p.category, p.standardized_name
            """, supplier_name)
            
            return [dict(row) for row in rows]
    
    async def find_supplier_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Find supplier by name (exact or fuzzy match)"""
        async with self.pool.acquire() as conn:
            # First try exact match
            row = await conn.fetchrow("""
                SELECT id, name, email, phone, address
                FROM suppliers
                WHERE LOWER(name) = LOWER($1)
            """, name)
            
            if row:
                return dict(row)
            
            # Try fuzzy match
            row = await conn.fetchrow("""
                SELECT id, name, email, phone, address,
                       similarity(LOWER(name), LOWER($1)) as score
                FROM suppliers
                WHERE similarity(LOWER(name), LOWER($1)) > 0.3
                ORDER BY score DESC
                LIMIT 1
            """, name)
            
            return dict(row) if row else None
    
    async def compare_prices_bulk(self, product_supplier_pairs: List[tuple]) -> Dict[str, Any]:
        """
        Compare prices for multiple products from a specific supplier
        with market prices
        
        Args:
            product_supplier_pairs: List of (product_name, supplier_id, current_price)
        
        Returns:
            Dictionary with comparison results
        """
        comparisons = []
        total_current = 0
        total_best = 0
        
        for product_name, supplier_id, current_price in product_supplier_pairs:
            # Find product
            products = await self.search_products(product_name, limit=1)
            if not products:
                continue
            
            product = products[0]
            prices = product['prices']
            
            # Find best price
            best_price = prices[0]['price'] if prices else current_price
            best_supplier = prices[0]['supplier_name'] if prices else 'Unknown'
            
            # Calculate savings
            savings = current_price - best_price
            savings_percent = (savings / current_price * 100) if current_price > 0 else 0
            
            comparisons.append({
                'product_name': product['standardized_name'],
                'current_price': current_price,
                'best_price': best_price,
                'best_supplier': best_supplier,
                'savings': savings,
                'savings_percent': savings_percent,
                'can_optimize': savings > 0
            })
            
            total_current += current_price
            total_best += best_price
        
        return {
            'comparisons': comparisons,
            'total_current': total_current,
            'total_best': total_best,
            'total_savings': total_current - total_best,
            'total_savings_percent': ((total_current - total_best) / total_current * 100) if total_current > 0 else 0
        }


# Global database instance
db = Database()