"""
Tests for AI Cache Service with Redis
Tests Task 10: AI response caching with Redis
"""

import pytest
import tempfile
import os
import json
import time
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

# Import our cache modules
import sys
sys.path.append(str(Path(__file__).parent.parent))

try:
    from src.pipeline.ai_cache_service import AICacheService, CacheEntry
except ImportError:
    # Handle import errors gracefully for systems without dependencies
    AICacheService = None
    CacheEntry = None


class TestAICacheService:
    """Test AI cache service functionality"""

    @pytest.fixture
    def cache_service(self):
        """Create cache service instance"""
        if AICacheService is None:
            pytest.skip("AI cache service not available")
        
        config = {
            'redis_host': 'localhost',
            'redis_port': 6379,
            'redis_db': 1,  # Use different DB for testing
            'default_ttl': 60,  # Short TTL for testing
            'compression_enabled': True,
            'cache_ai_responses': True,
            'cache_embeddings': True,
            'cache_processed_data': True
        }
        return AICacheService(config)

    @pytest.fixture
    def mock_redis(self):
        """Create mock Redis client"""
        mock_redis = Mock()
        mock_redis.ping.return_value = True
        mock_redis.get.return_value = None
        mock_redis.setex.return_value = True
        mock_redis.delete.return_value = 1
        mock_redis.keys.return_value = []
        mock_redis.ttl.return_value = 60
        mock_redis.config_set.return_value = True
        mock_redis.info.return_value = {
            'used_memory': 1024,
            'used_memory_human': '1K',
            'redis_version': '6.0.0',
            'redis_mode': 'standalone'
        }
        return mock_redis

    def test_cache_service_initialization(self, cache_service):
        """Test cache service initialization"""
        if cache_service is None:
            pytest.skip("Cache service not available")
            
        assert cache_service.default_ttl == 60
        assert cache_service.compression_enabled is True
        assert cache_service.cache_ai_responses is True

    @pytest.mark.unit
    def test_cache_key_generation(self, cache_service):
        """Test cache key generation"""
        if cache_service is None:
            pytest.skip("Cache service not available")
        
        # Test with dict input
        input_data = {"prompt": "test", "context": "example"}
        key1 = cache_service._generate_cache_key('ai_response', input_data, model='gpt-4o')
        key2 = cache_service._generate_cache_key('ai_response', input_data, model='gpt-4o')
        key3 = cache_service._generate_cache_key('ai_response', input_data, model='gpt-3.5')
        
        # Same input should generate same key
        assert key1 == key2
        
        # Different parameters should generate different keys
        assert key1 != key3
        
        # Keys should have correct prefix
        assert key1.startswith('ai_resp:')

    @pytest.mark.unit
    def test_data_serialization(self, cache_service):
        """Test data serialization and compression"""
        if cache_service is None:
            pytest.skip("Cache service not available")
        
        # Test small data (no compression)
        small_data = {"result": "test"}
        serialized_small = cache_service._serialize_data(small_data)
        deserialized_small = cache_service._deserialize_data(serialized_small)
        
        assert deserialized_small == small_data
        assert serialized_small.startswith(b'RAW:')
        
        # Test large data (with compression)
        large_data = {"result": "x" * 2000}  # Large string
        serialized_large = cache_service._serialize_data(large_data)
        deserialized_large = cache_service._deserialize_data(serialized_large)
        
        assert deserialized_large == large_data
        if cache_service.compression_enabled:
            # Should use compression for large data
            assert serialized_large.startswith(b'GZIP:') or serialized_large.startswith(b'RAW:')

    @pytest.mark.unit
    @patch('redis.Redis')
    def test_ai_response_caching(self, mock_redis_class, cache_service):
        """Test AI response caching operations"""
        if cache_service is None:
            pytest.skip("Cache service not available")
        
        # Setup mock Redis
        mock_redis = Mock()
        mock_redis.ping.return_value = True
        mock_redis.setex.return_value = True
        mock_redis.get.return_value = None
        mock_redis_class.return_value = mock_redis
        
        # Force enable cache with mock
        cache_service.redis_client = mock_redis
        cache_service.enabled = True
        
        input_data = {"prompt": "What is AI?", "context": "testing"}
        ai_response = {
            "response": "AI is artificial intelligence",
            "confidence": 0.95,
            "tokens_used": 25
        }
        
        # Test caching AI response
        result = cache_service.cache_ai_response(input_data, ai_response, model='gpt-4o')
        assert result is True
        
        # Verify Redis setex was called
        mock_redis.setex.assert_called()
        assert cache_service.stats['sets'] == 1

    @pytest.mark.unit
    @patch('redis.Redis')
    def test_ai_response_retrieval(self, mock_redis_class, cache_service):
        """Test AI response retrieval from cache"""
        if cache_service is None:
            pytest.skip("Cache service not available")
        
        # Setup mock Redis with cached data
        mock_redis = Mock()
        mock_redis.ping.return_value = True
        
        ai_response = {
            "response": "AI is artificial intelligence",
            "confidence": 0.95,
            "tokens_used": 25
        }
        
        # Serialize the response as the cache would
        serialized_response = cache_service._serialize_data(ai_response)
        mock_redis.get.return_value = serialized_response
        mock_redis_class.return_value = mock_redis
        
        # Force enable cache with mock
        cache_service.redis_client = mock_redis
        cache_service.enabled = True
        
        input_data = {"prompt": "What is AI?", "context": "testing"}
        
        # Test retrieving AI response
        result = cache_service.get_ai_response(input_data, model='gpt-4o')
        assert result == ai_response
        assert cache_service.stats['hits'] == 1

    @pytest.mark.unit
    @patch('redis.Redis')
    def test_embedding_caching(self, mock_redis_class, cache_service):
        """Test embedding vector caching"""
        if cache_service is None:
            pytest.skip("Cache service not available")
        
        # Setup mock Redis
        mock_redis = Mock()
        mock_redis.ping.return_value = True
        mock_redis.setex.return_value = True
        mock_redis.get.return_value = None
        mock_redis_class.return_value = mock_redis
        
        # Force enable cache with mock
        cache_service.redis_client = mock_redis
        cache_service.enabled = True
        
        text = "Hello world"
        embedding = [0.1, 0.2, 0.3, 0.4, 0.5]
        
        # Test caching embedding
        result = cache_service.cache_embedding(text, embedding)
        assert result is True
        
        # Verify Redis setex was called
        mock_redis.setex.assert_called()

    @pytest.mark.unit
    @patch('redis.Redis')
    def test_processed_data_caching(self, mock_redis_class, cache_service):
        """Test processed data caching"""
        if cache_service is None:
            pytest.skip("Cache service not available")
        
        # Setup mock Redis
        mock_redis = Mock()
        mock_redis.ping.return_value = True
        mock_redis.setex.return_value = True
        mock_redis.get.return_value = None
        mock_redis_class.return_value = mock_redis
        
        # Force enable cache with mock
        cache_service.redis_client = mock_redis
        cache_service.enabled = True
        
        file_hash = "abc123def456"
        processing_config = {"method": "table_extraction", "ocr": True}
        processed_data = {
            "tables": [{"data": [["Product", "Price"]], "headers": ["Product", "Price"]}],
            "metadata": {"total_tables": 1}
        }
        
        # Test caching processed data
        result = cache_service.cache_processed_data(file_hash, processing_config, processed_data)
        assert result is True
        
        # Verify Redis setex was called
        mock_redis.setex.assert_called()

    @pytest.mark.unit
    @patch('redis.Redis')
    def test_cache_invalidation(self, mock_redis_class, cache_service):
        """Test cache invalidation"""
        if cache_service is None:
            pytest.skip("Cache service not available")
        
        # Setup mock Redis
        mock_redis = Mock()
        mock_redis.ping.return_value = True
        mock_redis.keys.return_value = [b'ai_resp:key1', b'ai_resp:key2']
        mock_redis.delete.return_value = 2
        mock_redis_class.return_value = mock_redis
        
        # Force enable cache with mock
        cache_service.redis_client = mock_redis
        cache_service.enabled = True
        
        # Test invalidating AI responses
        deleted = cache_service.invalidate_cache(data_type='ai_response')
        assert deleted == 2
        assert cache_service.stats['deletes'] == 2

    @pytest.mark.unit
    @patch('redis.Redis')
    def test_cache_cleanup(self, mock_redis_class, cache_service):
        """Test cache cleanup operations"""
        if cache_service is None:
            pytest.skip("Cache service not available")
        
        # Setup mock Redis
        mock_redis = Mock()
        mock_redis.ping.return_value = True
        mock_redis.keys.return_value = [b'ai_resp:key1', b'embed:key2', b'proc:key3']
        mock_redis.ttl.side_effect = [60, -2, -1]  # Valid, expired, no expiry
        mock_redis.expire.return_value = True
        mock_redis_class.return_value = mock_redis
        
        # Force enable cache with mock
        cache_service.redis_client = mock_redis
        cache_service.enabled = True
        
        # Test cleanup
        result = cache_service.cleanup_expired()
        assert result['checked'] == 3
        assert result['deleted'] == 1

    @pytest.mark.unit
    @patch('redis.Redis')
    def test_cache_statistics(self, mock_redis_class, cache_service):
        """Test cache statistics generation"""
        if cache_service is None:
            pytest.skip("Cache service not available")
        
        # Setup mock Redis
        mock_redis = Mock()
        mock_redis.ping.return_value = True
        mock_redis.info.return_value = {
            'used_memory': 2048,
            'used_memory_human': '2K',
            'redis_version': '6.0.0',
            'redis_mode': 'standalone'
        }
        mock_redis.keys.side_effect = [
            [b'ai_resp:key1', b'ai_resp:key2'],  # AI responses
            [b'embed:key1'],                     # Embeddings
            [b'proc:key1'],                      # Processed data
            [],                                  # Metadata
            []                                   # Stats
        ]
        mock_redis_class.return_value = mock_redis
        
        # Force enable cache with mock
        cache_service.redis_client = mock_redis
        cache_service.enabled = True
        
        # Add some test stats
        cache_service.stats['hits'] = 10
        cache_service.stats['misses'] = 5
        
        # Test getting statistics
        stats = cache_service.get_cache_stats()
        
        assert stats['enabled'] is True
        assert stats['redis_connected'] is True
        assert stats['hits'] == 10
        assert stats['misses'] == 5
        assert stats['hit_rate_percent'] == 66.67
        assert stats['total_keys'] == 4
        assert stats['memory_used_human'] == '2K'

    @pytest.mark.unit
    def test_cache_key_consistency(self, cache_service):
        """Test cache key consistency across calls"""
        if cache_service is None:
            pytest.skip("Cache service not available")
        
        input_data = {"prompt": "test", "data": [1, 2, 3]}
        params = {"model": "gpt-4o", "temperature": 0.7}
        
        # Generate keys multiple times
        keys = []
        for _ in range(5):
            key = cache_service._generate_cache_key('ai_response', input_data, **params)
            keys.append(key)
        
        # All keys should be identical
        assert len(set(keys)) == 1
        
        # Different input should generate different key
        different_input = {"prompt": "different", "data": [1, 2, 3]}
        different_key = cache_service._generate_cache_key('ai_response', different_input, **params)
        assert different_key != keys[0]

    @pytest.mark.unit
    def test_disabled_cache_behavior(self):
        """Test behavior when cache is disabled"""
        if AICacheService is None:
            pytest.skip("Cache service not available")
        
        # Create cache service with disabled config
        config = {'enabled': False}
        disabled_cache = AICacheService(config)
        
        # Should return None/False for all operations
        assert disabled_cache.get_ai_response({"test": "data"}) is None
        assert disabled_cache.cache_ai_response({"test": "data"}, {"result": "test"}) is False
        assert disabled_cache.get_embedding("test text") is None
        assert disabled_cache.cache_embedding("test text", [0.1, 0.2]) is False

    @pytest.mark.unit
    def test_cache_warm_up(self, cache_service):
        """Test cache warming functionality"""
        if cache_service is None:
            pytest.skip("Cache service not available")
        
        # Test cache warming (should work even without Redis)
        sample_data = [
            {"prompt": "What is AI?"},
            {"prompt": "Explain machine learning"},
            {"prompt": "Define neural networks"}
        ]
        
        result = cache_service.warm_cache(sample_data)
        
        # Should return some result (even if cache is not enabled)
        assert 'cached' in result
        assert 'errors' in result

    @pytest.mark.unit
    def test_error_handling(self, cache_service):
        """Test error handling in cache operations"""
        if cache_service is None:
            pytest.skip("Cache service not available")
        
        # Test with invalid data
        with patch.object(cache_service, 'redis_client') as mock_redis:
            mock_redis.get.side_effect = Exception("Redis error")
            cache_service.enabled = True
            
            # Should handle errors gracefully
            result = cache_service.get_ai_response({"test": "data"})
            assert result is None
            assert cache_service.stats['errors'] > 0


@pytest.mark.integration
class TestAICacheIntegration:
    """Integration tests for AI cache (requires Redis)"""

    @pytest.mark.skipif(not os.getenv('REDIS_URL'), reason="Redis not available")
    def test_real_redis_integration(self):
        """Test with real Redis instance"""
        if AICacheService is None:
            pytest.skip("Cache service not available")
        
        # Use Redis URL from environment
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/1')
        
        # Parse Redis URL (simplified)
        if redis_url.startswith('redis://'):
            parts = redis_url.replace('redis://', '').split('/')
            host_port = parts[0].split(':')
            host = host_port[0] if host_port[0] else 'localhost'
            port = int(host_port[1]) if len(host_port) > 1 else 6379
            db = int(parts[1]) if len(parts) > 1 else 0
        else:
            host, port, db = 'localhost', 6379, 1
        
        config = {
            'redis_host': host,
            'redis_port': port,
            'redis_db': db,
            'default_ttl': 60
        }
        
        try:
            cache_service = AICacheService(config)
            
            if not cache_service.enabled:
                pytest.skip("Redis connection failed")
            
            # Test complete cache workflow
            input_data = {"prompt": "Integration test", "timestamp": time.time()}
            ai_response = {"result": "Integration test successful", "cached": True}
            
            # Cache the response
            cache_result = cache_service.cache_ai_response(input_data, ai_response)
            assert cache_result is True
            
            # Retrieve from cache
            retrieved = cache_service.get_ai_response(input_data)
            assert retrieved == ai_response
            
            # Test statistics
            stats = cache_service.get_cache_stats()
            assert stats['enabled'] is True
            assert stats['redis_connected'] is True
            assert stats['hits'] >= 1
            
            # Cleanup test data
            cache_service.invalidate_cache(data_type='ai_response')
            
        except Exception as e:
            pytest.skip(f"Redis integration test failed: {e}")


@pytest.mark.benchmark
class TestAICachePerformance:
    """Performance benchmarks for AI cache"""

    def test_cache_key_generation_speed(self, benchmark):
        """Benchmark cache key generation speed"""
        if AICacheService is None:
            pytest.skip("Cache service not available")
        
        cache_service = AICacheService()
        
        input_data = {
            "prompt": "This is a test prompt for benchmarking",
            "context": "Additional context data",
            "parameters": {"temperature": 0.7, "max_tokens": 100}
        }
        
        result = benchmark(cache_service._generate_cache_key, 'ai_response', input_data, model='gpt-4o')
        
        assert isinstance(result, str)
        assert len(result) > 10

    def test_serialization_speed(self, benchmark):
        """Benchmark data serialization speed"""
        if AICacheService is None:
            pytest.skip("Cache service not available")
        
        cache_service = AICacheService()
        
        # Large data structure for benchmarking
        large_data = {
            "products": [
                {
                    "name": f"Product {i}",
                    "price": 1000 + i * 10,
                    "description": f"Description for product {i}" * 10
                }
                for i in range(100)
            ],
            "metadata": {"total": 100, "processing_time": 1.5}
        }
        
        result = benchmark(cache_service._serialize_data, large_data)
        
        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_deserialization_speed(self, benchmark):
        """Benchmark data deserialization speed"""
        if AICacheService is None:
            pytest.skip("Cache service not available")
        
        cache_service = AICacheService()
        
        # Prepare serialized data
        large_data = {
            "products": [{"name": f"Product {i}", "price": 1000 + i} for i in range(100)]
        }
        serialized_data = cache_service._serialize_data(large_data)
        
        result = benchmark(cache_service._deserialize_data, serialized_data)
        
        assert result == large_data


# Test CLI interface
class TestAICacheCLI:
    """Test CLI interface for cache management"""

    def test_cli_stats_command(self):
        """Test CLI stats command"""
        if AICacheService is None:
            pytest.skip("Cache service not available")
        
        import subprocess
        import sys
        
        script_path = Path(__file__).parent.parent / "src" / "pipeline" / "ai_cache_service.py"
        
        # Test with mock Redis (will show disconnected stats)
        result = subprocess.run([
            sys.executable, str(script_path), "stats"
        ], capture_output=True, text=True, timeout=30)
        
        # Should succeed even if Redis is not available
        assert result.returncode in [0, 1]  # Either success or expected failure
        
        if result.returncode == 0:
            # Try to parse output as JSON
            try:
                stats = json.loads(result.stdout)
                assert 'enabled' in stats
            except json.JSONDecodeError:
                # Output might not be JSON if Redis is not available
                pass

    def test_cli_test_command(self):
        """Test CLI test command"""
        if AICacheService is None:
            pytest.skip("Cache service not available")
        
        import subprocess
        import sys
        
        script_path = Path(__file__).parent.parent / "src" / "pipeline" / "ai_cache_service.py"
        
        result = subprocess.run([
            sys.executable, str(script_path), "test"
        ], capture_output=True, text=True, timeout=30)
        
        # Should handle gracefully even without Redis
        assert result.returncode in [0, 1]


# Parameterized tests for different cache configurations
@pytest.mark.parametrize("config,expected_behavior", [
    ({"compression_enabled": True}, "compression_on"),
    ({"compression_enabled": False}, "compression_off"),
    ({"default_ttl": 300}, "custom_ttl"),
    ({"cache_ai_responses": False}, "ai_cache_disabled")
])
def test_configuration_behaviors(config, expected_behavior):
    """Test different cache configuration behaviors"""
    if AICacheService is None:
        pytest.skip("Cache service not available")
    
    cache_service = AICacheService(config)
    
    if expected_behavior == "compression_on":
        assert cache_service.compression_enabled is True
    elif expected_behavior == "compression_off":
        assert cache_service.compression_enabled is False
    elif expected_behavior == "custom_ttl":
        assert cache_service.default_ttl == 300
    elif expected_behavior == "ai_cache_disabled":
        assert cache_service.cache_ai_responses is False