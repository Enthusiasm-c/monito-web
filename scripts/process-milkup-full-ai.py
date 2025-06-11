#!/usr/bin/env python3
"""Process entire milk up.pdf with AI Vision"""

import os
import sys
import json

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from ai_pdf_ocr_extractor import AiPdfOcrExtractor

api_key = os.getenv('OPENAI_API_KEY')
pdf_path = "/Users/denisdomashenko/Downloads/aibuyer/milk up.pdf"

print("🚀 Processing entire milk up.pdf with AI Vision OCR")
print("=" * 80)

try:
    extractor = AiPdfOcrExtractor(api_key)
    
    # Process all pages
    result = extractor.process_pdf(pdf_path)
    
    if 'error' in result and not result['products']:
        print(f"❌ Error: {result['error']}")
    else:
        products = result['products']
        metrics = result['metrics']
        page_results = result.get('page_results', [])
        
        print(f"\n📊 COMPLETE RESULTS:")
        print(f"  • Total products extracted: {len(products)}")
        print(f"  • Pages processed: {metrics['pages_processed']}")
        print(f"  • Products before dedup: {metrics['products_before_dedup']}")
        print(f"  • Estimated cost: ${metrics['cost_usd']:.4f}")
        
        # Show page breakdown
        print(f"\n📄 Page breakdown:")
        for page_result in page_results:
            page_num = page_result['page']
            count = page_result['products_count']
            error = page_result.get('error', '')
            status = "❌" if error else "✅"
            print(f"  {status} Page {page_num}: {count} products {f'({error})' if error else ''}")
        
        # Categorize products
        categories = {}
        for product in products:
            name_lower = product['name'].lower()
            if 'yogurt' in name_lower or 'yoghurt' in name_lower:
                categories['yogurt'] = categories.get('yogurt', 0) + 1
            elif 'cheese' in name_lower or 'keju' in name_lower:
                categories['cheese'] = categories.get('cheese', 0) + 1
            elif 'milk' in name_lower or 'cream' in name_lower:
                categories['milk/cream'] = categories.get('milk/cream', 0) + 1
            elif 'bar' in name_lower:
                categories['bars'] = categories.get('bars', 0) + 1
            else:
                categories['other'] = categories.get('other', 0) + 1
        
        print(f"\n📦 Product categories:")
        for cat, count in sorted(categories.items()):
            print(f"  • {cat.capitalize()}: {count} products")
        
        # Show sample products
        print(f"\n📝 Sample products:")
        for i, product in enumerate(products[:15]):
            print(f"  {i+1}. {product['name']}: {product['price']:,.0f} IDR")
            
        if len(products) > 15:
            print(f"  ... and {len(products) - 15} more products")
        
        # Save results
        output_file = "/Users/denisdomashenko/monito-web/milk_up_ai_vision_complete.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump({
                'filename': 'milk up.pdf',
                'extraction_method': 'AI Vision OCR',
                'products': products,
                'metrics': metrics,
                'page_results': page_results
            }, f, ensure_ascii=False, indent=2)
        print(f"\n💾 Full results saved to: {output_file}")
        
        # Compare with original
        print(f"\n📈 IMPROVEMENT SUMMARY:")
        print(f"  • Original extraction: 47 products (7.8% completeness)")
        print(f"  • AI Vision extraction: {len(products)} products")
        improvement = (len(products) / 47) if 47 > 0 else 0
        print(f"  • Improvement: {improvement:.1f}x better")
        
except Exception as e:
    print(f"❌ Fatal error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)