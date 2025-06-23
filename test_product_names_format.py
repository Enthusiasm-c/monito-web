#!/usr/bin/env python3
"""
Test script to verify product names are shown in alternatives
"""

import sys
import os

# Add the telegram-bot directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'telegram-bot', 'app'))

from utils.formatting import format_comparison_report

def test_product_names_format():
    """Test the new format with product names in alternatives"""
    
    # Test data that matches server structure
    comparison_data = {
        "comparisons": [
            {
                "product_name": "Semangka Merah",
                "current_price": 49000,
                "status": "overpriced",
                "matched_product": {
                    "id": "1",
                    "name": "Watermelon Red",
                    "unit": "kg"
                },
                "can_optimize": True,  # Add field expected by original format
                "better_deals": [  # Move to root level for original format
                    {
                        "supplier": "Fresh Market",
                        "price": 15000,
                        "product_name": "Watermelon Red Grade A",
                        "unit": "kg",
                        "savings": 34000,
                        "savings_percent": 69
                    },
                    {
                        "supplier": "Veggie Paradise",
                        "price": 18000,
                        "product_name": "Red Watermelon Premium",
                        "unit": "kg",
                        "savings": 31000,
                        "savings_percent": 63
                    },
                    {
                        "supplier": "Local Farm",
                        "price": 22000,
                        "product_name": "Fresh Watermelon",
                        "unit": "kg",
                        "savings": 27000,
                        "savings_percent": 55
                    }
                ],
                "price_analysis": {
                    "min_price": 15000,
                    "max_price": 55000,
                    "avg_price": 35000,
                    "has_better_deals": True,
                    "is_best_price": False
                }
            },
            {
                "product_name": "Apple Fuji 2pcs",
                "current_price": 29000,
                "status": "normal",
                "matched_product": {
                    "id": "2",
                    "name": "Apple Fuji",
                    "unit": "piece"
                },
                "can_optimize": False,  # Add field expected by original format
                "price_analysis": {
                    "min_price": 28000,
                    "max_price": 35000,
                    "avg_price": 31000,
                    "has_better_deals": False,
                    "is_best_price": True,
                    "better_deals": []
                }
            }
        ],
        "total_current": 78000,
        "total_savings": 34000,
        "total_savings_percent": 43.6
    }
    
    # Generate report
    report = format_comparison_report(comparison_data, "RUCOLA FOOD SUPPLIER")
    
    print("=" * 70)
    print("🏷️  PRODUCT NAMES IN ALTERNATIVES - TEST RESULTS")
    print("=" * 70)
    print()
    
    print("Modified Report Output:")
    print("-" * 50)
    print(report)
    print("-" * 50)
    print()
    
    # Verify the format change
    format_checks = []
    
    # Check old format is NOT present
    if "Fresh Market \\- 15.000 IDR" not in report:
        format_checks.append("✅ Old format removed (supplier first)")
    else:
        format_checks.append("❌ Old format still present")
    
    # Check new format IS present (with escaping)
    if "15.000 IDR \\- Watermelon Red Grade A \\(Fresh Market\\)" in report:
        format_checks.append("✅ New format present (price - product (supplier))")
    else:
        format_checks.append("❌ New format not found")
    
    # Check multiple alternatives show product names
    if "Red Watermelon Premium" in report and "Fresh Watermelon" in report:
        format_checks.append("✅ Multiple alternatives show different product names")
    else:
        format_checks.append("❌ Product names missing in alternatives")
    
    # Check suppliers are in parentheses (with escaping)
    if "\\(Fresh Market\\)" in report and "\\(Veggie Paradise\\)" in report:
        format_checks.append("✅ Supplier names in parentheses")
    else:
        format_checks.append("❌ Supplier format incorrect")
    
    # Check savings percentages are preserved (with escaping)
    if "\\(\\-69%\\)" in report and "\\(\\-63%\\)" in report:
        format_checks.append("✅ Savings percentages preserved")
    else:
        format_checks.append("❌ Savings percentages missing")
    
    print("FORMAT VERIFICATION:")
    print("=" * 50)
    for check in format_checks:
        print(check)
    
    print()
    print("EXPECTED NEW FORMAT:")
    print("• [PRICE] — [PRODUCT_NAME] ([SUPPLIER]) (-X%)")
    print()
    print("EXAMPLE:")
    print("• 15.000 IDR — Watermelon Red Grade A (Fresh Market) (-69%)")
    print()
    
    all_passed = all("✅" in check for check in format_checks)
    if all_passed:
        print("🎉 PRODUCT NAMES FORMAT SUCCESSFULLY IMPLEMENTED!")
        print("📱 Bot now shows product names before supplier names")
    else:
        print("⚠️  Some format issues detected")
    
    print("=" * 70)

if __name__ == "__main__":
    test_product_names_format()