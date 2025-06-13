#!/usr/bin/env python3
"""
Test traditional Camelot extraction on Eggstra PDF to see why it's not working
"""

import sys
import requests
import tempfile
import os
import json
from pathlib import Path

try:
    import camelot
    import pandas as pd
    import fitz  # PyMuPDF
except ImportError as e:
    print(f"ERROR: Missing dependency: {e}")
    print("Install with: pip install camelot-py[cv] pandas PyMuPDF")
    sys.exit(1)

def test_camelot_extraction():
    print("🐪 Testing Camelot extraction on Eggstra PDF...")
    
    pdf_url = "https://cdc1w79ssc4kg6xh.public.blob.vercel-storage.com/PRICE%20QUOTATATION%20FOR%20EGGSTRA%20CAFE-jxtc940Um2B5E8YPygH1qi5bAx2sHQ.pdf"
    
    # Download PDF
    try:
        print("📥 Downloading PDF...")
        response = requests.get(pdf_url, timeout=30)
        response.raise_for_status()
        print(f"✅ Downloaded {len(response.content):,} bytes")
    except Exception as e:
        print(f"❌ Download failed: {e}")
        return
    
    # Save to temporary file
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
        tmp_file.write(response.content)
        pdf_path = tmp_file.name
    
    try:
        # Test both Camelot methods
        print(f"\n🔧 Testing Camelot lattice extraction...")
        try:
            tables_lattice = camelot.read_pdf(pdf_path, flavor='lattice', pages='all')
            print(f"✅ Lattice: Found {len(tables_lattice)} tables")
            
            total_rows_lattice = 0
            for i, table in enumerate(tables_lattice):
                rows = len(table.df)
                total_rows_lattice += rows
                print(f"   Table {i+1}: {rows} rows, {len(table.df.columns)} columns")
                if rows > 0:
                    print(f"      Sample data: {list(table.df.iloc[0].values)[:3]}")
                    
        except Exception as e:
            print(f"❌ Lattice failed: {e}")
            tables_lattice = []
            total_rows_lattice = 0
        
        print(f"\n🔧 Testing Camelot stream extraction...")
        try:
            tables_stream = camelot.read_pdf(pdf_path, flavor='stream', pages='all')
            print(f"✅ Stream: Found {len(tables_stream)} tables")
            
            total_rows_stream = 0
            for i, table in enumerate(tables_stream):
                rows = len(table.df)
                total_rows_stream += rows
                print(f"   Table {i+1}: {rows} rows, {len(table.df.columns)} columns")
                if rows > 0:
                    print(f"      Sample data: {list(table.df.iloc[0].values)[:3]}")
                    
        except Exception as e:
            print(f"❌ Stream failed: {e}")
            tables_stream = []
            total_rows_stream = 0
        
        # Analyze why traditional extraction might be failing
        print(f"\n📊 Camelot Results Summary:")
        print(f"   Lattice method: {len(tables_lattice)} tables, {total_rows_lattice} total rows")
        print(f"   Stream method: {len(tables_stream)} tables, {total_rows_stream} total rows")
        
        # Check which method found more data
        if total_rows_lattice > total_rows_stream:
            best_tables = tables_lattice
            best_method = "lattice"
            best_rows = total_rows_lattice
        else:
            best_tables = tables_stream
            best_method = "stream"
            best_rows = total_rows_stream
        
        print(f"   🏆 Best method: {best_method} with {best_rows} rows")
        
        if best_rows > 0:
            print(f"\n✅ Traditional extraction SHOULD work!")
            print(f"   Camelot found {best_rows} rows vs AI Vision's 51 products")
            print(f"   📋 Why is the system using AI Vision instead?")
            
            # Analyze table quality
            print(f"\n🔍 Table Quality Analysis:")
            for i, table in enumerate(best_tables[:3]):  # Analyze first 3 tables
                df = table.df
                print(f"\n   Table {i+1} ({len(df)} rows x {len(df.columns)} cols):")
                
                # Check for product names and prices
                name_cols = []
                price_cols = []
                
                for col_idx, col in enumerate(df.columns):
                    # Sample first few non-empty values
                    sample_values = df[col].dropna().head(5).astype(str)
                    
                    # Check if column contains product names
                    has_product_names = any(len(val) > 10 and any(c.isalpha() for c in val) for val in sample_values)
                    if has_product_names:
                        name_cols.append(col_idx)
                    
                    # Check if column contains prices
                    has_prices = any(any(c.isdigit() for c in val) and len(val) > 2 for val in sample_values)
                    if has_prices:
                        price_cols.append(col_idx)
                
                print(f"      Potential name columns: {name_cols}")
                print(f"      Potential price columns: {price_cols}")
                
                if name_cols and price_cols:
                    print(f"      ✅ Table looks good for extraction")
                    
                    # Show sample products
                    name_col = name_cols[0]
                    price_col = price_cols[0] 
                    print(f"      Sample products:")
                    for j in range(min(5, len(df))):
                        name = df.iloc[j, name_col]
                        price = df.iloc[j, price_col]
                        if pd.notna(name) and pd.notna(price):
                            print(f"         \"{name}\" - {price}")
                else:
                    print(f"      ❌ Table structure unclear")
        else:
            print(f"\n❌ Traditional extraction failed!")
            print(f"   This explains why AI Vision is being used as fallback")
            
            # Check PDF structure manually
            print(f"\n🔍 Manual PDF structure check...")
            doc = fitz.open(pdf_path)
            
            for page_num in range(min(3, len(doc))):
                page = doc.load_page(page_num)
                text = page.get_text()
                lines = text.split('\n')
                
                # Look for table-like structures
                table_lines = [line for line in lines if len(line.strip()) > 20 and '\t' in line or '  ' in line]
                
                print(f"   Page {page_num + 1}: {len(lines)} lines, {len(table_lines)} potential table rows")
                if table_lines:
                    print(f"      Sample: {table_lines[0][:80]}...")
            
            doc.close()
        
        # Final recommendation
        print(f"\n💡 Recommendations:")
        if best_rows > 100:
            print(f"1. ✅ Use traditional Camelot ({best_method}) - it found {best_rows} rows!")
            print(f"2. 🔧 Fix the logic that triggers AI fallback")
            print(f"3. 📊 Completeness threshold might be too high")
        else:
            print(f"1. 🤖 AI Vision fallback is appropriate")
            print(f"2. 🔧 Improve AI Vision settings for better extraction")
            print(f"3. 📊 Consider hybrid approach")
        
    finally:
        try:
            os.unlink(pdf_path)
        except:
            pass

if __name__ == "__main__":
    test_camelot_extraction()