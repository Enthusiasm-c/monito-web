#!/usr/bin/env python3
"""
Complex PDF Layout Processor
Handles challenging PDF layouts with multiple strategies
"""

import sys
import os
import json
import time
import pandas as pd
import pdfplumber
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
import re
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src', 'pipeline'))
from price_parser import PriceParser

class ComplexPDFProcessor:
    def __init__(self):
        self.price_parser = PriceParser()
        self.debug = os.getenv('DEBUG', 'false').lower() == 'true'
        
    def log(self, message: str, level: str = 'INFO'):
        """Log messages to stderr"""
        print(f"[{level}] {message}", file=sys.stderr)
    
    def process_pdf(self, pdf_path: str) -> Dict[str, Any]:
        """Process PDF with multiple strategies for complex layouts"""
        start_time = time.time()
        self.log(f"🔍 Processing complex PDF: {pdf_path}")
        
        result = {
            'products': [],
            'supplier': None,
            'errors': [],
            'metrics': {
                'totalRowsDetected': 0,
                'totalRowsProcessed': 0,
                'processingTimeMs': 0,
                'extractionStrategies': []
            }
        }
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                # Extract supplier info from first page
                if pdf.pages:
                    result['supplier'] = self.extract_supplier_info(pdf.pages[0])
                
                all_products = []
                
                # Process each page with multiple strategies
                for page_num, page in enumerate(pdf.pages):
                    self.log(f"📄 Processing page {page_num + 1}/{len(pdf.pages)}")
                    
                    # Strategy 1: Table extraction with enhanced settings
                    table_products = self.extract_with_tables(page, page_num + 1)
                    if table_products:
                        all_products.extend(table_products)
                        result['metrics']['extractionStrategies'].append(f'tables_page_{page_num + 1}')
                    
                    # Strategy 2: Text blocks analysis (for non-tabular layouts)
                    if not table_products:
                        text_products = self.extract_with_text_blocks(page, page_num + 1)
                        if text_products:
                            all_products.extend(text_products)
                            result['metrics']['extractionStrategies'].append(f'text_blocks_page_{page_num + 1}')
                    
                    # Strategy 3: Line-by-line analysis (for mixed layouts)
                    if not table_products and not text_products:
                        line_products = self.extract_with_lines(page, page_num + 1)
                        if line_products:
                            all_products.extend(line_products)
                            result['metrics']['extractionStrategies'].append(f'lines_page_{page_num + 1}')
                
                # Deduplicate products
                unique_products = self.deduplicate_products(all_products)
                result['products'] = unique_products
                result['metrics']['totalRowsDetected'] = len(all_products)
                result['metrics']['totalRowsProcessed'] = len(unique_products)
        
        except Exception as e:
            self.log(f"❌ Error processing PDF: {e}", 'ERROR')
            result['errors'].append(str(e))
        
        result['metrics']['processingTimeMs'] = int((time.time() - start_time) * 1000)
        self.log(f"✅ Extracted {len(result['products'])} unique products")
        
        return result
    
    def extract_with_tables(self, page, page_num: int) -> List[Dict[str, Any]]:
        """Extract products using table detection with enhanced settings"""
        products = []
        
        try:
            # Try different table settings for complex layouts
            table_settings = [
                {
                    "vertical_strategy": "lines",
                    "horizontal_strategy": "lines",
                    "explicit_vertical_lines": [],
                    "explicit_horizontal_lines": [],
                    "snap_tolerance": 3,
                    "join_tolerance": 3,
                    "edge_min_length": 10,
                    "min_words_vertical": 3,
                    "min_words_horizontal": 1,
                    "text_tolerance": 3,
                },
                {
                    "vertical_strategy": "text",
                    "horizontal_strategy": "text",
                    "snap_tolerance": 5,
                    "join_tolerance": 5,
                },
                {
                    "vertical_strategy": "lines_strict",
                    "horizontal_strategy": "lines_strict",
                    "intersection_tolerance": 3,
                }
            ]
            
            for settings in table_settings:
                tables = page.extract_tables(table_settings=settings)
                
                if tables:
                    self.log(f"  Found {len(tables)} tables with settings: {settings.get('vertical_strategy')}")
                    
                    for table_idx, table in enumerate(tables):
                        if table and len(table) > 1:
                            # Convert to DataFrame for easier processing
                            df = pd.DataFrame(table)
                            
                            # Clean the DataFrame
                            df = df.replace('', np.nan)
                            df = df.dropna(how='all')
                            
                            # Try to identify header row
                            header_idx = self.find_header_row(df)
                            if header_idx is not None and header_idx < len(df) - 1:
                                df.columns = df.iloc[header_idx]
                                df = df.iloc[header_idx + 1:]
                            
                            # Extract products from table
                            table_products = self.extract_products_from_dataframe(df, f"page_{page_num}_table_{table_idx}")
                            products.extend(table_products)
                    
                    if products:
                        break  # Use first successful strategy
            
        except Exception as e:
            self.log(f"  ⚠️ Table extraction error: {e}")
        
        return products
    
    def extract_with_text_blocks(self, page, page_num: int) -> List[Dict[str, Any]]:
        """Extract products by analyzing text blocks"""
        products = []
        
        try:
            # Get text with layout preservation
            text = page.extract_text(layout=True, x_tolerance=2, y_tolerance=2)
            if not text:
                return products
            
            lines = text.split('\n')
            
            # Pattern for product lines (name followed by price)
            product_patterns = [
                # Pattern 1: Product name ... price
                r'^(.+?)\s{2,}(?:Rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*$',
                # Pattern 2: Product name (with details) price
                r'^(.+?)\s*\(.*?\)\s*(?:Rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*$',
                # Pattern 3: Code Product name price
                r'^\S+\s+(.+?)\s+(?:Rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*$',
            ]
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                for pattern in product_patterns:
                    match = re.match(pattern, line)
                    if match:
                        name = match.group(1).strip()
                        price_str = match.group(2).strip()
                        
                        # Validate product name
                        if len(name) < 3 or name.isdigit():
                            continue
                        
                        # Parse price
                        price_result = self.price_parser.parse_price(price_str)
                        if price_result['success'] and price_result['parsed_price']:
                            price = price_result['parsed_price']['primary_price']
                            if price > 0:
                                products.append({
                                    'name': name,
                                    'price': float(price),
                                    'unit': 'pcs',  # Default unit
                                    'sourceMethod': f'text_blocks_page_{page_num}',
                                    'category': None,
                                    'description': None
                                })
                                break
        
        except Exception as e:
            self.log(f"  ⚠️ Text block extraction error: {e}")
        
        return products
    
    def extract_with_lines(self, page, page_num: int) -> List[Dict[str, Any]]:
        """Extract products by analyzing individual lines and their positions"""
        products = []
        
        try:
            # Get words with their bounding boxes
            words = page.extract_words(
                x_tolerance=3,
                y_tolerance=3,
                keep_blank_chars=False,
                use_text_flow=True
            )
            
            if not words:
                return products
            
            # Group words into lines based on y-coordinate
            lines = []
            current_line = []
            current_y = None
            
            for word in sorted(words, key=lambda w: (w['top'], w['x0'])):
                if current_y is None or abs(word['top'] - current_y) < 3:
                    current_line.append(word)
                    current_y = word['top']
                else:
                    if current_line:
                        lines.append(current_line)
                    current_line = [word]
                    current_y = word['top']
            
            if current_line:
                lines.append(current_line)
            
            # Analyze lines for product information
            for line in lines:
                line_text = ' '.join([w['text'] for w in line])
                
                # Look for price at the end of line
                price_match = re.search(r'(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*$', line_text)
                if price_match:
                    price_str = price_match.group(1)
                    name_part = line_text[:price_match.start()].strip()
                    
                    if len(name_part) > 3 and not name_part.isdigit():
                        price_result = self.price_parser.parse_price(price_str)
                        if price_result['success'] and price_result['parsed_price']:
                            price = price_result['parsed_price']['primary_price']
                            if price > 0:
                                products.append({
                                    'name': name_part,
                                    'price': float(price),
                                    'unit': 'pcs',
                                    'sourceMethod': f'lines_page_{page_num}',
                                    'category': None,
                                    'description': None
                                })
        
        except Exception as e:
            self.log(f"  ⚠️ Line extraction error: {e}")
        
        return products
    
    def extract_products_from_dataframe(self, df: pd.DataFrame, source: str) -> List[Dict[str, Any]]:
        """Extract products from a DataFrame"""
        products = []
        
        # Find name and price columns
        name_col = self.find_name_column(df)
        price_col = self.find_price_column(df)
        
        if name_col is None or price_col is None:
            return products
        
        for idx, row in df.iterrows():
            try:
                name = str(row.iloc[name_col]).strip() if name_col < len(row) else ""
                price_str = str(row.iloc[price_col]).strip() if price_col < len(row) else ""
                
                if not name or len(name) < 3 or name.lower() == 'nan':
                    continue
                
                # Parse price using the price parser
                price_result = self.price_parser.parse_price(price_str)
                if price_result['success'] and price_result['parsed_price']:
                    price = price_result['parsed_price']['primary_price']
                    if price > 0:
                        # Extract unit if available
                        unit = 'pcs'
                        for col_idx, cell in enumerate(row):
                            cell_str = str(cell).lower()
                            if any(u in cell_str for u in ['kg', 'gr', 'ltr', 'ml', 'pcs', 'box', 'pack']):
                                unit = cell_str
                                break
                        
                        products.append({
                            'name': name,
                            'price': float(price),
                            'unit': unit,
                            'sourceMethod': source,
                            'category': None,
                            'description': None
                        })
            
            except Exception as e:
                continue
        
        return products
    
    def find_header_row(self, df: pd.DataFrame) -> Optional[int]:
        """Find the header row in a DataFrame"""
        keywords = ['product', 'item', 'description', 'name', 'nama', 'barang', 'produk']
        
        for idx, row in df.iterrows():
            row_text = ' '.join([str(cell).lower() for cell in row if pd.notna(cell)])
            if any(keyword in row_text for keyword in keywords):
                return idx
        
        return None
    
    def find_name_column(self, df: pd.DataFrame) -> Optional[int]:
        """Find column containing product names"""
        keywords = ['product', 'item', 'description', 'name', 'nama', 'barang', 'produk', 'artikel']
        
        # Check column headers
        for col_idx, col in enumerate(df.columns):
            if pd.notna(col) and any(keyword in str(col).lower() for keyword in keywords):
                return col_idx
        
        # Check first few rows
        for col_idx in range(len(df.columns)):
            col_text = ' '.join([str(val).lower() for val in df.iloc[:5, col_idx] if pd.notna(val)])
            if len(col_text) > 20 and any(c.isalpha() for c in col_text):
                return col_idx
        
        return None
    
    def find_price_column(self, df: pd.DataFrame) -> Optional[int]:
        """Find column containing prices"""
        keywords = ['price', 'harga', 'rate', 'cost', 'total', 'amount']
        
        # Check column headers
        for col_idx, col in enumerate(df.columns):
            if pd.notna(col) and any(keyword in str(col).lower() for keyword in keywords):
                return col_idx
        
        # Check for columns with numeric values
        for col_idx in range(len(df.columns)):
            numeric_count = 0
            for val in df.iloc[:10, col_idx]:
                if pd.notna(val):
                    val_str = str(val)
                    if re.search(r'\d{3,}', val_str):  # Has 3+ digit numbers
                        numeric_count += 1
            
            if numeric_count >= 3:
                return col_idx
        
        return None
    
    def extract_supplier_info(self, first_page) -> Optional[Dict[str, str]]:
        """Extract supplier information from first page"""
        try:
            text = first_page.extract_text()
            if not text:
                return None
            
            lines = text.split('\n')[:20]  # Check first 20 lines
            
            supplier_info = {}
            
            # Look for company name patterns
            for line in lines:
                line = line.strip()
                if len(line) > 5:
                    # Common patterns for company names
                    if any(keyword in line.upper() for keyword in ['PT', 'CV', 'UD', 'COMPANY', 'SUPPLIER']):
                        supplier_info['name'] = line
                        break
                    # Check if line looks like a company name (title case, not too long)
                    elif line.istitle() and 5 < len(line) < 50 and not any(c.isdigit() for c in line):
                        supplier_info['name'] = line
                        break
            
            # Look for email
            email_match = re.search(r'\b[\w.-]+@[\w.-]+\.\w+\b', text)
            if email_match:
                supplier_info['email'] = email_match.group()
            
            # Look for phone
            phone_match = re.search(r'(?:Tel|Phone|Telp?|HP)[\s:]*([+\d\s()-]+)', text, re.IGNORECASE)
            if phone_match:
                supplier_info['phone'] = phone_match.group(1).strip()
            
            return supplier_info if supplier_info else None
        
        except Exception as e:
            self.log(f"  ⚠️ Supplier extraction error: {e}")
            return None
    
    def deduplicate_products(self, products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate products based on name and price"""
        seen = set()
        unique_products = []
        
        for product in products:
            key = (product['name'].lower().strip(), product['price'])
            if key not in seen:
                seen.add(key)
                unique_products.append(product)
        
        return unique_products


def main():
    """CLI interface"""
    if len(sys.argv) < 2:
        print("Usage: python complex_pdf_processor.py <pdf_path>", file=sys.stderr)
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    if not os.path.exists(pdf_path):
        print(f"Error: PDF file not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)
    
    processor = ComplexPDFProcessor()
    result = processor.process_pdf(pdf_path)
    
    # Output JSON result
    print("=== COMPLEX_PDF_JSON_START ===")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print("=== COMPLEX_PDF_JSON_END ===")


if __name__ == "__main__":
    main()