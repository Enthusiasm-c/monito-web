/**
 * Product Normalizer with Multi-language Support
 * Handles EN/ID/ES translations and normalization
 */

// Language mapping for common product names (EN/ID/ES)
export const LANG_MAP: Record<string, string> = {
  // Vegetables - Indonesian
  'wortel': 'carrot',
  'wortels': 'carrot',
  'kentang': 'potato',
  'tomat': 'tomato',
  'bawang': 'onion',
  'bayam': 'spinach',
  'kangkung': 'water spinach',
  'sawi': 'mustard greens',
  'terong': 'eggplant',
  'timun': 'cucumber',
  'jamur': 'mushroom',
  'kubis': 'cabbage',
  'kol': 'cabbage',
  'brokoli': 'broccoli',
  'kembang': 'cauliflower',
  'paprika': 'bell pepper',
  'cabe': 'chili',
  'cabai': 'chili',
  'labu': 'pumpkin',
  'jagung': 'corn',
  'selada': 'lettuce',
  
  // Vegetables - Spanish
  'zanahoria': 'carrot',
  'papa': 'potato',
  'patata': 'potato',
  'cebolla': 'onion',
  'espinaca': 'spinach',
  'berenjena': 'eggplant',
  'pepino': 'cucumber',
  'champiñón': 'mushroom',
  'champiñones': 'mushroom',
  'hongo': 'mushroom',
  'hongos': 'mushroom',
  'repollo': 'cabbage',
  'coliflor': 'cauliflower',
  'pimiento': 'bell pepper',
  'calabaza': 'pumpkin',
  'maíz': 'corn',
  'lechuga': 'lettuce',
  
  // Fruits - Indonesian
  'apel': 'apple',
  'jeruk': 'orange',
  'pisang': 'banana',
  'mangga': 'mango',
  'nanas': 'pineapple',
  'semangka': 'watermelon',
  'melon': 'melon',
  'anggur': 'grape',
  'pir': 'pear',
  'strawberi': 'strawberry',
  'alpukat': 'avocado',
  'pepaya': 'papaya',
  'jambu': 'guava',
  'durian': 'durian',
  'rambutan': 'rambutan',
  'manggis': 'mangosteen',
  'kelapa': 'coconut',
  'nangka': 'jackfruit',
  
  // Fruits - Spanish  
  'manzana': 'apple',
  'naranja': 'orange',
  'plátano': 'banana',
  'piña': 'pineapple',
  'sandía': 'watermelon',
  'melón': 'melon',
  'uva': 'grape',
  'uvas': 'grape',
  'fresa': 'strawberry',
  'aguacate': 'avocado',
  'palta': 'avocado',
  'coco': 'coconut',
  
  // Meat & Seafood - Indonesian
  'ayam': 'chicken',
  'daging': 'beef',
  'sapi': 'beef',
  'babi': 'pork',
  'ikan': 'fish',
  'udang': 'shrimp',
  'cumi': 'squid',
  'kepiting': 'crab',
  'kerang': 'clam',
  'telur': 'egg',
  
  // Meat & Seafood - Spanish
  'pollo': 'chicken',
  'carne': 'meat',
  'cerdo': 'pork',
  'pescado': 'fish',
  'camarón': 'shrimp',
  'camarones': 'shrimp',
  'calamar': 'squid',
  'cangrejo': 'crab',
  'huevo': 'egg',
  'huevos': 'egg',
  
  // Other - Indonesian
  'beras': 'rice',
  'gula': 'sugar',
  'garam': 'salt',
  'minyak': 'oil',
  'tepung': 'flour',
  'roti': 'bread',
  'keju': 'cheese',
  'susu': 'milk',
  'krupuk': 'cracker',
  'kerupuk': 'cracker',
  'tempe': 'tempeh',
  'tahu': 'tofu',
  'kecap': 'soy sauce',
  'sambal': 'chili sauce',
  
  // Additional Indonesian terms
  'putih': 'white',
  'merah': 'red',
  'hijau': 'green',
  'kuning': 'yellow',
  'kupas': 'peeled',
  'selada': 'lettuce',
  'kriting': 'curly',
  'harum': 'aromatic',
  'daun': 'leaf',
  'segar': 'fresh',
  'fuji': 'fuji',
  
  // Other - Spanish
  'arroz': 'rice',
  'azúcar': 'sugar',
  'sal': 'salt',
  'aceite': 'oil',
  'harina': 'flour',
  'pan': 'bread',
  'queso': 'cheese',
  'leche': 'milk'
};

// Exclusive modifiers that fundamentally change the product
export const EXCLUSIVE_MODIFIERS = [
  'sweet', 'oyster', 'baby', 'local', // As per M-3 requirement
  'cherry', 'grape', 'plum',
  'black', 'white', 'red', 'green', 'yellow', 'purple',
  'dried', 'frozen', 'canned', 'pickled', 'smoked',
  'wild', 'sea', 'mountain', 'water', 'bitter',
  // Animal product types
  'quail', 'duck', 'goose', 'turkey', 'chicken',
  // Plant parts
  'flower', 'leaf', 'stem', 'root', 'seed', 'bud',
  // Citrus varieties
  'tangerine', 'lime', 'lemon', 'grapefruit', 'mandarin',
  // Orange varieties
  'valencia', 'navel', 'blood', 'bitter',
  // Potato varieties
  'russet', 'fingerling', 'new',
  // Additional animal types
  'beef', 'pork', 'lamb', 'goat', 'rabbit',
  // Fish types
  'tuna', 'salmon', 'cod', 'tilapia', 'mackerel', 'snapper',
  // Milk types
  'cow', 'goat', 'soy', 'coconut', 'oat'
];

// Descriptive modifiers that don't change the core product
export const DESCRIPTIVE_MODIFIERS = [
  'big', 'large', 'huge', 'giant', 'jumbo',
  'small', 'mini', 'tiny', 'little',
  'medium', 'regular', 'standard',
  'fresh', 'new', 'premium', 'grade', 'quality',
  'whole', 'half', 'piece', 'slice',
  'imported', 'organic', 'conventional',
  // Preparation methods (descriptive, not exclusive)
  'roasted', 'grilled', 'fried', 'steamed', 'boiled', 'raw',
  'chopped', 'sliced', 'diced', 'minced', 'ground',
  'paste', 'pastes', 'sauce', 'powder', 'flakes'
];

/**
 * Normalize product name for matching
 * Handles multi-language translation and cleaning
 */
export function normalize(raw: string): string {
  // Clean and normalize
  const cleaned = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // Keep letters, numbers, spaces
    .replace(/\s+/g, ' ')
    .trim();

  // Apply language mapping and remove duplicates
  const words = cleaned
    .split(' ')
    .map(word => LANG_MAP[word] ?? word);
  
  // Remove consecutive duplicates (e.g., "carrot carrot" -> "carrot")
  const uniqueWords = words.filter((word, index) => 
    index === 0 || word !== words[index - 1]
  );
  
  return uniqueWords.join(' ');
}

/**
 * Extract core noun from product name
 * Removes exclusive modifiers to get the base product
 */
export function coreNoun(name: string): string {
  const normalized = normalize(name);
  const words = normalized.split(' ');
  
  // Filter out all modifiers to find core noun
  const coreWords = words.filter(word => 
    !EXCLUSIVE_MODIFIERS.includes(word) && 
    !DESCRIPTIVE_MODIFIERS.includes(word)
  );
  
  // Return first core word or empty string
  return coreWords[0] ?? '';
}

/**
 * Check if two products have different core nouns
 */
export function hasDifferentCoreNoun(query: string, productName: string): boolean {
  const queryCoreNoun = coreNoun(query);
  const productCoreNoun = coreNoun(productName);
  
  // If either is empty, allow match (partial queries)
  if (!queryCoreNoun || !productCoreNoun) {
    return false;
  }
  
  return queryCoreNoun !== productCoreNoun;
}

/**
 * Get all modifiers from a product name
 */
export function getModifiers(name: string): {
  exclusive: string[];
  descriptive: string[];
} {
  const normalized = normalize(name);
  const words = normalized.split(' ');
  
  return {
    exclusive: words.filter(w => EXCLUSIVE_MODIFIERS.includes(w)),
    descriptive: words.filter(w => DESCRIPTIVE_MODIFIERS.includes(w))
  };
}

/**
 * Calculate unit price with proper unit conversion
 */
export function calcUnitPrice(price: number, qty: number, unit: string): number | null {
  if (!qty || !unit || qty <= 0) return null;
  
  // Normalize unit
  const normalizedUnit = unit.toLowerCase().trim();
  
  // Convert to base units
  let factor = 1;
  
  // Weight conversions to kg
  if (normalizedUnit === 'g' || normalizedUnit === 'gr' || normalizedUnit === 'gram') {
    factor = 1000; // 1kg = 1000g
  } else if (normalizedUnit === 'mg' || normalizedUnit === 'milligram') {
    factor = 1000000; // 1kg = 1,000,000mg
  }
  // Volume conversions to liter
  else if (normalizedUnit === 'ml' || normalizedUnit === 'milliliter') {
    factor = 1000; // 1L = 1000ml
  }
  // Dozen conversion
  else if (normalizedUnit === 'dozen' || normalizedUnit === 'dz') {
    qty = qty * 12; // Convert dozen to pieces
  }
  
  // Calculate price per base unit
  return price / (qty / factor);
}