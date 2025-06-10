#!/usr/bin/env python3
"""
Improved PDF processor with better mixed-content extraction
Handles cases where product names and prices are mixed in the same columns
"""

import re
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple

def extract_products_from_mixed_content(tables_data: List[Dict]) -> List[Dict[str, Any]]:
    """
    Extract products from tables where names and prices are mixed in columns
    """
    all_products = []
    
    for table_info in tables_data:
        if 'dataframe' not in table_info:
            continue
            
        df = table_info['dataframe']
        table_name = table_info.get('name', 'unknown')
        
        print(f"[INFO] 🔍 Processing table: {table_name}")
        
        # Extract all text from all cells
        all_text_items = []
        for col_idx in range(df.shape[1]):
            for row_idx in range(df.shape[0]):
                cell = df.iloc[row_idx, col_idx]
                if pd.notna(cell) and str(cell).strip():
                    all_text_items.append(str(cell).strip())
        
        # Find product-price pairs
        products = find_product_price_pairs(all_text_items, table_name)
        all_products.extend(products)
        
        print(f"[INFO] ✅ Table {table_name}: Found {len(products)} products")
    
    return all_products

def find_product_price_pairs(text_items: List[str], source: str) -> List[Dict[str, Any]]:
    """
    Find product-price pairs from mixed text content
    """
    products = []
    
    # Patterns for prices
    price_patterns = [
        r'(\d+(?:,\d{3})*)\s*IDR',  # 1000 IDR, 104,000 IDR
        r'IDR\s*(\d+(?:,\d{3})*)',  # IDR 1000, IDR 104,000
        r'(\d+(?:,\d{3})*ML)\s*IDR\s*(\d+(?:,\d{3})*)',  # 1000ML IDR 104,000
        r'(\d+(?:KG|GR))\s*IDR\s*(\d+(?:,\d{3})*)',  # 1KG IDR 183,000
    ]
    
    # Patterns for product names
    product_keywords = [
        'YOGURT', 'CREAM', 'CHEESE', 'MILK', 'KEFIR', 'MASCARPONE', 
        'RICOTTA', 'CAKE', 'CARDAMOM', 'COCONUT', 'MANGO', 'VANILLA',
        'STRAWBERRY', 'BLUEBERRY', 'RASPBERRY', 'PLAIN', 'GREEK'
    ]
    
    # Extract price information
    price_info = {}
    for text in text_items:
        price_match = extract_price_info(text)
        if price_match:
            price_info[text] = price_match
    
    # Extract product candidates
    product_candidates = []
    for text in text_items:
        if is_product_name(text, product_keywords):
            product_candidates.append(text)
    
    print(f"[DEBUG] Found {len(price_info)} price entries and {len(product_candidates)} product candidates")
    
    # Strategy 1: Look for adjacent product-price pairs
    for i, text in enumerate(text_items):
        if is_product_name(text, product_keywords):
            # Look for price in next few items
            for j in range(i+1, min(i+4, len(text_items))):
                next_text = text_items[j]
                price_match = extract_price_info(next_text)
                if price_match:
                    product = create_product_entry(text, price_match, source)
                    if product:
                        products.append(product)
                    break
    
    # Strategy 2: Look for embedded price in product text
    for text in text_items:
        if any(keyword in text.upper() for keyword in product_keywords):
            # Check if this text contains both product and price
            price_match = extract_price_info(text)
            if price_match and not is_price_only(text):
                # Extract product name part
                product_name = extract_product_name_from_mixed(text)
                if product_name:
                    product = create_product_entry(product_name, price_match, source)
                    if product:
                        products.append(product)
    
    # Strategy 3: Pattern matching for common formats
    products.extend(extract_common_patterns(text_items, source))
    
    # Remove duplicates
    unique_products = []
    seen_names = set()
    
    for product in products:
        name_key = product['name'].upper().strip()
        if name_key not in seen_names:
            seen_names.add(name_key)
            unique_products.append(product)
    
    return unique_products

def extract_price_info(text: str) -> Optional[Dict[str, Any]]:
    """Extract price, unit, and amount from text"""
    text = text.strip()
    
    # Pattern: 1000ML IDR 104,000
    match = re.search(r'(\d+(?:ML|L|KG|GR|G|PCS)?)\s*IDR\s*(\d+(?:,\d{3})*)', text, re.IGNORECASE)
    if match:
        unit_text = match.group(1)
        price_text = match.group(2)
        
        # Extract unit
        unit_match = re.search(r'(\d+)\s*(ML|L|KG|GR|G|PCS)?', unit_text, re.IGNORECASE)
        if unit_match:
            amount = unit_match.group(1)
            unit = unit_match.group(2) or 'pcs'
        else:
            amount = '1'
            unit = 'pcs'
        
        # Clean price
        price = float(price_text.replace(',', ''))
        
        return {
            'price': price,
            'unit': unit.lower(),
            'amount': amount,
            'original_text': text
        }
    
    # Pattern: IDR 210,000
    match = re.search(r'IDR\s*(\d+(?:,\d{3})*)', text, re.IGNORECASE)
    if match:
        price = float(match.group(1).replace(',', ''))
        return {
            'price': price,
            'unit': 'pcs',
            'amount': '1',
            'original_text': text
        }
    
    return None

def is_product_name(text: str, keywords: List[str]) -> bool:
    """Check if text is likely a product name"""
    text_upper = text.upper()
    
    # Must contain at least one product keyword
    if not any(keyword in text_upper for keyword in keywords):
        return False
    
    # Should not be just a price
    if re.match(r'^\d+(\.\d+)?\s*(IDR|ML|KG|GR)?$', text.strip(), re.IGNORECASE):
        return False
    
    # Should not be shelf life info
    if 'SHELF LIFE' in text_upper or 'DAYS' in text_upper:
        return False
    
    # Should have reasonable length
    if len(text.strip()) < 3 or len(text.strip()) > 100:
        return False
    
    return True

def is_price_only(text: str) -> bool:
    """Check if text contains only price information"""
    # Remove price parts and see if anything meaningful remains
    text_clean = re.sub(r'\d+(?:,\d{3})*\s*IDR\s*\d+(?:,\d{3})*', '', text, flags=re.IGNORECASE)
    text_clean = re.sub(r'IDR\s*\d+(?:,\d{3})*', '', text_clean, flags=re.IGNORECASE)
    text_clean = re.sub(r'\d+(?:ML|L|KG|GR|G|PCS)', '', text_clean, flags=re.IGNORECASE)
    
    return len(text_clean.strip()) < 3

def extract_product_name_from_mixed(text: str) -> Optional[str]:
    """Extract product name from text containing both name and price"""
    # Remove price information
    name = re.sub(r'\d+(?:,\d{3})*\s*IDR\s*\d+(?:,\d{3})*', '', text, flags=re.IGNORECASE)
    name = re.sub(r'IDR\s*\d+(?:,\d{3})*', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\d+(?:ML|L|KG|GR|G|PCS)', '', name, flags=re.IGNORECASE)
    
    # Clean up
    name = re.sub(r'\s+', ' ', name).strip()
    
    return name if len(name) > 2 else None

def extract_common_patterns(text_items: List[str], source: str) -> List[Dict[str, Any]]:
    """Extract products using common PDF patterns"""
    products = []
    
    # Look for lines that contain both product keywords and IDR
    for text in text_items:
        if 'IDR' in text.upper():
            text_upper = text.upper()
            product_keywords = [
                'YOGURT', 'CREAM', 'CHEESE', 'MILK', 'KEFIR', 'MASCARPONE', 
                'RICOTTA', 'CAKE', 'CARDAMOM', 'COCONUT', 'MANGO', 'VANILLA',
                'STRAWBERRY', 'BLUEBERRY', 'RASPBERRY', 'PLAIN', 'GREEK'
            ]
            
            if any(keyword in text_upper for keyword in product_keywords):
                price_info = extract_price_info(text)
                product_name = extract_product_name_from_mixed(text)
                
                if price_info and product_name:
                    product = create_product_entry(product_name, price_info, source)
                    if product:
                        products.append(product)
    
    return products

def create_product_entry(name: str, price_info: Dict[str, Any], source: str) -> Optional[Dict[str, Any]]:
    """Create standardized product entry"""
    if not name or not price_info:
        return None
    
    # Clean product name
    name = name.strip()
    if len(name) < 2:
        return None
    
    # Determine category
    category = determine_category(name)
    
    return {
        'name': name,
        'price': price_info['price'],
        'unit': price_info['unit'],
        'category': category,
        'source': source,
        'raw_text': price_info.get('original_text', '')
    }

def determine_category(name: str) -> str:
    """Determine product category from name"""
    name_upper = name.upper()
    
    if any(word in name_upper for word in ['YOGURT', 'KEFIR']):
        return 'dairy'
    elif any(word in name_upper for word in ['CHEESE', 'MASCARPONE', 'RICOTTA']):
        return 'dairy'
    elif any(word in name_upper for word in ['MILK', 'CREAM']):
        return 'dairy'
    elif any(word in name_upper for word in ['CAKE']):
        return 'bakery'
    else:
        return 'other'

# Test with our data
if __name__ == "__main__":
    # This would be integrated into the main processor
    print("Improved PDF processor for mixed content extraction")