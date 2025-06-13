/**
 * Common utility functions shared across the application
 */

/**
 * Standardizes unit strings to a consistent format
 */
export function standardizeUnit(unit: string | null | undefined): string {
  if (!unit) return 'PIECE';
  
  const normalizedUnit = unit.toUpperCase().trim();
  
  const unitMappings: Record<string, string> = {
    'KG': 'KG',
    'KILOGRAM': 'KG',
    'KILO': 'KG',
    'G': 'GRAM',
    'GRAM': 'GRAM',
    'GR': 'GRAM',
    'L': 'LITER',
    'LITER': 'LITER',
    'LTR': 'LITER',
    'ML': 'ML',
    'MILLILITER': 'ML',
    'PCS': 'PIECE',
    'PIECE': 'PIECE',
    'PC': 'PIECE',
    'PACK': 'PACK',
    'PKT': 'PACK',
    'PACKET': 'PACK',
    'BOX': 'BOX',
    'CARTON': 'CARTON',
    'CTN': 'CARTON',
    'BOTTLE': 'BOTTLE',
    'BTL': 'BOTTLE',
    'CAN': 'CAN',
    'DOZEN': 'DOZEN',
    'DZ': 'DOZEN',
    'BUNDLE': 'BUNDLE',
    'BAG': 'BAG',
    'SACK': 'BAG',
    'TRAY': 'TRAY',
    'PUNNET': 'PUNNET',
    'BUNCH': 'BUNCH',
    'HEAD': 'HEAD',
    'LOAF': 'LOAF',
    'SLICE': 'SLICE',
    'PORTION': 'PORTION',
    'SERVING': 'SERVING',
    'UNIT': 'PIECE',
    'EA': 'PIECE',
    'EACH': 'PIECE'
  };
  
  // Check for patterns like "500G", "1KG", "250ML"
  const weightPattern = /^(\d+(?:\.\d+)?)\s*(KG|G|L|ML)$/i;
  const match = normalizedUnit.match(weightPattern);
  
  if (match) {
    const [, quantity, unit] = match;
    const standardUnit = unitMappings[unit.toUpperCase()] || unit.toUpperCase();
    return `${quantity}${standardUnit}`;
  }
  
  // Return mapped unit or original if no mapping exists
  return unitMappings[normalizedUnit] || normalizedUnit;
}

/**
 * Extracts supplier name from filename
 */
export function extractSupplierFromFilename(filename: string): string | null {
  if (!filename) return null;
  
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  
  // Common patterns to remove
  const patternsToRemove = [
    /price[\s_-]?list/gi,
    /catalog/gi,
    /inventory/gi,
    /products/gi,
    /\d{4}[-_]\d{2}[-_]\d{2}/g, // dates
    /\d{2}[-_]\d{2}[-_]\d{4}/g, // dates
    /\bv\d+\b/gi, // version numbers
    /\bfinal\b/gi,
    /\bdraft\b/gi,
    /\bupdated?\b/gi,
    /\bnew\b/gi,
    /\bcopy\b/gi,
    /\(\d+\)/, // (1), (2), etc.
  ];
  
  let cleanName = nameWithoutExt;
  patternsToRemove.forEach(pattern => {
    cleanName = cleanName.replace(pattern, ' ');
  });
  
  // Clean up multiple spaces, underscores, hyphens
  cleanName = cleanName
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // If nothing left, use original filename without extension
  if (!cleanName) {
    cleanName = nameWithoutExt
      .replace(/[_-]+/g, ' ')
      .trim();
  }
  
  return cleanName || null;
}

/**
 * Normalizes product names for matching
 */
export function normalizeProductName(name: string): string {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Categorizes products based on name and unit
 */
export function categorizeProduct(productName: string, unit?: string): string {
  const name = productName.toLowerCase();
  
  // Dairy & Eggs
  if (name.match(/\b(milk|susu|dairy|yogurt|yoghurt|cheese|keju|butter|mentega|cream|krim)\b/)) {
    return 'Dairy';
  }
  if (name.match(/\b(egg|telur|eggs)\b/)) {
    return 'Eggs';
  }
  
  // Meat & Poultry
  if (name.match(/\b(chicken|ayam|beef|sapi|meat|daging|pork|babi|lamb|domba|fish|ikan|seafood)\b/)) {
    return 'Meat & Poultry';
  }
  
  // Fruits & Vegetables
  if (name.match(/\b(vegetable|sayur|veggie|fruit|buah|apple|apel|banana|pisang|orange|jeruk|tomato|tomat)\b/)) {
    return 'Fruits & Vegetables';
  }
  
  // Bakery
  if (name.match(/\b(bread|roti|cake|kue|pastry|croissant|donut|muffin|bakery)\b/)) {
    return 'Bakery';
  }
  
  // Beverages
  if (name.match(/\b(drink|minuman|beverage|juice|jus|soda|cola|water|air|coffee|kopi|tea|teh)\b/)) {
    return 'Beverages';
  }
  
  // Grains & Cereals
  if (name.match(/\b(rice|beras|nasi|wheat|gandum|flour|tepung|pasta|noodle|mie|cereal|oat)\b/)) {
    return 'Grains & Cereals';
  }
  
  // Condiments & Sauces
  if (name.match(/\b(sauce|saus|ketchup|kecap|mayonnaise|mayo|mustard|vinegar|cuka|oil|minyak|salt|garam|pepper|lada|spice|bumbu)\b/)) {
    return 'Condiments & Sauces';
  }
  
  // Snacks
  if (name.match(/\b(snack|chips|keripik|crisp|biscuit|biskuit|cookie|cracker|chocolate|coklat|candy|permen)\b/)) {
    return 'Snacks';
  }
  
  // Frozen
  if (name.match(/\b(frozen|beku|ice cream|es krim)\b/)) {
    return 'Frozen';
  }
  
  // Default category
  return 'Other';
}

/**
 * Parses price string to number
 */
export function parsePrice(priceStr: string | number | null | undefined): number | null {
  if (priceStr === null || priceStr === undefined || priceStr === '') {
    return null;
  }
  
  if (typeof priceStr === 'number') {
    return isNaN(priceStr) ? null : priceStr;
  }
  
  // Convert to string and clean
  let cleanPrice = String(priceStr)
    .replace(/[^\d.,\-]/g, '') // Keep digits, dots, commas, and minus
    .replace(/,/g, ''); // Remove thousand separators
  
  // Handle negative prices
  const isNegative = cleanPrice.includes('-');
  cleanPrice = cleanPrice.replace(/-/g, '');
  
  const price = parseFloat(cleanPrice);
  
  if (isNaN(price)) {
    return null;
  }
  
  return isNegative ? -price : price;
}

/**
 * Validates if a price is within reasonable bounds
 */
export function isValidPrice(price: number | null): boolean {
  if (price === null || price === undefined) return false;
  if (isNaN(price)) return false;
  if (price < 0) return false;
  if (price > 10000000) return false; // 10 million max
  return true;
}

/**
 * Formats price for display
 */
export function formatPrice(price: number | null, currency: string = 'IDR'): string {
  if (price === null || price === undefined) return 'N/A';
  
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${currency} ${price.toLocaleString()}`;
  }
}

/**
 * Calculates Levenshtein distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  if (m === 0) return n;
  if (n === 0) return m;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // deletion
          dp[i][j - 1] + 1,    // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Calculates similarity score between two strings (0-1)
 */
export function stringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  
  return maxLength === 0 ? 1 : 1 - (distance / maxLength);
}

/**
 * Chunks an array into smaller arrays of specified size
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Retries an async function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}

/**
 * Safely parses JSON with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Generates a unique ID
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}${randomStr}` : `${timestamp}${randomStr}`;
}

/**
 * Debounces a function
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitizes filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^\w\s.-]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_{2,}/g, '_') // Remove multiple underscores
    .toLowerCase();
}