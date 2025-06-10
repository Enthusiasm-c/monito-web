#!/usr/bin/env python3
"""
Quick analysis of PDF structure to understand why only 51 products were extracted
"""

import sys
import requests
import tempfile
import os
from pathlib import Path

try:
    import fitz  # PyMuPDF
    from dotenv import load_dotenv
except ImportError as e:
    print(f"ERROR: Missing dependency: {e}")
    sys.exit(1)

def analyze_pdf_structure():
    print("🔍 Analyzing Eggstra PDF structure...")
    
    pdf_url = "https://cdc1w79ssc4kg6xh.public.blob.vercel-storage.com/PRICE%20QUOTATATION%20FOR%20EGGSTRA%20CAFE-jxtc940Um2B5E8YPygH1qi5bAx2sHQ.pdf"
    
    # Download PDF
    try:
        print("📥 Downloading PDF...")
        response = requests.get(pdf_url, timeout=30)
        response.raise_for_status()
        pdf_size = len(response.content)
        print(f"✅ Downloaded {pdf_size:,} bytes ({pdf_size/1024/1024:.1f} MB)")
    except Exception as e:
        print(f"❌ Download failed: {e}")
        return
    
    # Save to temporary file
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
        tmp_file.write(response.content)
        pdf_path = tmp_file.name
    
    try:
        # Open PDF with PyMuPDF
        doc = fitz.open(pdf_path)
        total_pages = len(doc)
        
        print(f"\n📄 PDF Structure Analysis:")
        print(f"   Total pages: {total_pages}")
        print(f"   Current processing limit: 8 pages")
        if total_pages > 8:
            print(f"   ⚠️ ISSUE: {total_pages - 8} pages are NOT being processed!")
        
        # Analyze each page
        total_text_length = 0
        pages_with_tables = 0
        
        print(f"\n📋 Page-by-page analysis:")
        for page_num in range(min(total_pages, 15)):  # Analyze first 15 pages
            page = doc.load_page(page_num)
            
            # Get text content
            text = page.get_text()
            text_length = len(text.strip())
            total_text_length += text_length
            
            # Count potential product lines (lines with numbers that look like prices)
            lines = text.split('\n')
            price_lines = 0
            for line in lines:
                # Look for patterns that might be prices (numbers with currency or decimals)
                if any(pattern in line.lower() for pattern in ['rp', 'idr', '.']):
                    if any(char.isdigit() for char in line):
                        price_lines += 1
            
            # Check if page has table-like structure
            has_table = text_length > 500 and price_lines > 5
            if has_table:
                pages_with_tables += 1
            
            status = "✅ Processed" if page_num < 8 else "❌ Skipped"
            table_indicator = "📊 Table" if has_table else "📝 Text"
            
            print(f"   Page {page_num + 1:2d}: {text_length:4d} chars, {price_lines:2d} price lines {table_indicator} {status}")
        
        if total_pages > 15:
            print(f"   ... and {total_pages - 15} more pages")
        
        # Summary
        print(f"\n📊 Analysis Summary:")
        print(f"   Pages with potential product tables: {pages_with_tables}")
        print(f"   Average text per page: {total_text_length // min(total_pages, 15):,} characters")
        print(f"   Pages currently processed: {min(total_pages, 8)}")
        print(f"   Pages being skipped: {max(0, total_pages - 8)}")
        
        # Calculate potential missed products
        if total_pages > 8:
            estimated_products_per_page = 51 / min(total_pages, 8)  # Based on current extraction
            missed_pages = total_pages - 8
            estimated_missed_products = estimated_products_per_page * missed_pages
            
            print(f"\n🎯 Estimated Impact:")
            print(f"   Products found: 51 (from {min(total_pages, 8)} pages)")
            print(f"   Estimated products per page: {estimated_products_per_page:.1f}")
            print(f"   Estimated missed products: {estimated_missed_products:.0f}")
            print(f"   Estimated total products: {51 + estimated_missed_products:.0f}")
        
        doc.close()
        
        print(f"\n💡 Recommendations:")
        print(f"1. Increase page processing limit from 8 to {total_pages}")
        print(f"2. Use higher resolution for dense product lists")
        print(f"3. Consider processing in batches to manage costs")
        
    finally:
        try:
            os.unlink(pdf_path)
        except:
            pass

if __name__ == "__main__":
    analyze_pdf_structure()