/**
 * Formatting utilities for Telegram invoice reports
 */

export interface FormattedRow {
  product_name: string;
  originalName?: string;
  standardizedName?: string;
  scanned_price: number;
  status: string;
  matched_product?: {
    id: string;
    name: string;
    unit: string;
  };
  price_analysis?: {
    min_price: number;
    max_price: number;
    avg_price: number;
    better_deals: Array<{
      supplier: string;
      price: number;
      product_name: string;
      unit: string;
      savings: number;
      savings_percent: number;
    }>;
    has_better_deals: boolean;
    is_best_price: boolean;
  };
  isNew?: boolean;
  diffPercent?: number;
}

export interface ComparisonData {
  comparisons: FormattedRow[];
  summary: {
    total_items: number;
    found_items: number;
    overpriced_items: number;
    good_deals: number;
  };
}

export interface SummaryData {
  totalPotentialSavings: number;
  totalSavingsPercent: number;
  overPricedCount: number;
  bestPriceCount: number;
  newItemsCount: number;
}

/**
 * Format Indonesian Rupiah price
 */
export function formatPrice(amount: number): string {
  return `${Math.round(amount).toLocaleString('id-ID')} IDR`;
}

/**
 * Format savings percentage
 */
export function formatSavingsPercent(percent: number): string {
  return `${Math.round(percent)}%`;
}

/**
 * Truncate long product names for display
 */
export function truncateProductName(name: string, maxLength: number = 25): string {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 3) + '...';
}

/**
 * Detect if text is Indonesian and needs translation
 */
export function needsTranslation(originalName: string, standardizedName: string): boolean {
  // If names are very different and original contains Indonesian words, show translation
  if (!standardizedName || originalName.toLowerCase() === standardizedName.toLowerCase()) {
    return false;
  }
  
  // Check for common Indonesian words/patterns
  const indonesianPatterns = [
    /\b(merah|hijau|putih|kuning|biru)\b/i, // colors
    /\b(besar|kecil|sedang)\b/i, // sizes
    /\b(segar|organik|lokal)\b/i, // descriptors
    /\b(buah|sayur|daging|ikan)\b/i, // categories
  ];
  
  return indonesianPatterns.some(pattern => pattern.test(originalName));
}

/**
 * Format product name with translation if needed
 */
export function formatProductNameWithTranslation(originalName: string, standardizedName?: string): string {
  if (!standardizedName || !needsTranslation(originalName, standardizedName)) {
    return originalName;
  }
  return `${originalName} / ${standardizedName}`;
}

/**
 * Calculate summary statistics from rows
 */
export function calculateSummary(rows: FormattedRow[]): SummaryData {
  let totalPotentialSavings = 0;
  let totalScannedPrice = 0;
  let overPricedCount = 0;
  let bestPriceCount = 0;
  let newItemsCount = 0;

  for (const row of rows) {
    if (row.isNew) {
      newItemsCount++;
      continue;
    }

    totalScannedPrice += row.scanned_price;
    
    if (row.price_analysis?.has_better_deals) {
      const bestDeal = row.price_analysis.better_deals[0];
      if (bestDeal) {
        totalPotentialSavings += bestDeal.savings;
        overPricedCount++;
      }
    } else if (row.price_analysis?.is_best_price) {
      bestPriceCount++;
    }
  }

  const totalSavingsPercent = totalScannedPrice > 0 
    ? (totalPotentialSavings / totalScannedPrice) * 100 
    : 0;

  return {
    totalPotentialSavings,
    totalSavingsPercent,
    overPricedCount,
    bestPriceCount,
    newItemsCount
  };
}

/**
 * Get status emoji for product
 */
export function getStatusEmoji(row: FormattedRow): string {
  if (row.isNew) return '🆕';
  if (row.price_analysis?.has_better_deals) return '🔴';
  if (row.price_analysis?.is_best_price) return '🟢';
  return '⚪'; // neutral
}

/**
 * Create compact comparison table
 */
export function createComparisonTable(rows: FormattedRow[], maxRows: number = 10): string {
  // Filter overpriced items and sort by highest overpayment
  const overPricedRows = rows
    .filter(row => !row.isNew && row.price_analysis?.has_better_deals)
    .sort((a, b) => {
      const aSavings = a.price_analysis?.better_deals[0]?.savings || 0;
      const bSavings = b.price_analysis?.better_deals[0]?.savings || 0;
      return bSavings - aSavings; // Highest savings first
    })
    .slice(0, maxRows);

  if (overPricedRows.length === 0) {
    return '<pre>No overpriced items found!</pre>';
  }

  const header = 'Product               | You      | Min     ';
  const separator = '―――――――――――――――――――――――――――――――――――――――――――――';
  
  const rows_formatted = overPricedRows.map(row => {
    const product = truncateProductName(row.product_name, 20).padEnd(20);
    const youPrice = formatShortPrice(row.scanned_price).padStart(8);
    const minPrice = formatShortPrice(row.price_analysis?.min_price || 0).padStart(7);
    return `${product} | ${youPrice} | ${minPrice}`;
  });

  return '<pre>' + [header, separator, ...rows_formatted].join('\n') + '</pre>';
}

/**
 * Format price in short form for tables
 */
function formatShortPrice(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}K`;
  }
  return `${Math.round(amount)}`;
}

/**
 * Escape special characters for Telegram HTML
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format enhanced comparison report for Telegram
 */
export function formatEnhancedComparisonReport(data: ComparisonData, supplierName?: string): string {
  const lines: string[] = [];
  const comparisons = data.comparisons;
  
  // Calculate summary data
  const summary = calculateSummary(comparisons);
  
  // Summary-first header with emoji
  if (summary.totalPotentialSavings > 0) {
    lines.push(`💰 <b>Invoice Analysis - Save ${formatPrice(summary.totalPotentialSavings)} (${Math.round(summary.totalSavingsPercent)}%)</b>`);
  } else {
    lines.push("✅ <b>Invoice Analysis - Optimal Pricing!</b>");
  }
  
  if (supplierName) {
    lines.push(`Supplier: ${escapeHtml(supplierName)}`);
  }
  
  // Summary stats
  lines.push(`📊 ${summary.overPricedCount} overpriced • ${summary.bestPriceCount} best price • ${summary.newItemsCount} new items`);
  lines.push("──────────");
  
  // Product list with status markers
  for (const comp of comparisons) {
    const emoji = getStatusEmoji(comp);
    const productName = comp.product_name;
    const currentPrice = formatPrice(comp.scanned_price);
    
    // Check if we need to add translation
    const standardizedName = comp.matched_product?.name || '';
    const formattedName = formatProductNameWithTranslation(productName, standardizedName);
    
    if (comp.status === 'not_found') {
      // New item with 🆕 badge
      lines.push(`${emoji} <b>${escapeHtml(formattedName)}</b> — ${currentPrice}`);
    } else {
      const analysis = comp.price_analysis;
      if (analysis?.has_better_deals) {
        // Overpriced item
        lines.push(`${emoji} <b>${escapeHtml(formattedName)}</b> — ${currentPrice}`);
        
        // Show up to 3 better deals
        const betterDeals = analysis.better_deals.slice(0, 3);
        for (const deal of betterDeals) {
          const dealPrice = formatPrice(deal.price);
          const supplier = escapeHtml(deal.supplier);
          const productNameDeal = escapeHtml(deal.product_name);
          const savingsPct = deal.savings_percent;
          lines.push(`  <i>• ${dealPrice} — ${productNameDeal} (${supplier}) (-${savingsPct}%)</i>`);
        }
      } else {
        // Best price
        lines.push(`${emoji} <b>${escapeHtml(formattedName)}</b> — ${currentPrice}`);
      }
    }
  }
  
  // Compact comparison table
  if (summary.overPricedCount > 0) {
    lines.push("\n<b>You vs Minimum:</b>");
    lines.push(createComparisonTable(comparisons));
  }
  
  return lines.join('\n');
}

/**
 * Generate test data for development and testing
 */
export function generateTestComparisonData(): ComparisonData {
  return {
    comparisons: [
      {
        product_name: "Semangka Merah",
        scanned_price: 25000,
        status: "overpriced",
        matched_product: {
          id: "1",
          name: "Watermelon Red",
          unit: "kg"
        },
        price_analysis: {
          min_price: 18000,
          max_price: 30000,
          avg_price: 22000,
          has_better_deals: true,
          is_best_price: false,
          better_deals: [
            {
              supplier: "Fresh Market",
              price: 18000,
              product_name: "Watermelon Red",
              unit: "kg",
              savings: 7000,
              savings_percent: 28
            },
            {
              supplier: "Veggie Paradise", 
              price: 20000,
              product_name: "Watermelon Red",
              unit: "kg",
              savings: 5000,
              savings_percent: 20
            }
          ]
        }
      },
      {
        product_name: "Apple Fuji",
        scanned_price: 35000,
        status: "normal",
        matched_product: {
          id: "2", 
          name: "Apple Fuji",
          unit: "kg"
        },
        price_analysis: {
          min_price: 35000,
          max_price: 45000,
          avg_price: 38000,
          has_better_deals: false,
          is_best_price: true,
          better_deals: []
        }
      },
      {
        product_name: "Dragon Fruit Exotic",
        scanned_price: 60000,
        status: "not_found",
        isNew: true
      }
    ],
    summary: {
      total_items: 3,
      found_items: 2,
      overpriced_items: 1,
      good_deals: 1
    }
  };
}