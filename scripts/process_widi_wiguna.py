#!/usr/bin/env python3
"""Process widi wiguna.xlsx with non-standard header location"""

import pandas as pd
import json

file_path = "/Users/denisdomashenko/Downloads/aibuyer/widi wiguna.xlsx"

print("📊 Processing widi wiguna.xlsx with custom header detection")
print("=" * 80)

try:
    # Read Excel file starting from row 3 (0-indexed, so row 4 in Excel)
    df = pd.read_excel(file_path, sheet_name=0, header=3)
    
    print(f"✅ Loaded Excel file with {len(df)} rows")
    print(f"Columns: {list(df.columns)}")
    
    # Clean column names
    df.columns = ['NO', 'Item', 'Unit', 'Price']
    
    products = []
    
    for idx, row in df.iterrows():
        try:
            # Skip empty rows
            if pd.isna(row['Item']) or pd.isna(row['Price']):
                continue
                
            item_name = str(row['Item']).strip()
            price = row['Price']
            unit = str(row['Unit']).strip() if pd.notna(row['Unit']) else 'pcs'
            
            # Skip invalid entries
            if not item_name or len(item_name) < 2:
                continue
                
            # Convert price to float
            if isinstance(price, str):
                price = float(price.replace(',', '').replace('.', ''))
            else:
                price = float(price)
                
            if price > 0:
                products.append({
                    'name': item_name,
                    'price': price,
                    'unit': unit.lower(),
                    'category': 'vegetables',
                    'supplier': 'Widi Wiguna'
                })
                
        except Exception as e:
            print(f"⚠️ Error processing row {idx}: {e}")
            continue
    
    print(f"\n✅ Successfully extracted {len(products)} products")
    
    # Show sample products
    print("\n📝 Sample products:")
    for i, product in enumerate(products[:10]):
        print(f"  {i+1}. {product['name']}: {product['price']:,.0f} IDR ({product['unit']})")
    
    if len(products) > 10:
        print(f"  ... and {len(products) - 10} more products")
    
    # Calculate price statistics
    prices = [p['price'] for p in products]
    avg_price = sum(prices) / len(prices) if prices else 0
    min_price = min(prices) if prices else 0
    max_price = max(prices) if prices else 0
    
    print(f"\n📊 Price statistics:")
    print(f"  • Average price: {avg_price:,.0f} IDR")
    print(f"  • Min price: {min_price:,.0f} IDR")
    print(f"  • Max price: {max_price:,.0f} IDR")
    
    # Save results
    result = {
        'filename': 'widi wiguna.xlsx',
        'supplier': 'Widi Wiguna',
        'products': products,
        'metrics': {
            'total_products': len(products),
            'avg_price': avg_price,
            'min_price': min_price,
            'max_price': max_price
        }
    }
    
    output_file = "/Users/denisdomashenko/monito-web/widi_wiguna_products.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"\n💾 Results saved to: {output_file}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)