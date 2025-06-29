/**
 * Unified Unit Converter
 * Consolidates all unit conversion logic from multiple files
 * Replaces: calcUnitPrice, calculateUnitPrice, and other scattered unit logic
 */

export interface UnitConversion {
  canonicalUnit: string;
  multiplier: number; // How many canonical units in the given unit
  category: 'weight' | 'volume' | 'count' | 'pack' | 'special';
}

/**
 * Comprehensive unit normalization map
 * Consolidates logic from unit-price-calculator.ts and product-normalizer.ts
 */
export const UNIT_CONVERSIONS: Record<string, UnitConversion> = {
  // Weight - normalize to kg
  'kg': { canonicalUnit: 'kg', multiplier: 1, category: 'weight' },
  'kgs': { canonicalUnit: 'kg', multiplier: 1, category: 'weight' },
  'kilogram': { canonicalUnit: 'kg', multiplier: 1, category: 'weight' },
  'kilo': { canonicalUnit: 'kg', multiplier: 1, category: 'weight' },
  'g': { canonicalUnit: 'kg', multiplier: 0.001, category: 'weight' },
  'gr': { canonicalUnit: 'kg', multiplier: 0.001, category: 'weight' },
  'gram': { canonicalUnit: 'kg', multiplier: 0.001, category: 'weight' },
  'mg': { canonicalUnit: 'kg', multiplier: 0.000001, category: 'weight' },
  'milligram': { canonicalUnit: 'kg', multiplier: 0.000001, category: 'weight' },
  
  // Volume - normalize to liter
  'l': { canonicalUnit: 'ltr', multiplier: 1, category: 'volume' },
  'ltr': { canonicalUnit: 'ltr', multiplier: 1, category: 'volume' },
  'liter': { canonicalUnit: 'ltr', multiplier: 1, category: 'volume' },
  'litre': { canonicalUnit: 'ltr', multiplier: 1, category: 'volume' },
  'ml': { canonicalUnit: 'ltr', multiplier: 0.001, category: 'volume' },
  'milliliter': { canonicalUnit: 'ltr', multiplier: 0.001, category: 'volume' },
  
  // Count - normalize to pcs
  'pcs': { canonicalUnit: 'pcs', multiplier: 1, category: 'count' },
  'pc': { canonicalUnit: 'pcs', multiplier: 1, category: 'count' },
  'piece': { canonicalUnit: 'pcs', multiplier: 1, category: 'count' },
  'pieces': { canonicalUnit: 'pcs', multiplier: 1, category: 'count' },
  'butir': { canonicalUnit: 'pcs', multiplier: 1, category: 'count' },
  'buah': { canonicalUnit: 'pcs', multiplier: 1, category: 'count' },
  'biji': { canonicalUnit: 'pcs', multiplier: 1, category: 'count' },
  'unit': { canonicalUnit: 'pcs', multiplier: 1, category: 'count' },
  'units': { canonicalUnit: 'pcs', multiplier: 1, category: 'count' },
  
  // Special counts
  'dozen': { canonicalUnit: 'pcs', multiplier: 12, category: 'count' },
  'dz': { canonicalUnit: 'pcs', multiplier: 12, category: 'count' },
  'lusin': { canonicalUnit: 'pcs', multiplier: 12, category: 'count' },
  
  // Pack
  'pak': { canonicalUnit: 'pak', multiplier: 1, category: 'pack' },
  'pack': { canonicalUnit: 'pak', multiplier: 1, category: 'pack' },
  'paket': { canonicalUnit: 'pak', multiplier: 1, category: 'pack' },
  'package': { canonicalUnit: 'pak', multiplier: 1, category: 'pack' },
  
  // Box/Container
  'dus': { canonicalUnit: 'dus', multiplier: 1, category: 'pack' },
  'box': { canonicalUnit: 'dus', multiplier: 1, category: 'pack' },
  'carton': { canonicalUnit: 'dus', multiplier: 1, category: 'pack' },
  'kotak': { canonicalUnit: 'dus', multiplier: 1, category: 'pack' },
  
  // Indonesian specific units
  'sisir': { canonicalUnit: 'bunch', multiplier: 1, category: 'special' },
  'lembar': { canonicalUnit: 'sheet', multiplier: 1, category: 'special' },
  'karung': { canonicalUnit: 'sack', multiplier: 1, category: 'special' },
  'ikat': { canonicalUnit: 'bunch', multiplier: 1, category: 'special' },
  'tray': { canonicalUnit: 'tray', multiplier: 1, category: 'special' },
  'cup': { canonicalUnit: 'cup', multiplier: 1, category: 'special' },
  'bottle': { canonicalUnit: 'bottle', multiplier: 1, category: 'special' },
  'can': { canonicalUnit: 'can', multiplier: 1, category: 'special' },
  'jar': { canonicalUnit: 'jar', multiplier: 1, category: 'special' },
  'bag': { canonicalUnit: 'bag', multiplier: 1, category: 'special' },
  'pouch': { canonicalUnit: 'pouch', multiplier: 1, category: 'special' },
};

/**
 * Normalize unit string for lookup
 */
function normalizeUnitString(unit: string): string {
  return unit.toLowerCase().trim().replace(/[.\s]/g, '');
}

/**
 * Calculate unit price (price per canonical unit)
 * Replaces both calcUnitPrice and calculateUnitPrice functions
 * @param totalPrice - Total price for the quantity
 * @param quantity - Quantity in original units
 * @param unit - Unit string (e.g., "kg", "g", "pcs")
 * @returns Price per canonical unit, or null if conversion not possible
 */
export function calculateUnitPrice(
  totalPrice: number,
  quantity: number,
  unit: string
): number | null {
  if (totalPrice <= 0 || quantity <= 0) {
    return null;
  }

  // Normalize unit string
  const normalizedUnit = normalizeUnitString(unit);
  
  // Find conversion
  const conversion = UNIT_CONVERSIONS[normalizedUnit];
  if (!conversion) {
    // Unknown unit - can't calculate unit price
    return null;
  }

  try {
    // Calculate canonical units
    const canonicalUnits = quantity * conversion.multiplier;
    if (canonicalUnits <= 0) {
      return null;
    }

    // Return price per canonical unit
    return totalPrice / canonicalUnits;
  } catch (error) {
    return null;
  }
}

/**
 * Legacy compatibility - alias for calculateUnitPrice
 * @deprecated Use calculateUnitPrice instead
 */
export function calcUnitPrice(price: number, qty: number, unit: string): number | null {
  return calculateUnitPrice(price, qty, unit);
}

/**
 * Get canonical unit for a given unit string
 * @param unit - Unit string
 * @returns Canonical unit or null if unknown
 */
export function getCanonicalUnit(unit: string): string | null {
  const normalizedUnit = normalizeUnitString(unit);
  const conversion = UNIT_CONVERSIONS[normalizedUnit];
  return conversion?.canonicalUnit || null;
}

/**
 * Get unit category (weight, volume, count, etc.)
 * @param unit - Unit string
 * @returns Unit category or null if unknown
 */
export function getUnitCategory(unit: string): string | null {
  const normalizedUnit = normalizeUnitString(unit);
  const conversion = UNIT_CONVERSIONS[normalizedUnit];
  return conversion?.category || null;
}

/**
 * Check if two units are comparable (same canonical unit)
 * @param unit1 - First unit
 * @param unit2 - Second unit  
 * @returns True if units can be compared
 */
export function areUnitsComparable(unit1: string, unit2: string): boolean {
  const canonical1 = getCanonicalUnit(unit1);
  const canonical2 = getCanonicalUnit(unit2);
  
  return canonical1 !== null && canonical2 !== null && canonical1 === canonical2;
}

/**
 * Convert quantity from one unit to another (if comparable)
 * @param quantity - Original quantity
 * @param fromUnit - Source unit
 * @param toUnit - Target unit
 * @returns Converted quantity or null if not comparable
 */
export function convertQuantity(
  quantity: number,
  fromUnit: string,
  toUnit: string
): number | null {
  if (quantity <= 0) return null;

  const fromNormalized = normalizeUnitString(fromUnit);
  const toNormalized = normalizeUnitString(toUnit);
  
  const fromConversion = UNIT_CONVERSIONS[fromNormalized];
  const toConversion = UNIT_CONVERSIONS[toNormalized];
  
  if (!fromConversion || !toConversion) {
    return null;
  }
  
  // Must be same canonical unit to convert
  if (fromConversion.canonicalUnit !== toConversion.canonicalUnit) {
    return null;
  }
  
  try {
    // Convert to canonical units, then to target units
    const canonicalQuantity = quantity * fromConversion.multiplier;
    return canonicalQuantity / toConversion.multiplier;
  } catch (error) {
    return null;
  }
}

/**
 * Standardize unit string to canonical form
 * @param unit - Input unit string
 * @returns Standardized unit string or original if unknown
 */
export function standardizeUnit(unit: string): string {
  const canonical = getCanonicalUnit(unit);
  return canonical || unit;
}

/**
 * Get all supported units for a category
 * @param category - Unit category ('weight', 'volume', etc.)
 * @returns Array of unit strings in that category
 */
export function getUnitsByCategory(category: string): string[] {
  return Object.entries(UNIT_CONVERSIONS)
    .filter(([_, conversion]) => conversion.category === category)
    .map(([unit, _]) => unit);
}

/**
 * Validate if a unit is supported
 * @param unit - Unit string to check
 * @returns True if unit is supported
 */
export function isUnitSupported(unit: string): boolean {
  const normalizedUnit = normalizeUnitString(unit);
  return normalizedUnit in UNIT_CONVERSIONS;
}

/**
 * Get unit conversion info
 * @param unit - Unit string
 * @returns Conversion info or null if unknown
 */
export function getUnitInfo(unit: string): UnitConversion | null {
  const normalizedUnit = normalizeUnitString(unit);
  return UNIT_CONVERSIONS[normalizedUnit] || null;
}

/**
 * Format unit for display (with proper case)
 * @param unit - Unit string
 * @returns Formatted unit string
 */
export function formatUnit(unit: string): string {
  const canonical = getCanonicalUnit(unit);
  if (!canonical) return unit;
  
  // Apply common formatting rules
  const formatMap: Record<string, string> = {
    'kg': 'kg',
    'ltr': 'L',
    'pcs': 'pcs',
    'pak': 'pack',
    'dus': 'box',
    'bunch': 'bunch',
    'sheet': 'sheet',
    'sack': 'sack',
    'tray': 'tray',
    'cup': 'cup',
    'bottle': 'bottle',
    'can': 'can',
    'jar': 'jar',
    'bag': 'bag',
    'pouch': 'pouch'
  };
  
  return formatMap[canonical] || canonical;
}