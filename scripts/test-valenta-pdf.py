#!/usr/bin/env python3
"""Test VALENTA PDF extraction to diagnose issues"""

import pdfplumber
import pandas as pd
import sys
import os

# Add parent directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src', 'pipeline'))
from price_parser import PriceParser

pdf_path = "/Users/denisdomashenko/Downloads/aibuyer/VALENTA cheese supplier.pdf"
price_parser = PriceParser()

print("🔍 Analyzing VALENTA cheese supplier PDF...")
print("=" * 60)

with pdfplumber.open(pdf_path) as pdf:
    print(f"Total pages: {len(pdf.pages)}")
    
    for page_num, page in enumerate(pdf.pages[:2]):  # Check first 2 pages
        print(f"\n📄 Page {page_num + 1}:")
        
        # Extract tables
        tables = page.extract_tables()
        print(f"   Tables found: {len(tables)}")
        
        if tables:
            for table_idx, table in enumerate(tables):
                print(f"\n   Table {table_idx + 1} ({len(table)} rows):")
                
                # Show first 10 rows
                for row_idx, row in enumerate(table[:10]):
                    if row_idx == 0:
                        print(f"   Headers: {row}")
                    else:
                        print(f"   Row {row_idx}: {row}")
                
                # Try to find price patterns
                print("\n   Price extraction test:")
                for row in table[1:6]:  # Test first 5 data rows
                    for cell in row:
                        if cell and isinstance(cell, str):
                            # Test if it looks like a price
                            if any(char.isdigit() for char in cell):
                                result = price_parser.parse_price(cell)
                                if result['success']:
                                    parsed = result['parsed_price']
                                    print(f"      '{cell}' → {parsed['primary_price']:,.0f} {parsed['currency']}")
        
        # Also check raw text
        print("\n   Raw text sample:")
        text = page.extract_text()
        lines = text.split('\n')[:10]
        for line in lines:
            if line.strip():
                print(f"      {line.strip()}")
        
        # Look for price patterns in text
        print("\n   Price patterns in text:")
        import re
        price_patterns = re.findall(r'\d{1,3}(?:\.\d{3})+', text)
        if price_patterns:
            print(f"   Found {len(price_patterns)} potential prices:")
            for price_text in price_patterns[:5]:
                result = price_parser.parse_price(price_text)
                if result['success']:
                    print(f"      '{price_text}' → {result['parsed_price']['primary_price']:,.0f}")

print("\n" + "=" * 60)
print("✅ Analysis complete!")