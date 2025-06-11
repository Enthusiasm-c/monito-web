#!/usr/bin/env python3
"""Test remaining files and problem files"""

import os
import sys
import json

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from enhanced_pdf_processor import EnhancedPdfProcessor

# Files to test
test_files = [
    {
        'path': '/Users/denisdomashenko/Downloads/aibuyer/lestari pangan.pdf',
        'name': 'lestari pangan.pdf'
    },
    {
        'path': '/Users/denisdomashenko/Downloads/aibuyer/sutria pangan sejati.pdf', 
        'name': 'sutria pangan sejati.pdf'
    },
    {
        'path': '/Users/denisdomashenko/Downloads/aibuyer/milk up.pdf',
        'name': 'milk up.pdf'
    },
    {
        'path': '/Users/denisdomashenko/Downloads/aibuyer/Pricelist - Global.pdf',
        'name': 'Pricelist - Global.pdf'
    }
]

processor = EnhancedPdfProcessor()

print("📊 TESTING REMAINING AND PROBLEM FILES")
print("=" * 80)

for file_info in test_files:
    print(f"\n🔍 Testing: {file_info['name']}")
    print("-" * 40)
    
    try:
        result = processor.process_pdf(file_info['path'])
        
        products = len(result['products'])
        total_rows = result['metrics']['totalRowsDetected']
        processed_rows = result['metrics']['totalRowsProcessed']
        completeness = (processed_rows / total_rows * 100) if total_rows > 0 else 0
        
        print(f"✅ Products extracted: {products}")
        print(f"📊 Rows: {processed_rows}/{total_rows} ({completeness:.1f}%)")
        print(f"🔧 Best method: {result['extractionMethods']['bestMethod']}")
        
        if products < 10:
            print(f"⚠️ WARNING: Very few products extracted!")
            
        # Show first 5 products
        if products > 0:
            print("\nFirst 5 products:")
            for i, product in enumerate(result['products'][:5]):
                print(f"  {i+1}. {product['name']}: {product['price']:,.0f} IDR")
                
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")

print("\n" + "=" * 80)