#!/usr/bin/env python3
"""
Debug script to analyze PDF structure and understand why 138 rows produce 0 products
"""

import sys
import tempfile
import requests
import json
from pathlib import Path

# Add camelot if available
try:
    import camelot
    HAS_CAMELOT = True
except ImportError:
    HAS_CAMELOT = False
    print("Camelot not available")

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False
    print("pdfplumber not available")

def analyze_pdf_structure(pdf_url):
    print(f"🔍 Analyzing PDF structure: {pdf_url}")
    
    # Download PDF
    response = requests.get(pdf_url, timeout=30)
    response.raise_for_status()
    
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
        tmp_file.write(response.content)
        pdf_path = tmp_file.name
    
    print(f"📄 PDF saved to: {pdf_path}")
    
    # Analysis 1: Camelot Stream (what found 138 rows)
    if HAS_CAMELOT:
        print("\n🔧 CAMELOT STREAM ANALYSIS:")
        try:
            tables = camelot.read_pdf(pdf_path, flavor='stream', pages='all')
            print(f"📊 Found {len(tables)} tables")
            
            total_rows = 0
            for i, table in enumerate(tables):
                df = table.df
                rows = len(df)
                cols = len(df.columns)
                total_rows += rows
                
                print(f"\n📋 Table {i+1}: {rows} rows × {cols} columns")
                print("📝 Sample data (first 3 rows):")
                for idx, row in df.head(3).iterrows():
                    print(f"   Row {idx}: {list(row.values)}")
                
                # Check for potential product/price patterns
                print("🔍 Looking for product/price patterns...")
                for col_idx, col in enumerate(df.columns):
                    col_data = df[col].astype(str).str.strip()
                    non_empty = col_data[col_data != ''].head(5).tolist()
                    if non_empty:
                        print(f"   Column {col_idx}: {non_empty}")
                        
                        # Check for price patterns
                        price_like = [x for x in non_empty if any(c.isdigit() for c in x) and len(x) > 1]
                        if price_like:
                            print(f"   🔢 Potential prices: {price_like}")
                        
                        # Check for product name patterns  
                        text_like = [x for x in non_empty if len(x) > 3 and not x.replace('.', '').replace(',', '').isdigit()]
                        if text_like:
                            print(f"   📦 Potential products: {text_like}")
            
            print(f"\n📊 Total rows across all tables: {total_rows}")
            
        except Exception as e:
            print(f"❌ Camelot analysis failed: {e}")
    
    # Analysis 2: pdfplumber (what found 0 rows)
    if HAS_PDFPLUMBER:
        print("\n🔧 PDFPLUMBER ANALYSIS:")
        try:
            with pdfplumber.open(pdf_path) as pdf:
                print(f"📄 Total pages: {len(pdf.pages)}")
                
                for page_num, page in enumerate(pdf.pages):
                    print(f"\n📑 Page {page_num + 1}:")
                    
                    # Extract text
                    text = page.extract_text()
                    if text:
                        lines = [line.strip() for line in text.split('\n') if line.strip()]
                        print(f"   📝 Text lines: {len(lines)}")
                        print("   📋 Sample lines:")
                        for i, line in enumerate(lines[:5]):
                            print(f"      {i+1}: {line}")
                    
                    # Extract tables
                    tables = page.extract_tables()
                    if tables:
                        print(f"   📊 Tables found: {len(tables)}")
                        for t_idx, table in enumerate(tables):
                            print(f"   📋 Table {t_idx+1}: {len(table)} rows")
                            if table:
                                print(f"      Sample row: {table[0] if table else 'Empty'}")
                    else:
                        print("   📊 No tables detected")
                        
        except Exception as e:
            print(f"❌ pdfplumber analysis failed: {e}")
    
    # Analysis 3: Raw text inspection
    print("\n🔧 RAW TEXT ANALYSIS:")
    if HAS_PDFPLUMBER:
        try:
            with pdfplumber.open(pdf_path) as pdf:
                full_text = ""
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        full_text += page_text + "\n"
                
                lines = [line.strip() for line in full_text.split('\n') if line.strip()]
                print(f"📝 Total text lines: {len(lines)}")
                
                # Look for patterns
                potential_products = []
                potential_prices = []
                
                for line in lines:
                    # Price patterns (numbers with currency indicators)
                    if any(currency in line.lower() for currency in ['rp', 'idr', '$', '₹']) and any(c.isdigit() for c in line):
                        potential_prices.append(line)
                    
                    # Product patterns (lines with reasonable length, mixed case)
                    elif 3 <= len(line) <= 50 and any(c.isalpha() for c in line):
                        potential_products.append(line)
                
                print(f"🔢 Potential price lines: {len(potential_prices)}")
                for price in potential_prices[:5]:
                    print(f"   💰 {price}")
                
                print(f"📦 Potential product lines: {len(potential_products)}")
                for product in potential_products[:10]:
                    print(f"   🛍️ {product}")
                    
        except Exception as e:
            print(f"❌ Raw text analysis failed: {e}")
    
    # Cleanup
    try:
        Path(pdf_path).unlink()
    except:
        pass

if __name__ == "__main__":
    pdf_url = "https://cdc1w79ssc4kg6xh.public.blob.vercel-storage.com/milk%20up-cKDiWJg6Acp5MlTG3Dra1KgItn7cuw.pdf"
    analyze_pdf_structure(pdf_url)