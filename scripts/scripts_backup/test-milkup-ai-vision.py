#!/usr/bin/env python3
"""Test milk up.pdf with AI Vision fallback"""

import os
import sys
import json

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from ai_pdf_ocr_extractor import AiPdfOcrExtractor

# Get API key from environment
api_key = os.getenv('OPENAI_API_KEY')
pdf_path = "/Users/denisdomashenko/Downloads/aibuyer/milk up.pdf"

print("🚀 Testing milk up.pdf with AI Vision OCR")
print("=" * 80)

# First test with limited pages to check if it works
print("\n1️⃣ Testing first 2 pages...")
extractor = AiPdfOcrExtractor(api_key)

# Convert first page to check
try:
    image_paths = extractor.pdf_to_images(pdf_path, dpi=150)
    print(f"✅ Successfully converted PDF to {len(image_paths)} images")
    
    # Process first 2 pages only
    result = extractor.process_pdf(pdf_path, max_pages=2)
    
    if 'error' in result and not result['products']:
        print(f"❌ Error: {result['error']}")
    else:
        products = result['products']
        metrics = result['metrics']
        
        print(f"\n📊 Results from first 2 pages:")
        print(f"  • Products extracted: {len(products)}")
        print(f"  • Pages processed: {metrics['pages_processed']}")
        print(f"  • Total pages: {metrics['total_pages']}")
        
        if products:
            print(f"\n📝 Sample products:")
            for i, product in enumerate(products[:5]):
                print(f"  {i+1}. {product['name']}: {product['price']:,.0f} IDR ({product.get('unit', 'pcs')})")
        
        # If successful, process entire document
        if len(products) > 10:
            print(f"\n2️⃣ Processing entire document ({metrics['total_pages']} pages)...")
            full_result = extractor.process_pdf(pdf_path)
            
            full_products = full_result['products']
            full_metrics = full_result['metrics']
            
            print(f"\n✅ COMPLETE RESULTS:")
            print(f"  • Total products extracted: {len(full_products)}")
            print(f"  • Pages processed: {full_metrics['pages_processed']}")
            print(f"  • Products before dedup: {full_metrics['products_before_dedup']}")
            print(f"  • Estimated cost: ${full_metrics['cost_usd']:.4f}")
            
            # Show product categories
            categories = {}
            for product in full_products:
                name_lower = product['name'].lower()
                if 'milk' in name_lower or 'susu' in name_lower:
                    categories['milk'] = categories.get('milk', 0) + 1
                elif 'cheese' in name_lower or 'keju' in name_lower:
                    categories['cheese'] = categories.get('cheese', 0) + 1
                elif 'yogurt' in name_lower or 'yoghurt' in name_lower:
                    categories['yogurt'] = categories.get('yogurt', 0) + 1
                else:
                    categories['other'] = categories.get('other', 0) + 1
            
            print(f"\n📦 Product categories:")
            for cat, count in sorted(categories.items()):
                print(f"  • {cat.capitalize()}: {count} products")
            
            # Save results
            output_file = "/Users/denisdomashenko/monito-web/milk_up_ai_vision_results.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(full_result, f, ensure_ascii=False, indent=2)
            print(f"\n💾 Full results saved to: {output_file}")
            
            # Compare with original extraction
            print(f"\n📈 IMPROVEMENT:")
            print(f"  • Original extraction: 47 products (7.8% completeness)")
            print(f"  • AI Vision extraction: {len(full_products)} products")
            improvement = (len(full_products) / 47) if 47 > 0 else 0
            print(f"  • Improvement: {improvement:.1f}x")
            
except Exception as e:
    print(f"❌ Fatal error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)