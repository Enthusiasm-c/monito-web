#!/usr/bin/env python3
"""
Specialized extractor for Island Organics complex price lists
"""

import sys
import json
import pdfplumber
import re
from typing import Dict, List, Any

def extract_island_organics(pdf_path: str) -> Dict[str, Any]:
    """Extract products from Island Organics PDF with complex table structure"""
    
    products = []
    total_rows = 0
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                print(f"Processing page {page_num + 1}...", file=sys.stderr)
                
                # Extract text
                text = page.extract_text()
                if not text:
                    continue
                
                lines = text.split('\n')
                
                # Pattern for Island Organics format:
                # Product Name Source Size Min. Weight WS Price Retail Weight Retail Price
                # Example: "Arugula - Baby (Eruca versicaria) IO Kg 1 Kg Rp 70.000 200 gr Rp 17.500"
                
                for line in lines:
                    # Skip headers and empty lines
                    if not line.strip() or 'Source' in line or 'Weight' in line or 'Price' in line:
                        continue
                    
                    # Pattern 1: Full line with both wholesale and retail
                    # Product (Latin name) Source Unit Min Rp XX.XXX Weight Rp XX.XXX
                    match = re.search(
                        r'^([^()]+(?:\([^)]+\))?)\s+' +  # Product name with optional (Latin name)
                        r'(?:IO|[A-Z]+)\s+' +  # Source (IO, etc)
                        r'(?:Kg|kg|gr|g|ml|ltr|pcs)\s+' +  # Unit
                        r'.*?' +  # Min weight
                        r'Rp\s*([\d.,]+)\s+' +  # Wholesale price
                        r'.*?' +  # Retail weight  
                        r'Rp\s*([\d.,]+)',  # Retail price
                        line
                    )
                    
                    if match:
                        product_name = match.group(1).strip()
                        wholesale_price = parse_price(match.group(2))
                        retail_price = parse_price(match.group(3))
                        
                        if wholesale_price > 0:
                            products.append({
                                'name': product_name,
                                'price': wholesale_price,
                                'price_type': 'wholesale',
                                'unit': 'kg',
                                'source_page': page_num + 1
                            })
                            
                        if retail_price > 0:
                            products.append({
                                'name': product_name,
                                'price': retail_price,
                                'price_type': 'retail',
                                'unit': 'pack',
                                'source_page': page_num + 1
                            })
                        
                        total_rows += 1
                        continue
                    
                    # Pattern 2: Line with single price
                    # Product (Latin name) Source Unit Price
                    match = re.search(
                        r'^([^()]+(?:\([^)]+\))?)\s+' +  # Product name
                        r'(?:IO|[A-Z]+)\s+' +  # Source
                        r'.*?' +  # Other info
                        r'Rp\s*([\d.,]+)',  # Price
                        line
                    )
                    
                    if match:
                        product_name = match.group(1).strip()
                        price = parse_price(match.group(2))
                        
                        if price > 0 and len(product_name) > 3:
                            products.append({
                                'name': product_name,
                                'price': price,
                                'price_type': 'standard',
                                'unit': 'pcs',
                                'source_page': page_num + 1
                            })
                            total_rows += 1
                
        # Deduplicate products
        unique_products = []
        seen = set()
        
        for product in products:
            key = f"{product['name']}_{product['price']}_{product['price_type']}"
            if key not in seen:
                seen.add(key)
                unique_products.append(product)
        
        print(f"Extracted {len(unique_products)} unique products from {total_rows} rows", file=sys.stderr)
        
        return {
            'supplier': {'name': 'Island Organics Bali'},
            'products': unique_products,
            'metrics': {
                'total_rows': total_rows,
                'unique_products': len(unique_products),
                'pages_processed': len(pdf.pages)
            }
        }
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return {
            'error': str(e),
            'products': []
        }

def parse_price(price_str: str) -> float:
    """Parse Indonesian price format"""
    try:
        # Remove Rp and spaces
        cleaned = price_str.replace('Rp', '').replace(' ', '').strip()
        
        # Handle dots as thousand separators
        if '.' in cleaned and ',' not in cleaned:
            # If dot is followed by 3 digits, it's a thousand separator
            parts = cleaned.split('.')
            if all(len(p) == 3 for p in parts[1:]):
                cleaned = cleaned.replace('.', '')
        
        # Handle commas
        cleaned = cleaned.replace(',', '')
        
        return float(cleaned)
    except:
        return 0.0


def main():
    if len(sys.argv) < 2:
        print("Usage: python island_organics_extractor.py <pdf_path>")
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    result = extract_island_organics(pdf_path)
    
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()