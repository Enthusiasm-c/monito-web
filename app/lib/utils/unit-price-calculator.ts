/**
 * MVP: Simple unit price calculator for price comparisons
 * Converts prices to comparable units (price per kg, per liter, per piece)
 */

export interface UnitConversion {
  canonicalUnit: string;
  multiplier: number; // How many canonical units in the given unit
}

/**
 * Simple unit normalization map
 * Format: "input_unit" -> { canonicalUnit: "kg", multiplier: 1 }
 */
export const UNIT_CONVERSIONS: Record<string, UnitConversion> = {
  // Weight - normalize to kg
  'kg': { canonicalUnit: 'kg', multiplier: 1 },
  'kgs': { canonicalUnit: 'kg', multiplier: 1 },
  'kilogram': { canonicalUnit: 'kg', multiplier: 1 },
  'kilo': { canonicalUnit: 'kg', multiplier: 1 },
  'g': { canonicalUnit: 'kg', multiplier: 0.001 },
  'gr': { canonicalUnit: 'kg', multiplier: 0.001 },
  'gram': { canonicalUnit: 'kg', multiplier: 0.001 },
  
  // Volume - normalize to liter
  'l': { canonicalUnit: 'ltr', multiplier: 1 },
  'ltr': { canonicalUnit: 'ltr', multiplier: 1 },
  'liter': { canonicalUnit: 'ltr', multiplier: 1 },
  'litre': { canonicalUnit: 'ltr', multiplier: 1 },
  'ml': { canonicalUnit: 'ltr', multiplier: 0.001 },
  
  // Count - normalize to pcs
  'pcs': { canonicalUnit: 'pcs', multiplier: 1 },
  'pc': { canonicalUnit: 'pcs', multiplier: 1 },
  'piece': { canonicalUnit: 'pcs', multiplier: 1 },
  'pieces': { canonicalUnit: 'pcs', multiplier: 1 },
  'butir': { canonicalUnit: 'pcs', multiplier: 1 },
  'buah': { canonicalUnit: 'pcs', multiplier: 1 },
  'biji': { canonicalUnit: 'pcs', multiplier: 1 },
  
  // Pack
  'pak': { canonicalUnit: 'pak', multiplier: 1 },
  'pack': { canonicalUnit: 'pak', multiplier: 1 },
  'paket': { canonicalUnit: 'pak', multiplier: 1 },
  
  // Box/Dozen
  'dus': { canonicalUnit: 'dus', multiplier: 1 },
  'box': { canonicalUnit: 'dus', multiplier: 1 },
  'dozen': { canonicalUnit: 'dus', multiplier: 1 },
  
  // Indonesian specific
  'sisir': { canonicalUnit: 'bunch', multiplier: 1 },
  'lembar': { canonicalUnit: 'sheet', multiplier: 1 },
  'karung': { canonicalUnit: 'sack', multiplier: 1 },
  'ikat': { canonicalUnit: 'bunch', multiplier: 1 },
};

/**
 * Calculate unit price (price per canonical unit)
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
  const normalizedUnit = unit.toLowerCase().trim().replace(/[.\s]/g, '');
  
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
 * Get canonical unit for a given unit string
 * @param unit - Unit string
 * @returns Canonical unit or null if unknown
 */
export function getCanonicalUnit(unit: string): string | null {
  const normalizedUnit = unit.toLowerCase().trim().replace(/[.\s]/g, '');
  const conversion = UNIT_CONVERSIONS[normalizedUnit];
  return conversion?.canonicalUnit || null;
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