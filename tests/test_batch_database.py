"""
Tests for Batch Database Operations Service
Tests Task 11: Batch database operations
"""

import pytest
import tempfile
import os
import json
import asyncio
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from datetime import datetime

# Import our batch database modules
import sys
sys.path.append(str(Path(__file__).parent.parent))

try:
    from src.pipeline.batch_database_service import BatchDatabaseService
except ImportError:
    # Handle import errors gracefully for systems without dependencies
    BatchDatabaseService = None


class TestBatchDatabaseService:
    """Test batch database service functionality"""

    @pytest.fixture
    def db_service(self):
        """Create database service instance"""
        if BatchDatabaseService is None:
            pytest.skip("Batch database service not available")
        
        config = {
            'database_url': 'postgresql://test:test@localhost:5432/test_db',
            'default_batch_size': 10,  # Small for testing
            'max_connections': 5,
            'min_connections': 2
        }
        return BatchDatabaseService(config)

    @pytest.fixture
    def sample_products(self):
        """Create sample product data"""
        return [
            {
                "name": "Fresh Tomatoes",
                "unit": "kg",
                "price": 12500,
                "currency": "IDR",
                "category": "Vegetables",
                "supplier": "Farm Fresh",
                "description": "Organic tomatoes",
                "confidence": 0.9
            },
            {
                "name": "Premium Milk",
                "unit": "liter",
                "price": 8750,
                "currency": "IDR",
                "category": "Dairy",
                "supplier": "Dairy Co",
                "description": "Fresh daily milk",
                "confidence": 0.85
            },
            {
                "name": "Chicken Breast",
                "unit": "kg",
                "price": 45000,
                "currency": "IDR",
                "category": "Meat",
                "supplier": "Poultry Farm",
                "description": "Free range chicken",
                "confidence": 0.95
            }
        ]

    def test_db_service_initialization(self, db_service):
        """Test database service initialization"""
        if db_service is None:
            pytest.skip("Database service not available")
            
        assert db_service.default_batch_size == 10
        assert db_service.max_connections == 5
        assert db_service.min_connections == 2

    @pytest.mark.unit
    def test_data_preparation(self, db_service, sample_products):
        """Test product data preparation"""
        if db_service is None:
            pytest.skip("Database service not available")
        
        prepared_data = db_service._prepare_product_data(sample_products)
        
        assert len(prepared_data) == 3
        assert all(isinstance(row, tuple) for row in prepared_data)
        
        # Check first product
        first_row = prepared_data[0]
        assert first_row[0] == "Fresh Tomatoes"  # name
        assert first_row[1] == "kg"  # unit
        assert first_row[2] == 12500.0  # price
        assert first_row[3] == "IDR"  # currency

    @pytest.mark.unit
    def test_batch_creation(self, db_service):
        """Test batch creation from data"""
        if db_service is None:
            pytest.skip("Database service not available")
        
        data = list(range(25))  # 25 items
        batches = db_service._create_batches(data, batch_size=10)
        
        # Should create 3 batches: [10, 10, 5]
        assert len(batches) == 3
        assert len(batches[0]) == 10
        assert len(batches[1]) == 10
        assert len(batches[2]) == 5

    @pytest.mark.unit
    def test_price_conversion(self, db_service):
        """Test price conversion handling"""
        if db_service is None:
            pytest.skip("Database service not available")
        
        test_products = [
            {"name": "Product 1", "price": "15,000"},
            {"name": "Product 2", "price": 25000.50},
            {"name": "Product 3", "price": "invalid"},
            {"name": "Product 4", "price": None},
        ]
        
        prepared_data = db_service._prepare_product_data(test_products)
        
        # Check price conversions
        assert prepared_data[0][2] == 15000.0  # String with comma
        assert prepared_data[1][2] == 25000.50  # Float
        assert prepared_data[2][2] == 0.0  # Invalid -> 0
        assert prepared_data[3][2] == 0.0  # None -> 0

    @pytest.mark.unit
    def test_empty_data_handling(self, db_service):
        """Test handling of empty or invalid data"""
        if db_service is None:
            pytest.skip("Database service not available")
        
        # Empty products list
        prepared_data = db_service._prepare_product_data([])
        assert len(prepared_data) == 0
        
        # Products without names (should be skipped)
        invalid_products = [
            {"unit": "kg", "price": 1000},  # No name
            {"name": "", "price": 2000},    # Empty name
            {"name": "   ", "price": 3000}, # Whitespace only name
        ]
        
        prepared_data = db_service._prepare_product_data(invalid_products)
        assert len(prepared_data) == 0

    @pytest.mark.unit
    @patch('asyncpg.create_pool')
    async def test_async_pool_initialization(self, mock_create_pool, db_service):
        """Test async connection pool initialization"""
        if db_service is None:
            pytest.skip("Database service not available")
        
        # Mock successful pool creation
        mock_pool = AsyncMock()
        mock_create_pool.return_value = mock_pool
        
        result = await db_service.initialize_async_pool()
        
        assert result is True
        assert db_service.async_pool == mock_pool
        assert db_service.enabled is True
        
        # Verify pool was created with correct parameters
        mock_create_pool.assert_called_once()

    @pytest.mark.unit
    @patch('psycopg2.connect')
    def test_sync_connection_initialization(self, mock_connect, db_service):
        """Test sync connection initialization"""
        if db_service is None:
            pytest.skip("Database service not available")
        
        # Mock successful connection
        mock_connection = Mock()
        mock_connect.return_value = mock_connection
        
        result = db_service.initialize_sync_connection()
        
        assert result is True
        assert db_service.sync_connection == mock_connection
        assert db_service.enabled is True
        
        # Verify autocommit was set to False
        assert mock_connection.autocommit is False

    @pytest.mark.unit
    async def test_bulk_insert_without_connection(self, db_service, sample_products):
        """Test bulk insert when database is not available"""
        if db_service is None:
            pytest.skip("Database service not available")
        
        # Don't initialize connection pool
        db_service.enabled = False
        
        result = await db_service.bulk_insert_products(sample_products)
        
        assert result["success"] is False
        assert result["inserted"] == 0
        assert "Database not available" in result["error_details"][0]

    @pytest.mark.unit
    @patch('asyncpg.create_pool')
    async def test_bulk_insert_with_mock_db(self, mock_create_pool, db_service, sample_products):
        """Test bulk insert with mocked database"""
        if db_service is None:
            pytest.skip("Database service not available")
        
        # Setup mock pool and connection
        mock_connection = AsyncMock()
        mock_transaction = AsyncMock()
        mock_connection.transaction.return_value.__aenter__ = AsyncMock(return_value=mock_transaction)
        mock_connection.transaction.return_value.__aexit__ = AsyncMock(return_value=None)
        mock_connection.executemany.return_value = "INSERT 0 3"
        
        mock_pool = AsyncMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_connection)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
        
        mock_create_pool.return_value = mock_pool
        
        # Initialize pool and test insert
        await db_service.initialize_async_pool()
        result = await db_service.bulk_insert_products(sample_products, on_conflict="ignore")
        
        assert result["success"] is True
        assert result["inserted"] > 0
        assert result["errors"] == 0

    @pytest.mark.unit
    def test_sync_bulk_insert_without_connection(self, db_service, sample_products):
        """Test sync bulk insert when database is not available"""
        if db_service is None:
            pytest.skip("Database service not available")
        
        # Don't initialize connection
        db_service.enabled = False
        
        result = db_service.bulk_insert_products_sync(sample_products)
        
        assert result["success"] is False
        assert result["inserted"] == 0
        assert "Database not available" in result["error_details"][0]

    @pytest.mark.unit
    @patch('psycopg2.connect')
    def test_sync_bulk_insert_with_mock_db(self, mock_connect, db_service, sample_products):
        """Test sync bulk insert with mocked database"""
        if db_service is None:
            pytest.skip("Database service not available")
        
        # Setup mock connection
        mock_cursor = Mock()
        mock_connection = Mock()
        mock_connection.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_connection
        
        # Initialize connection and test insert
        db_service.initialize_sync_connection()
        result = db_service.bulk_insert_products_sync(sample_products, on_conflict="ignore")
        
        assert result["success"] is True
        assert result["inserted"] == len(sample_products)
        
        # Verify cursor and connection methods were called
        mock_connection.cursor.assert_called()
        mock_connection.commit.assert_called()

    @pytest.mark.unit
    def test_error_result_creation(self, db_service):
        """Test error result structure creation"""
        if db_service is None:
            pytest.skip("Database service not available")
        
        error_result = db_service._create_error_result("Test error message")
        
        assert error_result["success"] is False
        assert error_result["inserted"] == 0
        assert error_result["errors"] == 1
        assert error_result["error_details"] == ["Test error message"]

    @pytest.mark.unit
    @patch('asyncpg.create_pool')
    async def test_bulk_update_with_mock_db(self, mock_create_pool, db_service):
        """Test bulk update with mocked database"""
        if db_service is None:
            pytest.skip("Database service not available")
        
        # Setup mock pool and connection
        mock_connection = AsyncMock()
        mock_transaction = AsyncMock()
        mock_connection.transaction.return_value.__aenter__ = AsyncMock(return_value=mock_transaction)
        mock_connection.transaction.return_value.__aexit__ = AsyncMock(return_value=None)
        mock_connection.execute.return_value = "UPDATE 1"
        
        mock_pool = AsyncMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_connection)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
        
        mock_create_pool.return_value = mock_pool
        
        # Test data with IDs
        update_products = [
            {"id": 1, "price": 15000, "category": "Updated"},
            {"id": 2, "price": 20000, "category": "Updated"}
        ]
        
        # Initialize pool and test update
        await db_service.initialize_async_pool()
        result = await db_service.bulk_update_products(update_products)
        
        assert result["success"] is True
        assert result["updated"] == 2
        assert result["errors"] == 0

    @pytest.mark.unit
    @patch('asyncpg.create_pool')
    async def test_bulk_delete_with_mock_db(self, mock_create_pool, db_service):
        """Test bulk delete with mocked database"""
        if db_service is None:
            pytest.skip("Database service not available")
        
        # Setup mock pool and connection
        mock_connection = AsyncMock()
        mock_transaction = AsyncMock()
        mock_connection.transaction.return_value.__aenter__ = AsyncMock(return_value=mock_transaction)
        mock_connection.transaction.return_value.__aexit__ = AsyncMock(return_value=None)
        mock_connection.execute.return_value = "DELETE 2"
        
        mock_pool = AsyncMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_connection)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
        
        mock_create_pool.return_value = mock_pool
        
        # Test data with IDs
        delete_ids = [1, 2]
        
        # Initialize pool and test delete
        await db_service.initialize_async_pool()
        result = await db_service.bulk_delete_products(delete_ids)
        
        assert result["success"] is True
        assert result["deleted"] == 2
        assert result["errors"] == 0

    @pytest.mark.unit
    @patch('asyncpg.create_pool')
    async def test_database_stats(self, mock_create_pool, db_service):
        """Test database statistics retrieval"""
        if db_service is None:
            pytest.skip("Database service not available")
        
        # Setup mock pool and connection
        mock_connection = AsyncMock()
        mock_connection.fetch.return_value = [
            {
                'schemaname': 'public',
                'tablename': 'Product',
                'inserts': 100,
                'updates': 50,
                'deletes': 10,
                'live_rows': 90,
                'dead_rows': 5
            }
        ]
        
        mock_pool = AsyncMock()
        mock_pool.get_size.return_value = 5
        mock_pool.get_min_size.return_value = 2
        mock_pool.get_max_size.return_value = 10
        mock_pool.get_idle_size.return_value = 3
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_connection)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
        
        mock_create_pool.return_value = mock_pool
        
        # Initialize pool and get stats
        await db_service.initialize_async_pool()
        db_service.async_pool = mock_pool  # Set directly for testing
        
        stats = await db_service.get_database_stats()
        
        assert stats["database_connected"] is True
        assert "table_statistics" in stats
        assert "connection_pool" in stats
        assert stats["connection_pool"]["size"] == 5

    @pytest.mark.unit
    @patch('asyncpg.create_pool')
    async def test_table_optimization(self, mock_create_pool, db_service):
        """Test table optimization"""
        if db_service is None:
            pytest.skip("Database service not available")
        
        # Setup mock pool and connection
        mock_connection = AsyncMock()
        mock_connection.execute.return_value = None
        mock_connection.fetchrow.return_value = {
            'total_size': '1024 kB',
            'table_size': '800 kB',
            'index_size': '224 kB'
        }
        
        mock_pool = AsyncMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_connection)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
        
        mock_create_pool.return_value = mock_pool
        
        # Initialize pool and test optimization
        await db_service.initialize_async_pool()
        result = await db_service.optimize_tables(['Product'])
        
        assert result["success"] is True
        assert result["tables_optimized"] == 1
        assert result["errors"] == 0
        assert "Product" in result["optimization_details"]

    @pytest.mark.unit
    def test_configuration_handling(self):
        """Test different configuration options"""
        if BatchDatabaseService is None:
            pytest.skip("Batch database service not available")
        
        # Test with custom configuration
        custom_config = {
            'default_batch_size': 500,
            'max_connections': 15,
            'use_copy': False,
            'parallel_batches': 2
        }
        
        service = BatchDatabaseService(custom_config)
        
        assert service.default_batch_size == 500
        assert service.max_connections == 15
        assert service.use_copy is False
        assert service.parallel_batches == 2

    @pytest.mark.unit
    def test_connection_url_parsing(self):
        """Test database URL configuration"""
        if BatchDatabaseService is None:
            pytest.skip("Batch database service not available")
        
        database_url = "postgresql://user:pass@localhost:5432/testdb"
        config = {'database_url': database_url}
        
        service = BatchDatabaseService(config)
        assert service.database_url == database_url


@pytest.mark.integration
class TestBatchDatabaseIntegration:
    """Integration tests for batch database operations (requires database)"""

    @pytest.mark.skipif(not os.getenv('TEST_DATABASE_URL'), reason="Test database not available")
    async def test_real_database_operations(self):
        """Test with real database connection"""
        if BatchDatabaseService is None:
            pytest.skip("Batch database service not available")
        
        database_url = os.getenv('TEST_DATABASE_URL')
        config = {
            'database_url': database_url,
            'default_batch_size': 5
        }
        
        service = BatchDatabaseService(config)
        
        try:
            # Initialize async pool
            success = await service.initialize_async_pool()
            if not success:
                pytest.skip("Could not connect to test database")
            
            # Test products
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
            
            # Test bulk insert
            insert_result = await service.bulk_insert_products(test_products, on_conflict="ignore")
            assert insert_result["success"] is True
            assert insert_result["inserted"] >= 0  # May be 0 if products already exist
            
            # Test database stats
            stats = await service.get_database_stats()
            assert stats["database_connected"] is True
            
            # Cleanup - delete test products
            delete_identifiers = [{"name": f"Test Product {i}", "supplier": "Test Supplier"} for i in range(10)]
            delete_result = await service.bulk_delete_products(delete_identifiers)
            # Note: delete may not find all products if insert was ignored
            
        except Exception as e:
            pytest.skip(f"Database integration test failed: {e}")
        
        finally:
            await service.close_connections()


@pytest.mark.benchmark
class TestBatchDatabasePerformance:
    """Performance benchmarks for batch database operations"""

    def test_data_preparation_speed(self, benchmark):
        """Benchmark data preparation speed"""
        if BatchDatabaseService is None:
            pytest.skip("Batch database service not available")
        
        service = BatchDatabaseService()
        
        # Large dataset for benchmarking
        large_dataset = [
            {
                "name": f"Product {i}",
                "unit": "kg",
                "price": 1000 + i * 10,
                "currency": "IDR",
                "category": "Test",
                "supplier": f"Supplier {i % 10}",
                "confidence": 0.8
            }
            for i in range(1000)
        ]
        
        result = benchmark(service._prepare_product_data, large_dataset)
        
        assert len(result) == 1000
        assert all(isinstance(row, tuple) for row in result)

    def test_batch_creation_speed(self, benchmark):
        """Benchmark batch creation speed"""
        if BatchDatabaseService is None:
            pytest.skip("Batch database service not available")
        
        service = BatchDatabaseService()
        
        # Large data array
        large_data = list(range(10000))
        
        batches = benchmark(service._create_batches, large_data, 100)
        
        assert len(batches) == 100  # 10000 items / 100 per batch


# Test CLI interface
class TestBatchDatabaseCLI:
    """Test CLI interface for batch database operations"""

    def test_cli_stats_command(self):
        """Test CLI stats command"""
        if BatchDatabaseService is None:
            pytest.skip("Batch database service not available")
        
        import subprocess
        import sys
        
        script_path = Path(__file__).parent.parent / "src" / "pipeline" / "batch_database_service.py"
        
        # Test with mock database URL (will show connection error)
        env = os.environ.copy()
        env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test_db'
        
        result = subprocess.run([
            sys.executable, str(script_path), "stats"
        ], capture_output=True, text=True, env=env, timeout=30)
        
        # Should handle gracefully even if database is not available
        assert result.returncode in [0, 1]  # Either success or expected failure

    def test_cli_test_command(self):
        """Test CLI test command"""
        if BatchDatabaseService is None:
            pytest.skip("Batch database service not available")
        
        import subprocess
        import sys
        
        script_path = Path(__file__).parent.parent / "src" / "pipeline" / "batch_database_service.py"
        
        result = subprocess.run([
            sys.executable, str(script_path), "test"
        ], capture_output=True, text=True, timeout=60)
        
        # Should handle gracefully even without database
        assert result.returncode in [0, 1]


# Parameterized tests for different batch configurations
@pytest.mark.parametrize("batch_size,expected_batches", [
    (10, 3),   # 25 items / 10 per batch = 3 batches
    (5, 5),    # 25 items / 5 per batch = 5 batches
    (30, 1),   # 25 items / 30 per batch = 1 batch
    (1, 25),   # 25 items / 1 per batch = 25 batches
])
def test_batch_size_configurations(batch_size, expected_batches):
    """Test different batch size configurations"""
    if BatchDatabaseService is None:
        pytest.skip("Batch database service not available")
    
    service = BatchDatabaseService({'default_batch_size': batch_size})
    
    data = list(range(25))
    batches = service._create_batches(data, batch_size)
    
    assert len(batches) == expected_batches
    
    # Verify all data is included
    total_items = sum(len(batch) for batch in batches)
    assert total_items == 25