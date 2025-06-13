#!/usr/bin/env python3
"""Test Island Organics extraction with enhanced processor and AI OCR fallback"""

import sys
import os
import json

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the enhanced processor
from enhanced_pdf_processor import EnhancedPdfProcessor

# Test with Island Organics
pdf_path = "/Users/denisdomashenko/Downloads/aibuyer/Island Organics Bali.pdf"
processor = EnhancedPdfProcessor()

print("Testing Island Organics with enhanced processor...")
print("=" * 60)

# Process with local file
result = processor.process_pdf(pdf_path)

print(f"\nProducts extracted: {len(result['products'])}")
print(f"Methods used: {result['extractionMethods']}")

# Show first 10 products
print("\nFirst 10 products:")
for i, product in enumerate(result['products'][:10]):
    price_type = product.get('price_type', 'standard')
    print(f"{i+1}. {product['name']}: {product['price']:,.0f} IDR [{price_type}]")

# Show extraction statistics
print("\n" + "=" * 60)
print("Extraction Statistics:")
print(f"Total rows detected: {result['metrics']['totalRowsDetected']}")
print(f"Total rows processed: {result['metrics']['totalRowsProcessed']}")
print(f"Completeness ratio: {result['metrics']['totalRowsProcessed'] / result['metrics']['totalRowsDetected'] * 100:.1f}%")

# Test AI OCR if traditional extraction is poor
if len(result['products']) < 50:
    print("\n" + "=" * 60)
    print("Traditional extraction yielded few products. Testing AI OCR fallback...")
    
    api_key = os.getenv('OPENAI_API_KEY')
    if api_key:
        print("\nRunning AI OCR extraction (first 2 pages)...")
        
        # Import and run AI OCR extractor
        from ai_pdf_ocr_extractor import AiPdfOcrExtractor
        
        ocr_extractor = AiPdfOcrExtractor(api_key)
        ocr_result = ocr_extractor.process_pdf(pdf_path, max_pages=2)
        
        print(f"\nAI OCR extracted: {len(ocr_result['products'])} products from {ocr_result['metrics']['pages_processed']} pages")
        
        # Show first 10 AI OCR products
        print("\nFirst 10 AI OCR products:")
        for i, product in enumerate(ocr_result['products'][:10]):
            price_type = product.get('price_type', 'standard')
            print(f"{i+1}. {product['name']}: {product['price']:,.0f} IDR [{price_type}]")
    else:
        print("No OpenAI API key found. Set OPENAI_API_KEY to test AI OCR.")

print("\n" + "=" * 60)
print("Full result saved to: island_organics_test_result.json")

# Save full result
with open('island_organics_test_result.json', 'w') as f:
    json.dump(result, f, indent=2, ensure_ascii=False)