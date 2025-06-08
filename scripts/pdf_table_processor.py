#!/usr/bin/env python3
"""
PDF Table Processor using Camelot
Handles complex PDF structures with proper table extraction and data normalization
"""

import camelot
import pandas as pd
import re
import json
import sys
import tempfile
import os
from urllib.parse import urlparse
from urllib.request import urlretrieve
import argparse

class PDFTableProcessor:
    def __init__(self):
        self.currency_patterns = {
            'rp': r'Rp\.?\s*',
            'idr': r'IDR\.?\s*',
            'dollar': r'\$\s*',
            'rupiah': r'rupiah\.?\s*'
        }
        
        self.weight_conversions = {
            'kg': 1000,
            'kilogram': 1000,
            'kilograms': 1000,
            'g': 1,
            'gram': 1,
            'grams': 1,
            'gr': 1,
            'lb': 453.592,
            'pound': 453.592,
            'pounds': 453.592,
            'oz': 28.3495,
            'ounce': 28.3495,
            'ounces': 28.3495
        }
    
    def determine_pdf_type(self, pdf_path):
        """Determine if PDF is text-based or scanned"""
        try:
            # Try stream method first (doesn't require Ghostscript)
            print("🔍 Testing with stream method...")
            tables_stream = camelot.read_pdf(pdf_path, pages='1', flavor='stream')
            if len(tables_stream) > 0 and not tables_stream[0].df.empty:
                text_content = tables_stream[0].df.to_string()
                if len(text_content.strip()) > 50:
                    print("✅ Stream method successful - PDF is text-based")
                    return 'text'
            
            # Try lattice method if available (requires Ghostscript)
            try:
                print("🔍 Testing with lattice method...")
                tables = camelot.read_pdf(pdf_path, pages='1', flavor='lattice')
                if len(tables) > 0 and not tables[0].df.empty:
                    text_content = tables[0].df.to_string()
                    if len(text_content.strip()) > 50:
                        print("✅ Lattice method successful - PDF is text-based")
                        return 'text'
            except Exception as lattice_error:
                print(f"⚠️ Lattice method failed (likely Ghostscript missing): {lattice_error}")
            
            print("📄 Defaulting to scan type")
            return 'scan'
            
        except Exception as e:
            print(f"Error determining PDF type: {e}")
            return 'text'  # Default to text to try stream method
    
    def extract_tables_from_pdf(self, pdf_path, pdf_type='text'):
        """Extract all tables from PDF using appropriate method"""
        all_tables = []
        
        try:
            if pdf_type == 'text':
                # Try stream method first (always available)
                print("🔍 Extracting tables using stream method...")
                tables_stream = camelot.read_pdf(pdf_path, pages='all', flavor='stream')
                
                for i, table in enumerate(tables_stream):
                    if not table.df.empty:
                        print(f"✅ Stream table {i+1}: {table.df.shape[0]} rows")
                        all_tables.append({
                            'method': 'stream',
                            'page': table.page,
                            'accuracy': getattr(table, 'accuracy', 0),
                            'dataframe': table.df
                        })
                
                # Try lattice method if Ghostscript is available
                try:
                    print("🔍 Extracting tables using lattice method...")
                    tables_lattice = camelot.read_pdf(pdf_path, pages='all', flavor='lattice')
                    
                    for i, table in enumerate(tables_lattice):
                        if not table.df.empty and table.accuracy > 50:
                            print(f"✅ Lattice table {i+1}: {table.df.shape[0]} rows, accuracy: {table.accuracy:.1f}%")
                            all_tables.append({
                                'method': 'lattice',
                                'page': table.page,
                                'accuracy': table.accuracy,
                                'dataframe': table.df
                            })
                except Exception as lattice_error:
                    print(f"⚠️ Lattice method failed: {lattice_error}")
                    print("📝 Continuing with stream method results only...")
            
            else:  # scanned PDF
                print("🖼️ Processing scanned PDF - using lattice with image processing...")
                tables = camelot.read_pdf(pdf_path, pages='all', flavor='lattice')
                
                for i, table in enumerate(tables):
                    if not table.df.empty:
                        print(f"✅ Scanned table {i+1}: {table.df.shape[0]} rows")
                        all_tables.append({
                            'method': 'lattice_scan',
                            'page': table.page,
                            'accuracy': table.accuracy,
                            'dataframe': table.df
                        })
        
        except Exception as e:
            print(f"❌ Error extracting tables: {e}")
            return []
        
        print(f"📊 Total tables extracted: {len(all_tables)}")
        return all_tables
    
    def normalize_price(self, price_str):
        """Clean and normalize price strings"""
        if pd.isna(price_str) or price_str == '':
            return None
        
        price_str = str(price_str).strip()
        
        # Remove currency symbols
        for currency, pattern in self.currency_patterns.items():
            price_str = re.sub(pattern, '', price_str, flags=re.IGNORECASE)
        
        # Remove commas and dots used as thousands separators
        # Handle Indonesian format: 50.000 or 50,000
        price_str = re.sub(r'[,.](?=\d{3}(?!\d))', '', price_str)
        
        # Extract numeric value
        price_match = re.search(r'(\d+(?:[.,]\d{1,2})?)', price_str)
        if price_match:
            price_value = price_match.group(1)
            # Handle decimal separator
            price_value = price_value.replace(',', '.')
            try:
                return float(price_value)
            except ValueError:
                return None
        
        return None
    
    def normalize_weight_to_grams(self, weight_str):
        """Convert weight to grams"""
        if pd.isna(weight_str) or weight_str == '':
            return None
        
        weight_str = str(weight_str).strip().lower()
        
        # Extract number and unit
        weight_match = re.search(r'(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)', weight_str)
        if weight_match:
            value_str = weight_match.group(1).replace(',', '.')
            unit = weight_match.group(2).lower()
            
            try:
                value = float(value_str)
                multiplier = self.weight_conversions.get(unit, 1)
                return value * multiplier
            except ValueError:
                return None
        
        # If no unit found, assume pieces or grams
        number_match = re.search(r'(\d+(?:[.,]\d+)?)', weight_str)
        if number_match:
            try:
                return float(number_match.group(1).replace(',', '.'))
            except ValueError:
                return None
        
        return None
    
    def detect_categories_by_empty_prices(self, df):
        """Detect category headers by empty price columns"""
        categories = []
        current_category = None
        
        for idx, row in df.iterrows():
            # Check if this row has product name but no price (likely a category)
            has_name = False
            has_price = False
            
            for col in df.columns:
                cell_value = str(row[col]).strip()
                if cell_value and cell_value != 'nan' and len(cell_value) > 2:
                    has_name = True
                    # Check if this looks like a price
                    if self.normalize_price(cell_value) is not None:
                        has_price = True
            
            if has_name and not has_price:
                # This might be a category header
                category_text = ' '.join([str(cell) for cell in row if pd.notna(cell) and str(cell).strip()]).strip()
                if len(category_text) > 0 and len(category_text) < 50:  # Reasonable category length
                    current_category = category_text
                    print(f"📂 Detected category: {current_category}")
            
            elif has_name and has_price:
                # This is a product row
                categories.append({
                    'row_index': idx,
                    'category': current_category,
                    'row_data': row
                })
        
        return categories
    
    def process_table_to_products(self, table_data):
        """Process a table DataFrame to extract products"""
        df = table_data['dataframe']
        products = []
        
        print(f"🔄 Processing table from page {table_data['page']} ({table_data['method']})...")
        print(f"📊 Table shape: {df.shape}")
        
        # Detect categories and products
        categorized_rows = self.detect_categories_by_empty_prices(df)
        
        for item in categorized_rows:
            row = item['row_data']
            category = item['category']
            
            # Extract product information from row
            product_name = None
            price = None
            unit = None
            weight = None
            
            # Try to identify columns by content
            for col_idx, cell_value in enumerate(row):
                cell_str = str(cell_value).strip()
                if cell_str == 'nan' or not cell_str:
                    continue
                
                # Check if this looks like a price
                normalized_price = self.normalize_price(cell_str)
                if normalized_price is not None and normalized_price > 0:
                    price = normalized_price
                    continue
                
                # Check if this looks like a weight/unit
                normalized_weight = self.normalize_weight_to_grams(cell_str)
                if normalized_weight is not None:
                    weight = normalized_weight
                    unit = self.extract_unit_from_string(cell_str)
                    continue
                
                # Otherwise, this might be the product name
                if not product_name and len(cell_str) > 2:
                    product_name = cell_str
            
            # Create product if we have at least name and price
            if product_name and price is not None:
                product = {
                    'name': self.clean_product_name(product_name),
                    'price': price,
                    'unit': unit or 'pcs',
                    'category': category,
                    'weight_grams': weight,
                    'description': None
                }
                products.append(product)
                print(f"✅ Product: {product_name} - {price} ({unit})")
            elif product_name and not price:
                # Product without clear price - might still be useful
                product = {
                    'name': self.clean_product_name(product_name),
                    'price': 0,  # Will be filtered out or marked for manual review
                    'unit': unit or 'pcs',
                    'category': category,
                    'weight_grams': weight,
                    'description': 'Price not found in table'
                }
                products.append(product)
                print(f"⚠️ Product without price: {product_name}")
        
        return products
    
    def extract_unit_from_string(self, text):
        """Extract unit from text string"""
        text = str(text).lower()
        
        for unit in self.weight_conversions.keys():
            if unit in text:
                if unit in ['kg', 'kilogram', 'kilograms']:
                    return 'kg'
                elif unit in ['g', 'gram', 'grams', 'gr']:
                    return 'g'
                elif unit in ['lb', 'pound', 'pounds']:
                    return 'lb'
                elif unit in ['oz', 'ounce', 'ounces']:
                    return 'oz'
        
        # Check for common units
        if any(word in text for word in ['piece', 'pcs', 'pc', 'each']):
            return 'pcs'
        elif any(word in text for word in ['bunch', 'bundle', 'ikat']):
            return 'bunch'
        elif any(word in text for word in ['pack', 'packet', 'pck']):
            return 'pack'
        
        return 'pcs'  # default
    
    def clean_product_name(self, name):
        """Clean and normalize product names"""
        if not name:
            return ''
        
        name = str(name).strip()
        # Remove extra whitespace
        name = re.sub(r'\s+', ' ', name)
        # Remove leading/trailing non-alphanumeric characters
        name = re.sub(r'^[^\w\s]+|[^\w\s]+$', '', name)
        # Capitalize first letter of each word
        name = ' '.join(word.capitalize() for word in name.split())
        
        return name
    
    def process_pdf_file(self, pdf_url_or_path):
        """Main method to process PDF file"""
        # Download file if URL
        if pdf_url_or_path.startswith('http'):
            print(f"📥 Downloading PDF from: {pdf_url_or_path}")
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
            urlretrieve(pdf_url_or_path, temp_file.name)
            pdf_path = temp_file.name
        else:
            pdf_path = pdf_url_or_path
        
        try:
            # Determine PDF type
            pdf_type = self.determine_pdf_type(pdf_path)
            print(f"📄 PDF type detected: {pdf_type}")
            
            # Extract tables
            tables = self.extract_tables_from_pdf(pdf_path, pdf_type)
            
            if not tables:
                print("⚠️ No tables found in PDF")
                return {
                    'supplier': None,
                    'products': []
                }
            
            # Process all tables to extract products
            all_products = []
            for table in tables:
                products = self.process_table_to_products(table)
                all_products.extend(products)
            
            # Try to detect supplier info from first table
            supplier_info = self.extract_supplier_info(tables[0]['dataframe'] if tables else None)
            
            result = {
                'supplier': supplier_info,
                'products': all_products
            }
            
            print(f"🎉 Processing complete: {len(all_products)} products extracted")
            return result
            
        finally:
            # Clean up temp file
            if pdf_url_or_path.startswith('http') and os.path.exists(pdf_path):
                os.unlink(pdf_path)
    
    def extract_supplier_info(self, df):
        """Try to extract supplier information from table header"""
        if df is None or df.empty:
            return None
        
        # Look in first few rows for supplier info
        supplier_info = {}
        
        for idx in range(min(5, len(df))):
            row_text = ' '.join([str(cell) for cell in df.iloc[idx] if pd.notna(cell)]).strip()
            
            # Look for email
            email_match = re.search(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', row_text)
            if email_match:
                supplier_info['email'] = email_match.group(1)
            
            # Look for phone
            phone_match = re.search(r'(\+?[\d\s\-\(\)]{8,})', row_text)
            if phone_match:
                supplier_info['phone'] = phone_match.group(1).strip()
            
            # Use first meaningful text as name if no specific supplier name found
            if 'name' not in supplier_info and len(row_text) > 5 and len(row_text) < 50:
                # Skip if it looks like a table header
                if not any(word in row_text.lower() for word in ['product', 'price', 'name', 'unit', 'category']):
                    supplier_info['name'] = row_text
        
        return supplier_info if supplier_info else None

def main():
    parser = argparse.ArgumentParser(description='Process PDF tables with Camelot')
    parser.add_argument('pdf_path', help='Path or URL to PDF file')
    parser.add_argument('--output', '-o', help='Output JSON file path')
    parser.add_argument('--json-only', action='store_true', help='Output only JSON (for Node.js integration)')
    
    args = parser.parse_args()
    
    processor = PDFTableProcessor()
    result = processor.process_pdf_file(args.pdf_path)
    
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        if not args.json_only:
            print(f"💾 Results saved to: {args.output}")
    
    if args.json_only:
        # For Node.js integration - output ONLY clean JSON
        print(json.dumps(result, ensure_ascii=False))
    else:
        print("📋 Results:")
        print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()