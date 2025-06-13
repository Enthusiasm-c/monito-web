#!/usr/bin/env python3
"""
Special extractor for VALENTA-style PDFs with text-based price lists
"""

import sys
import os
import json
import time
import pdfplumber
import re
from typing import List, Dict, Any, Optional

# Add parent directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src', 'pipeline'))
from price_parser import PriceParser

class ValentaStyleExtractor:
    def __init__(self):
        self.price_parser = PriceParser()
        
    def extract_from_pdf(self, pdf_path: str) -> Dict[str, Any]:
        """Extract products from VALENTA-style PDFs"""
        start_time = time.time()
        
        result = {
            'products': [],
            'supplier': {
                'name': 'Indonesian Cheese',
                'email': None,
                'phone': None,
                'address': None
            },
            'metrics': {
                'totalRowsDetected': 0,
                'totalRowsProcessed': 0,
                'processingTimeMs': 0
            },
            'extractionMethods': {
                'bestMethod': 'text_pattern_matching'
            }
        }
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                all_products = []
                
                for page_num, page in enumerate(pdf.pages):
                    print(f"Processing page {page_num + 1}...", file=sys.stderr)
                    
                    # Extract text
                    text = page.extract_text()
                    if not text:
                        continue
                    
                    # Extract products using pattern matching
                    page_products = self.extract_products_from_text(text, page_num + 1)
                    all_products.extend(page_products)
                
                # Deduplicate
                unique_products = self.deduplicate_products(all_products)
                
                result['products'] = unique_products
                result['metrics']['totalRowsDetected'] = len(all_products)
                result['metrics']['totalRowsProcessed'] = len(unique_products)
        
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            result['errors'] = [str(e)]
        
        result['metrics']['processingTimeMs'] = int((time.time() - start_time) * 1000)
        return result
    
    def extract_products_from_text(self, text: str, page_num: int) -> List[Dict[str, Any]]:
        """Extract products from text using patterns"""
        products = []
        lines = text.split('\n')
        
        # Pattern 1: PRODUCT NAME followed by price (e.g., "HALLOUMI CHEESE 179K")
        # Pattern 2: PRODUCT NAME on one line, price on next line
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # Skip empty lines and headers
            if not line or 'DELIVERY' in line or 'PRICE NOT INCLUDE' in line:
                i += 1
                continue
            
            # Check if line contains product name and price
            # Pattern: NAME PRICE (where price ends with K or has numbers)
            price_match = re.search(r'(\d+(?:\.\d{3})*(?:K|k)?)\s*$', line)
            
            if price_match:
                # Price found at end of line
                price_text = price_match.group(1)
                product_name = line[:price_match.start()].strip()
                
                if product_name and len(product_name) > 3:
                    # Parse price
                    price_value = self.parse_price_text(price_text)
                    
                    if price_value > 0:
                        # Check if next line is description
                        description = None
                        if i + 1 < len(lines):
                            next_line = lines[i + 1].strip()
                            if next_line and not any(char.isdigit() for char in next_line[-5:]):
                                description = next_line
                                i += 1  # Skip description line
                        
                        products.append({
                            'name': product_name,
                            'price': float(price_value),
                            'unit': 'kg',  # Default for cheese
                            'category': 'cheese',
                            'description': description,
                            'sourceMethod': f'text_pattern_page_{page_num}',
                            'sourcePage': page_num
                        })
            else:
                # Check if this line is a product name and next line has price
                if line and len(line) > 3 and line.isupper():
                    # Potential product name
                    if i + 1 < len(lines):
                        next_line = lines[i + 1].strip()
                        price_match = re.search(r'^(\d+(?:\.\d{3})*(?:K|k)?)\s*$', next_line)
                        
                        if price_match:
                            price_text = price_match.group(1)
                            price_value = self.parse_price_text(price_text)
                            
                            if price_value > 0:
                                products.append({
                                    'name': line,
                                    'price': float(price_value),
                                    'unit': 'kg',
                                    'category': 'cheese',
                                    'description': None,
                                    'sourceMethod': f'text_pattern_page_{page_num}',
                                    'sourcePage': page_num
                                })
                                i += 1  # Skip price line
            
            i += 1
        
        return products
    
    def parse_price_text(self, price_text: str) -> float:
        """Parse price text like '179K' or '179.500'"""
        if not price_text:
            return 0.0
        
        # Handle 'K' suffix (thousands)
        if price_text.upper().endswith('K'):
            try:
                number = float(price_text[:-1])
                return number * 1000
            except:
                pass
        
        # Use price parser for other formats
        result = self.price_parser.parse_price(price_text)
        if result['success'] and result['parsed_price']:
            return result['parsed_price']['primary_price']
        
        return 0.0
    
    def deduplicate_products(self, products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate products"""
        seen = set()
        unique = []
        
        for product in products:
            key = (product['name'].lower(), product['price'])
            if key not in seen:
                seen.add(key)
                unique.append(product)
        
        return unique


def main():
    if len(sys.argv) < 2:
        print("Usage: python valenta_pdf_extractor.py <pdf_path>", file=sys.stderr)
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    extractor = ValentaStyleExtractor()
    result = extractor.extract_from_pdf(pdf_path)
    
    print("=== VALENTA_EXTRACTION_JSON_START ===")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print("=== VALENTA_EXTRACTION_JSON_END ===")
    
    print(f"\nExtracted {len(result['products'])} products", file=sys.stderr)


if __name__ == "__main__":
    main()