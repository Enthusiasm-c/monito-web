"""
Unit tests for Telegram invoice formatting functions
"""

import unittest
from typing import Dict, Any
import sys
import os

# Add the telegram-bot directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'telegram-bot', 'app'))

from utils.formatting import (
    format_price, format_short_price, truncate_product_name,
    needs_translation, format_product_name_with_translation,
    get_status_emoji, calculate_diff_percent, create_comparison_table,
    format_comparison_report
)


class TestFormattingFunctions(unittest.TestCase):
    
    def test_format_price(self):
        """Test price formatting"""
        self.assertEqual(format_price(15000), "15.000 IDR")
        self.assertEqual(format_price(150000), "150.000 IDR")
        self.assertEqual(format_price(1500000), "1.500.000 IDR")
        self.assertEqual(format_price(25.50, "USD"), "25.50 USD")
    
    def test_format_short_price(self):
        """Test short price formatting for tables"""
        self.assertEqual(format_short_price(500), "500")
        self.assertEqual(format_short_price(1500), "2K")
        self.assertEqual(format_short_price(15000), "15K")
        self.assertEqual(format_short_price(1500000), "1.5M")
        self.assertEqual(format_short_price(2500000), "2.5M")
    
    def test_truncate_product_name(self):
        """Test product name truncation"""
        short_name = "Tomato"
        long_name = "This is a very long product name that should be truncated"
        
        self.assertEqual(truncate_product_name(short_name, 25), "Tomato")
        self.assertEqual(truncate_product_name(long_name, 25), "This is a very long pr...")
        self.assertEqual(truncate_product_name(long_name, 10), "This is...")
    
    def test_needs_translation(self):
        """Test Indonesian translation detection"""
        # Should need translation
        self.assertTrue(needs_translation("Semangka Merah", "Watermelon Red"))
        self.assertTrue(needs_translation("Tomat Segar", "Fresh Tomato"))
        self.assertTrue(needs_translation("Bawang Putih", "White Onion"))
        
        # Should not need translation
        self.assertFalse(needs_translation("Tomato", "Tomato"))
        self.assertFalse(needs_translation("Apple", "Apple"))
        self.assertFalse(needs_translation("Organic Spinach", ""))
        self.assertFalse(needs_translation("Red Apple", "Red Apple"))
    
    def test_format_product_name_with_translation(self):
        """Test product name formatting with translation"""
        # With translation needed
        result1 = format_product_name_with_translation("Semangka Merah", "Watermelon Red")
        self.assertEqual(result1, "Semangka Merah / Watermelon Red")
        
        # No translation needed
        result2 = format_product_name_with_translation("Tomato", "Tomato")
        self.assertEqual(result2, "Tomato")
        
        # No standardized name
        result3 = format_product_name_with_translation("Apple", "")
        self.assertEqual(result3, "Apple")
    
    def test_get_status_emoji(self):
        """Test status emoji selection"""
        # Not found item
        not_found = {"status": "not_found"}
        self.assertEqual(get_status_emoji(not_found), "🆕")
        
        # Overpriced item
        overpriced = {
            "status": "overpriced",
            "price_analysis": {"has_better_deals": True}
        }
        self.assertEqual(get_status_emoji(overpriced), "🔴")
        
        # Best price item
        best_price = {
            "status": "normal",
            "price_analysis": {"is_best_price": True, "has_better_deals": False}
        }
        self.assertEqual(get_status_emoji(best_price), "🟢")
        
        # Neutral item
        neutral = {
            "status": "normal",
            "price_analysis": {"has_better_deals": False, "is_best_price": False}
        }
        self.assertEqual(get_status_emoji(neutral), "⚪")
    
    def test_calculate_diff_percent(self):
        """Test percentage difference calculation"""
        comparison = {
            "scanned_price": 12000,
            "price_analysis": {"min_price": 10000}
        }
        diff = calculate_diff_percent(comparison)
        self.assertEqual(diff, 20.0)  # 20% overpaying
        
        # Best price scenario
        best_price = {
            "scanned_price": 10000,
            "price_analysis": {"min_price": 10000}
        }
        diff_best = calculate_diff_percent(best_price)
        self.assertEqual(diff_best, 0.0)
    
    def test_create_comparison_table(self):
        """Test comparison table creation"""
        comparisons = [
            {
                "product_name": "Tomato Red Large",
                "scanned_price": 15000,
                "status": "overpriced",
                "price_analysis": {
                    "min_price": 10000,
                    "has_better_deals": True,
                    "better_deals": [{"savings": 5000}]
                }
            },
            {
                "product_name": "Apple Green",
                "scanned_price": 20000,
                "status": "overpriced", 
                "price_analysis": {
                    "min_price": 12000,
                    "has_better_deals": True,
                    "better_deals": [{"savings": 8000}]
                }
            }
        ]
        
        table = create_comparison_table(comparisons, max_rows=10)
        
        # Should contain the table structure
        self.assertIn('<pre>', table)
        self.assertIn('Product', table)
        self.assertIn('You', table)
        self.assertIn('Min', table)
        self.assertIn('Apple Green', table)  # Higher savings should be first
        self.assertIn('Tomato Red Large', table)
    
    def test_comparison_table_limit(self):
        """Test that comparison table respects row limit"""
        # Create more than 10 overpriced items
        comparisons = []
        for i in range(15):
            comparisons.append({
                "product_name": f"Product {i}",
                "scanned_price": 10000 + i * 1000,
                "status": "overpriced",
                "price_analysis": {
                    "min_price": 8000,
                    "has_better_deals": True,
                    "better_deals": [{"savings": 2000 + i * 1000}]
                }
            })
        
        table = create_comparison_table(comparisons, max_rows=10)
        
        # Count the number of actual data lines (excluding header and separator)
        lines = table.split('\n')
        data_lines = [line for line in lines if '|' in line and not line.strip().startswith('Product') and not line.startswith('―')]
        self.assertLessEqual(len(data_lines), 10)
    
    def test_format_comparison_report_summary_first(self):
        """Test that report starts with summary"""
        comparison_data = {
            "comparisons": [
                {
                    "product_name": "Tomato",
                    "scanned_price": 15000,
                    "status": "overpriced",
                    "matched_product": {"name": "Tomato Red"},
                    "price_analysis": {
                        "min_price": 10000,
                        "has_better_deals": True,
                        "is_best_price": False,
                        "better_deals": [
                            {
                                "price": 10000,
                                "supplier": "Best Supplier",
                                "product_name": "Tomato Red",
                                "savings": 5000,
                                "savings_percent": 33
                            }
                        ]
                    }
                },
                {
                    "product_name": "Apple",
                    "scanned_price": 8000,
                    "status": "normal",
                    "matched_product": {"name": "Apple Green"},
                    "price_analysis": {
                        "min_price": 8000,
                        "has_better_deals": False,
                        "is_best_price": True,
                        "better_deals": []
                    }
                }
            ]
        }
        
        report = format_comparison_report(comparison_data, "Test Supplier")
        lines = report.split('\n')
        
        # First line should contain savings summary
        self.assertIn("Invoice Analysis", lines[0])
        self.assertIn("Save", lines[0])
        
        # Should contain supplier info
        self.assertIn("Test Supplier", report)
        
        # Should contain summary stats
        self.assertIn("1 overpriced", report)
        self.assertIn("1 best price", report)
        
        # Should contain separator
        self.assertIn("──────────", report)
        
        # Should contain status emojis
        self.assertIn("🔴", report)  # Overpriced
        self.assertIn("🟢", report)  # Best price
        
        # Should contain comparison table
        self.assertIn("You vs Minimum:", report)
        self.assertIn("<pre>", report)


if __name__ == '__main__':
    unittest.main()