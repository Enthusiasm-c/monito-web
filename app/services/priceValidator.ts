/**
 * Price Validator Service
 * Validates extracted prices against business rules and market ranges
 */

interface PriceValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  confidence: number;
}

interface ProductCategory {
  keywords: string[];
  minPrice: number;
  maxPrice: number;
  commonUnits: string[];
}

export const priceValidator = {
  
  // Price ranges for different product categories in IDR
  // Updated based on actual Indonesian market data
  categories: Record<string, ProductCategory> = {
    // Dairy products
    cheese: {
      keywords: ['cheese', 'keju', 'mozzarella', 'cheddar', 'parmesan', 'gouda', 'brie', 'mascarpone', 'ricotta'],
      minPrice: 50000,    // 50k IDR minimum
      maxPrice: 5000000,  // 5M IDR maximum (premium imported cheese)
      commonUnits: ['kg', 'gr', 'pack', 'pcs']
    },
    milk: {
      keywords: ['milk', 'susu', 'yogurt'],
      minPrice: 10000,    // 10k IDR
      maxPrice: 500000,   // 500k IDR
      commonUnits: ['ltr', 'ml', 'pack', 'bottle']
    },
    cream: {
      keywords: ['cream', 'butter', 'mentega', 'whipping', 'sour cream'],
      minPrice: 20000,    // 20k IDR
      maxPrice: 5000000,  // 5M IDR (bulk butter 25kg)
      commonUnits: ['kg', 'gr', 'ltr', 'ml', 'pack']
    },
    
    // Seafood
    seafood: {
      keywords: ['fish', 'ikan', 'salmon', 'tuna', 'shrimp', 'udang', 'crab', 'lobster', 'squid'],
      minPrice: 20000,    // 20k IDR
      maxPrice: 3000000,  // 3M IDR
      commonUnits: ['kg', 'gr', 'pcs', 'pack']
    },
    
    // Vegetables & Fruits
    vegetables: {
      keywords: ['vegetable', 'sayur', 'tomato', 'potato', 'carrot', 'onion', 'garlic', 'lettuce'],
      minPrice: 5000,     // 5k IDR
      maxPrice: 200000,   // 200k IDR
      commonUnits: ['kg', 'gr', 'pack', 'bundle']
    },
    fruits: {
      keywords: ['fruit', 'buah', 'apple', 'orange', 'banana', 'mango', 'strawberry', 'berry'],
      minPrice: 5000,     // 5k IDR
      maxPrice: 500000,   // 500k IDR (for premium/imported)
      commonUnits: ['kg', 'gr', 'pack', 'pcs']
    },
    
    // Meat products
    meat: {
      keywords: ['meat', 'daging', 'beef', 'chicken', 'lamb', 'pork', 'sausage', 'bacon', 'brisket', 'steak'],
      minPrice: 2000,     // 2k IDR (for small portions/sausages)
      maxPrice: 1000000,  // 1M IDR
      commonUnits: ['kg', 'gr', 'pack', 'pcs']
    },
    
    // Beverages
    beverages: {
      keywords: ['juice', 'jus', 'coffee', 'kopi', 'tea', 'teh', 'soda', 'water', 'air'],
      minPrice: 5000,     // 5k IDR
      maxPrice: 300000,   // 300k IDR
      commonUnits: ['ltr', 'ml', 'bottle', 'can', 'pack']
    },
    
    // General groceries
    groceries: {
      keywords: ['rice', 'beras', 'oil', 'minyak', 'sugar', 'gula', 'salt', 'garam', 'flour', 'tepung', 'sauce', 'paste'],
      minPrice: 1000,     // 1k IDR (for small sachets/portions)
      maxPrice: 2000000,  // 2M IDR (specialty flours, bulk items)
      commonUnits: ['kg', 'gr', 'ltr', 'pack', 'pcs']
    },
    
    // Specialty items
    specialty: {
      keywords: ['truffle', 'honey', 'madu', 'nuts', 'almond', 'pistachio', 'pecan', 'walnut', 'dried'],
      minPrice: 10000,    // 10k IDR
      maxPrice: 10000000, // 10M IDR (premium imports like pistachios)
      commonUnits: ['kg', 'gr', 'pack']
    }
  };
  
  // General price bounds for unknown products
  generalBounds = {
    minPrice: 500,       // 500 IDR absolute minimum (for very small items)
    maxPrice: 50000000,  // 50M IDR absolute maximum
    suspiciouslyLow: 1000,     // Below 1k is suspicious (unless unit pricing)
    suspiciouslyHigh: 10000000 // Above 10M is suspicious
  };

  public static getInstance(): PriceValidator {
    if (!PriceValidator.instance) {
      PriceValidator.instance = new PriceValidator();
    }
    return PriceValidator.instance;
  }

  /**
   * Validate a single product's price
   */
  validateProduct(product: {
    name: string;
    price: number;
    unit?: string;
    category?: string;
  }): PriceValidationResult {
    const result: PriceValidationResult = {
      isValid: true,
      warnings: [],
      errors: [],
      confidence: 1.0
    };

    // Basic validation
    if (!product.price || product.price <= 0) {
      result.isValid = false;
      result.errors.push('Price must be greater than 0');
      result.confidence = 0;
      return result;
    }

    // Check absolute bounds
    if (product.price < priceValidator.generalBounds.minPrice) {
      result.isValid = false;
      result.errors.push(`Price ${product.price} is below absolute minimum ${priceValidator.generalBounds.minPrice}`);
      result.confidence = 0;
      return result;
    }

    if (product.price > priceValidator.generalBounds.maxPrice) {
      result.isValid = false;
      result.errors.push(`Price ${product.price} exceeds absolute maximum ${priceValidator.generalBounds.maxPrice}`);
      result.confidence = 0;
      return result;
    }

    // Detect product category
    const category = priceValidator.detectCategory(product.name, product.category);
    
    if (category) {
      // Validate against category-specific ranges
      if (product.price < category.minPrice) {
        result.warnings.push(
          `Price ${product.price} is below typical minimum ${category.minPrice} for category`
        );
        result.confidence *= 0.7;
      }
      
      if (product.price > category.maxPrice) {
        result.warnings.push(
          `Price ${product.price} exceeds typical maximum ${category.maxPrice} for category`
        );
        result.confidence *= 0.7;
      }

      // Check unit compatibility
      if (product.unit && category.commonUnits.length > 0) {
        const unitLower = product.unit.toLowerCase();
        const isCommonUnit = category.commonUnits.some(u => 
          unitLower.includes(u) || u.includes(unitLower)
        );
        
        if (!isCommonUnit) {
          result.warnings.push(
            `Unit '${product.unit}' is unusual for this category (expected: ${category.commonUnits.join(', ')})`
          );
          result.confidence *= 0.8;
        }
      }
    } else {
      // No specific category detected, use general validation
      if (product.price < priceValidator.generalBounds.suspiciouslyLow) {
        result.warnings.push(`Price ${product.price} seems suspiciously low`);
        result.confidence *= 0.8;
      }
      
      if (product.price > priceValidator.generalBounds.suspiciouslyHigh) {
        result.warnings.push(`Price ${product.price} seems suspiciously high`);
        result.confidence *= 0.8;
      }
    }

    // Check for common price parsing errors
    if (priceValidator.looksLikePriceError(product.price)) {
      result.warnings.push('Price might have decimal point parsing error');
      result.confidence *= 0.6;
    }

    return result;
  }

  /**
   * Validate a batch of products
   */
  validateBatch(products: Array<{
    name: string;
    price: number;
    unit?: string;
    category?: string;
  }>): {
    results: PriceValidationResult[];
    summary: {
      totalProducts: number;
      validProducts: number;
      productsWithWarnings: number;
      productsWithErrors: number;
      averageConfidence: number;
      priceDistribution: {
        below10k: number;
        between10kAnd100k: number;
        between100kAnd1M: number;
        above1M: number;
      };
    };
  } {
    const results = products.map(p => priceValidator.validateProduct(p));
    
    const summary = {
      totalProducts: products.length,
      validProducts: results.filter(r => r.isValid).length,
      productsWithWarnings: results.filter(r => r.warnings.length > 0).length,
      productsWithErrors: results.filter(r => r.errors.length > 0).length,
      averageConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
      priceDistribution: {
        below10k: products.filter(p => p.price < 10000).length,
        between10kAnd100k: products.filter(p => p.price >= 10000 && p.price < 100000).length,
        between100kAnd1M: products.filter(p => p.price >= 100000 && p.price < 1000000).length,
        above1M: products.filter(p => p.price >= 1000000).length
      }
    };

    return { results, summary };
  }

  /**
   * Detect product category based on name and optional category hint
   */
  detectCategory(productName: string, categoryHint?: string): ProductCategory | null {
    const nameLower = productName.toLowerCase();
    const categoryLower = categoryHint?.toLowerCase() || '';
    
    for (const [categoryName, category] of Object.entries(priceValidator.categories)) {
      // Check category hint first
      if (categoryLower && categoryLower.includes(categoryName)) {
        return category;
      }
      
      // Check keywords in product name
      for (const keyword of category.keywords) {
        if (nameLower.includes(keyword)) {
          return category;
        }
      }
    }
    
    return null;
  }

  /**
   * Check if price looks like a parsing error
   */
  looksLikePriceError(price: number): boolean {
    // Check if price is a round decimal that might be missing zeros
    // e.g., 316.35 instead of 316350
    const priceStr = price.toString();
    
    // Pattern 1: Ends with .XX where XX could be thousands
    if (/\.\d{2}$/.test(priceStr) && price < 1000) {
      return true;
    }
    
    // Pattern 2: Very specific decimal that looks like truncated thousands
    if (priceStr.includes('.') && !priceStr.endsWith('00') && !priceStr.endsWith('50')) {
      const decimal = parseFloat('0.' + priceStr.split('.')[1]);
      // If decimal part looks like it could be hundreds (e.g., .35 = 350)
      if (decimal > 0.09 && decimal < 1) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Suggest corrected price if parsing error is suspected
   */
  suggestPriceCorrection(price: number): number | null {
    const priceStr = price.toString();
    
    // If price ends with .XX and is suspiciously low
    if (/\.\d{2}$/.test(priceStr) && price < 1000) {
      // Multiply by 1000 (assume decimal was thousand separator)
      return Math.round(price * 1000);
    }
    
    // If price has suspicious decimal
    if (priceStr.includes('.')) {
      const parts = priceStr.split('.');
      if (parts[1].length <= 3) {
        // Try interpreting as thousands separator
        return parseInt(parts[0] + parts[1].padEnd(3, '0'));
      }
    }
    
    return null;
  }
};