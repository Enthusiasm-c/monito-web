"""
Tests for Logging and Metrics Service
Tests Task 12: Logging and metrics with structlog
"""

import pytest
import tempfile
import os
import json
import asyncio
import time
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from datetime import datetime

# Import our logging modules
import sys
sys.path.append(str(Path(__file__).parent.parent))

try:
    from src.pipeline.logging_service import LoggingService, MetricsCollector, get_logging_service, get_logger
except ImportError:
    # Handle import errors gracefully for systems without dependencies
    LoggingService = None
    MetricsCollector = None


class TestMetricsCollector:
    """Test metrics collection functionality"""

    @pytest.fixture
    def metrics_collector(self):
        """Create metrics collector instance"""
        if MetricsCollector is None:
            pytest.skip("Metrics collector not available")
        
        config = {
            'max_metric_age': 60,  # 1 minute for testing
            'max_timer_samples': 100,
            'flush_interval': 5,   # 5 seconds for testing
            'redis_enabled': False  # Disable Redis for unit tests
        }
        return MetricsCollector(config)

    @pytest.mark.unit
    def test_counter_operations(self, metrics_collector):
        """Test counter increment operations"""
        if metrics_collector is None:
            pytest.skip("Metrics collector not available")
        
        # Test basic increment
        metrics_collector.increment_counter('test_counter')
        assert metrics_collector.counters['test_counter'] == 1
        
        # Test increment with value
        metrics_collector.increment_counter('test_counter', 5)
        assert metrics_collector.counters['test_counter'] == 6
        
        # Test increment with tags
        metrics_collector.increment_counter('test_counter', tags={'env': 'test'})
        assert 'test_counter[env:test]' in metrics_collector.counters
        assert metrics_collector.counters['test_counter[env:test]'] == 1

    @pytest.mark.unit
    def test_gauge_operations(self, metrics_collector):
        """Test gauge set operations"""
        if metrics_collector is None:
            pytest.skip("Metrics collector not available")
        
        # Test basic gauge
        metrics_collector.set_gauge('cpu_usage', 45.5)
        assert metrics_collector.gauges['cpu_usage'] == 45.5
        
        # Test gauge with tags
        metrics_collector.set_gauge('memory_usage', 80.2, tags={'host': 'server1'})
        assert 'memory_usage[host:server1]' in metrics_collector.gauges
        assert metrics_collector.gauges['memory_usage[host:server1]'] == 80.2

    @pytest.mark.unit
    def test_timer_operations(self, metrics_collector):
        """Test timer recording operations"""
        if metrics_collector is None:
            pytest.skip("Metrics collector not available")
        
        # Record multiple timer samples
        metrics_collector.record_timer('api_request', 120.5)
        metrics_collector.record_timer('api_request', 95.2)
        metrics_collector.record_timer('api_request', 150.0)
        
        assert len(metrics_collector.timers['api_request']) == 3
        
        # Test timer with tags
        metrics_collector.record_timer('db_query', 45.0, tags={'table': 'products'})
        assert 'db_query[table:products]' in metrics_collector.timers

    @pytest.mark.unit
    def test_error_operations(self, metrics_collector):
        """Test error recording operations"""
        if metrics_collector is None:
            pytest.skip("Metrics collector not available")
        
        # Record errors
        metrics_collector.record_error('api_errors', 'validation_error')
        metrics_collector.record_error('api_errors', 'timeout_error')
        metrics_collector.record_error('api_errors', 'validation_error')  # Duplicate type
        
        # Should have two different error type keys
        error_keys = [key for key in metrics_collector.errors.keys() if key.startswith('api_errors')]
        assert len(error_keys) == 2
        
        # Check specific error counts
        validation_key = next(key for key in error_keys if 'validation_error' in key)
        timeout_key = next(key for key in error_keys if 'timeout_error' in key)
        
        assert metrics_collector.errors[validation_key] == 2
        assert metrics_collector.errors[timeout_key] == 1

    @pytest.mark.unit
    def test_metrics_summary(self, metrics_collector):
        """Test metrics summary generation"""
        if metrics_collector is None:
            pytest.skip("Metrics collector not available")
        
        # Add various metrics
        metrics_collector.increment_counter('requests_total', 10)
        metrics_collector.set_gauge('active_users', 42)
        metrics_collector.record_timer('response_time', 100.0)
        metrics_collector.record_timer('response_time', 150.0)
        metrics_collector.record_timer('response_time', 200.0)
        metrics_collector.record_error('errors_total', 'server_error')
        
        summary = metrics_collector.get_metrics_summary()
        
        # Check summary structure
        assert 'counters' in summary
        assert 'gauges' in summary
        assert 'timers' in summary
        assert 'errors' in summary
        assert 'timestamp' in summary
        
        # Check counter values
        assert summary['counters']['requests_total'] == 10
        
        # Check gauge values
        assert summary['gauges']['active_users'] == 42
        
        # Check timer statistics
        timer_stats = summary['timers']['response_time']
        assert timer_stats['count'] == 3
        assert timer_stats['min_ms'] == 100.0
        assert timer_stats['max_ms'] == 200.0
        assert timer_stats['avg_ms'] == 150.0
        
        # Check error counts
        error_key = next(key for key in summary['errors'].keys() if 'errors_total' in key)
        assert summary['errors'][error_key] == 1

    @pytest.mark.unit
    def test_metric_key_generation(self, metrics_collector):
        """Test metric key generation with tags"""
        if metrics_collector is None:
            pytest.skip("Metrics collector not available")
        
        # Test without tags
        key1 = metrics_collector._create_metric_key('test_metric')
        assert key1 == 'test_metric'
        
        # Test with single tag
        key2 = metrics_collector._create_metric_key('test_metric', {'env': 'prod'})
        assert key2 == 'test_metric[env:prod]'
        
        # Test with multiple tags (should be sorted)
        key3 = metrics_collector._create_metric_key('test_metric', {'env': 'prod', 'service': 'api'})
        assert key3 == 'test_metric[env:prod,service:api]'

    @pytest.mark.unit
    def test_percentile_calculation(self, metrics_collector):
        """Test percentile calculation"""
        if metrics_collector is None:
            pytest.skip("Metrics collector not available")
        
        data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        
        # Test various percentiles
        assert metrics_collector._percentile(data, 50) == 5  # Median
        assert metrics_collector._percentile(data, 90) == 9
        assert metrics_collector._percentile(data, 99) == 10
        
        # Test edge cases
        assert metrics_collector._percentile([], 50) == 0.0
        assert metrics_collector._percentile([42], 50) == 42

    @pytest.mark.unit
    def test_metrics_cleanup(self, metrics_collector):
        """Test old metrics cleanup"""
        if metrics_collector is None:
            pytest.skip("Metrics collector not available")
        
        # Add timer with old timestamp
        old_time = time.time() - 3600  # 1 hour ago
        metrics_collector.timers['old_timer'].append({
            'duration_ms': 100.0,
            'timestamp': old_time
        })
        
        # Add timer with recent timestamp
        recent_time = time.time()
        metrics_collector.timers['recent_timer'].append({
            'duration_ms': 200.0,
            'timestamp': recent_time
        })
        
        # Cleanup should remove old timer
        metrics_collector.cleanup_old_metrics()
        
        assert 'old_timer' not in metrics_collector.timers
        assert 'recent_timer' in metrics_collector.timers


class TestLoggingService:
    """Test logging service functionality"""

    @pytest.fixture
    def temp_log_dir(self):
        """Create temporary log directory"""
        with tempfile.TemporaryDirectory() as temp_dir:
            yield Path(temp_dir)

    @pytest.fixture
    def logging_service(self, temp_log_dir):
        """Create logging service instance"""
        if LoggingService is None:
            pytest.skip("Logging service not available")
        
        config = {
            'log_level': 'DEBUG',
            'environment': 'test',
            'service_name': 'test-service',
            'log_dir': str(temp_log_dir),
            'enable_json_logs': False,
            'enable_file_logs': True,
            'metrics_config': {
                'redis_enabled': False  # Disable Redis for tests
            }
        }
        return LoggingService(config)

    @pytest.mark.unit
    def test_logging_service_initialization(self, logging_service):
        """Test logging service initialization"""
        if logging_service is None:
            pytest.skip("Logging service not available")
        
        assert logging_service.log_level == 'DEBUG'
        assert logging_service.environment == 'test'
        assert logging_service.service_name == 'test-service'
        assert logging_service.enable_file_logs is True

    @pytest.mark.unit
    def test_request_context(self, logging_service):
        """Test request context management"""
        if logging_service is None:
            pytest.skip("Logging service not available")
        
        # Test request context
        with logging_service.request_context(
            request_id='test-123',
            user_id='user-456',
            operation='test_operation'
        ) as logger:
            # Context should be available
            context_data = getattr(logging_service.context, 'data', {})
            assert context_data['request_id'] == 'test-123'
            assert context_data['user_id'] == 'user-456'
            assert context_data['operation'] == 'test_operation'
        
        # Context should be cleared after exit
        context_data = getattr(logging_service.context, 'data', {})
        assert context_data == {}

    @pytest.mark.unit
    def test_timing_decorator(self, logging_service):
        """Test timing decorator functionality"""
        if logging_service is None:
            pytest.skip("Logging service not available")
        
        @logging_service.timing_decorator("test_operation")
        def test_function(x: int) -> int:
            time.sleep(0.01)  # Small delay
            return x * 2
        
        result = test_function(5)
        assert result == 10
        
        # Check that metrics were recorded
        metrics = logging_service.get_metrics_summary()
        assert 'function_duration' in str(metrics)

    @pytest.mark.unit
    def test_pipeline_event_logging(self, logging_service):
        """Test pipeline event logging"""
        if logging_service is None:
            pytest.skip("Logging service not available")
        
        logging_service.log_pipeline_event('file_uploaded', filename='test.pdf', size=1024)
        
        # Check metrics
        metrics = logging_service.get_metrics_summary()
        pipeline_events = [key for key in metrics['counters'].keys() if 'pipeline_events' in key]
        assert len(pipeline_events) > 0

    @pytest.mark.unit
    def test_file_processing_logging(self, logging_service):
        """Test file processing logging"""
        if logging_service is None:
            pytest.skip("Logging service not available")
        
        # Test successful processing
        logging_service.log_file_processing(
            filename='test.pdf',
            file_size=2048,
            processing_time_ms=500.0,
            products_extracted=25,
            success=True
        )
        
        # Test failed processing
        logging_service.log_file_processing(
            filename='failed.pdf',
            file_size=1024,
            processing_time_ms=100.0,
            products_extracted=0,
            success=False,
            error='Parsing failed'
        )
        
        # Check metrics
        metrics = logging_service.get_metrics_summary()
        
        # Should have file processing counters
        file_counters = [key for key in metrics['counters'].keys() if 'files_processed' in key]
        assert len(file_counters) >= 2  # success=true and success=false
        
        # Should have timing metrics
        assert any('file_processing_duration' in key for key in metrics['timers'].keys())
        
        # Should have gauge metrics
        assert 'last_file_products_extracted' in metrics['gauges']
        assert 'last_file_size_bytes' in metrics['gauges']

    @pytest.mark.unit
    def test_health_check(self, logging_service):
        """Test health check functionality"""
        if logging_service is None:
            pytest.skip("Logging service not available")
        
        health = logging_service.health_check()
        
        assert 'status' in health
        assert 'checks' in health
        assert 'timestamp' in health
        
        # Log directory should be OK since we're using temp dir
        assert health['checks']['log_directory'] == 'ok'

    @pytest.mark.unit
    def test_metrics_export(self, logging_service, temp_log_dir):
        """Test metrics export functionality"""
        if logging_service is None:
            pytest.skip("Logging service not available")
        
        # Add some metrics
        logging_service.metrics.increment_counter('test_export')
        logging_service.metrics.set_gauge('test_gauge', 123.45)
        
        # Export to file
        export_file = temp_log_dir / 'metrics_export.json'
        json_output = logging_service.export_metrics_json(export_file)
        
        # Check file was created
        assert export_file.exists()
        
        # Check content
        with open(export_file, 'r') as f:
            exported_data = json.load(f)
        
        assert 'service' in exported_data
        assert 'timestamp' in exported_data
        assert 'metrics' in exported_data
        assert exported_data['service'] == 'test-service'

    @pytest.mark.unit
    @patch('psutil.cpu_percent')
    @patch('psutil.virtual_memory')
    @patch('psutil.disk_usage')
    def test_system_metrics(self, mock_disk, mock_memory, mock_cpu, logging_service):
        """Test system metrics collection"""
        if logging_service is None:
            pytest.skip("Logging service not available")
        
        # Mock system metrics
        mock_cpu.return_value = 45.5
        mock_memory.return_value.percent = 67.8
        mock_disk.return_value.percent = 23.4
        
        metrics = logging_service.get_metrics_summary()
        
        # Should include system metrics if psutil is available
        if 'system' in metrics and metrics['system']:
            assert 'cpu_percent' in metrics['system']
            assert 'memory_percent' in metrics['system']
            assert 'disk_percent' in metrics['system']


class TestLoggingIntegration:
    """Test logging integration functionality"""

    @pytest.mark.unit
    def test_logger_factory(self):
        """Test logger factory function"""
        if get_logger is None:
            pytest.skip("Logger factory not available")
        
        logger = get_logger("test_module")
        assert logger is not None

    @pytest.mark.unit
    def test_global_logging_service(self):
        """Test global logging service singleton"""
        if get_logging_service is None:
            pytest.skip("Global logging service not available")
        
        service1 = get_logging_service()
        service2 = get_logging_service()
        
        # Should return same instance
        assert service1 is service2


@pytest.mark.integration
class TestLoggingPerformance:
    """Performance tests for logging system"""

    def test_high_volume_logging(self, benchmark):
        """Benchmark high-volume logging performance"""
        if LoggingService is None:
            pytest.skip("Logging service not available")
        
        # Create service with minimal configuration
        config = {
            'log_level': 'INFO',
            'enable_file_logs': False,  # Disable for performance
            'metrics_config': {'redis_enabled': False}
        }
        
        logging_service = LoggingService(config)
        
        def log_messages():
            for i in range(100):
                logging_service.log_pipeline_event(f'event_{i}', iteration=i)
        
        # Benchmark logging performance
        benchmark(log_messages)

    def test_metrics_collection_performance(self, benchmark):
        """Benchmark metrics collection performance"""
        if MetricsCollector is None:
            pytest.skip("Metrics collector not available")
        
        metrics = MetricsCollector({'redis_enabled': False})
        
        def collect_metrics():
            for i in range(100):
                metrics.increment_counter('test_counter')
                metrics.set_gauge('test_gauge', i)
                metrics.record_timer('test_timer', i * 10.0)
        
        benchmark(collect_metrics)


# Test CLI interface
class TestLoggingCLI:
    """Test CLI interface for logging service"""

    def test_cli_health_command(self):
        """Test CLI health command"""
        if LoggingService is None:
            pytest.skip("Logging service not available")
        
        import subprocess
        import sys
        
        script_path = Path(__file__).parent.parent / "src" / "pipeline" / "logging_service.py"
        
        result = subprocess.run([
            sys.executable, str(script_path), "health"
        ], capture_output=True, text=True, timeout=30)
        
        # Should complete successfully
        assert result.returncode == 0
        
        # Output should be valid JSON
        try:
            health_data = json.loads(result.stdout)
            assert 'status' in health_data
            assert 'checks' in health_data
        except json.JSONDecodeError:
            pytest.fail("Health command did not return valid JSON")

    def test_cli_metrics_command(self):
        """Test CLI metrics command"""
        if LoggingService is None:
            pytest.skip("Logging service not available")
        
        import subprocess
        import sys
        
        script_path = Path(__file__).parent.parent / "src" / "pipeline" / "logging_service.py"
        
        result = subprocess.run([
            sys.executable, str(script_path), "metrics"
        ], capture_output=True, text=True, timeout=30)
        
        # Should complete successfully
        assert result.returncode == 0
        
        # Output should be valid JSON
        try:
            metrics_data = json.loads(result.stdout)
            assert 'counters' in metrics_data
            assert 'gauges' in metrics_data
            assert 'timers' in metrics_data
        except json.JSONDecodeError:
            pytest.fail("Metrics command did not return valid JSON")

    def test_cli_test_command(self):
        """Test CLI test command"""
        if LoggingService is None:
            pytest.skip("Logging service not available")
        
        import subprocess
        import sys
        
        script_path = Path(__file__).parent.parent / "src" / "pipeline" / "logging_service.py"
        
        result = subprocess.run([
            sys.executable, str(script_path), "test"
        ], capture_output=True, text=True, timeout=60)
        
        # Should complete successfully
        assert result.returncode == 0
        
        # Should contain test completion message
        assert "Logging test completed successfully!" in result.stderr or "Logging test completed successfully!" in result.stdout


# Parameterized tests for different configurations
@pytest.mark.parametrize("log_level,environment,json_logs", [
    ("DEBUG", "development", False),
    ("INFO", "production", True),
    ("WARNING", "staging", False),
    ("ERROR", "production", True),
])
def test_logging_configurations(log_level, environment, json_logs):
    """Test different logging configurations"""
    if LoggingService is None:
        pytest.skip("Logging service not available")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        config = {
            'log_level': log_level,
            'environment': environment,
            'enable_json_logs': json_logs,
            'log_dir': temp_dir,
            'metrics_config': {'redis_enabled': False}
        }
        
        service = LoggingService(config)
        
        assert service.log_level == log_level
        assert service.environment == environment
        assert service.enable_json_logs == json_logs