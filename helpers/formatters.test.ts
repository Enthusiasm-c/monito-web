/**
 * Unit tests for TypeScript formatting utilities
 */

import {
  formatPrice,
  truncateProductName,
  needsTranslation,
  formatProductNameWithTranslation,
  getStatusEmoji,
  calculateSummary,
  createComparisonTable,
  formatEnhancedComparisonReport,
  generateTestComparisonData,
  type FormattedRow,
  type ComparisonData
} from './formatters';

describe('Formatters', () => {
  describe('formatPrice', () => {
    it('should format Indonesian Rupiah correctly', () => {
      expect(formatPrice(15000)).toBe('15.000 IDR');
      expect(formatPrice(150000)).toBe('150.000 IDR');
      expect(formatPrice(1500000)).toBe('1.500.000 IDR');
    });
  });

  describe('truncateProductName', () => {
    it('should truncate long product names', () => {
      const shortName = "Tomato";
      const longName = "This is a very long product name that should be truncated";
      
      expect(truncateProductName(shortName, 25)).toBe("Tomato");
      expect(truncateProductName(longName, 25)).toBe("This is a very long pr...");
      expect(truncateProductName(longName, 10)).toBe("This is...");
    });
  });

  describe('needsTranslation', () => {
    it('should detect Indonesian names that need translation', () => {
      // Should need translation
      expect(needsTranslation("Semangka Merah", "Watermelon Red")).toBe(true);
      expect(needsTranslation("Tomat Segar", "Fresh Tomato")).toBe(true);
      expect(needsTranslation("Bawang Putih", "White Onion")).toBe(true);
      
      // Should not need translation
      expect(needsTranslation("Tomato", "Tomato")).toBe(false);
      expect(needsTranslation("Apple", "Apple")).toBe(false);
      expect(needsTranslation("Organic Spinach", "")).toBe(false);
      expect(needsTranslation("Red Apple", "Red Apple")).toBe(false);
    });
  });

  describe('formatProductNameWithTranslation', () => {
    it('should format product names with translation when needed', () => {
      // With translation needed
      const result1 = formatProductNameWithTranslation("Semangka Merah", "Watermelon Red");
      expect(result1).toBe("Semangka Merah / Watermelon Red");
      
      // No translation needed
      const result2 = formatProductNameWithTranslation("Tomato", "Tomato");
      expect(result2).toBe("Tomato");
      
      // No standardized name
      const result3 = formatProductNameWithTranslation("Apple", "");
      expect(result3).toBe("Apple");
    });
  });

  describe('getStatusEmoji', () => {
    it('should return correct emoji for different statuses', () => {
      // Not found item
      const notFound: FormattedRow = {
        product_name: "Test",
        scanned_price: 1000,
        status: "not_found",
        isNew: true
      };
      expect(getStatusEmoji(notFound)).toBe("🆕");

      // Overpriced item
      const overpriced: FormattedRow = {
        product_name: "Test",
        scanned_price: 1000,
        status: "overpriced",
        price_analysis: {
          min_price: 800,
          max_price: 1200,
          avg_price: 1000,
          has_better_deals: true,
          is_best_price: false,
          better_deals: []
        }
      };
      expect(getStatusEmoji(overpriced)).toBe("🔴");

      // Best price item
      const bestPrice: FormattedRow = {
        product_name: "Test",
        scanned_price: 1000,
        status: "normal",
        price_analysis: {
          min_price: 1000,
          max_price: 1200,
          avg_price: 1100,
          has_better_deals: false,
          is_best_price: true,
          better_deals: []
        }
      };
      expect(getStatusEmoji(bestPrice)).toBe("🟢");
    });
  });

  describe('calculateSummary', () => {
    it('should calculate summary statistics correctly', () => {
      const testData = generateTestComparisonData();
      const summary = calculateSummary(testData.comparisons);
      
      expect(summary.overPricedCount).toBe(1);
      expect(summary.bestPriceCount).toBe(1);
      expect(summary.newItemsCount).toBe(1);
      expect(summary.totalPotentialSavings).toBe(7000);
      expect(summary.totalSavingsPercent).toBeCloseTo(28, 0); // ~28%
    });
  });

  describe('createComparisonTable', () => {
    it('should create a comparison table with overpriced items', () => {
      const testData = generateTestComparisonData();
      const table = createComparisonTable(testData.comparisons);
      
      expect(table).toContain('<pre>');
      expect(table).toContain('Product');
      expect(table).toContain('You');
      expect(table).toContain('Min');
      expect(table).toContain('Semangka Merah');
    });

    it('should respect row limit', () => {
      // Create test data with many overpriced items
      const comparisons: FormattedRow[] = [];
      for (let i = 0; i < 15; i++) {
        comparisons.push({
          product_name: `Product ${i}`,
          scanned_price: 10000 + i * 1000,
          status: "overpriced",
          price_analysis: {
            min_price: 8000,
            max_price: 12000,
            avg_price: 10000,
            has_better_deals: true,
            is_best_price: false,
            better_deals: [{ 
              supplier: "Test", 
              price: 8000, 
              product_name: `Product ${i}`, 
              unit: "kg", 
              savings: 2000 + i * 1000, 
              savings_percent: 20 
            }]
          }
        });
      }
      
      const table = createComparisonTable(comparisons, 10);
      const lines = table.split('\n');
      const dataLines = lines.filter(line => 
        line.includes('|') && 
        !line.trim().startsWith('Product') && 
        !line.startsWith('―')
      );
      
      expect(dataLines.length).toBeLessThanOrEqual(10);
    });
  });

  describe('formatEnhancedComparisonReport', () => {
    it('should generate a complete enhanced report', () => {
      const testData = generateTestComparisonData();
      const report = formatEnhancedComparisonReport(testData, "Test Supplier");
      
      // Should start with summary
      expect(report).toMatch(/^💰.*Invoice Analysis.*Save/);
      
      // Should contain supplier info
      expect(report).toContain("Test Supplier");
      
      // Should contain summary stats
      expect(report).toContain("1 overpriced");
      expect(report).toContain("1 best price");
      expect(report).toContain("1 new items");
      
      // Should contain separator
      expect(report).toContain("──────────");
      
      // Should contain status emojis
      expect(report).toContain("🔴"); // Overpriced
      expect(report).toContain("🟢"); // Best price
      expect(report).toContain("🆕"); // New item
      
      // Should contain comparison table
      expect(report).toContain("You vs Minimum:");
      expect(report).toContain("<pre>");
      
      // Should contain HTML formatting
      expect(report).toContain("<b>");
      expect(report).toContain("<i>");
    });

    it('should handle optimal pricing scenario', () => {
      const optimalData: ComparisonData = {
        comparisons: [
          {
            product_name: "Perfect Product",
            scanned_price: 10000,
            status: "normal",
            matched_product: { id: "1", name: "Perfect Product", unit: "kg" },
            price_analysis: {
              min_price: 10000,
              max_price: 12000,
              avg_price: 11000,
              has_better_deals: false,
              is_best_price: true,
              better_deals: []
            }
          }
        ],
        summary: { total_items: 1, found_items: 1, overpriced_items: 0, good_deals: 1 }
      };
      
      const report = formatEnhancedComparisonReport(optimalData);
      expect(report).toContain("✅");
      expect(report).toContain("Optimal Pricing!");
      expect(report).not.toContain("You vs Minimum:");
    });
  });

  describe('generateTestComparisonData', () => {
    it('should generate valid test data', () => {
      const testData = generateTestComparisonData();
      
      expect(testData.comparisons).toHaveLength(3);
      expect(testData.summary.total_items).toBe(3);
      expect(testData.summary.found_items).toBe(2);
      expect(testData.summary.overpriced_items).toBe(1);
      expect(testData.summary.good_deals).toBe(1);
      
      // Check that we have different types of items
      const statuses = testData.comparisons.map(c => c.status);
      expect(statuses).toContain("overpriced");
      expect(statuses).toContain("normal");
      expect(statuses).toContain("not_found");
    });
  });
});