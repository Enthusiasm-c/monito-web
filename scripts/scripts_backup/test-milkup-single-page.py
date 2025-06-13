#!/usr/bin/env python3
"""Test milk up.pdf with AI Vision - single page only"""

import os
import sys
import json

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from ai_pdf_ocr_extractor import AiPdfOcrExtractor

# Get API key from environment
api_key = os.getenv('OPENAI_API_KEY')
pdf_path = "/Users/denisdomashenko/Downloads/aibuyer/milk up.pdf"

print("🚀 Testing milk up.pdf with AI Vision OCR (single page)")
print("=" * 80)

try:
    extractor = AiPdfOcrExtractor(api_key)
    
    # Process only first page
    result = extractor.process_pdf(pdf_path, max_pages=1)
    
    if 'error' in result and not result['products']:
        print(f"❌ Error: {result['error']}")
    else:
        products = result['products']
        metrics = result['metrics']
        
        print(f"\n📊 Results from first page:")
        print(f"  • Products extracted: {len(products)}")
        print(f"  • Pages processed: {metrics['pages_processed']}")
        
        if products:
            print(f"\n📝 Products found:")
            for i, product in enumerate(products):
                print(f"  {i+1}. {product['name']}: {product['price']:,.0f} IDR ({product.get('unit', 'pcs')})")
                if 'price_type' in product:
                    print(f"     Type: {product['price_type']}")
        else:
            print("  No products found on first page")
            
except Exception as e:
    print(f"❌ Fatal error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)