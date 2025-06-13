/**
 * Dictionary for product name standardization
 * Includes Indonesian to English translations and common variations
 */

// Common misspellings and typos
export const COMMON_MISSPELLINGS: Record<string, string> = {
  // Vegetables
  'poteto': 'potato',
  'potatoe': 'potato',
  'potatos': 'potato',
  'potatoes': 'potato',
  'tomato': 'tomato',
  'tomatos': 'tomato',
  'tomatoes': 'tomato',
  'brocoly': 'broccoli',
  'brocoli': 'broccoli',
  'carots': 'carrot',
  'carot': 'carrot',
  'spinch': 'spinach',
  'spinatch': 'spinach',
  'cucmber': 'cucumber',
  'cuccumber': 'cucumber',
  'eggplan': 'eggplant',
  'egglant': 'eggplant',
  'cabage': 'cabbage',
  'caabbage': 'cabbage',
  'lettus': 'lettuce',
  'lettuce': 'lettuce',
  'bean': 'bean',
  'beens': 'bean',
  
  // Fruits
  'banan': 'banana',
  'bananna': 'banana',
  'bannana': 'banana',
  'aple': 'apple',
  'appel': 'apple',
  'orrange': 'orange',
  'orage': 'orange',
  'lemmon': 'lemon',
  'limon': 'lemon',
  'straberry': 'strawberry',
  'strawbery': 'strawberry',
  'pinapple': 'pineapple',
  'pineaple': 'pineapple',
  'advocado': 'avocado',
  'avacado': 'avocado',
  'avocato': 'avocado',
  
  // Meat
  'chiken': 'chicken',
  'chicke': 'chicken',
  'beff': 'beef',
  'beaf': 'beef',
  'porck': 'pork',
  'lamp': 'lamb',
  'lam': 'lamb',
  
  // Fish
  'shrim': 'shrimp',
  'schrimp': 'shrimp',
  'sqiud': 'squid',
  'squids': 'squid',
  'crap': 'crab',
  'crabs': 'crab',
  
  // Others
  'yoghurt': 'yogurt',
  'chese': 'cheese',
  'cheeze': 'cheese',
  'bred': 'bread',
  'berad': 'bread',
  'noodles': 'noodle',
  'noddle': 'noodle',
  'noddles': 'noodle',
  'cofee': 'coffee',
  'coffe': 'coffee',
  'juise': 'juice',
  'juce': 'juice',
  'choclate': 'chocolate',
  'chocholate': 'chocolate',
  'chocolat': 'chocolate'
};

// Indonesian to English food translations
export const INDONESIAN_PRODUCTS: Record<string, string> = {
  // Dairy
  'susu': 'milk',
  'keju': 'cheese',
  'yogurt': 'yogurt',
  'yoghurt': 'yogurt',
  'mentega': 'butter',
  'krim': 'cream',
  'es krim': 'ice-cream',
  'eskrim': 'ice-cream',
  
  // Meat & Poultry
  'daging': 'meat',
  'daging sapi': 'beef',
  'daging ayam': 'chicken',
  'ayam': 'chicken',
  'daging babi': 'pork',
  'daging kambing': 'lamb',
  'ikan': 'fish',
  'udang': 'shrimp',
  'cumi': 'squid',
  'kepiting': 'crab',
  'telur': 'egg',
  'telor': 'egg',
  
  // Vegetables
  'sayur': 'vegetable',
  'sayuran': 'vegetable',
  'tomat': 'tomato',
  'kentang': 'potato',
  'wortel': 'carrot',
  'bawang': 'onion',
  'bawang merah': 'shallot',
  'bawang putih': 'garlic',
  'bawang bombay': 'onion',
  'kubis': 'cabbage',
  'kol': 'cabbage',
  'sawi': 'mustard-green',
  'bayam': 'spinach',
  'kangkung': 'water-spinach',
  'terong': 'eggplant',
  'timun': 'cucumber',
  'labu': 'pumpkin',
  'jagung': 'corn',
  'buncis': 'green-bean',
  'kacang panjang': 'long-bean',
  'paprika': 'bell-pepper',
  'cabe': 'chili',
  'cabai': 'chili',
  
  // Fruits
  'buah': 'fruit',
  'apel': 'apple',
  'jeruk': 'orange',
  'pisang': 'banana',
  'pisang kepok': 'plantain',
  'kepok': 'plantain',
  'mangga': 'mango',
  'anggur': 'grape',
  'semangka': 'watermelon',
  'melon': 'melon',
  'nanas': 'pineapple',
  'pepaya': 'papaya',
  'alpukat': 'avocado',
  'durian': 'durian',
  'rambutan': 'rambutan',
  'kelapa': 'coconut',
  'stroberi': 'strawberry',
  'strawberry': 'strawberry',
  'lemon': 'lemon',
  'jeruk nipis': 'lime',
  'jambu': 'guava',
  'nangka': 'jackfruit',
  'manggis': 'mangosteen',
  'salak': 'snake-fruit',
  
  // Grains & Staples
  'beras': 'rice',
  'nasi': 'cooked-rice',
  'mie': 'noodle',
  'mi': 'noodle',
  'pasta': 'pasta',
  'roti': 'bread',
  'tepung': 'flour',
  'tepung terigu': 'wheat-flour',
  'gandum': 'wheat',
  
  // Beverages
  'minuman': 'beverage',
  'air': 'water',
  'air mineral': 'mineral-water',
  'jus': 'juice',
  'kopi': 'coffee',
  'teh': 'tea',
  'sirup': 'syrup',
  'soda': 'soda',
  
  // Condiments & Spices
  'garam': 'salt',
  'gula': 'sugar',
  'gula merah': 'palm-sugar',
  'gula pasir': 'sugar',
  'merica': 'pepper',
  'lada': 'pepper',
  'kecap': 'soy-sauce',
  'kecap manis': 'sweet-soy-sauce',
  'kecap asin': 'soy-sauce',
  'sambal': 'chili-sauce',
  'saus': 'sauce',
  'mayones': 'mayonnaise',
  'minyak': 'oil',
  'minyak goreng': 'cooking-oil',
  'cuka': 'vinegar',
  
  // Snacks & Others
  'kerupuk': 'cracker',
  'keripik': 'chips',
  'biskuit': 'biscuit',
  'kue': 'cake',
  'permen': 'candy',
  'coklat': 'chocolate',
  'es': 'ice',
  'madu': 'honey'
};

// Common Indonesian descriptors
export const INDONESIAN_DESCRIPTORS: Record<string, string> = {
  // Colors
  'merah': 'red',
  'hijau': 'green',
  'kuning': 'yellow',
  'putih': 'white',
  'hitam': 'black',
  'biru': 'blue',
  'ungu': 'purple',
  'coklat': 'brown',
  'oranye': 'orange',
  'orange': 'orange',
  
  // Varieties
  'kepok': 'plantain',
  'raja': 'king',
  'ambon': 'cavendish',
  'mas': 'lady-finger',
  'uli': 'cooking-banana',
  
  // Sizes
  'baby': 'baby',
  'besar': 'large',
  'kecil': 'small',
  'sedang': 'medium',
  'jumbo': 'jumbo',
  'mini': 'mini',
  
  // Qualities
  'segar': 'fresh',
  'beku': 'frozen',
  'kering': 'dried',
  'manis': 'sweet',
  'asin': 'salty',
  'pedas': 'spicy',
  'pahit': 'bitter',
  'asam': 'sour',
  'gurih': 'savory',
  'organik': 'organic',
  'alami': 'natural',
  'murni': 'pure',
  'matang': 'ripe',
  'mentah': 'raw',
  'goreng': 'fried',
  'rebus': 'boiled',
  'bakar': 'grilled',
  'panggang': 'roasted',
  
  // Parts
  'dada': 'breast',
  'paha': 'thigh',
  'sayap': 'wing',
  'kepala': 'head',
  'ekor': 'tail',
  'fillet': 'fillet',
  'potongan': 'cut',
  'utuh': 'whole',
  'tanpa tulang': 'boneless',
  'dengan tulang': 'with-bone',
  
  // Packaging
  'kemasan': 'package',
  'botol': 'bottle',
  'kaleng': 'can',
  'kardus': 'box',
  'plastik': 'plastic',
  'sachet': 'sachet',
  'pack': 'pack',
  'bundel': 'bundle',
  'lusin': 'dozen',
  
  // Others
  'lokal': 'local',
  'impor': 'imported',
  'premium': 'premium',
  'super': 'super',
  'spesial': 'special',
  'original': 'original',
  'rasa': 'flavor',
  'tanpa': 'without',
  'dengan': 'with',
  'rendah': 'low',
  'tinggi': 'high',
  'bebas': 'free'
};

// Common brand names that should be preserved
export const BRAND_NAMES = [
  'indomie', 'sedaap', 'abc', 'indofood', 'unilever',
  'nestle', 'danone', 'aqua', 'sosro', 'pocari-sweat',
  'coca-cola', 'pepsi', 'sprite', 'fanta', 'minute-maid',
  'ultra', 'diamond', 'frisian-flag', 'bear-brand',
  'silverqueen', 'delfi', 'kitkat', 'oreo', 'khongguan',
  'roma', 'monde', 'orang-tua', 'mayora', 'garuda',
  'dua-kelinci', 'taro', 'qtela', 'chitato', 'lays',
  'pringles', 'mr-potato', 'japota', 'kusuka', 'potabee'
];

// Unit conversions
export const UNIT_CONVERSIONS: Record<string, string> = {
  // Indonesian units
  'butir': 'pcs',
  'buah': 'pcs',
  'biji': 'pcs',
  'lembar': 'sheet',
  'potong': 'pcs',
  'ekor': 'pcs',
  'bungkus': 'pack',
  'dus': 'box',
  'karton': 'carton',
  'botol': 'bottle',
  'kaleng': 'can',
  'liter': 'l',
  'mililiter': 'ml',
  'kilogram': 'kg',
  'gram': 'g',
  'ons': 'hg', // 100g
  
  // Common variations
  'kg': 'kg',
  'ijs': 'pcs',
  'ijas': 'pcs',
  'ijasan': 'pcs',
  'ssr': 'pcs',
  'sst': 'pcs',
  'sheet': 'sheet',
  'gr': 'g',
  'g': 'g',
  'l': 'l',
  'ml': 'ml',
  'pcs': 'pcs',
  'pack': 'pack',
  'box': 'box',
  'dozen': 'dozen',
  'lusin': 'dozen'
};

// Common product name patterns that need special handling
export const SPECIAL_PATTERNS = [
  // Pattern: "Mie Instan" → "instant-noodle"
  { pattern: /\b(mie|mi)\s+(instan|instant)\b/gi, replacement: 'instant-noodle' },
  // Pattern: "Air Mineral" → "mineral-water"
  { pattern: /\bair\s+mineral\b/gi, replacement: 'mineral-water' },
  // Pattern: "Es Krim" → "ice-cream"
  { pattern: /\bes\s+krim\b/gi, replacement: 'ice-cream' },
  // Pattern: "Kecap Manis" → "sweet-soy-sauce"
  { pattern: /\bkecap\s+manis\b/gi, replacement: 'sweet-soy-sauce' },
  // Pattern: "Minyak Goreng" → "cooking-oil"
  { pattern: /\bminyak\s+goreng\b/gi, replacement: 'cooking-oil' },
  // Pattern: "Gula Pasir" → "sugar"
  { pattern: /\bgula\s+pasir\b/gi, replacement: 'sugar' },
  // Pattern: "Gula Merah" → "palm-sugar"
  { pattern: /\bgula\s+merah\b/gi, replacement: 'palm-sugar' },
  // Pattern: "Bawang Merah" → "shallot"
  { pattern: /\bbawang\s+merah\b/gi, replacement: 'shallot' },
  // Pattern: "Bawang Putih" → "garlic"
  { pattern: /\bbawang\s+putih\b/gi, replacement: 'garlic' },
  // Pattern: "Kacang Panjang" → "long-bean"
  { pattern: /\bkacang\s+panjang\b/gi, replacement: 'long-bean' }
];

// Function to normalize price strings (handles k notation)
export function normalizePrice(priceStr: string): number | null {
  if (!priceStr) return null;
  
  // Remove currency symbols and spaces
  let cleaned = priceStr.replace(/[Rp$.\s,]/gi, '').trim();
  
  // Handle 'k' notation (e.g., "39k" → 39000)
  if (cleaned.toLowerCase().endsWith('k')) {
    const numPart = cleaned.slice(0, -1);
    const num = parseFloat(numPart);
    return isNaN(num) ? null : num * 1000;
  }
  
  // Handle 'rb' or 'ribu' notation (thousand in Indonesian)
  if (cleaned.toLowerCase().endsWith('rb') || cleaned.toLowerCase().endsWith('ribu')) {
    const numPart = cleaned.replace(/rb|ribu/i, '').trim();
    const num = parseFloat(numPart);
    return isNaN(num) ? null : num * 1000;
  }
  
  // Handle 'jt' or 'juta' notation (million in Indonesian)
  if (cleaned.toLowerCase().endsWith('jt') || cleaned.toLowerCase().endsWith('juta')) {
    const numPart = cleaned.replace(/jt|juta/i, '');
    const num = parseFloat(numPart);
    return isNaN(num) ? null : num * 1000000;
  }
  
  // Parse regular number
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}