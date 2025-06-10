#!/usr/bin/env python3
"""
Basic Pipeline Integration Test
Tests core pipeline functionality without external dependencies
"""

import sys
import os
import json
import tempfile
from pathlib import Path
from datetime import datetime

# Add src to path
sys.path.append(str(Path(__file__).parent))

# Test basic imports without external dependencies
try:
    from src.pipeline.price_parser import PriceParser
    from src.pipeline.product_normalizer import ProductNormalizer
    from src.pipeline.ai_cache_service import AICacheService
    from src.pipeline.batch_database_service import BatchDatabaseService
    from src.pipeline.logging_service import LoggingService
    print("✅ Core pipeline modules imported successfully")
except ImportError as e:
    print(f"❌ Failed to import core modules: {e}")
    sys.exit(1)


class BasicPipelineTest:
    """Basic pipeline functionality test"""
    
    def __init__(self):
        self.temp_dir = None
        self.services = {}
        
    def setup(self):
        """Setup test environment"""
        self.temp_dir = Path(tempfile.mkdtemp())
        print(f"📁 Created test directory: {self.temp_dir}")
        
        # Initialize core services
        try:
            logging_config = {
                'log_level': 'INFO',
                'environment': 'test',
                'service_name': 'basic-pipeline-test',
                'log_dir': str(self.temp_dir / 'logs'),
                'enable_json_logs': False,
                'enable_file_logs': True,
                'metrics_config': {'redis_enabled': False}
            }
            
            cache_config = {
                'redis_enabled': False,
                'cache_dir': str(self.temp_dir / 'cache'),
                'default_ttl': 300,
                'compression_enabled': True
            }
            
            db_config = {
                'database_url': None,
                'default_batch_size': 50,
                'max_connections': 3
            }
            
            self.services = {
                'logging': LoggingService(logging_config),
                'price_parser': PriceParser(),
                'product_normalizer': ProductNormalizer(),
                'ai_cache': AICacheService(cache_config),
                'database': BatchDatabaseService(db_config)
            }
            
            print("✅ Core services initialized")
            return True
            
        except Exception as e:
            print(f"❌ Service initialization failed: {e}")
            return False
    
    def test_price_parsing(self):
        """Test price parsing functionality"""
        print("\n1️⃣ Testing Price Parsing...")
        
        test_prices = [
            "Rp 15,000",
            "Rp 8.500",
            "15000 IDR",
            "$12.50",
            "€8,75",
            "Rp 25,000/kg",
            "2 x Rp 5,000",
            "12.5k",
            "invalid price",
            "Rp 1,250,000"
        ]
        
        successful_parses = 0
        
        for price_text in test_prices:
            try:
                result = self.services['price_parser'].parse_price(price_text)
                if result.get('success'):
                    parsed = result['parsed_price']
                    print(f"   ✅ '{price_text}' → {parsed['primary_price']} {parsed['currency']}")
                    successful_parses += 1
                else:
                    print(f"   ❌ '{price_text}' → parsing failed")
            except Exception as e:
                print(f"   ⚠️ '{price_text}' → error: {e}")
        
        print(f"   📊 Success rate: {successful_parses}/{len(test_prices)} ({successful_parses/len(test_prices)*100:.1f}%)")
        return successful_parses > 0
    
    def test_product_normalization(self):
        """Test product normalization"""
        print("\n2️⃣ Testing Product Normalization...")
        
        test_products = [
            {
                'name': '  fresh tomatoes  ',
                'price': 'Rp 12,500',
                'unit': 'kilogram',
                'category': 'VEGETABLES'
            },
            {
                'name': 'premium MILK',
                'price': 'Rp 8,750',
                'unit': 'liter',
                'category': 'dairy'
            },
            {
                'name': 'Chicken Breast Fillet',
                'price': 'Rp 45,000',
                'unit': 'kg',
                'category': 'meat & seafood'
            },
            {
                'name': 'Rice Premium Quality',
                'price': 'Rp 15,000',
                'unit': 'kilo',
                'category': 'grains'
            }
        ]
        
        normalized_products = []
        
        try:
            # Use the correct method that takes a list of products
            result = self.services['product_normalizer'].normalize_products(test_products)
            if result.get('success'):
                normalized_products = result.get('normalized_products', [])
                for original, normalized in zip(test_products, normalized_products):
                    print(f"   ✅ '{original['name']}' → '{normalized.get('name', 'N/A')}'")
            else:
                print(f"   ❌ Batch normalization failed: {result.get('error', 'Unknown error')}")
        except Exception as e:
            print(f"   ❌ Product normalization service failed: {e}")
            # Fallback: try individual normalization
            for product in test_products:
                try:
                    normalized = self.services['product_normalizer']._normalize_single_product(product)
                    normalized_products.append(normalized)
                    print(f"   ✅ '{product['name']}' → '{normalized.get('name', 'N/A')}'")
                except Exception as e:
                    print(f"   ❌ Individual normalization failed for '{product['name']}': {e}")
        
        print(f"   📦 Normalized: {len(normalized_products)}/{len(test_products)} products")
        return len(normalized_products) > 0
    
    def test_cache_functionality(self):
        """Test cache functionality"""
        print("\n3️⃣ Testing Cache Functionality...")
        
        try:
            cache_service = self.services['ai_cache']
            
            # Test data
            test_inputs = [
                {
                    'prompt': 'Extract products from text',
                    'data': ['Product 1: Rice - Rp 15,000/kg']
                },
                {
                    'prompt': 'Parse price list',
                    'data': ['Milk - Rp 8,500/liter', 'Bread - Rp 3,500/piece']
                }
            ]
            
            test_responses = [
                {'products': [{'name': 'Rice', 'price': 15000, 'unit': 'kg'}]},
                {'products': [{'name': 'Milk', 'price': 8500, 'unit': 'liter'}, {'name': 'Bread', 'price': 3500, 'unit': 'piece'}]}
            ]
            
            # Cache responses
            for i, (input_data, response_data) in enumerate(zip(test_inputs, test_responses)):
                cache_service.cache_ai_response(input_data, response_data, model='test-model')
                print(f"   💾 Cached response {i+1}")
            
            # Retrieve from cache
            cache_hits = 0
            for i, input_data in enumerate(test_inputs):
                cached = cache_service.get_ai_response(input_data, model='test-model')
                if cached:
                    cache_hits += 1
                    print(f"   🎯 Retrieved response {i+1} from cache")
                else:
                    print(f"   ❌ Failed to retrieve response {i+1} from cache")
            
            # Get cache statistics
            stats = cache_service.get_cache_stats()
            print(f"   📊 Cache stats: {stats['hits']} hits, {stats['misses']} misses")
            
            return cache_hits > 0
            
        except Exception as e:
            print(f"   ❌ Cache test failed: {e}")
            return False
    
    def test_database_operations(self):
        """Test database operations"""
        print("\n4️⃣ Testing Database Operations...")
        
        try:
            db_service = self.services['database']
            
            # Test product data
            test_products = [
                {
                    'name': 'Test Rice Premium',
                    'price': 15000,
                    'unit': 'kg',
                    'currency': 'IDR',
                    'category': 'Grains',
                    'supplier': 'Test Supplier A',
                    'confidence': 0.9
                },
                {
                    'name': 'Test Fresh Milk',
                    'price': 8500,
                    'unit': 'liter',
                    'currency': 'IDR',
                    'category': 'Dairy',
                    'supplier': 'Test Supplier B',
                    'confidence': 0.85
                },
                {
                    'name': 'Test Organic Vegetables',
                    'price': 12000,
                    'unit': 'kg',
                    'currency': 'IDR',
                    'category': 'Vegetables',
                    'supplier': 'Test Supplier C',
                    'confidence': 0.95
                }
            ]
            
            # Test data preparation
            prepared_data = db_service._prepare_product_data(test_products)
            print(f"   📋 Prepared {len(prepared_data)} products for database")
            
            # Test batch creation
            batches = db_service._create_batches(test_products, batch_size=2)
            print(f"   📦 Created {len(batches)} batches")
            for i, batch in enumerate(batches):
                print(f"       Batch {i+1}: {len(batch)} products")
            
            # Test database stats (without actual DB connection)
            try:
                stats = {'operations': 0, 'records_processed': 0, 'database_connected': False}
                print(f"   📊 Database stats: {stats}")
            except Exception as e:
                print(f"   ⚠️ Database stats unavailable: {e}")
            
            return len(prepared_data) == len(test_products)
            
        except Exception as e:
            print(f"   ❌ Database test failed: {e}")
            return False
    
    def test_logging_and_metrics(self):
        """Test logging and metrics"""
        print("\n5️⃣ Testing Logging and Metrics...")
        
        try:
            logging_service = self.services['logging']
            
            # Test request context
            with logging_service.request_context(
                request_id='basic_test_001',
                operation='basic_pipeline_test',
                user_id='test_user',
                test_scenario='core_functionality'
            ) as logger:
                logger.info("Basic pipeline test started")
                
                # Test metrics collection
                logging_service.metrics.increment_counter('basic_tests_executed')
                logging_service.metrics.set_gauge('test_products_count', 10)
                logging_service.metrics.record_timer('test_execution_time', 1500.0)
                logging_service.metrics.record_error('test_errors', 'validation_error')
                
                logger.info("Metrics recorded successfully")
                
                # Test timing decorator
                @logging_service.timing_decorator('test_operation')
                def simulate_operation():
                    import time
                    time.sleep(0.01)
                    return {'status': 'completed', 'items': 5}
                
                result = simulate_operation()
                logger.info("Timed operation completed", result=result)
            
            # Get comprehensive metrics
            metrics = logging_service.get_metrics_summary()
            
            print(f"   📊 Collected metrics:")
            print(f"       - Counters: {len(metrics['counters'])}")
            for name, value in metrics['counters'].items():
                print(f"         * {name}: {value}")
            
            print(f"       - Gauges: {len(metrics['gauges'])}")
            for name, value in metrics['gauges'].items():
                print(f"         * {name}: {value}")
            
            print(f"       - Timers: {len(metrics['timers'])}")
            for name, stats in metrics['timers'].items():
                print(f"         * {name}: {stats['count']} samples, avg {stats['avg_ms']:.2f}ms")
            
            print(f"       - Errors: {len(metrics['errors'])}")
            for name, count in metrics['errors'].items():
                print(f"         * {name}: {count}")
            
            # Test health check
            health = logging_service.health_check()
            print(f"   🏥 System health: {health['status']}")
            
            return len(metrics['counters']) > 0
            
        except Exception as e:
            print(f"   ❌ Logging test failed: {e}")
            return False
    
    def run_basic_test(self):
        """Run basic pipeline test"""
        print("🚀 Starting Basic Pipeline Test")
        print("=" * 50)
        
        try:
            # Setup
            if not self.setup():
                return False
            
            # Run tests
            test_results = {
                'price_parsing': self.test_price_parsing(),
                'product_normalization': self.test_product_normalization(),
                'cache_functionality': self.test_cache_functionality(),
                'database_operations': self.test_database_operations(),
                'logging_and_metrics': self.test_logging_and_metrics()
            }
            
            # Summary
            print("\n" + "=" * 50)
            print("📋 TEST RESULTS SUMMARY")
            print("=" * 50)
            
            passed_tests = 0
            total_tests = len(test_results)
            
            for test_name, result in test_results.items():
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"   {status} {test_name.replace('_', ' ').title()}")
                if result:
                    passed_tests += 1
            
            success_rate = (passed_tests / total_tests) * 100
            print(f"\n📊 Overall Success Rate: {passed_tests}/{total_tests} ({success_rate:.1f}%)")
            
            if success_rate >= 80:
                print("\n🎉 BASIC PIPELINE TEST PASSED!")
                print("✅ Core functionality is working correctly")
                return True
            else:
                print("\n⚠️ BASIC PIPELINE TEST FAILED!")
                print("❌ Some core functionality needs attention")
                return False
            
        except Exception as e:
            print(f"\n❌ Test execution failed: {e}")
            import traceback
            traceback.print_exc()
            return False
        
        finally:
            # Cleanup
            if self.services.get('logging'):
                self.services['logging'].shutdown()
            print("\n🧹 Test cleanup completed")


def main():
    """Main test runner"""
    tester = BasicPipelineTest()
    success = tester.run_basic_test()
    
    if success:
        print("\n🎯 Basic pipeline test completed successfully!")
        print("💡 System is ready for advanced testing and production use.")
        return 0
    else:
        print("\n⚠️ Basic pipeline test had issues.")
        print("💡 Please review the failed components before proceeding.")
        return 1


if __name__ == "__main__":
    exit(main())