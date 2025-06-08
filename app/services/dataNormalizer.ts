/**
 * Data Normalization Service
 * Handles currency, weight, and price normalization for extracted product data
 */

interface NormalizationResult {
  value: number | null;
  unit?: string;
  originalValue?: string;
}

export class DataNormalizer {
  private currencyPatterns = {
    rp: /Rp\.?\s*/gi,
    idr: /IDR\.?\s*/gi,
    dollar: /\$\s*/g,
    rupiah: /rupiah\.?\s*/gi,
    euro: /€\s*/g,
    pound: /£\s*/g
  };

  private weightConversions = {
    // Weight to grams
    'kg': 1000,
    'kilogram': 1000,
    'kilograms': 1000,
    'kilo': 1000,
    'g': 1,
    'gram': 1,
    'grams': 1,
    'gr': 1,
    'lb': 453.592,
    'pound': 453.592,
    'pounds': 453.592,
    'lbs': 453.592,
    'oz': 28.3495,
    'ounce': 28.3495,
    'ounces': 28.3495,
    
    // Volume to ml
    'l': 1000,
    'liter': 1000,
    'litre': 1000,
    'liters': 1000,
    'litres': 1000,
    'ml': 1,
    'milliliter': 1,
    'milliliters': 1,
    
    // Count units (normalized to pieces)
    'pcs': 1,
    'piece': 1,
    'pieces': 1,
    'pc': 1,
    'each': 1,
    'item': 1,
    'unit': 1,
    
    // Indonesian units
    'sisir': 1, // bunch
    'ikat': 1,  // bundle
    'bunch': 1,
    'bundle': 1
  };

  /**
   * Normalize price strings to numeric values
   */
  normalizePrice(priceStr: string | number | null | undefined): NormalizationResult {
    if (priceStr === null || priceStr === undefined || priceStr === '') {
      return { value: null };
    }

    const originalValue = String(priceStr);
    let cleanPrice = originalValue.trim();

    // Remove currency symbols
    for (const [currency, pattern] of Object.entries(this.currencyPatterns)) {
      cleanPrice = cleanPrice.replace(pattern, '');
    }

    // Handle Indonesian number format: 50.000 or 50,000
    // Remove thousands separators (dots or commas followed by exactly 3 digits)
    cleanPrice = cleanPrice.replace(/[.,](?=\d{3}(?!\d))/g, '');

    // Extract numeric value (including decimals)
    const priceMatch = cleanPrice.match(/(\d+(?:[.,]\d{1,2})?)/);
    if (priceMatch) {
      let priceValue = priceMatch[1];
      // Handle decimal separator (convert comma to dot)
      priceValue = priceValue.replace(',', '.');
      
      try {
        const numericValue = parseFloat(priceValue);
        return {
          value: numericValue > 0 ? numericValue : null,
          originalValue
        };
      } catch (error) {
        return { value: null, originalValue };
      }
    }

    return { value: null, originalValue };
  }

  /**
   * Normalize weight/unit strings to standard units and grams
   */
  normalizeWeight(weightStr: string | null | undefined): NormalizationResult {
    if (!weightStr || weightStr.trim() === '') {
      return { value: null, unit: 'pcs' };
    }

    const originalValue = String(weightStr).trim();
    const lowerWeight = originalValue.toLowerCase();

    // Extract number and unit
    const weightMatch = lowerWeight.match(/(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)/);
    if (weightMatch) {
      const valueStr = weightMatch[1].replace(',', '.');
      const unit = weightMatch[2].toLowerCase();

      try {
        const value = parseFloat(valueStr);
        const multiplier = this.weightConversions[unit];

        if (multiplier !== undefined) {
          return {
            value: value * multiplier,
            unit: this.getStandardUnit(unit),
            originalValue
          };
        }
      } catch (error) {
        // Fall through to default handling
      }
    }

    // If no unit found, try to extract just the number
    const numberMatch = lowerWeight.match(/(\d+(?:[.,]\d+)?)/);
    if (numberMatch) {
      try {
        const value = parseFloat(numberMatch[1].replace(',', '.'));
        return {
          value,
          unit: 'pcs', // Default to pieces if no unit specified
          originalValue
        };
      } catch (error) {
        // Fall through
      }
    }

    // Check for common unit keywords without numbers
    if (lowerWeight.includes('kg') || lowerWeight.includes('kilo')) {
      return { value: 1000, unit: 'kg', originalValue }; // Default 1kg
    }
    if (lowerWeight.includes('gram') || lowerWeight.includes(' g ')) {
      return { value: 1, unit: 'g', originalValue }; // Default 1g
    }

    return { value: null, unit: 'pcs', originalValue };
  }

  /**
   * Get standard unit name for display
   */
  private getStandardUnit(unit: string): string {
    const lowerUnit = unit.toLowerCase();

    // Weight units
    if (['kg', 'kilogram', 'kilograms', 'kilo'].includes(lowerUnit)) return 'kg';
    if (['g', 'gram', 'grams', 'gr'].includes(lowerUnit)) return 'g';
    if (['lb', 'pound', 'pounds', 'lbs'].includes(lowerUnit)) return 'lb';
    if (['oz', 'ounce', 'ounces'].includes(lowerUnit)) return 'oz';

    // Volume units
    if (['l', 'liter', 'litre', 'liters', 'litres'].includes(lowerUnit)) return 'l';
    if (['ml', 'milliliter', 'milliliters'].includes(lowerUnit)) return 'ml';

    // Count units
    if (['pcs', 'piece', 'pieces', 'pc', 'each', 'item', 'unit'].includes(lowerUnit)) return 'pcs';

    // Indonesian/local units
    if (['sisir', 'ikat', 'bunch', 'bundle'].includes(lowerUnit)) return 'bunch';

    return lowerUnit; // Return as-is if not recognized
  }

  /**
   * Clean and standardize product names
   */
  normalizeProductName(name: string): string {
    if (!name || typeof name !== 'string') return '';

    return name
      .trim()
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/[""'']/g, '"') // Normalize quotes
      .replace(/[–—]/g, '-') // Normalize dashes
      .replace(/^\W+|\W+$/g, '') // Remove leading/trailing non-word chars
      .trim();
  }

  /**
   * Detect if a string likely represents a category header
   */
  isCategoryHeader(text: string, hasPrice: boolean = false): boolean {
    if (!text || typeof text !== 'string') return false;

    const cleanText = text.trim();
    
    // Category headers typically:
    // 1. Have no price
    // 2. Are not too long
    // 3. Don't contain numbers (usually)
    // 4. Contain category keywords

    if (hasPrice) return false; // Has price, likely a product
    if (cleanText.length < 3 || cleanText.length > 50) return false;

    const categoryKeywords = [
      // English categories
      'vegetable', 'fruit', 'meat', 'seafood', 'dairy', 'grain', 'spice', 'herb',
      'fresh', 'frozen', 'organic', 'category', 'section', 'group', 'type',
      'vegetables', 'fruits', 'meats', 'spices', 'herbs',
      
      // Indonesian categories
      'sayur', 'buah', 'daging', 'ikan', 'susu', 'rempah', 'segar',
      'sayuran', 'buahan', 'kategori', 'jenis', 'bagian'
    ];

    const lowerText = cleanText.toLowerCase();
    const hasKeyword = categoryKeywords.some(keyword => lowerText.includes(keyword));
    const hasNumbers = /\d/.test(cleanText);

    // Likely a category if:
    // - Contains category keywords, OR
    // - Is short text without numbers and without obvious product indicators
    return hasKeyword || (!hasNumbers && !this.looksLikeProduct(cleanText));
  }

  /**
   * Check if text looks like a product name
   */
  private looksLikeProduct(text: string): boolean {
    const lowerText = text.toLowerCase();
    
    // Product indicators
    const productIndicators = [
      'grade', 'quality', 'premium', 'fresh', 'organic', 'local',
      'large', 'small', 'medium', 'big', 'baby', 'mini',
      'red', 'green', 'white', 'yellow', 'brown'
    ];

    return productIndicators.some(indicator => lowerText.includes(indicator));
  }

  /**
   * Extract currency information from price string
   */
  extractCurrency(priceStr: string): string {
    if (!priceStr) return 'IDR'; // Default to Indonesian Rupiah

    const str = priceStr.toLowerCase();
    
    if (str.includes('rp') || str.includes('rupiah') || str.includes('idr')) return 'IDR';
    if (str.includes('$') || str.includes('usd')) return 'USD';
    if (str.includes('€') || str.includes('eur')) return 'EUR';
    if (str.includes('£') || str.includes('gbp')) return 'GBP';
    
    return 'IDR'; // Default
  }

  /**
   * Normalize a complete product object
   */
  normalizeProduct(rawProduct: any): any {
    const priceResult = this.normalizePrice(rawProduct.price);
    const weightResult = this.normalizeWeight(rawProduct.unit || rawProduct.weight);
    
    return {
      name: this.normalizeProductName(rawProduct.name),
      price: priceResult.value,
      unit: weightResult.unit || 'pcs',
      category: rawProduct.category || null,
      description: rawProduct.description || null,
      currency: this.extractCurrency(rawProduct.price),
      weightGrams: weightResult.value,
      originalData: {
        name: rawProduct.name,
        price: priceResult.originalValue,
        unit: weightResult.originalValue
      }
    };
  }
}

// Export singleton instance
export const dataNormalizer = new DataNormalizer();