/**
 * Calculate token usage for VALENTA standardization request
 */

// Sample products from the VALENTA upload
const products = [
  { rawName: "HALLOUMI CHEESE", rawUnit: "K", category: "COW CHEESE" },
  { rawName: "FETA CHEESE", rawUnit: "K", category: "COW CHEESE" },
  { rawName: "COTTAGE CHEESE", rawUnit: "K", category: "COW CHEESE" },
  { rawName: "PANEER CHEESE", rawUnit: "K", category: "COW CHEESE" },
  { rawName: "RICOTTA CHEESE", rawUnit: "K", category: "COW CHEESE" },
  { rawName: "MOZARELLA CHEESE", rawUnit: "K", category: "COW CHEESE" },
  { rawName: "CHEDDAR CHEESE", rawUnit: "K", category: "COW CHEESE" },
  { rawName: "YOUNG GOUDA CHEESE", rawUnit: "K", category: "COW CHEESE" },
  { rawName: "OLD GOUDA CHEESE", rawUnit: "K", category: "COW CHEESE" },
  { rawName: "PARMESAN CHEESE", rawUnit: "K", category: "COW CHEESE" },
  { rawName: "TOMME CHEESE", rawUnit: "K", category: "COW CHEESE" },
  { rawName: "COTIJA CHEESE", rawUnit: "K", category: "COW CHEESE" },
  { rawName: "BLUE CHEESE", rawUnit: "K", category: "COW CHEESE" },
  { rawName: "HALLOUMI CHEESE", rawUnit: "K", category: "GOAT CHEESE" },
  { rawName: "FETA CHEESE", rawUnit: "K", category: "GOAT CHEESE" },
  { rawName: "COTTAGE CHEESE", rawUnit: "K", category: "GOAT CHEESE" },
  { rawName: "PANEER CHEESE", rawUnit: "K", category: "GOAT CHEESE" },
  { rawName: "RICOTTA CHEESE", rawUnit: "K", category: "GOAT CHEESE" },
  { rawName: "PECORINO CHEESE", rawUnit: "K", category: "GOAT CHEESE" },
  { rawName: "TOMME CHEESE", rawUnit: "K", category: "GOAT CHEESE" },
  { rawName: "CHEDDAR CHEESE", rawUnit: "K", category: "GOAT CHEESE" },
  { rawName: "BLUE CHEESE", rawUnit: "K", category: "GOAT CHEESE" },
  { rawName: "COW GHEE 1000 ML", rawUnit: "K", category: "BUTTER & GHEE" },
  { rawName: "COW GHEE 250 ML", rawUnit: "K", category: "BUTTER & GHEE" },
  { rawName: "GOAT GHEE 1000 ML", rawUnit: "K", category: "BUTTER & GHEE" },
  { rawName: "GOAT GHEE 250 ML", rawUnit: "K", category: "BUTTER & GHEE" },
  { rawName: "COW BUTTER UNSALTED 1 KG", rawUnit: "K", category: "BUTTER & GHEE" },
  { rawName: "GOAT BUTTER UNSALTED 1 KG", rawUnit: "K", category: "BUTTER & GHEE" },
  { rawName: "COW YOGURT PLAIN 1000 GRAM", rawUnit: "K", category: "GREEK YOGURT" },
  { rawName: "GOAT YOGURT PLAIN 1000 GRAM", rawUnit: "K", category: "GREEK YOGURT" },
  { rawName: "COCONUT YOGURT 1000 GRAM", rawUnit: "K", category: "GREEK YOGURT" },
  { rawName: "RAW COW MILK 2 LITER", rawUnit: "K", category: "MILK & KEFIR" },
  { rawName: "RAW GOAT MILK 1 LITER", rawUnit: "K", category: "MILK & KEFIR" },
  { rawName: "RAW GOAT MILK 500 ML", rawUnit: "K", category: "MILK & KEFIR" },
  { rawName: "COW KEFIR 500 ML", rawUnit: "K", category: "MILK & KEFIR" },
  { rawName: "GOAT KEFIR 500 ML", rawUnit: "K", category: "MILK & KEFIR" },
  { rawName: "RAW BEE POLLEN 500 GRAM", rawUnit: "K", category: "Honey" },
  { rawName: "BROWN RAW HONEY 550 ML", rawUnit: "K", category: "Honey" },
  { rawName: "BLACK WILD RAW HONEY 550 ML", rawUnit: "K", category: "Honey" },
  { rawName: "WHITE ROYAL JELLY HONEY 500 ML", rawUnit: "K", category: "Honey" },
  { rawName: "AMINOS 1 LITER", rawUnit: "K", category: "COCONUT" },
  { rawName: "VIRGIN COCONUT OIL 5 LITER", rawUnit: "K", category: "COCONUT" },
  { rawName: "VIRGIN COCONUT OIL 500 ML", rawUnit: "K", category: "COCONUT" },
  { rawName: "BLUEBERRY IMPORT 1 KG", rawUnit: "K", category: "FROZEN FRUIT" },
  { rawName: "RASPBERRY LOCAL 1 KG", rawUnit: "K", category: "FROZEN FRUIT" },
  { rawName: "MULBERRY LOCAL 1 KG", rawUnit: "K", category: "FROZEN FRUIT" },
  { rawName: "STRAWBERRY LOCAL 1 KG", rawUnit: "K", category: "FROZEN FRUIT" }
];

// Recreate the exact prompt from StandardizationService.ts
function buildGeminiStandardizationPrompt(products) {
  const productList = products.map((product, index) => {
    return `${index + 1}. Name: "${product.rawName}", Unit: "${product.rawUnit || 'unknown'}", Category: "${product.category || 'unknown'}"`;
  }).join('\n');

  return `You are an expert at standardizing food product names and units for an Indonesian inventory system.

TASK: Standardize the following products extracted from a supplier document.

PRODUCTS TO STANDARDIZE:
${productList}

CRITICAL STANDARDIZATION RULES:

1. INDONESIAN UNIT "K" = THOUSANDS (ribu):
   - "K" means "ribu" (thousands) in Indonesian pricing
   - Convert "K" → "ribu" 
   - Examples: "128K" unit should become "ribu"

2. PRODUCT NAMES:
   - Translate Indonesian to English
   - Use singular form (cheese, not cheeses)
   - Main noun first: "Cheese Gouda" not "Gouda Cheese"
   - Fix spelling errors (Mozarella → Mozzarella)

3. STANDARD UNITS:
   - kg, g, l, ml, pcs, pack, box, bottle, can, bunch
   - Indonesian: sisir→bunch, butir→pcs, lembar→sheet
   - IMPORTANT: K→ribu (thousands)

4. CATEGORIES:
   - dairy, meat, vegetables, fruits, beverages, spices, etc.

5. CONFIDENCE SCORING:
   - 100 = perfect translation/standardization
   - 80-99 = high confidence
   - 60-79 = medium confidence
   - <60 = low confidence

REQUIRED OUTPUT FORMAT - Return ONLY a valid JSON array:
[
  {
    "originalName": "original product name",
    "standardizedName": "standardized English name",
    "originalUnit": "original unit", 
    "standardizedUnit": "standardized unit",
    "category": "product category",
    "confidence": 95
  }
]

EXAMPLES:
- Name: "MOZARELLA CHEESE", Unit: "K" → standardizedName: "Cheese Mozzarella", standardizedUnit: "ribu"
- Name: "GOAT GHEE 250 ML", Unit: "K" → standardizedName: "Ghee Goat 250ml", standardizedUnit: "ribu"

Return ONLY the JSON array, no other text or formatting:`;
}

// Calculate token usage
const prompt = buildGeminiStandardizationPrompt(products);

console.log('=== VALENTA STANDARDIZATION TOKEN ANALYSIS ===\n');

console.log('📊 BASIC STATISTICS:');
console.log(`Products to standardize: ${products.length}`);
console.log(`Prompt character count: ${prompt.length}`);
console.log(`Prompt word count: ${prompt.split(/\s+/).length}`);

// Token estimation (roughly 4 characters per token for English text)
const estimatedInputTokens = Math.ceil(prompt.length / 4);
console.log(`Estimated input tokens: ~${estimatedInputTokens}`);

// Expected output tokens (JSON array with 47 products)
// Each product object is roughly: {"originalName": "...", "standardizedName": "...", "originalUnit": "...", "standardizedUnit": "...", "category": "...", "confidence": 95}
// Average ~150 characters per product object
const expectedOutputTokens = Math.ceil((47 * 150) / 4);
console.log(`Estimated output tokens: ~${expectedOutputTokens}`);

const totalEstimatedTokens = estimatedInputTokens + expectedOutputTokens;
console.log(`Total estimated tokens: ~${totalEstimatedTokens}`);

console.log('\n🔍 GEMINI 1.5 PRO LIMITS:');
console.log('- Free tier: 32,000 tokens per minute');
console.log('- Input token limit: 1,048,576 tokens');
console.log('- Output token limit: 8,192 tokens');

console.log('\n⚖️ COMPARISON:');
console.log(`Input tokens vs limit: ${estimatedInputTokens} / 1,048,576 (${(estimatedInputTokens/1048576*100).toFixed(2)}%)`);
console.log(`Output tokens vs limit: ${expectedOutputTokens} / 8,192 (${(expectedOutputTokens/8192*100).toFixed(2)}%)`);
console.log(`Total tokens vs rate limit: ${totalEstimatedTokens} / 32,000 (${(totalEstimatedTokens/32000*100).toFixed(2)}%)`);

console.log('\n🎯 ANALYSIS:');
if (totalEstimatedTokens > 32000) {
  console.log('❌ QUOTA EXCEEDED: This request likely failed due to the 32,000 tokens per minute rate limit');
  console.log('   This is a RATE LIMIT issue, not a token capacity issue');
} else if (expectedOutputTokens > 8192) {
  console.log('❌ OUTPUT LIMIT EXCEEDED: Expected output exceeds 8,192 token limit');
} else {
  console.log('✅ Request should be within all limits - failure likely due to other issues');
}

console.log('\n📝 PROMPT PREVIEW (first 500 chars):');
console.log(prompt.substring(0, 500) + '...');

console.log('\n📝 PRODUCT LIST SECTION:');
const productListStart = prompt.indexOf('PRODUCTS TO STANDARDIZE:');
const productListEnd = prompt.indexOf('CRITICAL STANDARDIZATION RULES:');
const productListSection = prompt.substring(productListStart, productListEnd);
console.log(`Product list section: ${productListSection.length} characters`);
console.log('Sample products:');
console.log(productListSection.substring(0, 300) + '...');