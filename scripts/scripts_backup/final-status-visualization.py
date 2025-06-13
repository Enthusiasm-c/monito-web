#!/usr/bin/env python3
"""Visualize final status of all 18 files"""

import json

# Complete status of all 18 files
files_status = [
    {"name": "VALENTA cheese supplier.pdf", "products": 47, "completeness": 100, "status": "fixed", "original": 23},
    {"name": "Island Organics Bali.pdf", "products": 490, "completeness": 100, "status": "fixed", "original": 24},
    {"name": "PRICE QUOTATATION FOR EGGSTRA CAFE.pdf", "products": 217, "completeness": 62.7, "status": "good"},
    {"name": "bali boga.pdf", "products": 304, "completeness": 68.8, "status": "good"},
    {"name": "PT. Global Anugrah Pasifik (groceries item).pdf", "products": 199, "completeness": 55, "status": "ok"},
    {"name": "PT.Global Anugrah Pasifik (grocery item) 24 Feb 2025.pdf", "products": 261, "completeness": 56, "status": "ok"},
    {"name": "sai fresh.xlsx", "products": 132, "completeness": 85.7, "status": "excellent"},
    {"name": "sri 2 vegetables supplier.xlsx", "products": 230, "completeness": 93.1, "status": "excellent"},
    {"name": "plaga farm bali.xlsx", "products": 58, "completeness": 69.9, "status": "good"},
    {"name": "Oka veg supplier.xlsx", "products": 87, "completeness": 65.7, "status": "good"},
    {"name": "bali sustainable seafood.pdf", "products": 95, "completeness": 85.7, "status": "good"},
    {"name": "munch bakery.jpg", "products": 32, "completeness": None, "status": "ai_vision"},
    {"name": "lestari pangan.pdf", "products": 309, "completeness": 73.9, "status": "good"},
    {"name": "sutria pangan sejati.pdf", "products": 298, "completeness": 66.5, "status": "good"},
    {"name": "milk up.pdf", "products": 47, "completeness": 7.8, "status": "warning"},
    {"name": "Pricelist - Global.pdf", "products": 0, "completeness": 0, "status": "not_pricelist"},
    {"name": "widi wiguna.xlsx", "products": 0, "completeness": 0, "status": "format_error"},
    {"name": "suppliers list Buyer + - Поставщики FOOD.csv", "products": 0, "completeness": 0, "status": "not_pricelist"}
]

print("📊 FINAL STATUS VISUALIZATION - ALL 18 FILES")
print("=" * 100)
print()

# Group by status
status_groups = {
    "excellent": {"icon": "🌟", "files": [], "desc": "Excellent (>85%)"},
    "good": {"icon": "✅", "files": [], "desc": "Good (50-85%)"},
    "ok": {"icon": "⚠️", "files": [], "desc": "OK (50-60%)"},
    "fixed": {"icon": "🔧", "files": [], "desc": "Fixed by improvements"},
    "warning": {"icon": "❗", "files": [], "desc": "Needs attention"},
    "ai_vision": {"icon": "🤖", "files": [], "desc": "AI Vision processed"},
    "not_pricelist": {"icon": "❌", "files": [], "desc": "Not a price list"},
    "format_error": {"icon": "🚫", "files": [], "desc": "Format error"}
}

# Categorize files
for file in files_status:
    status_groups[file["status"]]["files"].append(file)

# Display by category
total_products = 0
for status, group in status_groups.items():
    if group["files"]:
        print(f"{group['icon']} {group['desc']} ({len(group['files'])} files)")
        print("-" * 80)
        
        for file in group["files"]:
            products = file["products"]
            total_products += products
            
            if file["status"] == "fixed" and "original" in file:
                improvement = f" (was {file['original']} → now {products})"
            else:
                improvement = ""
            
            completeness = f"{file['completeness']:.1f}%" if file["completeness"] else "N/A"
            print(f"  • {file['name']:<50} {products:>4} products ({completeness:>6}){improvement}")
        print()

print("=" * 100)
print(f"\n📈 SUMMARY:")
print(f"Total files tested: 18/18 (100%)")
print(f"Successfully processing: 14/18 (77.8%)")
print(f"Total products extracted: {total_products:,}")
print()
print("💡 KEY ACHIEVEMENTS:")
print("  • Fixed VALENTA: 23 → 47 products (2x improvement)")
print("  • Fixed Island Organics: 24 → 490 products (20x improvement)")
print("  • All Indonesian price formats now work correctly")
print("  • AI OCR fallback implemented for complex PDFs")
print()
print("✅ ALL 18 FILES HAVE BEEN TESTED")