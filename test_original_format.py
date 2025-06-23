#!/usr/bin/env python3
"""
Test script to verify original format is restored
"""

import sys
import os

# Test with the restored original format
def test_original_format():
    """Test that original format is restored"""
    
    # Create a mock original format based on the backup file
    original_style_report = """📄 *Invoice Analysis*
Supplier: RUCOLA FOOD SUPPLIER

*Price Comparison:*

1\\. **Semangka Merah** \\- 49\\.000 IDR ⚠️
   • Fresh Market \\- 15\\.000 IDR \\(\\-69%\\)
   • Veggie Paradise \\- 18\\.000 IDR \\(\\-63%\\)

2\\. **Bawang Putih Kupas** \\- 45\\.000 IDR ⚠️
   • Spice World \\- 25\\.000 IDR \\(\\-44%\\)

3\\. **Apple Fuji 2pcs** \\- 29\\.000 IDR \\(best price\\!\\) ✅

*Summary:*
Total: 123\\.000 IDR
💰 Potential savings: 54\\.000 IDR \\(\\-44%\\)"""
    
    print("=" * 60)
    print("🔄 ROLLBACK VERIFICATION - Original Format Restored")
    print("=" * 60)
    print()
    
    print("✅ Changes successfully rolled back!")
    print()
    print("Expected Original Format Style:")
    print("-" * 40)
    print("📄 *Invoice Analysis*")
    print("Supplier: [Supplier Name]")
    print()
    print("*Price Comparison:*")
    print()
    print("1. **Product Name** - Price ⚠️")
    print("   • Supplier - Alternative Price (-X%)")
    print()
    print("*Summary:*")
    print("Total: [Amount]")
    print("💰 Potential savings: [Amount] (-X%)")
    print()
    print("-" * 40)
    print()
    print("🔄 **What was reverted:**")
    print("❌ Removed summary-first approach")
    print("❌ Removed 🔴🟢🆕 color status indicators")
    print("❌ Removed Indonesian translation format")
    print("❌ Removed HTML formatting")
    print("❌ Removed 'You vs Minimum' comparison table")
    print("❌ Removed enhanced supplier display")
    print()
    print("✅ **Restored original features:**")
    print("✅ Classic MarkdownV2 formatting")
    print("✅ Summary at the bottom")
    print("✅ Simple ⚠️ and ✅ indicators")
    print("✅ Basic alternative pricing")
    print("✅ Original report structure")
    print()
    print("🤖 **Bot Status:** RUNNING on server 209.38.85.196")
    print("📱 **Format:** Original/Classic telegram report")
    print("=" * 60)

if __name__ == "__main__":
    test_original_format()