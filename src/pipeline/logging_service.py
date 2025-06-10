#!/usr/bin/env python3
"""
Logging and Metrics Service with Structlog
Implements Task 12: Logging and metrics with structlog

Features:
- Structured logging with JSON output for production
- Contextual logging with request IDs and user tracking
- Performance metrics and timing decorators
- Error tracking and alerting
- Log aggregation and rotation
- Integration with monitoring systems
- Custom formatters for different environments
"""

import sys
import os
import json
import time
import uuid
from pathlib import Path
from typing import Dict, Any, List, Optional, Union, Callable
from datetime import datetime, timedelta
from functools import wraps
from contextlib import contextmanager
import threading
from collections import defaultdict, deque
import asyncio

# Structured logging with structlog
try:
    import structlog
    from structlog import configure, get_logger, processors, dev, testing
    from structlog.stdlib import LoggerFactory
    STRUCTLOG_AVAILABLE = True
except ImportError:
    print("[WARNING] structlog not available, using standard logging", file=sys.stderr)
    STRUCTLOG_AVAILABLE = False

# Standard logging as fallback
import logging
import logging.handlers

# Performance metrics
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    print("[WARNING] psutil not available, limited system metrics", file=sys.stderr)
    PSUTIL_AVAILABLE = False

# Redis for metrics storage
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    print("[WARNING] Redis not available, metrics will be in-memory only", file=sys.stderr)
    REDIS_AVAILABLE = False

# Additional imports
import re
import math


class MetricsCollector:
    """Collect and aggregate metrics for monitoring"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        
        # Metrics storage
        self.metrics = defaultdict(list)
        self.counters = defaultdict(int)
        self.gauges = defaultdict(float)
        self.timers = defaultdict(list)
        self.errors = defaultdict(int)
        
        # Configuration
        self.max_metric_age = self.config.get('max_metric_age', 3600)  # 1 hour
        self.max_timer_samples = self.config.get('max_timer_samples', 1000)
        self.flush_interval = self.config.get('flush_interval', 60)  # 1 minute
        
        # Redis connection for persistence
        self.redis_client = None
        if REDIS_AVAILABLE and self.config.get('redis_enabled', True):
            try:
                redis_config = self.config.get('redis_config', {})
                self.redis_client = redis.Redis(
                    host=redis_config.get('host', 'localhost'),
                    port=redis_config.get('port', 6379),
                    db=redis_config.get('db', 2),  # Different DB from cache
                    decode_responses=True
                )
                self.redis_client.ping()
                print("[INFO] Metrics Redis connection established", file=sys.stderr)
            except Exception as e:
                print(f"[WARNING] Failed to connect to Redis for metrics: {e}", file=sys.stderr)
                self.redis_client = None
        
        # Background cleanup thread
        self._cleanup_thread = None
        self._stop_cleanup = threading.Event()
        self.start_cleanup_thread()
    
    def start_cleanup_thread(self):
        """Start background thread for metrics cleanup"""
        
        def cleanup_worker():
            while not self._stop_cleanup.wait(self.flush_interval):
                try:
                    self.cleanup_old_metrics()
                    self.flush_to_redis()
                except Exception as e:
                    print(f"[ERROR] Metrics cleanup failed: {e}", file=sys.stderr)
        
        self._cleanup_thread = threading.Thread(target=cleanup_worker, daemon=True)
        self._cleanup_thread.start()
    
    def stop_cleanup_thread(self):
        """Stop background cleanup thread"""
        self._stop_cleanup.set()
        if self._cleanup_thread:
            self._cleanup_thread.join(timeout=5)
    
    def increment_counter(self, name: str, value: int = 1, tags: Optional[Dict[str, str]] = None):
        """Increment a counter metric"""
        
        metric_key = self._create_metric_key(name, tags)
        self.counters[metric_key] += value
        
        # Also store in Redis if available
        if self.redis_client:
            try:
                self.redis_client.hincrby("metrics:counters", metric_key, value)
                self.redis_client.expire("metrics:counters", self.max_metric_age)
            except Exception as e:
                print(f"[WARNING] Failed to store counter in Redis: {e}", file=sys.stderr)
    
    def set_gauge(self, name: str, value: float, tags: Optional[Dict[str, str]] = None):
        """Set a gauge metric"""
        
        metric_key = self._create_metric_key(name, tags)
        self.gauges[metric_key] = value
        
        if self.redis_client:
            try:
                self.redis_client.hset("metrics:gauges", metric_key, value)
                self.redis_client.expire("metrics:gauges", self.max_metric_age)
            except Exception as e:
                print(f"[WARNING] Failed to store gauge in Redis: {e}", file=sys.stderr)
    
    def record_timer(self, name: str, duration_ms: float, tags: Optional[Dict[str, str]] = None):
        """Record a timer metric"""
        
        metric_key = self._create_metric_key(name, tags)
        self.timers[metric_key].append({
            'duration_ms': duration_ms,
            'timestamp': time.time()
        })
        
        # Keep only recent samples
        if len(self.timers[metric_key]) > self.max_timer_samples:
            self.timers[metric_key] = self.timers[metric_key][-self.max_timer_samples:]
        
        if self.redis_client:
            try:
                timer_data = json.dumps({
                    'duration_ms': duration_ms,
                    'timestamp': time.time()
                })
                self.redis_client.lpush(f"metrics:timers:{metric_key}", timer_data)
                self.redis_client.ltrim(f"metrics:timers:{metric_key}", 0, self.max_timer_samples - 1)
                self.redis_client.expire(f"metrics:timers:{metric_key}", self.max_metric_age)
            except Exception as e:
                print(f"[WARNING] Failed to store timer in Redis: {e}", file=sys.stderr)
    
    def record_error(self, name: str, error_type: str = "unknown", tags: Optional[Dict[str, str]] = None):
        """Record an error metric"""
        
        error_tags = (tags or {}).copy()
        error_tags['error_type'] = error_type
        
        metric_key = self._create_metric_key(name, error_tags)
        self.errors[metric_key] += 1
        
        if self.redis_client:
            try:
                self.redis_client.hincrby("metrics:errors", metric_key, 1)
                self.redis_client.expire("metrics:errors", self.max_metric_age)
            except Exception as e:
                print(f"[WARNING] Failed to store error in Redis: {e}", file=sys.stderr)
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        """Get current metrics summary"""
        
        summary = {
            'counters': dict(self.counters),
            'gauges': dict(self.gauges),
            'errors': dict(self.errors),
            'timers': {},
            'system': {},
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Calculate timer statistics
        for timer_key, samples in self.timers.items():
            if samples:
                durations = [s['duration_ms'] for s in samples]
                summary['timers'][timer_key] = {
                    'count': len(durations),
                    'min_ms': min(durations),
                    'max_ms': max(durations),
                    'avg_ms': sum(durations) / len(durations),
                    'p50_ms': self._percentile(durations, 50),
                    'p95_ms': self._percentile(durations, 95),
                    'p99_ms': self._percentile(durations, 99)
                }
        
        # Add system metrics if available
        if PSUTIL_AVAILABLE:
            try:
                summary['system'] = {
                    'cpu_percent': psutil.cpu_percent(),
                    'memory_percent': psutil.virtual_memory().percent,
                    'disk_percent': psutil.disk_usage('/').percent,
                    'load_avg': os.getloadavg() if hasattr(os, 'getloadavg') else None
                }
            except Exception as e:
                print(f"[WARNING] Failed to get system metrics: {e}", file=sys.stderr)
        
        return summary
    
    def _create_metric_key(self, name: str, tags: Optional[Dict[str, str]] = None) -> str:
        """Create a unique metric key with tags"""
        
        if not tags:
            return name
        
        tag_parts = [f"{k}:{v}" for k, v in sorted(tags.items())]
        return f"{name}[{','.join(tag_parts)}]"
    
    def _percentile(self, data: List[float], percentile: int) -> float:
        """Calculate percentile of data"""
        
        if not data:
            return 0.0
        
        sorted_data = sorted(data)
        index = (percentile / 100) * (len(sorted_data) - 1)
        
        if index.is_integer():
            return sorted_data[int(index)]
        else:
            lower_index = int(math.floor(index))
            upper_index = int(math.ceil(index))
            lower_value = sorted_data[lower_index]
            upper_value = sorted_data[upper_index]
            # Linear interpolation
            return lower_value + (upper_value - lower_value) * (index - lower_index)
    
    def cleanup_old_metrics(self):
        """Clean up old timer samples"""
        
        cutoff_time = time.time() - self.max_metric_age
        
        for timer_key in list(self.timers.keys()):
            self.timers[timer_key] = [
                sample for sample in self.timers[timer_key]
                if sample['timestamp'] > cutoff_time
            ]
            
            if not self.timers[timer_key]:
                del self.timers[timer_key]
    
    def flush_to_redis(self):
        """Flush current metrics to Redis"""
        
        if not self.redis_client:
            return
        
        try:
            # Store metrics summary
            summary = self.get_metrics_summary()
            summary_key = f"metrics:summary:{int(time.time())}"
            self.redis_client.setex(summary_key, self.max_metric_age, json.dumps(summary))
            
            # Keep only recent summaries
            pattern = "metrics:summary:*"
            keys = self.redis_client.keys(pattern)
            if len(keys) > 100:  # Keep last 100 summaries
                old_keys = sorted(keys)[:-100]
                if old_keys:
                    self.redis_client.delete(*old_keys)
            
        except Exception as e:
            print(f"[WARNING] Failed to flush metrics to Redis: {e}", file=sys.stderr)


class LoggingService:
    """Comprehensive logging service with structured logging and metrics"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        
        # Configuration
        self.log_level = self.config.get('log_level', 'INFO').upper()
        self.environment = self.config.get('environment', 'development')
        self.service_name = self.config.get('service_name', 'monito-pipeline')
        self.log_dir = Path(self.config.get('log_dir', 'logs'))
        self.enable_json_logs = self.config.get('enable_json_logs', self.environment == 'production')
        self.enable_file_logs = self.config.get('enable_file_logs', True)
        self.max_log_size = self.config.get('max_log_size', 100 * 1024 * 1024)  # 100MB
        self.backup_count = self.config.get('backup_count', 5)
        
        # Create log directory
        if self.enable_file_logs:
            self.log_dir.mkdir(exist_ok=True)
        
        # Initialize metrics collector
        metrics_config = self.config.get('metrics_config', {})
        self.metrics = MetricsCollector(metrics_config)
        
        # Request context storage
        self.context = threading.local()
        
        # Configure structured logging
        self.setup_logging()
        
        # Get logger instance
        if STRUCTLOG_AVAILABLE:
            self.logger = structlog.get_logger(self.service_name)
        else:
            self.logger = logging.getLogger(self.service_name)
        
        self.logger.info("Logging service initialized", 
                        environment=self.environment,
                        log_level=self.log_level,
                        json_logs=self.enable_json_logs)
    
    def setup_logging(self):
        """Configure logging based on environment and preferences"""
        
        if STRUCTLOG_AVAILABLE:
            self._setup_structlog()
        else:
            self._setup_standard_logging()
    
    def _setup_structlog(self):
        """Setup structlog configuration"""
        
        # Define processors based on environment
        if self.environment == 'development':
            processors_list = [
                structlog.stdlib.add_log_level,
                structlog.stdlib.add_logger_name,
                processors.TimeStamper(fmt="ISO"),
                processors.StackInfoRenderer(),
                dev.ConsoleRenderer(colors=True)
            ]
        else:
            processors_list = [
                processors.TimeStamper(fmt="ISO"),
                structlog.stdlib.add_log_level,
                structlog.stdlib.add_logger_name,
                processors.StackInfoRenderer(),
                processors.JSONRenderer()
            ]
        
        # Configure structlog
        structlog.configure(
            processors=processors_list,
            wrapper_class=structlog.stdlib.BoundLogger,
            logger_factory=LoggerFactory(),
            cache_logger_on_first_use=True,
        )
        
        # Configure standard library logger
        logging.basicConfig(
            level=getattr(logging, self.log_level),
            handlers=self._create_handlers()
        )
    
    def _setup_standard_logging(self):
        """Setup standard logging as fallback"""
        
        logger = logging.getLogger(self.service_name)
        logger.setLevel(getattr(logging, self.log_level))
        
        # Remove existing handlers
        for handler in logger.handlers[:]:
            logger.removeHandler(handler)
        
        # Add new handlers
        for handler in self._create_handlers():
            logger.addHandler(handler)
    
    def _create_handlers(self) -> List[logging.Handler]:
        """Create logging handlers"""
        
        handlers = []
        
        # Console handler
        console_handler = logging.StreamHandler(sys.stderr)
        if self.enable_json_logs:
            console_handler.setFormatter(logging.Formatter(
                '%(asctime)s %(name)s %(levelname)s %(message)s'
            ))
        else:
            console_handler.setFormatter(logging.Formatter(
                '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
            ))
        handlers.append(console_handler)
        
        # File handlers
        if self.enable_file_logs:
            # Application log file
            app_log_file = self.log_dir / f'{self.service_name}.log'
            app_handler = logging.handlers.RotatingFileHandler(
                app_log_file,
                maxBytes=self.max_log_size,
                backupCount=self.backup_count
            )
            
            if self.enable_json_logs:
                app_handler.setFormatter(logging.Formatter('%(message)s'))
            else:
                app_handler.setFormatter(logging.Formatter(
                    '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
                ))
            handlers.append(app_handler)
            
            # Error log file (errors only)
            error_log_file = self.log_dir / f'{self.service_name}_errors.log'
            error_handler = logging.handlers.RotatingFileHandler(
                error_log_file,
                maxBytes=self.max_log_size,
                backupCount=self.backup_count
            )
            error_handler.setLevel(logging.ERROR)
            error_handler.setFormatter(logging.Formatter(
                '%(asctime)s [%(levelname)s] %(name)s: %(message)s\n%(exc_info)s'
            ))
            handlers.append(error_handler)
        
        return handlers
    
    @contextmanager
    def request_context(self, request_id: Optional[str] = None, user_id: Optional[str] = None, 
                       operation: Optional[str] = None, **kwargs):
        """Context manager for request-scoped logging"""
        
        # Generate request ID if not provided
        if not request_id:
            request_id = str(uuid.uuid4())[:8]
        
        # Store context
        old_context = getattr(self.context, 'data', {})
        self.context.data = {
            'request_id': request_id,
            'user_id': user_id,
            'operation': operation,
            **kwargs
        }
        
        start_time = time.time()
        
        try:
            if STRUCTLOG_AVAILABLE:
                logger = self.logger.bind(**self.context.data)
            else:
                logger = self.logger
            
            logger.info("Request started", **self.context.data)
            yield logger
            
            duration_ms = (time.time() - start_time) * 1000
            logger.info("Request completed", duration_ms=duration_ms, **self.context.data)
            
            # Record metrics
            self.metrics.increment_counter('requests_total', tags={'operation': operation})
            self.metrics.record_timer('request_duration', duration_ms, tags={'operation': operation})
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            
            if STRUCTLOG_AVAILABLE:
                logger = self.logger.bind(**self.context.data)
            else:
                logger = self.logger
            
            logger.error("Request failed", 
                        error=str(e),
                        error_type=type(e).__name__,
                        duration_ms=duration_ms,
                        exc_info=True,
                        **self.context.data)
            
            # Record error metrics
            self.metrics.record_error('requests_failed', 
                                    error_type=type(e).__name__,
                                    tags={'operation': operation})
            self.metrics.record_timer('request_duration', duration_ms, 
                                    tags={'operation': operation, 'status': 'error'})
            raise
        finally:
            # Restore old context
            self.context.data = old_context
    
    def timing_decorator(self, operation: str, include_args: bool = False):
        """Decorator for timing function calls"""
        
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                start_time = time.time()
                
                # Prepare log context
                log_context = {'operation': operation, 'function': func.__name__}
                if include_args:
                    log_context['args_count'] = len(args)
                    log_context['kwargs_keys'] = list(kwargs.keys())
                
                try:
                    if STRUCTLOG_AVAILABLE:
                        logger = self.logger.bind(**log_context)
                    else:
                        logger = self.logger
                    
                    logger.debug("Function started", **log_context)
                    result = func(*args, **kwargs)
                    
                    duration_ms = (time.time() - start_time) * 1000
                    logger.debug("Function completed", duration_ms=duration_ms, **log_context)
                    
                    # Record metrics
                    self.metrics.record_timer(f'function_duration', duration_ms, 
                                            tags={'function': func.__name__, 'operation': operation})
                    
                    return result
                    
                except Exception as e:
                    duration_ms = (time.time() - start_time) * 1000
                    
                    if STRUCTLOG_AVAILABLE:
                        logger = self.logger.bind(**log_context)
                    else:
                        logger = self.logger
                    
                    logger.error("Function failed",
                                error=str(e),
                                error_type=type(e).__name__,
                                duration_ms=duration_ms,
                                exc_info=True,
                                **log_context)
                    
                    self.metrics.record_error('function_errors',
                                            error_type=type(e).__name__,
                                            tags={'function': func.__name__, 'operation': operation})
                    raise
            
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                start_time = time.time()
                
                log_context = {'operation': operation, 'function': func.__name__}
                if include_args:
                    log_context['args_count'] = len(args)
                    log_context['kwargs_keys'] = list(kwargs.keys())
                
                try:
                    if STRUCTLOG_AVAILABLE:
                        logger = self.logger.bind(**log_context)
                    else:
                        logger = self.logger
                    
                    logger.debug("Async function started", **log_context)
                    result = await func(*args, **kwargs)
                    
                    duration_ms = (time.time() - start_time) * 1000
                    logger.debug("Async function completed", duration_ms=duration_ms, **log_context)
                    
                    self.metrics.record_timer('function_duration', duration_ms,
                                            tags={'function': func.__name__, 'operation': operation, 'type': 'async'})
                    
                    return result
                    
                except Exception as e:
                    duration_ms = (time.time() - start_time) * 1000
                    
                    if STRUCTLOG_AVAILABLE:
                        logger = self.logger.bind(**log_context)
                    else:
                        logger = self.logger
                    
                    logger.error("Async function failed",
                                error=str(e),
                                error_type=type(e).__name__,
                                duration_ms=duration_ms,
                                exc_info=True,
                                **log_context)
                    
                    self.metrics.record_error('function_errors',
                                            error_type=type(e).__name__,
                                            tags={'function': func.__name__, 'operation': operation, 'type': 'async'})
                    raise
            
            # Return appropriate wrapper based on function type
            if asyncio.iscoroutinefunction(func):
                return async_wrapper
            else:
                return sync_wrapper
        
        return decorator
    
    def log_pipeline_event(self, event_type: str, **kwargs):
        """Log pipeline-specific events with metrics"""
        
        if STRUCTLOG_AVAILABLE:
            logger = self.logger.bind(event_type=event_type)
        else:
            logger = self.logger
        
        logger.info("Pipeline event", event_type=event_type, **kwargs)
        
        # Record metrics
        self.metrics.increment_counter('pipeline_events', tags={'event_type': event_type})
    
    def log_file_processing(self, filename: str, file_size: int, processing_time_ms: float, 
                           products_extracted: int, success: bool, **kwargs):
        """Log file processing events with detailed metrics"""
        
        log_context = {
            'filename': filename,
            'file_size_bytes': file_size,
            'processing_time_ms': processing_time_ms,
            'products_extracted': products_extracted,
            'success': success,
            **kwargs
        }
        
        if STRUCTLOG_AVAILABLE:
            logger = self.logger.bind(**log_context)
        else:
            logger = self.logger
        
        if success:
            logger.info("File processing completed", **log_context)
        else:
            logger.error("File processing failed", **log_context)
        
        # Record detailed metrics
        self.metrics.increment_counter('files_processed', tags={'success': str(success)})
        self.metrics.record_timer('file_processing_duration', processing_time_ms)
        self.metrics.set_gauge('last_file_products_extracted', products_extracted)
        self.metrics.set_gauge('last_file_size_bytes', file_size)
        
        if products_extracted > 0:
            extraction_rate = products_extracted / (processing_time_ms / 1000)  # products per second
            self.metrics.set_gauge('extraction_rate_products_per_sec', extraction_rate)
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        """Get current metrics summary"""
        return self.metrics.get_metrics_summary()
    
    def export_metrics_json(self, output_path: Optional[Path] = None) -> str:
        """Export metrics to JSON format"""
        
        metrics_data = {
            'service': self.service_name,
            'timestamp': datetime.utcnow().isoformat(),
            'metrics': self.get_metrics_summary()
        }
        
        json_output = json.dumps(metrics_data, indent=2)
        
        if output_path:
            with open(output_path, 'w') as f:
                f.write(json_output)
        
        return json_output
    
    def health_check(self) -> Dict[str, Any]:
        """Perform health check of logging system"""
        
        health = {
            'status': 'healthy',
            'checks': {},
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Check log directory
        if self.enable_file_logs:
            try:
                test_file = self.log_dir / '.health_check'
                test_file.write_text('test')
                test_file.unlink()
                health['checks']['log_directory'] = 'ok'
            except Exception as e:
                health['checks']['log_directory'] = f'error: {e}'
                health['status'] = 'degraded'
        
        # Check Redis connection
        if self.metrics.redis_client:
            try:
                self.metrics.redis_client.ping()
                health['checks']['redis_metrics'] = 'ok'
            except Exception as e:
                health['checks']['redis_metrics'] = f'error: {e}'
                health['status'] = 'degraded'
        else:
            health['checks']['redis_metrics'] = 'disabled'
        
        # Check system resources if available
        if PSUTIL_AVAILABLE:
            try:
                memory_usage = psutil.virtual_memory().percent
                disk_usage = psutil.disk_usage('/').percent
                
                if memory_usage > 90 or disk_usage > 90:
                    health['status'] = 'warning'
                
                health['checks']['system_resources'] = {
                    'memory_usage_percent': memory_usage,
                    'disk_usage_percent': disk_usage
                }
            except Exception as e:
                health['checks']['system_resources'] = f'error: {e}'
        
        return health
    
    def shutdown(self):
        """Cleanup logging service"""
        
        self.logger.info("Logging service shutting down")
        
        # Stop metrics cleanup
        self.metrics.stop_cleanup_thread()
        
        # Flush any remaining metrics
        try:
            self.metrics.flush_to_redis()
        except Exception as e:
            print(f"[WARNING] Failed to flush metrics on shutdown: {e}", file=sys.stderr)


# Global logging service instance
_logging_service = None

def get_logging_service(config: Optional[Dict[str, Any]] = None) -> LoggingService:
    """Get or create global logging service instance"""
    
    global _logging_service
    
    if _logging_service is None:
        _logging_service = LoggingService(config)
    
    return _logging_service

def get_logger(name: str = "pipeline"):
    """Get a logger instance"""
    
    service = get_logging_service()
    
    if STRUCTLOG_AVAILABLE:
        return structlog.get_logger(name)
    else:
        return logging.getLogger(name)


async def main():
    """CLI interface for logging service"""
    
    if len(sys.argv) < 2:
        print("Usage: python logging_service.py <command> [args]", file=sys.stderr)
        print("Commands:", file=sys.stderr)
        print("  health         - Show health check", file=sys.stderr)
        print("  metrics        - Show current metrics", file=sys.stderr)
        print("  export [file]  - Export metrics to JSON", file=sys.stderr)
        print("  test           - Run logging tests", file=sys.stderr)
        sys.exit(1)
    
    command = sys.argv[1]
    
    # Configuration from environment
    config = {
        'log_level': os.getenv('LOG_LEVEL', 'INFO'),
        'environment': os.getenv('ENVIRONMENT', 'development'),
        'service_name': os.getenv('SERVICE_NAME', 'monito-pipeline'),
        'enable_json_logs': os.getenv('JSON_LOGS', 'false').lower() == 'true',
        'log_dir': os.getenv('LOG_DIR', 'logs')
    }
    
    logging_service = LoggingService(config)
    
    try:
        if command == 'health':
            health = logging_service.health_check()
            print(json.dumps(health, indent=2))
            
        elif command == 'metrics':
            metrics = logging_service.get_metrics_summary()
            print(json.dumps(metrics, indent=2, default=str))
            
        elif command == 'export':
            output_file = sys.argv[2] if len(sys.argv) > 2 else None
            output_path = Path(output_file) if output_file else None
            
            json_output = logging_service.export_metrics_json(output_path)
            
            if output_path:
                print(f"Metrics exported to {output_path}")
            else:
                print(json_output)
                
        elif command == 'test':
            # Test logging functionality
            logger = get_logger("test")
            
            print("Testing logging functionality...")
            
            # Test different log levels
            logger.debug("Debug message")
            logger.info("Info message", test_param="value")
            logger.warning("Warning message")
            logger.error("Error message")
            
            # Test request context
            with logging_service.request_context(operation="test_operation", user_id="test_user"):
                logger.info("Message within request context")
                
                # Test timing decorator
                @logging_service.timing_decorator("test_function")
                def test_function(x: int) -> int:
                    time.sleep(0.1)  # Simulate work
                    return x * 2
                
                result = test_function(5)
                logger.info("Function result", result=result)
            
            # Test metrics
            logging_service.metrics.increment_counter("test_counter")
            logging_service.metrics.set_gauge("test_gauge", 42.0)
            logging_service.metrics.record_timer("test_timer", 123.45)
            
            # Show final metrics
            metrics = logging_service.get_metrics_summary()
            print("\nFinal metrics:")
            print(json.dumps(metrics, indent=2, default=str))
            
            print("\nLogging test completed successfully!")
            
        else:
            print(f"Unknown command: {command}", file=sys.stderr)
            sys.exit(1)
            
    except Exception as e:
        print(f"[ERROR] Command failed: {e}", file=sys.stderr)
        sys.exit(1)
    
    finally:
        logging_service.shutdown()


if __name__ == "__main__":
    asyncio.run(main())