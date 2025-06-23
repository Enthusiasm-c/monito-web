#!/usr/bin/env python3
"""
Test script to verify all fixes are working correctly
"""

import sys
import os

# Add the telegram-bot directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'telegram-bot', 'app'))

from utils.formatting import format_comparison_report

def test_all_fixes():
    """Test all the fixes with realistic overpriced data"""
    
    # Test data with overpriced items (like the actual invoice)
    comparison_data = {
        "comparisons": [
            {
                "product_name": "Semangka Merah", 
                "current_price": 49000,  # Overpriced vs min 15000
                "status": "overpriced",
                "matched_product": {
                    "id": "1", 
                    "name": "Watermelon Red",
                    "unit": "kg"
                },
                "price_analysis": {
                    "min_price": 15000,
                    "max_price": 55000,
                    "avg_price": 35000,
                    "has_better_deals": True,
                    "is_best_price": False,
                    "suppliers": [
                        {"name": "Fresh Market", "price": 15000, "product_name": "Watermelon Red"},
                        {"name": "Veggie Paradise", "price": 18000, "product_name": "Watermelon Red"},
                        {"name": "Local Farm", "price": 22000, "product_name": "Watermelon Red"}
                    ]
                }
            },
            {
                "product_name": "Bawang Putih Kupas",
                "current_price": 45000,  # Overpriced vs min 25000
                "status": "overpriced", 
                "matched_product": {
                    "id": "2",
                    "name": "Peeled Garlic",
                    "unit": "kg"
                },
                "price_analysis": {
                    "min_price": 25000,
                    "max_price": 50000,
                    "avg_price": 37500,
                    "has_better_deals": True,
                    "is_best_price": False,
                    "suppliers": [
                        {"name": "Spice World", "price": 25000, "product_name": "Peeled Garlic"},
                        {"name": "Garlic Plus", "price": 28000, "product_name": "Peeled Garlic"}
                    ]
                }
            },
            {
                "product_name": "Apple Fuji 2pcs",
                "current_price": 29000,  # Good price
                "status": "normal",
                "matched_product": {
                    "id": "3",
                    "name": "Apple Fuji",
                    "unit": "piece"
                },
                "price_analysis": {
                    "min_price": 28000,
                    "max_price": 35000,
                    "avg_price": 31000,
                    "has_better_deals": False,
                    "is_best_price": True,
                    "suppliers": [
                        {"name": "Apple Store", "price": 28000, "product_name": "Apple Fuji"},
                        {"name": "Fruit Palace", "price": 30000, "product_name": "Apple Fuji"}
                    ]
                }
            },
            {
                "product_name": "Dragon Fruit Exotic",
                "current_price": 60000,
                "status": "not_found"  # New item
            }
        ]
    }
    
    # Generate the report
    report = format_comparison_report(comparison_data, "RUCOLA FOOD SUPPLIER")
    
    print("=" * 70)
    print("🔧 COMPLETE FIX VERIFICATION TEST")
    print("=" * 70)
    print()
    
    print("Fixed Report Output:")
    print("-" * 50)
    print(report)
    print("-" * 50)
    print()
    
    # Verify each fix
    fixes_verified = []
    
    # 1. Check summary calculation
    if "2 overpriced" in report and not "0 overpriced" in report:
        fixes_verified.append("✅ Fix 1: Summary shows real overpriced count (not 0)")
    else:
        fixes_verified.append("❌ Fix 1: Summary still shows wrong count")
    
    # 2. Check status markers
    if "🔴" in report and "🟢" in report:
        fixes_verified.append("✅ Fix 2: Status markers show 🔴 for overpriced, 🟢 for best price")
    else:
        fixes_verified.append("❌ Fix 2: Status markers still wrong")
    
    # 3. Check alternatives with suppliers
    if "Fresh Market" in report and "(-" in report and "%)" in report:
        fixes_verified.append("✅ Fix 3: Shows alternatives with supplier names and savings %")
    else:
        fixes_verified.append("❌ Fix 3: Missing alternatives or savings %")
    
    # 4. Check Indonesian translation
    if "Semangka Merah / Watermelon Red" in report or "Bawang Putih Kupas / Peeled Garlic" in report:
        fixes_verified.append("✅ Fix 4: Indonesian translation with slash format")
    else:
        fixes_verified.append("❌ Fix 4: Missing Indonesian translation")
    
    # 5. Check new item badge
    if "🆕" in report and "1 new items" in report:
        fixes_verified.append("✅ Fix 5: New items marked with 🆕 and counted correctly")
    else:
        fixes_verified.append("❌ Fix 5: New items not properly marked")
    
    # 6. Check comparison table
    if "You vs Minimum:" in report and "<pre>" in report and "Semangka Merah" in report:
        fixes_verified.append("✅ Fix 6: 'You vs Minimum' table present with overpriced items")
    else:
        fixes_verified.append("❌ Fix 6: Missing comparison table")
    
    # 7. Check savings calculation
    if "Save" in report and "IDR" in report and not "Save 0" in report:
        fixes_verified.append("✅ Fix 7: Shows real savings amount in IDR")
    else:
        fixes_verified.append("❌ Fix 7: Savings calculation incorrect")
    
    print("VERIFICATION RESULTS:")
    print("=" * 50)
    for fix in fixes_verified:
        print(fix)
    
    print()
    print("=" * 70)
    
    all_passed = all("✅" in fix for fix in fixes_verified)
    if all_passed:
        print("🎉 ALL FIXES VERIFIED SUCCESSFULLY!")
        print("📱 Enhanced Telegram report is ready for production use!")
    else:
        print("⚠️  Some fixes need additional attention")
    
    print("=" * 70)

if __name__ == "__main__":
    test_all_fixes()