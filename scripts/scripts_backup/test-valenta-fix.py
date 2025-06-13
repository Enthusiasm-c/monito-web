#!/usr/bin/env python3
"""Test VALENTA extraction with enhanced processor"""

import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the enhanced processor
from enhanced_pdf_processor import EnhancedPdfProcessor

# Test with VALENTA
pdf_path = "/Users/denisdomashenko/Downloads/aibuyer/VALENTA cheese supplier.pdf"
processor = EnhancedPdfProcessor()

print("Testing VALENTA with enhanced processor...")
print("=" * 60)

# Process with local file
import json
result = processor.process_pdf(pdf_path)

print(f"\nProducts extracted: {len(result['products'])}")
print(f"Methods used: {result['extractionMethods']}")

# Show first 5 products
print("\nFirst 5 products:")
for i, product in enumerate(result['products'][:5]):
    print(f"{i+1}. {product['name']}: {product['price']:,.0f} IDR")

print("\n" + "=" * 60)
print("Full result:")
print(json.dumps(result, indent=2, ensure_ascii=False))