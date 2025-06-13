#!/usr/bin/env python3
"""Test price parsing fix for Indonesian format"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src', 'pipeline'))

from price_parser import PriceParser

# Test cases
test_prices = [
    "316.350",  # Indonesian format
    "Rp 316.350",
    "IDR 316.350",
    "104.000",
    "75.000",
    "280.000",
    "1.450.000",  # Million with dots
    "15,000",  # US format
    "15.50",  # Decimal
    "250@10pcs",
    "15k",
    "20rb",
]

parser = PriceParser()

print("Testing Indonesian price format parsing:")
print("=" * 50)

for price_text in test_prices:
    result = parser.parse_price(price_text)
    if result["success"]:
        parsed = result["parsed_price"]
        print(f"✅ '{price_text}' -> {parsed['primary_price']:,.0f} {parsed['currency']}")
    else:
        print(f"❌ '{price_text}' -> Failed: {result['error']}")

print("\n" + "=" * 50)
print("All tests completed!")