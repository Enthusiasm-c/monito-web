#!/usr/bin/env python3
"""Test milk up.pdf page 2 with AI Vision"""

import os
import sys
import json

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from ai_pdf_ocr_extractor import AiPdfOcrExtractor
from pdf2image import convert_from_path

api_key = os.getenv('OPENAI_API_KEY')
pdf_path = "/Users/denisdomashenko/Downloads/aibuyer/milk up.pdf"

print("🚀 Testing milk up.pdf page 2 with AI Vision")
print("=" * 80)

try:
    # Convert page 2 to image
    images = convert_from_path(pdf_path, dpi=200, first_page=2, last_page=2)
    if images:
        temp_path = "/tmp/milkup_page2.jpg"
        images[0].save(temp_path, 'JPEG', quality=95)
        print(f"✅ Page 2 saved to {temp_path}")
        
        # Now extract products from this image
        extractor = AiPdfOcrExtractor(api_key)
        result = extractor.extract_products_from_image(temp_path, 2)
        
        if 'error' in result:
            print(f"❌ Error: {result['error']}")
        else:
            products = result.get('products', [])
            page_info = result.get('page_info', {})
            
            print(f"\n📊 Results from page 2:")
            print(f"  • Products extracted: {len(products)}")
            print(f"  • Total visible: {page_info.get('total_products_visible', 'unknown')}")
            
            if products:
                print(f"\n📝 Products found:")
                for i, product in enumerate(products[:10]):  # Show first 10
                    print(f"  {i+1}. {product['name']}: {product['price']:,.0f} IDR")
                    if 'size' in product:
                        print(f"     Size: {product['size']}")
                    if 'notes' in product:
                        print(f"     Notes: {product['notes']}")
                        
                if len(products) > 10:
                    print(f"  ... and {len(products) - 10} more products")
                    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)