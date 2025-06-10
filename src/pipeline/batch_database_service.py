#!/usr/bin/env python3
"""
Batch Database Operations Service
Implements Task 11: Batch database operations

Features:
- Bulk insert/update/delete operations for better performance
- Connection pooling and transaction management
- Automatic batching with configurable sizes
- Error handling and rollback mechanisms
- Progress tracking and monitoring
- Memory-efficient processing for large datasets
- Conflict resolution and upsert operations
"""

import sys
import os
import json
import time
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union
import logging
from datetime import datetime
from collections import defaultdict
import asyncio
from contextlib import asynccontextmanager

# Database connection libraries
try:
    import asyncpg
    import psycopg2
    from psycopg2.extras import execute_batch, execute_values
    POSTGRES_AVAILABLE = True
except ImportError:
    print("[WARNING] PostgreSQL libraries not available, database operations limited", file=sys.stderr)
    POSTGRES_AVAILABLE = False

# For data processing
try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    print("[WARNING] pandas not available, limited data processing", file=sys.stderr)
    PANDAS_AVAILABLE = False


class BatchDatabaseService:
    """Service for efficient batch database operations"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        
        # Database configuration
        self.database_url = self.config.get('database_url') or os.getenv('DATABASE_URL')
        self.host = self.config.get('host', 'localhost')
        self.port = self.config.get('port', 5432)
        self.database = self.config.get('database', 'postgres')
        self.username = self.config.get('username', 'postgres')
        self.password = self.config.get('password', '')
        
        # Connection pool settings
        self.min_connections = self.config.get('min_connections', 5)
        self.max_connections = self.config.get('max_connections', 20)
        self.connection_timeout = self.config.get('connection_timeout', 30)
        
        # Batch operation settings
        self.default_batch_size = self.config.get('default_batch_size', 1000)
        self.max_batch_size = self.config.get('max_batch_size', 10000)
        self.transaction_timeout = self.config.get('transaction_timeout', 300)  # 5 minutes
        
        # Performance settings
        self.use_copy = self.config.get('use_copy', True)  # Use COPY for bulk inserts
        self.parallel_batches = self.config.get('parallel_batches', 4)
        self.commit_frequency = self.config.get('commit_frequency', 5000)  # Commit every N records
        
        # Connection pools
        self.async_pool = None
        self.sync_connection = None
        self.enabled = False
        
        # Statistics
        self.stats = {
            'operations': 0,
            'records_processed': 0,
            'batches_executed': 0,
            'errors': 0,
            'total_time_ms': 0,
            'avg_batch_time_ms': 0
        }
        
        print(f"[INFO] Batch Database Service initialized", file=sys.stderr)
        print(f"[INFO] PostgreSQL: {'✓' if POSTGRES_AVAILABLE else '✗'}", file=sys.stderr)
        print(f"[INFO] Default batch size: {self.default_batch_size}", file=sys.stderr)
    
    async def initialize_async_pool(self):
        """Initialize async connection pool"""
        
        if not POSTGRES_AVAILABLE:
            print("[WARNING] PostgreSQL not available, async operations disabled", file=sys.stderr)
            return False
        
        try:
            # Create connection pool
            if self.database_url:
                self.async_pool = await asyncpg.create_pool(
                    self.database_url,
                    min_size=self.min_connections,
                    max_size=self.max_connections,
                    command_timeout=self.connection_timeout
                )
            else:
                self.async_pool = await asyncpg.create_pool(
                    host=self.host,
                    port=self.port,
                    database=self.database,
                    user=self.username,
                    password=self.password,
                    min_size=self.min_connections,
                    max_size=self.max_connections,
                    command_timeout=self.connection_timeout
                )
            
            self.enabled = True
            print(f"[INFO] Async connection pool created: {self.min_connections}-{self.max_connections} connections", file=sys.stderr)
            return True
            
        except Exception as e:
            print(f"[ERROR] Failed to create async pool: {e}", file=sys.stderr)
            return False
    
    def initialize_sync_connection(self):
        """Initialize synchronous connection"""
        
        if not POSTGRES_AVAILABLE:
            print("[WARNING] PostgreSQL not available, sync operations disabled", file=sys.stderr)
            return False
        
        try:
            if self.database_url:
                self.sync_connection = psycopg2.connect(self.database_url)
            else:
                self.sync_connection = psycopg2.connect(
                    host=self.host,
                    port=self.port,
                    database=self.database,
                    user=self.username,
                    password=self.password
                )
            
            # Set autocommit to False for transaction control
            self.sync_connection.autocommit = False
            
            self.enabled = True
            print(f"[INFO] Sync connection established", file=sys.stderr)
            return True
            
        except Exception as e:
            print(f"[ERROR] Failed to create sync connection: {e}", file=sys.stderr)
            return False
    
    async def bulk_insert_products(self, products: List[Dict[str, Any]], 
                                 table_name: str = "Product",
                                 batch_size: Optional[int] = None,
                                 on_conflict: str = "ignore") -> Dict[str, Any]:
        """
        Bulk insert products with conflict resolution
        
        Args:
            products: List of product dictionaries
            table_name: Target table name
            batch_size: Batch size for processing
            on_conflict: 'ignore', 'update', or 'error'
        """
        start_time = time.time()
        batch_size = batch_size or self.default_batch_size
        
        if not self.async_pool:
            await self.initialize_async_pool()
        
        if not self.enabled:
            return self._create_error_result("Database not available")
        
        print(f"[INFO] Starting bulk insert: {len(products)} products to {table_name}", file=sys.stderr)
        
        result = {
            "success": False,
            "inserted": 0,
            "updated": 0,
            "errors": 0,
            "skipped": 0,
            "batches_processed": 0,
            "processing_time_ms": 0,
            "error_details": [],
            "metadata": {
                "table": table_name,
                "batch_size": batch_size,
                "conflict_strategy": on_conflict,
                "total_products": len(products)
            }
        }
        
        try:
            # Process in batches
            batches = self._create_batches(products, batch_size)
            
            for batch_idx, batch in enumerate(batches):
                batch_result = await self._process_product_batch_async(
                    batch, table_name, batch_idx, on_conflict
                )
                
                # Aggregate results
                result["inserted"] += batch_result.get("inserted", 0)
                result["updated"] += batch_result.get("updated", 0)
                result["errors"] += batch_result.get("errors", 0)
                result["skipped"] += batch_result.get("skipped", 0)
                result["batches_processed"] += 1
                
                if batch_result.get("error_details"):
                    result["error_details"].extend(batch_result["error_details"])
                
                # Progress logging
                if batch_idx % 10 == 0:
                    progress = (batch_idx + 1) / len(batches) * 100
                    print(f"[INFO] Batch progress: {progress:.1f}% ({batch_idx + 1}/{len(batches)})", file=sys.stderr)
            
            result["success"] = result["errors"] == 0 or result["inserted"] > 0
            
            # Update statistics
            self.stats['operations'] += 1
            self.stats['records_processed'] += len(products)
            self.stats['batches_executed'] += len(batches)
            
            print(f"[INFO] Bulk insert completed: {result['inserted']} inserted, "
                  f"{result['updated']} updated, {result['errors']} errors", file=sys.stderr)
            
        except Exception as e:
            result["success"] = False
            result["error_details"].append(str(e))
            self.stats['errors'] += 1
            print(f"[ERROR] Bulk insert failed: {e}", file=sys.stderr)
        
        finally:
            result["processing_time_ms"] = int((time.time() - start_time) * 1000)
            self.stats['total_time_ms'] += result["processing_time_ms"]
        
        return result
    
    async def _process_product_batch_async(self, batch: List[Dict[str, Any]], 
                                         table_name: str, batch_idx: int,
                                         on_conflict: str) -> Dict[str, Any]:
        """Process a single batch of products asynchronously"""
        
        result = {
            "inserted": 0,
            "updated": 0,
            "errors": 0,
            "skipped": 0,
            "error_details": []
        }
        
        async with self.async_pool.acquire() as connection:
            try:
                async with connection.transaction():
                    # Prepare product data
                    prepared_data = self._prepare_product_data(batch)
                    
                    if on_conflict == "ignore":
                        result = await self._batch_insert_ignore(connection, table_name, prepared_data)
                    elif on_conflict == "update":
                        result = await self._batch_upsert(connection, table_name, prepared_data)
                    else:  # error
                        result = await self._batch_insert_strict(connection, table_name, prepared_data)
                
                print(f"[INFO] Batch {batch_idx} completed: {result['inserted']} inserted", file=sys.stderr)
                
            except Exception as e:
                result["errors"] = len(batch)
                result["error_details"].append(f"Batch {batch_idx}: {str(e)}")
                print(f"[ERROR] Batch {batch_idx} failed: {e}", file=sys.stderr)
        
        return result
    
    def _prepare_product_data(self, products: List[Dict[str, Any]]) -> List[Tuple]:
        """Prepare product data for database insertion"""
        
        prepared_data = []
        
        for product in products:
            # Extract required fields with defaults
            name = product.get('name', '').strip()
            unit = product.get('unit', '').strip()
            price = product.get('price', 0.0)
            currency = product.get('currency', 'IDR')
            category = product.get('category', 'General')
            supplier = product.get('supplier', '').strip()
            description = product.get('description', '').strip()
            
            # Convert price to float
            try:
                if isinstance(price, str):
                    price = float(price.replace(',', '').replace(' ', ''))
                price = float(price) if price else 0.0
            except (ValueError, TypeError):
                price = 0.0
            
            # Validate required fields
            if not name:
                continue  # Skip products without names
            
            # Additional fields
            brand = product.get('brand', '').strip()
            sku = product.get('sku', '').strip()
            confidence = product.get('confidence', 0.8)
            
            # Metadata
            source_file = product.get('source_file', '')
            created_at = datetime.utcnow()
            
            prepared_data.append((
                name, unit, price, currency, category, supplier, 
                description, brand, sku, confidence, source_file, created_at
            ))
        
        return prepared_data
    
    async def _batch_insert_ignore(self, connection, table_name: str, 
                                 data: List[Tuple]) -> Dict[str, Any]:
        """Batch insert with conflict ignore"""
        
        if not data:
            return {"inserted": 0, "updated": 0, "errors": 0, "skipped": 0}
        
        insert_sql = f"""
            INSERT INTO "{table_name}" (
                name, unit, price, currency, category, supplier,
                description, brand, sku, confidence, "sourceFile", "createdAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (name, supplier) DO NOTHING
        """
        
        try:
            # Use executemany for bulk insert
            inserted_count = await connection.executemany(insert_sql, data)
            
            return {
                "inserted": len(data),  # Approximate, as we can't easily count actual inserts with DO NOTHING
                "updated": 0,
                "errors": 0,
                "skipped": 0
            }
            
        except Exception as e:
            return {
                "inserted": 0,
                "updated": 0,
                "errors": len(data),
                "skipped": 0,
                "error_details": [str(e)]
            }
    
    async def _batch_upsert(self, connection, table_name: str, 
                          data: List[Tuple]) -> Dict[str, Any]:
        """Batch upsert (insert or update on conflict)"""
        
        if not data:
            return {"inserted": 0, "updated": 0, "errors": 0, "skipped": 0}
        
        upsert_sql = f"""
            INSERT INTO "{table_name}" (
                name, unit, price, currency, category, supplier,
                description, brand, sku, confidence, "sourceFile", "createdAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (name, supplier) DO UPDATE SET
                unit = EXCLUDED.unit,
                price = EXCLUDED.price,
                currency = EXCLUDED.currency,
                category = EXCLUDED.category,
                description = EXCLUDED.description,
                brand = EXCLUDED.brand,
                sku = EXCLUDED.sku,
                confidence = EXCLUDED.confidence,
                "sourceFile" = EXCLUDED."sourceFile",
                "updatedAt" = NOW()
        """
        
        try:
            result = await connection.executemany(upsert_sql, data)
            
            return {
                "inserted": len(data),  # Mix of inserts and updates
                "updated": 0,  # Can't easily distinguish without additional queries
                "errors": 0,
                "skipped": 0
            }
            
        except Exception as e:
            return {
                "inserted": 0,
                "updated": 0,
                "errors": len(data),
                "skipped": 0,
                "error_details": [str(e)]
            }
    
    async def _batch_insert_strict(self, connection, table_name: str, 
                                 data: List[Tuple]) -> Dict[str, Any]:
        """Batch insert with strict error handling"""
        
        if not data:
            return {"inserted": 0, "updated": 0, "errors": 0, "skipped": 0}
        
        insert_sql = f"""
            INSERT INTO "{table_name}" (
                name, unit, price, currency, category, supplier,
                description, brand, sku, confidence, "sourceFile", "createdAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        """
        
        inserted = 0
        errors = 0
        error_details = []
        
        # Insert one by one for better error handling
        for row in data:
            try:
                await connection.execute(insert_sql, *row)
                inserted += 1
            except Exception as e:
                errors += 1
                error_details.append(f"Row error: {str(e)}")
        
        return {
            "inserted": inserted,
            "updated": 0,
            "errors": errors,
            "skipped": 0,
            "error_details": error_details
        }
    
    def bulk_insert_products_sync(self, products: List[Dict[str, Any]], 
                                table_name: str = "Product",
                                batch_size: Optional[int] = None,
                                on_conflict: str = "ignore") -> Dict[str, Any]:
        """Synchronous version of bulk insert"""
        
        if not self.sync_connection:
            self.initialize_sync_connection()
        
        if not self.enabled:
            return self._create_error_result("Database not available")
        
        start_time = time.time()
        batch_size = batch_size or self.default_batch_size
        
        print(f"[INFO] Starting sync bulk insert: {len(products)} products", file=sys.stderr)
        
        result = {
            "success": False,
            "inserted": 0,
            "updated": 0,
            "errors": 0,
            "skipped": 0,
            "processing_time_ms": 0,
            "error_details": []
        }
        
        try:
            cursor = self.sync_connection.cursor()
            
            # Prepare data
            prepared_data = self._prepare_product_data(products)
            
            if on_conflict == "ignore":
                insert_sql = f"""
                    INSERT INTO "{table_name}" (
                        name, unit, price, currency, category, supplier,
                        description, brand, sku, confidence, "sourceFile", "createdAt"
                    ) VALUES %s
                    ON CONFLICT (name, supplier) DO NOTHING
                """
                
                # Use execute_values for better performance
                execute_values(
                    cursor, insert_sql, prepared_data,
                    template=None, page_size=batch_size
                )
                
            elif on_conflict == "update":
                # Use execute_batch for upsert operations
                upsert_sql = f"""
                    INSERT INTO "{table_name}" (
                        name, unit, price, currency, category, supplier,
                        description, brand, sku, confidence, "sourceFile", "createdAt"
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (name, supplier) DO UPDATE SET
                        unit = EXCLUDED.unit,
                        price = EXCLUDED.price,
                        currency = EXCLUDED.currency,
                        category = EXCLUDED.category,
                        description = EXCLUDED.description,
                        brand = EXCLUDED.brand,
                        sku = EXCLUDED.sku,
                        confidence = EXCLUDED.confidence,
                        "sourceFile" = EXCLUDED."sourceFile",
                        "updatedAt" = NOW()
                """
                
                execute_batch(cursor, upsert_sql, prepared_data, page_size=batch_size)
            
            # Commit transaction
            self.sync_connection.commit()
            
            result["success"] = True
            result["inserted"] = len(prepared_data)
            
            print(f"[INFO] Sync bulk insert completed: {result['inserted']} records", file=sys.stderr)
            
        except Exception as e:
            self.sync_connection.rollback()
            result["success"] = False
            result["errors"] = len(products)
            result["error_details"].append(str(e))
            print(f"[ERROR] Sync bulk insert failed: {e}", file=sys.stderr)
        
        finally:
            result["processing_time_ms"] = int((time.time() - start_time) * 1000)
        
        return result
    
    async def bulk_update_products(self, products: List[Dict[str, Any]], 
                                 table_name: str = "Product",
                                 update_fields: Optional[List[str]] = None,
                                 batch_size: Optional[int] = None) -> Dict[str, Any]:
        """Bulk update products"""
        
        start_time = time.time()
        batch_size = batch_size or self.default_batch_size
        update_fields = update_fields or ['price', 'unit', 'category', 'confidence', 'updatedAt']
        
        if not self.async_pool:
            await self.initialize_async_pool()
        
        if not self.enabled:
            return self._create_error_result("Database not available")
        
        print(f"[INFO] Starting bulk update: {len(products)} products", file=sys.stderr)
        
        result = {
            "success": False,
            "updated": 0,
            "errors": 0,
            "not_found": 0,
            "processing_time_ms": 0,
            "error_details": []
        }
        
        try:
            # Process in batches
            batches = self._create_batches(products, batch_size)
            
            for batch_idx, batch in enumerate(batches):
                batch_result = await self._process_update_batch_async(
                    batch, table_name, update_fields, batch_idx
                )
                
                result["updated"] += batch_result.get("updated", 0)
                result["errors"] += batch_result.get("errors", 0)
                result["not_found"] += batch_result.get("not_found", 0)
                
                if batch_result.get("error_details"):
                    result["error_details"].extend(batch_result["error_details"])
            
            result["success"] = result["errors"] == 0
            
            print(f"[INFO] Bulk update completed: {result['updated']} updated, "
                  f"{result['errors']} errors", file=sys.stderr)
            
        except Exception as e:
            result["success"] = False
            result["error_details"].append(str(e))
            print(f"[ERROR] Bulk update failed: {e}", file=sys.stderr)
        
        finally:
            result["processing_time_ms"] = int((time.time() - start_time) * 1000)
        
        return result
    
    async def _process_update_batch_async(self, batch: List[Dict[str, Any]], 
                                        table_name: str, update_fields: List[str],
                                        batch_idx: int) -> Dict[str, Any]:
        """Process a single batch of updates asynchronously"""
        
        result = {
            "updated": 0,
            "errors": 0,
            "not_found": 0,
            "error_details": []
        }
        
        async with self.async_pool.acquire() as connection:
            try:
                async with connection.transaction():
                    for product in batch:
                        try:
                            # Build update query
                            set_clauses = []
                            values = []
                            param_count = 1
                            
                            for field in update_fields:
                                if field in product and field not in ['id', 'name', 'supplier']:
                                    if field == 'updatedAt':
                                        set_clauses.append(f'"{field}" = NOW()')
                                    else:
                                        set_clauses.append(f'"{field}" = ${param_count}')
                                        values.append(product[field])
                                        param_count += 1
                            
                            if not set_clauses:
                                continue
                            
                            # Add WHERE conditions
                            where_conditions = []
                            if 'id' in product:
                                where_conditions.append(f'id = ${param_count}')
                                values.append(product['id'])
                                param_count += 1
                            elif 'name' in product and 'supplier' in product:
                                where_conditions.append(f'name = ${param_count}')
                                values.append(product['name'])
                                param_count += 1
                                where_conditions.append(f'supplier = ${param_count}')
                                values.append(product['supplier'])
                                param_count += 1
                            else:
                                result["errors"] += 1
                                continue
                            
                            update_sql = f"""
                                UPDATE "{table_name}"
                                SET {', '.join(set_clauses)}
                                WHERE {' AND '.join(where_conditions)}
                            """
                            
                            affected_rows = await connection.execute(update_sql, *values)
                            
                            if 'UPDATE 1' in affected_rows:
                                result["updated"] += 1
                            else:
                                result["not_found"] += 1
                                
                        except Exception as e:
                            result["errors"] += 1
                            result["error_details"].append(f"Product update error: {str(e)}")
                
            except Exception as e:
                result["errors"] = len(batch)
                result["error_details"].append(f"Batch {batch_idx}: {str(e)}")
        
        return result
    
    async def bulk_delete_products(self, identifiers: List[Union[int, Dict[str, Any]]], 
                                 table_name: str = "Product",
                                 batch_size: Optional[int] = None) -> Dict[str, Any]:
        """Bulk delete products by IDs or other identifiers"""
        
        start_time = time.time()
        batch_size = batch_size or self.default_batch_size
        
        if not self.async_pool:
            await self.initialize_async_pool()
        
        if not self.enabled:
            return self._create_error_result("Database not available")
        
        print(f"[INFO] Starting bulk delete: {len(identifiers)} products", file=sys.stderr)
        
        result = {
            "success": False,
            "deleted": 0,
            "errors": 0,
            "not_found": 0,
            "processing_time_ms": 0,
            "error_details": []
        }
        
        try:
            # Process in batches
            batches = self._create_batches(identifiers, batch_size)
            
            for batch_idx, batch in enumerate(batches):
                batch_result = await self._process_delete_batch_async(
                    batch, table_name, batch_idx
                )
                
                result["deleted"] += batch_result.get("deleted", 0)
                result["errors"] += batch_result.get("errors", 0)
                result["not_found"] += batch_result.get("not_found", 0)
                
                if batch_result.get("error_details"):
                    result["error_details"].extend(batch_result["error_details"])
            
            result["success"] = result["errors"] == 0
            
            print(f"[INFO] Bulk delete completed: {result['deleted']} deleted, "
                  f"{result['errors']} errors", file=sys.stderr)
            
        except Exception as e:
            result["success"] = False
            result["error_details"].append(str(e))
            print(f"[ERROR] Bulk delete failed: {e}", file=sys.stderr)
        
        finally:
            result["processing_time_ms"] = int((time.time() - start_time) * 1000)
        
        return result
    
    async def _process_delete_batch_async(self, batch: List[Union[int, Dict[str, Any]]], 
                                        table_name: str, batch_idx: int) -> Dict[str, Any]:
        """Process a single batch of deletes asynchronously"""
        
        result = {
            "deleted": 0,
            "errors": 0,
            "not_found": 0,
            "error_details": []
        }
        
        async with self.async_pool.acquire() as connection:
            try:
                async with connection.transaction():
                    # Separate IDs and complex identifiers
                    ids = []
                    complex_deletes = []
                    
                    for identifier in batch:
                        if isinstance(identifier, int):
                            ids.append(identifier)
                        elif isinstance(identifier, dict):
                            complex_deletes.append(identifier)
                    
                    # Delete by IDs (more efficient)
                    if ids:
                        delete_sql = f'DELETE FROM "{table_name}" WHERE id = ANY($1)'
                        result_str = await connection.execute(delete_sql, ids)
                        deleted_count = int(result_str.split()[-1]) if result_str.startswith('DELETE') else 0
                        result["deleted"] += deleted_count
                        result["not_found"] += len(ids) - deleted_count
                    
                    # Delete by complex identifiers
                    for item in complex_deletes:
                        try:
                            where_conditions = []
                            values = []
                            param_count = 1
                            
                            for key, value in item.items():
                                if key in ['name', 'supplier', 'id']:
                                    where_conditions.append(f'"{key}" = ${param_count}')
                                    values.append(value)
                                    param_count += 1
                            
                            if where_conditions:
                                delete_sql = f"""
                                    DELETE FROM "{table_name}"
                                    WHERE {' AND '.join(where_conditions)}
                                """
                                
                                result_str = await connection.execute(delete_sql, *values)
                                if 'DELETE 1' in result_str:
                                    result["deleted"] += 1
                                else:
                                    result["not_found"] += 1
                            
                        except Exception as e:
                            result["errors"] += 1
                            result["error_details"].append(f"Delete error: {str(e)}")
                
            except Exception as e:
                result["errors"] = len(batch)
                result["error_details"].append(f"Batch {batch_idx}: {str(e)}")
        
        return result
    
    def _create_batches(self, data: List[Any], batch_size: int) -> List[List[Any]]:
        """Create batches from data list"""
        
        batches = []
        for i in range(0, len(data), batch_size):
            batch = data[i:i + batch_size]
            batches.append(batch)
        
        return batches
    
    def _create_error_result(self, error_message: str) -> Dict[str, Any]:
        """Create error result structure"""
        
        return {
            "success": False,
            "inserted": 0,
            "updated": 0,
            "deleted": 0,
            "errors": 1,
            "processing_time_ms": 0,
            "error_details": [error_message]
        }
    
    async def get_database_stats(self) -> Dict[str, Any]:
        """Get database and service statistics"""
        
        stats = self.stats.copy()
        
        if self.async_pool:
            try:
                async with self.async_pool.acquire() as connection:
                    # Get table statistics
                    table_stats = await connection.fetch("""
                        SELECT 
                            schemaname,
                            tablename,
                            n_tup_ins as inserts,
                            n_tup_upd as updates,
                            n_tup_del as deletes,
                            n_live_tup as live_rows,
                            n_dead_tup as dead_rows
                        FROM pg_stat_user_tables
                        WHERE tablename IN ('Product', 'User', 'Upload')
                        ORDER BY tablename
                    """)
                    
                    # Get connection pool stats
                    pool_stats = {
                        "size": self.async_pool.get_size(),
                        "min_size": self.async_pool.get_min_size(),
                        "max_size": self.async_pool.get_max_size(),
                        "idle_connections": self.async_pool.get_idle_size()
                    }
                    
                    stats.update({
                        "database_connected": True,
                        "table_statistics": [dict(row) for row in table_stats],
                        "connection_pool": pool_stats
                    })
                    
            except Exception as e:
                stats.update({
                    "database_connected": False,
                    "error": str(e)
                })
        else:
            stats.update({
                "database_connected": False,
                "error": "No connection pool available"
            })
        
        # Calculate averages
        if stats['batches_executed'] > 0:
            stats['avg_batch_time_ms'] = stats['total_time_ms'] / stats['batches_executed']
        
        return stats
    
    async def optimize_tables(self, table_names: Optional[List[str]] = None) -> Dict[str, Any]:
        """Optimize database tables (VACUUM, ANALYZE)"""
        
        table_names = table_names or ['Product', 'User', 'Upload']
        
        if not self.async_pool:
            await self.initialize_async_pool()
        
        if not self.enabled:
            return self._create_error_result("Database not available")
        
        result = {
            "success": False,
            "tables_optimized": 0,
            "errors": 0,
            "error_details": [],
            "optimization_details": {}
        }
        
        async with self.async_pool.acquire() as connection:
            try:
                for table_name in table_names:
                    try:
                        print(f"[INFO] Optimizing table: {table_name}", file=sys.stderr)
                        
                        # VACUUM and ANALYZE
                        await connection.execute(f'VACUUM ANALYZE "{table_name}"')
                        
                        # Get table size info
                        size_info = await connection.fetchrow(f"""
                            SELECT 
                                pg_size_pretty(pg_total_relation_size('"{table_name}"')) as total_size,
                                pg_size_pretty(pg_relation_size('"{table_name}"')) as table_size,
                                pg_size_pretty(pg_indexes_size('"{table_name}"')) as index_size
                        """)
                        
                        result["optimization_details"][table_name] = dict(size_info)
                        result["tables_optimized"] += 1
                        
                    except Exception as e:
                        result["errors"] += 1
                        result["error_details"].append(f"Table {table_name}: {str(e)}")
                
                result["success"] = result["errors"] == 0
                
            except Exception as e:
                result["success"] = False
                result["error_details"].append(str(e))
        
        return result
    
    async def close_connections(self):
        """Close all database connections"""
        
        try:
            if self.async_pool:
                await self.async_pool.close()
                print("[INFO] Async connection pool closed", file=sys.stderr)
            
            if self.sync_connection:
                self.sync_connection.close()
                print("[INFO] Sync connection closed", file=sys.stderr)
                
        except Exception as e:
            print(f"[WARNING] Error closing connections: {e}", file=sys.stderr)


async def main():
    """CLI interface for batch database operations"""
    
    if len(sys.argv) < 2:
        print("Usage: python batch_database_service.py <command> [args]", file=sys.stderr)
        print("Commands:", file=sys.stderr)
        print("  stats              - Show database statistics", file=sys.stderr)
        print("  optimize [tables]  - Optimize database tables", file=sys.stderr)
        print("  test               - Test batch operations", file=sys.stderr)
        print("  api <json>         - API mode for TypeScript integration", file=sys.stderr)
        sys.exit(1)
    
    command = sys.argv[1]
    
    # Configuration from environment
    config = {
        'database_url': os.getenv('DATABASE_URL'),
        'default_batch_size': int(os.getenv('BATCH_SIZE', '1000')),
        'max_connections': int(os.getenv('MAX_DB_CONNECTIONS', '20'))
    }
    
    db_service = BatchDatabaseService(config)
    
    try:
        if command == 'stats':
            await db_service.initialize_async_pool()
            stats = await db_service.get_database_stats()
            print(json.dumps(stats, indent=2, default=str))
            
        elif command == 'optimize':
            table_names = sys.argv[2:] if len(sys.argv) > 2 else None
            await db_service.initialize_async_pool()
            result = await db_service.optimize_tables(table_names)
            print(f"Optimization completed: {json.dumps(result, indent=2, default=str)}")
            
        elif command == 'test':
            # Basic test with mock data
            await db_service.initialize_async_pool()
            
            test_products = [
                {
                    "name": f"Test Product {i}",
                    "unit": "kg",
                    "price": 1000 + i * 100,
                    "currency": "IDR",
                    "category": "Test",
                    "supplier": "Test Supplier",
                    "confidence": 0.9
                }
                for i in range(10)
            ]
            
            # Test insert
            print("Testing bulk insert...")
            result = await db_service.bulk_insert_products(test_products, on_conflict="ignore")
            print(f"Insert result: {json.dumps(result, indent=2, default=str)}")
            
            # Get stats
            stats = await db_service.get_database_stats()
            print(f"Final stats: {json.dumps(stats, indent=2, default=str)}")
            
        elif command == 'api':
            # API mode for TypeScript integration
            if len(sys.argv) < 3:
                print("Error: API mode requires command data", file=sys.stderr)
                sys.exit(1)
            
            try:
                command_data = json.loads(sys.argv[2])
                api_command = command_data.get('command')
                params = command_data.get('params', {})
                
                result = {'success': False, 'data': None, 'error': None}
                
                if api_command == 'bulk_insert_async':
                    await db_service.initialize_async_pool()
                    data = await db_service.bulk_insert_products(
                        params.get('products', []),
                        params.get('table_name', 'Product'),
                        params.get('batch_size'),
                        params.get('on_conflict', 'ignore')
                    )
                    result = {'success': data['success'], 'data': data}
                    
                elif api_command == 'bulk_insert_sync':
                    db_service.initialize_sync_connection()
                    data = db_service.bulk_insert_products_sync(
                        params.get('products', []),
                        params.get('table_name', 'Product'),
                        params.get('batch_size'),
                        params.get('on_conflict', 'ignore')
                    )
                    result = {'success': data['success'], 'data': data}
                    
                elif api_command == 'bulk_update':
                    await db_service.initialize_async_pool()
                    data = await db_service.bulk_update_products(
                        params.get('products', []),
                        params.get('table_name', 'Product'),
                        params.get('update_fields'),
                        params.get('batch_size')
                    )
                    result = {'success': data['success'], 'data': data}
                    
                elif api_command == 'bulk_delete':
                    await db_service.initialize_async_pool()
                    data = await db_service.bulk_delete_products(
                        params.get('identifiers', []),
                        params.get('table_name', 'Product'),
                        params.get('batch_size')
                    )
                    result = {'success': data['success'], 'data': data}
                    
                elif api_command == 'get_stats':
                    await db_service.initialize_async_pool()
                    stats = await db_service.get_database_stats()
                    result = {'success': True, 'data': stats}
                    
                elif api_command == 'optimize_tables':
                    await db_service.initialize_async_pool()
                    data = await db_service.optimize_tables(params.get('table_names'))
                    result = {'success': data['success'], 'data': data}
                    
                else:
                    result = {'success': False, 'error': f'Unknown API command: {api_command}'}
                
                print(f"BATCH_DB_RESULT:{json.dumps(result, default=str)}")
                
            except Exception as e:
                error_result = {'success': False, 'error': str(e)}
                print(f"BATCH_DB_RESULT:{json.dumps(error_result)}")
                sys.exit(1)
            
        else:
            print(f"Unknown command: {command}", file=sys.stderr)
            sys.exit(1)
            
    except Exception as e:
        print(f"[ERROR] Command failed: {e}", file=sys.stderr)
        sys.exit(1)
    
    finally:
        await db_service.close_connections()


if __name__ == "__main__":
    asyncio.run(main())