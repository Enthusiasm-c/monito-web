/**
 * Advanced product name and unit standardization service
 * Handles Indonesian to English translation and multi-supplier variations
 */

import {
  COMMON_MISSPELLINGS,
  INDONESIAN_PRODUCTS,
  INDONESIAN_DESCRIPTORS,
  BRAND_NAMES,
  UNIT_CONVERSIONS,
  SPECIAL_PATTERNS,
  normalizePrice
} from './dictionary';

export { normalizePrice };

interface StandardizationResult {
  standardizedName: string;
  standardizedUnit: string;
  confidence: number;
  detectedLanguage: 'id' | 'en' | 'mixed';
  detectedBrand?: string;
  extractedSize?: string;
}

/**
 * Main standardization function
 */
export function standardizeProductData(
  rawName: string,
  rawUnit?: string
): StandardizationResult {
  const language = detectLanguage(rawName);
  const confidence = calculateConfidence(rawName, language);
  
  // Step 1: Clean and normalize
  let cleanedName = rawName.toLowerCase().trim();
  cleanedName = cleanedName.replace(/[^\w\s-]/g, ' ');
  cleanedName = cleanedName.replace(/\s+/g, ' ').trim();
  
  // Step 2: Fix common misspellings first
  cleanedName = fixMisspellings(cleanedName);
  
  // Step 3: Apply special patterns
  for (const { pattern, replacement } of SPECIAL_PATTERNS) {
    cleanedName = cleanedName.replace(pattern, replacement);
  }
  
  // Step 4: Extract size/weight if present
  const sizeInfo = extractSizeFromName(cleanedName);
  if (sizeInfo.size) {
    cleanedName = sizeInfo.nameWithoutSize;
  }
  
  // Step 5: Detect and preserve brand
  const brandInfo = detectBrand(cleanedName);
  if (brandInfo.brand) {
    cleanedName = brandInfo.nameWithoutBrand;
  }
  
  // Step 6: Translate Indonesian words
  const translatedName = translateIndonesianName(cleanedName);
  
  // Step 7: Parse into components
  const components = parseProductComponents(translatedName);
  
  // Step 8: Reorder components
  const standardizedName = assembleStandardizedName(
    components,
    brandInfo.brand,
    sizeInfo.size
  );
  
  // Step 9: Standardize unit
  const standardizedUnit = standardizeUnit(
    rawUnit || sizeInfo.extractedUnit || 'pcs'
  );
  
  return {
    standardizedName,
    standardizedUnit,
    confidence,
    detectedLanguage: language,
    detectedBrand: brandInfo.brand,
    extractedSize: sizeInfo.size
  };
}

/**
 * Detect language of the product name
 */
function detectLanguage(text: string): 'id' | 'en' | 'mixed' {
  const words = text.toLowerCase().split(/\s+/);
  let indonesianCount = 0;
  let englishCount = 0;
  
  for (const word of words) {
    if (INDONESIAN_PRODUCTS[word] || INDONESIAN_DESCRIPTORS[word]) {
      indonesianCount++;
    } else if (/^[a-z]+$/.test(word) && word.length > 2) {
      englishCount++;
    }
  }
  
  const total = indonesianCount + englishCount;
  if (total === 0) return 'en';
  
  const indonesianRatio = indonesianCount / total;
  if (indonesianRatio > 0.7) return 'id';
  if (indonesianRatio < 0.3) return 'en';
  return 'mixed';
}

/**
 * Calculate confidence score
 */
function calculateConfidence(name: string, language: 'id' | 'en' | 'mixed'): number {
  let confidence = 0.5;
  
  // Higher confidence for single language
  if (language !== 'mixed') confidence += 0.2;
  
  // Higher confidence if contains known products
  const words = name.toLowerCase().split(/\s+/);
  for (const word of words) {
    if (INDONESIAN_PRODUCTS[word]) {
      confidence += 0.1;
      break;
    }
  }
  
  // Lower confidence for very short or very long names
  if (words.length < 2) confidence -= 0.2;
  if (words.length > 6) confidence -= 0.1;
  
  return Math.max(0.1, Math.min(1.0, confidence));
}

/**
 * Extract size/weight from product name
 */
function extractSizeFromName(name: string): {
  size: string | null;
  extractedUnit: string | null;
  nameWithoutSize: string;
} {
  // Pattern for size: number + unit
  const sizePattern = /\b(\d+(?:\.\d+)?)\s*(ml|l|g|kg|gr|mg|oz|pcs|pack|box|butir|buah|lembar|potong|ekor|bungkus|dus|karton|botol|kaleng|liter|mililiter|kilogram|gram|ons)\b/gi;
  
  const match = name.match(sizePattern);
  if (match) {
    const fullMatch = match[0];
    const [, number, unit] = fullMatch.match(/(\d+(?:\.\d+)?)\s*(.+)/) || [];
    
    return {
      size: fullMatch.toLowerCase(),
      extractedUnit: unit ? unit.toLowerCase() : null,
      nameWithoutSize: name.replace(sizePattern, '').replace(/\s+/g, ' ').trim()
    };
  }
  
  return {
    size: null,
    extractedUnit: null,
    nameWithoutSize: name
  };
}

/**
 * Detect and extract brand name
 */
function detectBrand(name: string): {
  brand: string | null;
  nameWithoutBrand: string;
} {
  const words = name.toLowerCase().split(/\s+/);
  
  for (const brand of BRAND_NAMES) {
    if (words.includes(brand)) {
      return {
        brand,
        nameWithoutBrand: name.replace(new RegExp(`\\b${brand}\\b`, 'gi'), '').replace(/\s+/g, ' ').trim()
      };
    }
  }
  
  return {
    brand: null,
    nameWithoutBrand: name
  };
}

/**
 * Fix common misspellings
 */
function fixMisspellings(text: string): string {
  const words = text.split(/\s+/);
  
  const correctedWords = words.map(word => {
    // Check if the word is a common misspelling
    if (COMMON_MISSPELLINGS[word]) {
      return COMMON_MISSPELLINGS[word];
    }
    // Check if it's a plural misspelling (ends with 's')
    if (word.endsWith('s') && COMMON_MISSPELLINGS[word.slice(0, -1)]) {
      return COMMON_MISSPELLINGS[word.slice(0, -1)] + 's';
    }
    return word;
  });
  
  return correctedWords.join(' ');
}

/**
 * Translate Indonesian words to English
 */
function translateIndonesianName(name: string): string {
  let translated = name;
  const words = translated.split(/\s+/);
  
  // Translate each word
  const translatedWords = words.map(word => {
    // Check products dictionary
    if (INDONESIAN_PRODUCTS[word]) {
      return INDONESIAN_PRODUCTS[word];
    }
    // Check descriptors dictionary
    if (INDONESIAN_DESCRIPTORS[word]) {
      return INDONESIAN_DESCRIPTORS[word];
    }
    // Keep original if no translation
    return word;
  });
  
  return translatedWords.join(' ');
}

/**
 * Parse product name into components
 */
function parseProductComponents(name: string): {
  mainProduct: string | null;
  descriptors: string[];
} {
  const words = name.split(/\s+/);
  const commonProducts = [
    'milk', 'yogurt', 'cheese', 'butter', 'cream', 'ice-cream',
    'chicken', 'beef', 'pork', 'lamb', 'fish', 'shrimp', 'egg',
    'rice', 'noodle', 'bread', 'flour', 'oil', 'sugar', 'salt',
    'water', 'juice', 'coffee', 'tea', 'soda', 'sauce',
    'vegetable', 'fruit', 'meat', 'instant-noodle', 'mineral-water'
  ];
  
  // Find main product
  let mainProduct = null;
  const descriptors: string[] = [];
  
  for (const word of words) {
    if (commonProducts.includes(word) && !mainProduct) {
      mainProduct = word;
    } else {
      descriptors.push(word);
    }
  }
  
  // If no main product found, use first noun-like word
  if (!mainProduct && words.length > 0) {
    mainProduct = words[0];
    descriptors.push(...words.slice(1));
  }
  
  return { mainProduct, descriptors };
}

/**
 * Assemble standardized product name
 */
function assembleStandardizedName(
  components: { mainProduct: string | null; descriptors: string[] },
  brand: string | null,
  size: string | null
): string {
  const parts: string[] = [];
  
  // 1. Main product
  if (components.mainProduct) {
    parts.push(components.mainProduct);
  }
  
  // 2. Brand
  if (brand) {
    parts.push(brand);
  }
  
  // 3. Descriptors (filtered, deduplicated and sorted)
  const relevantDescriptors = [...new Set(components.descriptors)]
    .filter(d => d.length > 1 && !['the', 'and', 'or', 'with'].includes(d))
    .filter(d => d !== components.mainProduct && d !== brand) // Avoid duplicates
    .sort();
  
  parts.push(...relevantDescriptors);
  
  // 4. Size (at the end)
  if (size) {
    parts.push(size);
  }
  
  return parts.join(' ');
}

/**
 * Standardize unit
 */
export function standardizeUnit(unit: string): string {
  if (!unit) return 'pcs';
  
  const normalized = unit.toLowerCase().trim();
  
  // Check conversions
  if (UNIT_CONVERSIONS[normalized]) {
    return UNIT_CONVERSIONS[normalized];
  }
  
  // Extract unit from compound (e.g., "330ml" → "ml")
  const match = normalized.match(/\d+\s*([a-z]+)/);
  if (match && UNIT_CONVERSIONS[match[1]]) {
    return UNIT_CONVERSIONS[match[1]];
  }
  
  // Default mappings
  const defaultMappings: Record<string, string> = {
    'piece': 'pcs',
    'pieces': 'pcs',
    'unit': 'pcs',
    'units': 'pcs',
    'item': 'pcs',
    'items': 'pcs'
  };
  
  if (defaultMappings[normalized]) {
    return defaultMappings[normalized];
  }
  
  // Return original if no mapping
  return normalized;
}

/**
 * Generate standardized data (wrapper for backward compatibility)
 */
export function generateStandardizedData(
  rawName: string,
  rawUnit?: string
): {
  standardizedName: string;
  standardizedUnit: string;
} {
  const result = standardizeProductData(rawName, rawUnit);
  return {
    standardizedName: result.standardizedName,
    standardizedUnit: result.standardizedUnit
  };
}