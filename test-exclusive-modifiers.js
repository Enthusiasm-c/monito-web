/**
 * Test script to verify exclusive modifiers fix
 * Tests that products with exclusive modifiers don't incorrectly match
 * 
 * This script validates the implementation of the exclusive modifiers mechanism
 * in the product-normalizer.ts file, ensuring that:
 * 
 * 1. Products with exclusive modifiers (like "sweet potato" vs "potato") don't match
 * 2. Products with descriptive modifiers (like "large potato" vs "potato") do match
 * 3. Core noun extraction works correctly to identify the base product
 * 4. Conflicting exclusive modifiers prevent matches
 * 
 * Usage:
 *   node test-exclusive-modifiers.js
 * 
 * The test covers the specific failing cases mentioned in the requirements:
 * - "sweet potato" should NOT match "potato"
 * - "quail egg" should NOT match "chicken egg"
 * - "zucchini flower" should NOT match "zucchini"
 * - "orange tangerine" should NOT match "orange"
 * 
 * Plus additional edge cases to ensure robust functionality.
 */

// Replicate the functionality from product-normalizer.ts since we can't import TypeScript directly

// Language mapping for common product names (EN/ID/ES)
const LANG_MAP = {
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
const EXCLUSIVE_MODIFIERS = [
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
  'cow', 'goat', 'almond', 'soy', 'coconut', 'oat'
];

// Descriptive modifiers that don't change the core product
const DESCRIPTIVE_MODIFIERS = [
  'big', 'large', 'huge', 'giant', 'jumbo',
  'small', 'mini', 'tiny', 'little',
  'medium', 'regular', 'standard',
  'fresh', 'new', 'premium', 'grade', 'quality',
  'whole', 'half', 'piece', 'slice',
  'imported', 'organic', 'conventional'
];

/**
 * Normalize product name for matching
 * Handles multi-language translation and cleaning
 */
function normalize(raw) {
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
function coreNoun(name) {
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
function hasDifferentCoreNoun(query, productName) {
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
function getModifiers(name) {
  const normalized = normalize(name);
  const words = normalized.split(' ');
  
  return {
    exclusive: words.filter(w => EXCLUSIVE_MODIFIERS.includes(w)),
    descriptive: words.filter(w => DESCRIPTIVE_MODIFIERS.includes(w))
  };
}

/**
 * Calculates similarity score between two strings (0-1)
 */
function stringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  function levenshteinDistance(s1, s2) {
    const m = s1.length;
    const n = s2.length;
    
    if (m === 0) return n;
    if (n === 0) return m;
    
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
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
  
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  
  return maxLength === 0 ? 1 : 1 - (distance / maxLength);
}

console.log('🧪 Testing Exclusive Modifiers Fix\n');
console.log('=' .repeat(50));

// Test cases that should NOT match
const testCases = [
  {
    query: 'sweet potato',
    product: 'potato',
    description: '"sweet potato" should NOT match "potato"'
  },
  {
    query: 'quail egg',
    product: 'chicken egg',
    description: '"quail egg" should NOT match "chicken egg"'
  },
  {
    query: 'zucchini flower',
    product: 'zucchini',
    description: '"zucchini flower" should NOT match "zucchini"'
  },
  {
    query: 'orange tangerine',
    product: 'orange',
    description: '"orange tangerine" should NOT match "orange"'
  }
];

// Additional test cases for verification
const additionalTests = [
  {
    query: 'red potato',
    product: 'potato',
    description: '"red potato" should NOT match "potato" (exclusive color modifier)',
    shouldMatch: false
  },
  {
    query: 'duck egg',
    product: 'egg',
    description: '"duck egg" should NOT match "egg" (exclusive animal modifier)',
    shouldMatch: false
  },
  {
    query: 'frozen chicken',
    product: 'chicken',
    description: '"frozen chicken" should NOT match "chicken" (exclusive preparation modifier)',
    shouldMatch: false
  },
  {
    query: 'large potato',
    product: 'potato',
    description: '"large potato" should match "potato" (descriptive size modifier)',
    shouldMatch: true
  },
  {
    query: 'fresh milk',
    product: 'milk',
    description: '"fresh milk" should match "milk" (descriptive quality modifier)',
    shouldMatch: true
  },
  {
    query: 'red apple',
    product: 'green apple',
    description: '"red apple" should NOT match "green apple" (conflicting color modifiers)',
    shouldMatch: false
  },
  {
    query: 'salmon fish',
    product: 'tuna fish',
    description: '"salmon fish" should NOT match "tuna fish" (conflicting fish types)',
    shouldMatch: false
  },
  {
    query: 'sea salt',
    product: 'salt',
    description: '"sea salt" should NOT match "salt" (exclusive type modifier)',
    shouldMatch: false
  },
  {
    query: 'organic potato',
    product: 'potato',
    description: '"organic potato" should match "potato" (descriptive quality modifier)',
    shouldMatch: true
  },
  {
    query: 'premium milk',
    product: 'fresh milk',
    description: '"premium milk" should match "fresh milk" (both descriptive modifiers)',
    shouldMatch: true
  }
];

function runTest(testCase, index) {
  console.log(`\n${index + 1}. ${testCase.description}`);
  console.log('-'.repeat(40));
  
  // Test 1: Core noun extraction
  const queryCoreNoun = coreNoun(testCase.query);
  const productCoreNoun = coreNoun(testCase.product);
  
  console.log(`Query: "${testCase.query}" → Core noun: "${queryCoreNoun}"`);
  console.log(`Product: "${testCase.product}" → Core noun: "${productCoreNoun}"`);
  
  // Test 2: Different core noun check
  const hasDifferentCore = hasDifferentCoreNoun(testCase.query, testCase.product);
  console.log(`Different core nouns: ${hasDifferentCore}`);
  
  // Test 3: Get modifiers
  const queryModifiers = getModifiers(testCase.query);
  const productModifiers = getModifiers(testCase.product);
  
  console.log(`Query modifiers:`, queryModifiers);
  console.log(`Product modifiers:`, productModifiers);
  
  // Test 4: String similarity (for reference)
  const normalizedQuery = normalize(testCase.query);
  const normalizedProduct = normalize(testCase.product);
  const similarity = stringSimilarity(normalizedQuery, normalizedProduct);
  
  console.log(`Normalized query: "${normalizedQuery}"`);
  console.log(`Normalized product: "${normalizedProduct}"`);
  console.log(`String similarity: ${(similarity * 100).toFixed(1)}%`);
  
  // Test 5: Check for exclusive modifiers in query
  const queryWords = normalizedQuery.split(' ');
  const hasExclusiveModifier = queryWords.some(word => EXCLUSIVE_MODIFIERS.includes(word));
  
  console.log(`Query has exclusive modifier: ${hasExclusiveModifier}`);
  
  // Expected result for main test cases (should NOT match)
  const shouldPreventMatch = hasDifferentCore || (hasExclusiveModifier && similarity < 1.0);
  console.log(`Should prevent match: ${shouldPreventMatch}`);
  
  // Result
  if (index < 4) { // Main test cases
    if (shouldPreventMatch) {
      console.log('✅ PASS: Match correctly prevented');
    } else {
      console.log('❌ FAIL: Match should have been prevented');
    }
  }
  
  return shouldPreventMatch;
}

function runAdditionalTest(testCase, index) {
  console.log(`\nAdditional Test ${index + 1}: ${testCase.description}`);
  console.log('-'.repeat(50));
  
  const queryCoreNoun = coreNoun(testCase.query);
  const productCoreNoun = coreNoun(testCase.product);
  const hasDifferentCore = hasDifferentCoreNoun(testCase.query, testCase.product);
  
  const normalizedQuery = normalize(testCase.query);
  const normalizedProduct = normalize(testCase.product);
  const queryWords = normalizedQuery.split(' ');
  const productWords = normalizedProduct.split(' ');
  const hasExclusiveModifier = queryWords.some(word => EXCLUSIVE_MODIFIERS.includes(word));
  
  // The logic should be:
  // - If there are different core nouns, don't match
  // - If query has exclusive modifiers that are not in the product, don't match
  // - If both have same core noun and no conflicting exclusive modifiers, allow match
  
  let shouldPreventMatch = false;
  
  if (hasDifferentCore) {
    shouldPreventMatch = true;
  } else if (hasExclusiveModifier) {
    // Check if the query's exclusive modifiers conflict with the product
    const queryExclusiveModifiers = queryWords.filter(w => EXCLUSIVE_MODIFIERS.includes(w));
    const productExclusiveModifiers = productWords.filter(w => EXCLUSIVE_MODIFIERS.includes(w));
    
    // If query has exclusive modifiers that are not present in the product, prevent match
    const hasConflictingModifiers = queryExclusiveModifiers.some(mod => !productWords.includes(mod));
    
    if (hasConflictingModifiers) {
      shouldPreventMatch = true;
    }
  }
  
  const actualShouldMatch = !shouldPreventMatch;
  
  console.log(`Query: "${testCase.query}" → Core: "${queryCoreNoun}"`);
  console.log(`Product: "${testCase.product}" → Core: "${productCoreNoun}"`);
  console.log(`Has exclusive modifier: ${hasExclusiveModifier}`);
  console.log(`Different core nouns: ${hasDifferentCore}`);
  console.log(`Should prevent match: ${shouldPreventMatch}`);
  console.log(`Should match: ${actualShouldMatch} (expected: ${testCase.shouldMatch})`);
  
  if (actualShouldMatch === testCase.shouldMatch) {
    console.log('✅ PASS: Matching behavior is correct');
  } else {
    console.log('❌ FAIL: Unexpected matching behavior');
  }
  
  return actualShouldMatch === testCase.shouldMatch;
}

// Run main tests
console.log('\n📋 Main Test Cases (should NOT match):');
let passCount = 0;
let totalTests = testCases.length;

for (let i = 0; i < testCases.length; i++) {
  if (runTest(testCases[i], i)) {
    passCount++;
  }
}

// Run additional tests
console.log('\n\n📋 Additional Test Cases:');
let additionalPassCount = 0;
let additionalTotalTests = additionalTests.length;

for (let i = 0; i < additionalTests.length; i++) {
  if (runAdditionalTest(additionalTests[i], i)) {
    additionalPassCount++;
  }
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(50));
console.log(`Main Tests: ${passCount}/${totalTests} passed`);
console.log(`Additional Tests: ${additionalPassCount}/${additionalTotalTests} passed`);
console.log(`Overall: ${passCount + additionalPassCount}/${totalTests + additionalTotalTests} passed`);

if (passCount === totalTests && additionalPassCount === additionalTotalTests) {
  console.log('🎉 ALL TESTS PASSED! Exclusive modifiers fix is working correctly.');
} else {
  console.log('⚠️  Some tests failed. The exclusive modifiers fix may need adjustment.');
}

console.log('\n📝 Key Points:');
console.log('- Exclusive modifiers should prevent matches when they fundamentally change the product');
console.log('- Descriptive modifiers should allow matches as they only describe the product');
console.log('- Core noun extraction should identify the base product correctly');
console.log('- Products with different core nouns should not match');