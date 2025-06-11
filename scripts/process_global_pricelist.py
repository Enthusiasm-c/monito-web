#!/usr/bin/env python3
"""Process Pricelist - Global.pdf with AI Vision OCR"""

import os
import sys
import json

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from ai_pdf_ocr_extractor import AiPdfOcrExtractor

api_key = os.getenv('OPENAI_API_KEY')
pdf_path = "/Users/denisdomashenko/Downloads/aibuyer/Pricelist - Global.pdf"

print("🚀 Processing Pricelist - Global.pdf with AI Vision OCR")
print("=" * 80)
print("ℹ️ This is an image-based PDF that requires OCR")

try:
    extractor = AiPdfOcrExtractor(api_key)
    
    # Process the PDF (it has only 1 page)
    result = extractor.process_pdf(pdf_path)
    
    if 'error' in result and not result['products']:
        print(f"❌ Error: {result['error']}")
    else:
        products = result['products']
        metrics = result['metrics']
        
        print(f"\n📊 RESULTS:")
        print(f"  • Total products extracted: {len(products)}")
        print(f"  • Pages processed: {metrics['pages_processed']}")
        
        if products:
            # Categorize products
            categories = {}
            for product in products:
                name_lower = product['name'].lower()
                # Try to categorize based on product name
                if any(word in name_lower for word in ['bread', 'baguette', 'croissant', 'pain', 'brioche']):
                    cat = 'bakery'
                elif any(word in name_lower for word in ['cake', 'tart', 'gateau', 'dessert']):
                    cat = 'desserts'
                elif any(word in name_lower for word in ['sandwich', 'panini']):
                    cat = 'sandwiches'
                else:
                    cat = 'other'
                    
                categories[cat] = categories.get(cat, 0) + 1
            
            print(f"\n📦 Product categories:")
            for cat, count in sorted(categories.items()):
                print(f"  • {cat.capitalize()}: {count} products")
            
            print(f"\n📝 Sample products:")
            for i, product in enumerate(products[:15]):
                print(f"  {i+1}. {product['name']}: {product['price']:,.0f} IDR")
                if 'notes' in product and product['notes']:
                    print(f"     Notes: {product['notes']}")
                    
            if len(products) > 15:
                print(f"  ... and {len(products) - 15} more products")
            
            # Save results
            output_file = "/Users/denisdomashenko/monito-web/global_pricelist_products.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'filename': 'Pricelist - Global.pdf',
                    'extraction_method': 'AI Vision OCR',
                    'products': products,
                    'metrics': metrics,
                    'categories': categories
                }, f, ensure_ascii=False, indent=2)
            print(f"\n💾 Results saved to: {output_file}")
        else:
            print("\n⚠️ No products found. This might not be a price list.")
            
except Exception as e:
    print(f"❌ Fatal error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)