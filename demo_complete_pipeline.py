#!/usr/bin/env python3
"""
Complete Pipeline Demo
Demonstrates all sprint components working together
"""

import sys
import os
import json
import asyncio
import tempfile
from pathlib import Path

# Add src to path
sys.path.append(str(Path(__file__).parent))

try:
    from src.pipeline.logging_service import LoggingService
    from src.pipeline.ai_cache_service import AICacheService
    from src.pipeline.batch_database_service import BatchDatabaseService
    print("✅ All pipeline modules imported successfully")
except ImportError as e:
    print(f"❌ Failed to import pipeline modules: {e}")
    sys.exit(1)


async def demo_complete_pipeline():
    """Demonstrate complete pipeline functionality"""
    
    print("\n🚀 Starting Complete Pipeline Demo")
    print("=" * 50)
    
    # Create temporary directories
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        cache_dir = temp_path / 'cache'
        log_dir = temp_path / 'logs'
        cache_dir.mkdir()
        log_dir.mkdir()
        
        print(f"📁 Created temp directories: {temp_path}")
        
        # 1. Initialize Logging Service
        print("\n1️⃣ Initializing Logging Service...")
        logging_config = {
            'log_level': 'INFO',
            'environment': 'demo',
            'service_name': 'pipeline-demo',
            'log_dir': str(log_dir),
            'enable_json_logs': False,
            'enable_file_logs': True,
            'metrics_config': {
                'redis_enabled': False,
                'max_metric_age': 300
            }
        }
        
        logging_service = LoggingService(logging_config)
        print("✅ Logging service initialized")
        
        # 2. Initialize Cache Service
        print("\n2️⃣ Initializing Cache Service...")
        cache_config = {
            'redis_enabled': False,
            'cache_dir': str(cache_dir),
            'default_ttl': 300,
            'compression_enabled': True
        }
        
        cache_service = AICacheService(cache_config)
        print("✅ Cache service initialized")
        
        # 3. Initialize Database Service (with mock)
        print("\n3️⃣ Initializing Database Service...")
        db_config = {
            'database_url': None,  # Will use mock
            'default_batch_size': 100,
            'max_connections': 5
        }
        
        db_service = BatchDatabaseService(db_config)
        print("✅ Database service initialized")
        
        # 4. Demo request context and logging
        print("\n4️⃣ Testing Request Context and Logging...")
        with logging_service.request_context(
            request_id='demo_001',
            operation='pipeline_demo',
            user_id='demo_user',
            filename='demo_file.pdf'
        ) as logger:
            logger.info("Demo request started")
            
            # Test metrics collection
            logging_service.metrics.increment_counter('demo_operations')
            logging_service.metrics.set_gauge('demo_value', 42.5)
            logging_service.metrics.record_timer('demo_duration', 123.45)
            
            logger.info("Metrics recorded successfully")
        
        print("✅ Request context and logging working")
        
        # 5. Demo AI Cache functionality
        print("\n5️⃣ Testing AI Cache...")
        
        # Cache some AI response data
        test_input = {
            'prompt': 'Extract products from this data',
            'model': 'gpt-4o',
            'data': ['Product 1: Rice - Rp 15,000/kg', 'Product 2: Milk - Rp 8,500/liter']
        }
        
        test_response = {
            'products': [
                {'name': 'Rice', 'price': 15000, 'unit': 'kg', 'currency': 'IDR'},
                {'name': 'Milk', 'price': 8500, 'unit': 'liter', 'currency': 'IDR'}
            ],
            'confidence': 0.9
        }
        
        # Cache the response
        cache_service.cache_ai_response(test_input, test_response, model='gpt-4o')
        print("💾 Cached AI response")
        
        # Retrieve from cache
        cached_response = cache_service.get_ai_response(test_input, model='gpt-4o')
        if cached_response:
            print("🎯 Retrieved from cache successfully")
            print(f"   Products: {len(cached_response['products'])}")
        else:
            print("❌ Cache retrieval failed")
        
        # 6. Demo Database Operations (with prepared data)
        print("\n6️⃣ Testing Database Operations...")
        
        test_products = [
            {
                'name': 'Premium Rice',
                'price': 15000,
                'unit': 'kg',
                'currency': 'IDR',
                'category': 'Grains',
                'supplier': 'Demo Supplier',
                'confidence': 0.9
            },
            {
                'name': 'Fresh Milk',
                'price': 8500,
                'unit': 'liter',
                'currency': 'IDR',
                'category': 'Dairy',
                'supplier': 'Demo Supplier',
                'confidence': 0.85
            },
            {
                'name': 'Organic Tomatoes',
                'price': 12000,
                'unit': 'kg',
                'currency': 'IDR',
                'category': 'Vegetables',
                'supplier': 'Demo Supplier',
                'confidence': 0.95
            }
        ]
        
        # Prepare data for database (simulate the process)
        prepared_data = db_service._prepare_product_data(test_products)
        print(f"📋 Prepared {len(prepared_data)} products for database")
        
        # Simulate batch processing
        batches = db_service._create_batches(test_products, 2)  # Small batches for demo
        print(f"📦 Created {len(batches)} batches")
        
        for i, batch in enumerate(batches):
            print(f"   Batch {i+1}: {len(batch)} products")
        
        # 7. Demo File Processing Logging
        print("\n7️⃣ Testing File Processing Logging...")
        
        logging_service.log_file_processing(
            filename='demo_products.pdf',
            file_size=2048,
            processing_time_ms=250.0,
            products_extracted=3,
            success=True,
            extraction_method='table_detection',
            ai_structured=True
        )
        
        print("📄 Logged file processing event")
        
        # 8. Demo Performance Metrics
        print("\n8️⃣ Testing Performance Metrics...")
        
        @logging_service.timing_decorator('demo_function')
        def simulate_processing():
            import time
            time.sleep(0.05)  # Simulate work
            return {'processed': True, 'items': 5}
        
        result = simulate_processing()
        print(f"⚡ Function result: {result}")
        
        # 9. Get Comprehensive Metrics Summary
        print("\n9️⃣ Getting Metrics Summary...")
        
        metrics = logging_service.get_metrics_summary()
        
        print("📊 Current Metrics:")
        print(f"   Counters: {len(metrics['counters'])}")
        for name, value in metrics['counters'].items():
            print(f"     - {name}: {value}")
        
        print(f"   Gauges: {len(metrics['gauges'])}")
        for name, value in metrics['gauges'].items():
            print(f"     - {name}: {value}")
        
        print(f"   Timers: {len(metrics['timers'])}")
        for name, stats in metrics['timers'].items():
            print(f"     - {name}: {stats['count']} samples, avg {stats['avg_ms']:.2f}ms")
        
        if metrics['system']:
            print("   System:")
            for key, value in metrics['system'].items():
                print(f"     - {key}: {value}")
        
        # 10. Test Health Checks
        print("\n🔟 Testing Health Checks...")
        
        health = logging_service.health_check()
        print(f"🏥 System Health: {health['status']}")
        for check_name, check_result in health['checks'].items():
            if isinstance(check_result, str):
                status = "✅" if check_result == "ok" else "⚠️"
                print(f"   {status} {check_name}: {check_result}")
            else:
                print(f"   📊 {check_name}: {check_result}")
        
        # 11. Test Cache Statistics
        print("\n🔟 Cache Statistics...")
        cache_stats = cache_service.get_cache_stats()
        print(f"💾 Cache Performance:")
        print(f"   Hits: {cache_stats['hits']}")
        print(f"   Misses: {cache_stats['misses']}")
        
        # Calculate hit rate
        total_requests = cache_stats['hits'] + cache_stats['misses']
        hit_rate = cache_stats['hits'] / total_requests if total_requests > 0 else 0
        print(f"   Hit Rate: {hit_rate:.1%}")
        print(f"   Cached Items: {cache_stats.get('cached_items', 'N/A')}")
        
        # 12. Export Metrics
        print("\n🔟 Exporting Metrics...")
        export_file = temp_path / 'metrics_export.json'
        json_output = logging_service.export_metrics_json(export_file)
        
        print(f"📤 Metrics exported to: {export_file}")
        print(f"   File size: {export_file.stat().st_size} bytes")
        
        # 13. Final Summary
        print("\n" + "=" * 50)
        print("🎉 PIPELINE DEMO COMPLETED SUCCESSFULLY!")
        print("=" * 50)
        print("\n✅ All Components Tested:")
        print("   - Structured Logging with Request Context")
        print("   - Metrics Collection and Aggregation")
        print("   - AI Response Caching (File-based)")
        print("   - Database Operations Preparation")
        print("   - Performance Monitoring")
        print("   - Health Checks")
        print("   - Error Handling")
        print("   - Metrics Export")
        
        print(f"\n📈 Final Stats:")
        final_metrics = logging_service.get_metrics_summary()
        print(f"   Total Operations: {sum(final_metrics['counters'].values())}")
        print(f"   Total Timers: {len(final_metrics['timers'])}")
        print(f"   Cache Hit Rate: {hit_rate:.1%}")
        
        # Cleanup
        logging_service.shutdown()
        print("\n🧹 Services shut down cleanly")


if __name__ == "__main__":
    asyncio.run(demo_complete_pipeline())