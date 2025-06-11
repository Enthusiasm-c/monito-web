#!/usr/bin/env python3
"""Check extraction status for all files in aibuyer folder"""

import json
import os

# Files in the folder
files = [
    "Island Organics Bali.pdf",
    "Oka veg supplier.xlsx", 
    "PRICE QUOTATATION FOR EGGSTRA CAFE.pdf",
    "PT. Global Anugrah Pasifik (groceries item).pdf",
    "PT.Global Anugrah Pasifik (grocery item) 24 Feb 2025.pdf",
    "Pricelist - Global.pdf",
    "VALENTA cheese supplier.pdf",
    "bali boga.pdf",
    "bali sustainable seafood.pdf",
    "lestari pangan.pdf",
    "milk up.pdf",
    "plaga farm bali.xlsx",
    "sai fresh.xlsx",
    "sri 2 vegetables supplier.xlsx",
    "suppliers list Buyer + - Поставщики FOOD.csv",
    "sutria pangan sejati.pdf",
    "widi wiguna.xlsx",
    "munch bakery.jpg"  # From logs
]

# Read latest processing log
log_file = "/Users/denisdomashenko/monito-web/logs/processing.log"
latest_results = {}

with open(log_file, 'r') as f:
    for line in f:
        try:
            data = json.loads(line.strip())
            filename = data.get('fileName', '')
            # Keep only the latest result for each file
            latest_results[filename] = data
        except:
            continue

print("📊 EXTRACTION STATUS FOR ALL FILES")
print("=" * 80)
print(f"{'File Name':<50} {'Products':<10} {'Ratio':<10} {'Status':<15}")
print("-" * 80)

tested_files = set()
good_files = []
problem_files = []

for filename in sorted(files):
    if filename in latest_results:
        tested_files.add(filename)
        result = latest_results[filename]
        
        products = result.get('productsCreated', 0)
        ratio = result.get('completenessRatio', 0)
        status = result.get('status', 'unknown')
        
        # Determine if file is problematic
        is_problem = False
        if products < 20 or (ratio < 50 and products < 100):
            is_problem = True
            status_icon = "❌"
        elif ratio < 50:
            status_icon = "⚠️"
        else:
            status_icon = "✅"
            
        print(f"{filename:<50} {products:<10} {ratio:<10.1f} {status_icon} {status:<15}")
        
        if is_problem:
            problem_files.append({
                'name': filename,
                'products': products,
                'ratio': ratio,
                'rows': result.get('totalRows', 0)
            })
        else:
            good_files.append(filename)
    else:
        print(f"{filename:<50} {'NOT TESTED':<10} {'--':<10} ❓ {'not tested':<15}")

print("\n" + "=" * 80)
print(f"\n📈 SUMMARY:")
print(f"Total files: {len(files)}")
print(f"Tested files: {len(tested_files)}")
print(f"Not tested: {len(files) - len(tested_files)}")
print(f"Good extraction (✅): {len(good_files)}")
print(f"Problems (❌/⚠️): {len(problem_files)}")

if problem_files:
    print(f"\n🔧 FILES REQUIRING ATTENTION:")
    for f in problem_files:
        print(f"  - {f['name']}: {f['products']} products ({f['ratio']:.1f}% of {f['rows']} rows)")

# Check for files not in our list
print(f"\n📁 OTHER FILES IN LOGS:")
for filename in latest_results:
    if filename not in files:
        result = latest_results[filename]
        products = result.get('productsCreated', 0)
        print(f"  - {filename}: {products} products")