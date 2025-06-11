#!/usr/bin/env python3
"""
AI Response Caching Service with Redis
Implements Task 10: AI response caching with Redis

Features:
- Redis-based caching for AI responses
- Configurable TTL and cache strategies
- Cache hit/miss metrics and monitoring
- Automatic cache invalidation and cleanup
- Memory-efficient serialization with compression
- Cache warming and preloading capabilities
- Hash-based cache keys for deterministic lookups
"""

import sys
import os
import json
import time
import hashlib
import gzip
import pickle
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union
import logging
from datetime import datetime, timedelta
from dataclasses import dataclass

# Redis for caching
try:
    import redis
    from redis import Redis
    REDIS_AVAILABLE = True
except ImportError:
    print("[WARNING] redis not available, caching disabled", file=sys.stderr)
    REDIS_AVAILABLE = False

# For cache statistics
from collections import defaultdict, Counter


@dataclass
class CacheEntry:
    """Cache entry metadata"""
    key: str
    data: Any
    created_at: datetime
    ttl_seconds: int
    hit_count: int = 0
    last_accessed: Optional[datetime] = None
    size_bytes: int = 0
    compression_ratio: float = 1.0


class AICacheService:
    """AI response caching service with Redis backend"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        
        # Redis configuration
        self.redis_host = self.config.get('redis_host', 'localhost')
        self.redis_port = self.config.get('redis_port', 6379)
        self.redis_db = self.config.get('redis_db', 0)
        self.redis_password = self.config.get('redis_password', None)
        self.redis_ssl = self.config.get('redis_ssl', False)
        
        # Cache configuration
        self.default_ttl = self.config.get('default_ttl', 86400)  # 24 hours
        self.max_memory_mb = self.config.get('max_memory_mb', 512)
        self.compression_enabled = self.config.get('compression_enabled', True)
        self.compression_threshold = self.config.get('compression_threshold', 1024)  # bytes
        
        # Cache strategies
        self.cache_ai_responses = self.config.get('cache_ai_responses', True)
        self.cache_embeddings = self.config.get('cache_embeddings', True)
        self.cache_processed_data = self.config.get('cache_processed_data', True)
        
        # Performance settings
        self.batch_operations = self.config.get('batch_operations', True)
        self.pipeline_size = self.config.get('pipeline_size', 100)
        
        # Initialize Redis connection
        self.redis_client = None
        self.enabled = False
        self._init_redis()
        
        # Cache statistics
        self.stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'deletes': 0,
            'errors': 0,
            'bytes_saved': 0,
            'api_calls_saved': 0
        }
        
        # Key prefixes for different data types
        self.prefixes = {
            'ai_response': 'ai_resp:',
            'embedding': 'embed:',
            'processed': 'proc:',
            'metadata': 'meta:',
            'stats': 'stats:'
        }
        
        print(f"[INFO] AI Cache Service initialized", file=sys.stderr)
        print(f"[INFO] Redis: {'✓' if self.enabled else '✗'}", file=sys.stderr)
        print(f"[INFO] Compression: {'✓' if self.compression_enabled else '✗'}", file=sys.stderr)
    
    def _init_redis(self):
        """Initialize Redis connection"""
        
        if not REDIS_AVAILABLE:
            print("[WARNING] Redis not available, caching disabled", file=sys.stderr)
            return
        
        try:
            # Create Redis connection
            connection_kwargs = {
                'host': self.redis_host,
                'port': self.redis_port,
                'db': self.redis_db,
                'decode_responses': False,  # We handle binary data
                'socket_timeout': 5,
                'socket_connect_timeout': 5,
                'retry_on_timeout': True,
                'health_check_interval': 30
            }
            
            if self.redis_password:
                connection_kwargs['password'] = self.redis_password
            
            if self.redis_ssl:
                connection_kwargs['ssl'] = True
                connection_kwargs['ssl_cert_reqs'] = None
            
            self.redis_client = Redis(**connection_kwargs)
            
            # Test connection
            self.redis_client.ping()
            self.enabled = True
            
            # Set memory policy if supported
            try:
                self.redis_client.config_set('maxmemory-policy', 'allkeys-lru')
                if self.max_memory_mb:
                    max_memory_bytes = self.max_memory_mb * 1024 * 1024
                    self.redis_client.config_set('maxmemory', max_memory_bytes)
            except:
                # Some Redis instances don't allow config changes
                pass
            
            print(f"[INFO] Redis connected: {self.redis_host}:{self.redis_port}", file=sys.stderr)
            
        except Exception as e:
            print(f"[WARNING] Redis connection failed: {e}", file=sys.stderr)
            self.enabled = False
    
    def _generate_cache_key(self, data_type: str, input_data: Any, **kwargs) -> str:
        """Generate deterministic cache key from input data"""
        
        # Create hash from input data
        if isinstance(input_data, (dict, list)):
            data_str = json.dumps(input_data, sort_keys=True, ensure_ascii=False)
        else:
            data_str = str(input_data)
        
        # Include additional parameters
        params_str = json.dumps(kwargs, sort_keys=True, ensure_ascii=False)
        
        # Create hash
        hash_input = f"{data_str}:{params_str}".encode('utf-8')
        cache_hash = hashlib.sha256(hash_input).hexdigest()[:16]  # 16 chars should be enough
        
        # Add prefix
        prefix = self.prefixes.get(data_type, 'cache:')
        return f"{prefix}{cache_hash}"
    
    def _serialize_data(self, data: Any) -> bytes:
        """Serialize data with optional compression"""
        
        # Serialize with pickle (handles complex Python objects)
        serialized = pickle.dumps(data, protocol=pickle.HIGHEST_PROTOCOL)
        
        # Compress if enabled and data is large enough
        if self.compression_enabled and len(serialized) > self.compression_threshold:
            compressed = gzip.compress(serialized)
            # Only use compression if it actually reduces size
            if len(compressed) < len(serialized):
                return b'GZIP:' + compressed
        
        return b'RAW:' + serialized
    
    def _deserialize_data(self, data: bytes) -> Any:
        """Deserialize data with automatic decompression"""
        
        if data.startswith(b'GZIP:'):
            # Decompress
            compressed_data = data[5:]  # Remove prefix
            decompressed = gzip.decompress(compressed_data)
            return pickle.loads(decompressed)
        elif data.startswith(b'RAW:'):
            # Raw data
            raw_data = data[4:]  # Remove prefix
            return pickle.loads(raw_data)
        else:
            # Legacy format, assume pickle
            return pickle.loads(data)
    
    def get_ai_response(self, input_data: Dict[str, Any], model: str = "gpt-o3", 
                       **api_params) -> Optional[Dict[str, Any]]:
        """Get cached AI response or return None if not found"""
        
        if not self.enabled or not self.cache_ai_responses:
            return None
        
        try:
            # Generate cache key
            cache_params = {'model': model, **api_params}
            cache_key = self._generate_cache_key('ai_response', input_data, **cache_params)
            
            # Try to get from cache
            cached_data = self.redis_client.get(cache_key)
            if cached_data:
                result = self._deserialize_data(cached_data)
                
                # Update statistics
                self.stats['hits'] += 1
                self.stats['api_calls_saved'] += 1
                
                # Update access time and hit count
                self._update_cache_metadata(cache_key)
                
                print(f"[INFO] Cache HIT: AI response for {cache_key[:12]}...", file=sys.stderr)
                return result
            else:
                self.stats['misses'] += 1
                print(f"[INFO] Cache MISS: AI response for {cache_key[:12]}...", file=sys.stderr)
                return None
                
        except Exception as e:
            self.stats['errors'] += 1
            print(f"[ERROR] Cache get error: {e}", file=sys.stderr)
            return None
    
    def cache_ai_response(self, input_data: Dict[str, Any], response: Dict[str, Any], 
                         model: str = "gpt-o3", ttl: Optional[int] = None, **api_params) -> bool:
        """Cache AI response with metadata"""
        
        if not self.enabled or not self.cache_ai_responses:
            return False
        
        try:
            # Generate cache key
            cache_params = {'model': model, **api_params}
            cache_key = self._generate_cache_key('ai_response', input_data, **cache_params)
            
            # Serialize response
            serialized_data = self._serialize_data(response)
            
            # Set TTL
            cache_ttl = ttl or self.default_ttl
            
            # Store in Redis
            self.redis_client.setex(cache_key, cache_ttl, serialized_data)
            
            # Store metadata
            metadata = {
                'cached_at': datetime.utcnow().isoformat(),
                'ttl': cache_ttl,
                'size_bytes': len(serialized_data),
                'model': model,
                'api_params': api_params
            }
            metadata_key = self.prefixes['metadata'] + cache_key
            self.redis_client.setex(metadata_key, cache_ttl, json.dumps(metadata))
            
            # Update statistics
            self.stats['sets'] += 1
            self.stats['bytes_saved'] += len(serialized_data)
            
            print(f"[INFO] Cache SET: AI response for {cache_key[:12]}... ({len(serialized_data)} bytes)", file=sys.stderr)
            return True
            
        except Exception as e:
            self.stats['errors'] += 1
            print(f"[ERROR] Cache set error: {e}", file=sys.stderr)
            return False
    
    def get_embedding(self, text: str, model: str = "text-embedding-ada-002") -> Optional[List[float]]:
        """Get cached embedding or return None if not found"""
        
        if not self.enabled or not self.cache_embeddings:
            return None
        
        try:
            cache_key = self._generate_cache_key('embedding', text, model=model)
            
            cached_data = self.redis_client.get(cache_key)
            if cached_data:
                result = self._deserialize_data(cached_data)
                self.stats['hits'] += 1
                self._update_cache_metadata(cache_key)
                return result
            else:
                self.stats['misses'] += 1
                return None
                
        except Exception as e:
            self.stats['errors'] += 1
            print(f"[ERROR] Embedding cache get error: {e}", file=sys.stderr)
            return None
    
    def cache_embedding(self, text: str, embedding: List[float], 
                       model: str = "text-embedding-ada-002", ttl: Optional[int] = None) -> bool:
        """Cache embedding vector"""
        
        if not self.enabled or not self.cache_embeddings:
            return False
        
        try:
            cache_key = self._generate_cache_key('embedding', text, model=model)
            serialized_data = self._serialize_data(embedding)
            
            cache_ttl = ttl or (self.default_ttl * 7)  # Embeddings last longer
            self.redis_client.setex(cache_key, cache_ttl, serialized_data)
            
            self.stats['sets'] += 1
            return True
            
        except Exception as e:
            self.stats['errors'] += 1
            print(f"[ERROR] Embedding cache set error: {e}", file=sys.stderr)
            return False
    
    def get_processed_data(self, file_hash: str, processing_config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Get cached processed data (tables, text extraction, etc.)"""
        
        if not self.enabled or not self.cache_processed_data:
            return None
        
        try:
            cache_key = self._generate_cache_key('processed', file_hash, **processing_config)
            
            cached_data = self.redis_client.get(cache_key)
            if cached_data:
                result = self._deserialize_data(cached_data)
                self.stats['hits'] += 1
                self._update_cache_metadata(cache_key)
                return result
            else:
                self.stats['misses'] += 1
                return None
                
        except Exception as e:
            self.stats['errors'] += 1
            return None
    
    def cache_processed_data(self, file_hash: str, processing_config: Dict[str, Any], 
                           processed_data: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        """Cache processed data results"""
        
        if not self.enabled or not self.cache_processed_data:
            return False
        
        try:
            cache_key = self._generate_cache_key('processed', file_hash, **processing_config)
            serialized_data = self._serialize_data(processed_data)
            
            cache_ttl = ttl or (self.default_ttl * 3)  # Processed data lasts longer
            self.redis_client.setex(cache_key, cache_ttl, serialized_data)
            
            self.stats['sets'] += 1
            return True
            
        except Exception as e:
            self.stats['errors'] += 1
            return False
    
    def _update_cache_metadata(self, cache_key: str):
        """Update cache metadata on access"""
        
        try:
            metadata_key = self.prefixes['metadata'] + cache_key
            metadata_data = self.redis_client.get(metadata_key)
            
            if metadata_data:
                metadata = json.loads(metadata_data)
                metadata['last_accessed'] = datetime.utcnow().isoformat()
                metadata['hit_count'] = metadata.get('hit_count', 0) + 1
                
                # Update with same TTL as original key
                ttl = self.redis_client.ttl(cache_key)
                if ttl > 0:
                    self.redis_client.setex(metadata_key, ttl, json.dumps(metadata))
                    
        except Exception as e:
            # Don't fail on metadata update errors
            pass
    
    def invalidate_cache(self, pattern: str = None, data_type: str = None) -> int:
        """Invalidate cache entries matching pattern or data type"""
        
        if not self.enabled:
            return 0
        
        try:
            if pattern:
                keys = self.redis_client.keys(pattern)
            elif data_type and data_type in self.prefixes:
                prefix = self.prefixes[data_type]
                keys = self.redis_client.keys(f"{prefix}*")
            else:
                # Default: clear all cache entries
                all_patterns = [f"{prefix}*" for prefix in self.prefixes.values()]
                keys = []
                for pattern in all_patterns:
                    keys.extend(self.redis_client.keys(pattern))
            
            if keys:
                deleted = self.redis_client.delete(*keys)
                self.stats['deletes'] += deleted
                print(f"[INFO] Invalidated {deleted} cache entries", file=sys.stderr)
                return deleted
            
            return 0
            
        except Exception as e:
            self.stats['errors'] += 1
            print(f"[ERROR] Cache invalidation error: {e}", file=sys.stderr)
            return 0
    
    def cleanup_expired(self) -> Dict[str, int]:
        """Clean up expired cache entries and return statistics"""
        
        if not self.enabled:
            return {'deleted': 0, 'checked': 0}
        
        try:
            deleted = 0
            checked = 0
            
            # Check all prefixes
            for prefix in self.prefixes.values():
                keys = self.redis_client.keys(f"{prefix}*")
                checked += len(keys)
                
                for key in keys:
                    ttl = self.redis_client.ttl(key)
                    if ttl == -2:  # Key doesn't exist (expired)
                        deleted += 1
                    elif ttl == -1:  # Key exists but has no expiry
                        # Set default expiry for keys without TTL
                        self.redis_client.expire(key, self.default_ttl)
            
            print(f"[INFO] Cache cleanup: checked {checked}, expired {deleted}", file=sys.stderr)
            return {'deleted': deleted, 'checked': checked}
            
        except Exception as e:
            self.stats['errors'] += 1
            print(f"[ERROR] Cache cleanup error: {e}", file=sys.stderr)
            return {'deleted': 0, 'checked': 0, 'error': str(e)}
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get comprehensive cache statistics"""
        
        stats = self.stats.copy()
        
        if self.enabled:
            try:
                # Redis info
                redis_info = self.redis_client.info()
                
                # Memory usage
                memory_used = redis_info.get('used_memory', 0)
                memory_human = redis_info.get('used_memory_human', '0B')
                
                # Key counts by type
                key_counts = {}
                total_keys = 0
                
                for data_type, prefix in self.prefixes.items():
                    count = len(self.redis_client.keys(f"{prefix}*"))
                    key_counts[data_type] = count
                    total_keys += count
                
                # Calculate hit rate
                total_requests = stats['hits'] + stats['misses']
                hit_rate = (stats['hits'] / total_requests * 100) if total_requests > 0 else 0
                
                stats.update({
                    'enabled': True,
                    'redis_connected': True,
                    'memory_used_bytes': memory_used,
                    'memory_used_human': memory_human,
                    'total_keys': total_keys,
                    'key_counts_by_type': key_counts,
                    'hit_rate_percent': round(hit_rate, 2),
                    'total_requests': total_requests,
                    'redis_version': redis_info.get('redis_version', 'unknown'),
                    'redis_mode': redis_info.get('redis_mode', 'standalone')
                })
                
            except Exception as e:
                stats.update({
                    'enabled': True,
                    'redis_connected': False,
                    'error': str(e)
                })
        else:
            stats.update({
                'enabled': False,
                'redis_connected': False
            })
        
        return stats
    
    def warm_cache(self, data_samples: List[Dict[str, Any]], model: str = "gpt-4o") -> Dict[str, int]:
        """Pre-warm cache with sample data (for testing/development)"""
        
        if not self.enabled:
            return {'cached': 0, 'errors': 0}
        
        cached = 0
        errors = 0
        
        for sample in data_samples:
            try:
                # Generate mock AI response for warming
                mock_response = {
                    'products': [],
                    'confidence': 0.8,
                    'processing_time': 1.2,
                    'cached': True,
                    'warm_cache_entry': True
                }
                
                if self.cache_ai_response(sample, mock_response, model=model):
                    cached += 1
                else:
                    errors += 1
                    
            except Exception as e:
                errors += 1
                print(f"[ERROR] Cache warming error: {e}", file=sys.stderr)
        
        print(f"[INFO] Cache warmed: {cached} entries, {errors} errors", file=sys.stderr)
        return {'cached': cached, 'errors': errors}
    
    def export_cache_data(self, output_path: Path) -> Dict[str, Any]:
        """Export cache data for backup or analysis"""
        
        if not self.enabled:
            return {'exported': 0, 'error': 'Cache not enabled'}
        
        try:
            exported_data = {}
            total_exported = 0
            
            for data_type, prefix in self.prefixes.items():
                keys = self.redis_client.keys(f"{prefix}*")
                type_data = {}
                
                for key in keys:
                    try:
                        cached_data = self.redis_client.get(key)
                        if cached_data:
                            data = self._deserialize_data(cached_data)
                            ttl = self.redis_client.ttl(key)
                            
                            type_data[key.decode() if isinstance(key, bytes) else key] = {
                                'data': data,
                                'ttl': ttl,
                                'size_bytes': len(cached_data)
                            }
                            total_exported += 1
                    except Exception as e:
                        print(f"[WARNING] Failed to export key {key}: {e}", file=sys.stderr)
                
                exported_data[data_type] = type_data
            
            # Save to file
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump({
                    'exported_at': datetime.utcnow().isoformat(),
                    'total_entries': total_exported,
                    'cache_stats': self.get_cache_stats(),
                    'data': exported_data
                }, f, indent=2, default=str)
            
            return {'exported': total_exported, 'file': str(output_path)}
            
        except Exception as e:
            return {'exported': 0, 'error': str(e)}


def main():
    """CLI interface for cache management"""
    
    if len(sys.argv) < 2:
        print("Usage: python ai_cache_service.py <command> [args]", file=sys.stderr)
        print("Commands:", file=sys.stderr)
        print("  stats              - Show cache statistics", file=sys.stderr)
        print("  cleanup            - Clean up expired entries", file=sys.stderr)
        print("  invalidate [type]  - Invalidate cache entries", file=sys.stderr)
        print("  export <file>      - Export cache data", file=sys.stderr)
        print("  test               - Test cache operations", file=sys.stderr)
        print("  api <json>         - API mode for TypeScript integration", file=sys.stderr)
        sys.exit(1)
    
    command = sys.argv[1]
    
    # Configuration from environment
    config = {
        'redis_host': os.getenv('REDIS_HOST', 'localhost'),
        'redis_port': int(os.getenv('REDIS_PORT', '6379')),
        'redis_db': int(os.getenv('REDIS_DB', '0')),
        'redis_password': os.getenv('REDIS_PASSWORD'),
        'default_ttl': int(os.getenv('CACHE_TTL', '86400')),
        'compression_enabled': os.getenv('CACHE_COMPRESSION', 'true').lower() == 'true'
    }
    
    cache_service = AICacheService(config)
    
    try:
        if command == 'stats':
            stats = cache_service.get_cache_stats()
            print(json.dumps(stats, indent=2))
            
        elif command == 'cleanup':
            result = cache_service.cleanup_expired()
            print(f"Cleanup completed: {json.dumps(result)}")
            
        elif command == 'invalidate':
            data_type = sys.argv[2] if len(sys.argv) > 2 else None
            deleted = cache_service.invalidate_cache(data_type=data_type)
            print(f"Invalidated {deleted} cache entries")
            
        elif command == 'export':
            if len(sys.argv) < 3:
                print("Error: Export requires output file path", file=sys.stderr)
                sys.exit(1)
            
            output_path = Path(sys.argv[2])
            result = cache_service.export_cache_data(output_path)
            print(f"Export completed: {json.dumps(result)}")
            
        elif command == 'test':
            # Basic cache test
            test_data = {'test': 'data', 'timestamp': time.time()}
            test_response = {'result': 'success', 'cached': True}
            
            # Test cache operations
            cached = cache_service.cache_ai_response(test_data, test_response)
            print(f"Cache set: {cached}")
            
            retrieved = cache_service.get_ai_response(test_data)
            print(f"Cache get: {retrieved is not None}")
            
            stats = cache_service.get_cache_stats()
            print(f"Final stats: hit_rate={stats.get('hit_rate_percent', 0)}%")
            
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
                
                if api_command == 'get_ai_response':
                    data = cache_service.get_ai_response(
                        params.get('input_data'), 
                        params.get('model', 'gpt-4o'),
                        **params.get('api_params', {})
                    )
                    result = {'success': data is not None, 'data': data}
                    
                elif api_command == 'cache_ai_response':
                    success = cache_service.cache_ai_response(
                        params.get('input_data'),
                        params.get('response'),
                        params.get('model', 'gpt-4o'),
                        params.get('ttl'),
                        **params.get('api_params', {})
                    )
                    result = {'success': success, 'data': {'cached': success}}
                    
                elif api_command == 'get_embedding':
                    data = cache_service.get_embedding(
                        params.get('text'),
                        params.get('model', 'text-embedding-ada-002')
                    )
                    result = {'success': data is not None, 'data': data}
                    
                elif api_command == 'cache_embedding':
                    success = cache_service.cache_embedding(
                        params.get('text'),
                        params.get('embedding'),
                        params.get('model', 'text-embedding-ada-002'),
                        params.get('ttl')
                    )
                    result = {'success': success, 'data': {'cached': success}}
                    
                elif api_command == 'get_processed_data':
                    data = cache_service.get_processed_data(
                        params.get('file_hash'),
                        params.get('processing_config', {})
                    )
                    result = {'success': data is not None, 'data': data}
                    
                elif api_command == 'cache_processed_data':
                    success = cache_service.cache_processed_data(
                        params.get('file_hash'),
                        params.get('processing_config', {}),
                        params.get('processed_data'),
                        params.get('ttl')
                    )
                    result = {'success': success, 'data': {'cached': success}}
                    
                elif api_command == 'get_cache_stats':
                    stats = cache_service.get_cache_stats()
                    result = {'success': True, 'data': stats}
                    
                elif api_command == 'invalidate_cache':
                    deleted = cache_service.invalidate_cache(data_type=params.get('data_type'))
                    result = {'success': True, 'data': {'deleted': deleted}}
                    
                elif api_command == 'cleanup_expired':
                    cleanup_result = cache_service.cleanup_expired()
                    result = {'success': True, 'data': cleanup_result}
                    
                else:
                    result = {'success': False, 'error': f'Unknown API command: {api_command}'}
                
                print(f"CACHE_API_RESULT:{json.dumps(result)}")
                
            except Exception as e:
                error_result = {'success': False, 'error': str(e)}
                print(f"CACHE_API_RESULT:{json.dumps(error_result)}")
                sys.exit(1)
            
        else:
            print(f"Unknown command: {command}", file=sys.stderr)
            sys.exit(1)
    
    except Exception as e:
        print(f"[ERROR] Command failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()