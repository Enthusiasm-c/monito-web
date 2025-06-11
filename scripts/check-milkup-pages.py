#!/usr/bin/env python3
"""Check what's on milk up.pdf pages"""

import pdfplumber

pdf_path = "/Users/denisdomashenko/Downloads/aibuyer/milk up.pdf"

print("📄 Checking milk up.pdf pages...")
print("=" * 80)

with pdfplumber.open(pdf_path) as pdf:
    print(f"Total pages: {len(pdf.pages)}")
    
    for i, page in enumerate(pdf.pages[:3]):  # Check first 3 pages
        print(f"\n📄 Page {i+1}:")
        print("-" * 40)
        
        text = page.extract_text()
        if text:
            lines = text.split('\n')[:10]  # First 10 lines
            for line in lines:
                if line.strip():
                    print(f"  {line[:100]}...")
        else:
            print("  [No text extracted]")
            
        # Check for tables
        tables = page.extract_tables()
        if tables:
            print(f"\n  Tables found: {len(tables)}")
            for j, table in enumerate(tables[:1]):  # First table only
                print(f"  Table {j+1} has {len(table)} rows")
                if table and len(table) > 0:
                    print(f"  First row: {table[0][:5]}")  # First 5 columns