#!/usr/bin/env python3
"""
Demo script to show the enhanced Telegram invoice report format
"""

import sys
import os

# Add the telegram-bot directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'telegram-bot', 'app'))

from utils.formatting import format_comparison_report

def main():
    # Test data simulating API response
    comparison_data = {
        "comparisons": [
            {
                "product_name": "Semangka Merah",
                "scanned_price": 25000,
                "status": "overpriced",
                "matched_product": {
                    "id": "1",
                    "name": "Watermelon Red",
                    "unit": "kg"
                },
                "price_analysis": {
                    "min_price": 18000,
                    "max_price": 30000,
                    "avg_price": 22000,
                    "has_better_deals": True,
                    "is_best_price": False,
                    "better_deals": [
                        {
                            "supplier": "Fresh Market",
                            "price": 18000,
                            "product_name": "Watermelon Red",
                            "unit": "kg",
                            "savings": 7000,
                            "savings_percent": 28
                        },
                        {
                            "supplier": "Veggie Paradise",
                            "price": 20000,
                            "product_name": "Watermelon Red",
                            "unit": "kg", 
                            "savings": 5000,
                            "savings_percent": 20
                        }
                    ]
                }
            },
            {
                "product_name": "Tomat Segar",
                "scanned_price": 15000,
                "status": "overpriced",
                "matched_product": {
                    "id": "2",
                    "name": "Fresh Tomato",
                    "unit": "kg"
                },
                "price_analysis": {
                    "min_price": 12000,
                    "max_price": 18000,
                    "avg_price": 14000,
                    "has_better_deals": True,
                    "is_best_price": False,
                    "better_deals": [
                        {
                            "supplier": "Local Farm",
                            "price": 12000,
                            "product_name": "Fresh Tomato",
                            "unit": "kg",
                            "savings": 3000,
                            "savings_percent": 20
                        }
                    ]
                }
            },
            {
                "product_name": "Apple Fuji",
                "scanned_price": 35000,
                "status": "normal",
                "matched_product": {
                    "id": "3",
                    "name": "Apple Fuji",
                    "unit": "kg"
                },
                "price_analysis": {
                    "min_price": 35000,
                    "max_price": 45000,
                    "avg_price": 38000,
                    "has_better_deals": False,
                    "is_best_price": True,
                    "better_deals": []
                }
            },
            {
                "product_name": "Dragon Fruit Exotic",
                "scanned_price": 60000,
                "status": "not_found"
            }
        ]
    }
    
    # Generate the enhanced report
    report = format_comparison_report(comparison_data, "Indo Fresh Market")
    
    print("=" * 60)
    print("ENHANCED TELEGRAM INVOICE REPORT DEMO")
    print("=" * 60)
    print()
    
    # Show raw HTML version
    print("Raw HTML Output:")
    print("-" * 40)
    print(report)
    print()
    
    # Show how it would look in Telegram (simulated)
    print("How it looks in Telegram (simulated):")
    print("-" * 40)
    import re
    # Simple HTML to plain text conversion for demo
    plain_text = report
    plain_text = re.sub(r'<b>(.*?)</b>', r'**\1**', plain_text)
    plain_text = re.sub(r'<i>(.*?)</i>', r'_\1_', plain_text)
    plain_text = re.sub(r'<pre>(.*?)</pre>', r'```\n\1\n```', plain_text, flags=re.DOTALL)
    
    print(plain_text)
    print()
    print("=" * 60)
    print("KEY FEATURES DEMONSTRATED:")
    print("• Summary-first approach with savings highlight")
    print("• Color status markers (🔴 = overpriced, 🟢 = best price, 🆕 = new)")
    print("• Indonesian name translation (Semangka Merah / Watermelon Red)")
    print("• Compact alternatives with supplier names and savings")
    print("• Mono-table comparing 'You vs Minimum' prices")
    print("• HTML formatting for better Telegram compatibility")
    print("=" * 60)

if __name__ == "__main__":
    main()