/**
 * Comprehensive Token Usage Analysis for VALENTA Upload Failure
 */

console.log('=== COMPREHENSIVE VALENTA TOKEN ANALYSIS ===\n');

// The actual VALENTA products from the upload record
const valentaProducts = [
  { name: "HALLOUMI CHEESE", unit: "K", category: "COW CHEESE" },
  { name: "FETA CHEESE", unit: "K", category: "COW CHEESE" },
  { name: "COTTAGE CHEESE", unit: "K", category: "COW CHEESE" },
  { name: "PANEER CHEESE", unit: "K", category: "COW CHEESE" },
  { name: "RICOTTA CHEESE", unit: "K", category: "COW CHEESE" },
  { name: "MOZARELLA CHEESE", unit: "K", category: "COW CHEESE" },
  { name: "CHEDDAR CHEESE", unit: "K", category: "COW CHEESE" },
  { name: "YOUNG GOUDA CHEESE", unit: "K", category: "COW CHEESE" },
  { name: "OLD GOUDA CHEESE", unit: "K", category: "COW CHEESE" },
  { name: "PARMESAN CHEESE", unit: "K", category: "COW CHEESE" },
  { name: "TOMME CHEESE", unit: "K", category: "COW CHEESE" },
  { name: "COTIJA CHEESE", unit: "K", category: "COW CHEESE" },
  { name: "BLUE CHEESE", unit: "K", category: "COW CHEESE" },
  { name: "HALLOUMI CHEESE", unit: "K", category: "GOAT CHEESE" },
  { name: "FETA CHEESE", unit: "K", category: "GOAT CHEESE" },
  { name: "COTTAGE CHEESE", unit: "K", category: "GOAT CHEESE" },
  { name: "PANEER CHEESE", unit: "K", category: "GOAT CHEESE" },
  { name: "RICOTTA CHEESE", unit: "K", category: "GOAT CHEESE" },
  { name: "PECORINO CHEESE", unit: "K", category: "GOAT CHEESE" },
  { name: "TOMME CHEESE", unit: "K", category: "GOAT CHEESE" },
  { name: "CHEDDAR CHEESE", unit: "K", category: "GOAT CHEESE" },
  { name: "BLUE CHEESE", unit: "K", category: "GOAT CHEESE" },
  { name: "COW GHEE 1000 ML", unit: "K", category: "BUTTER & GHEE" },
  { name: "COW GHEE 250 ML", unit: "K", category: "BUTTER & GHEE" },
  { name: "GOAT GHEE 1000 ML", unit: "K", category: "BUTTER & GHEE" },
  { name: "GOAT GHEE 250 ML", unit: "K", category: "BUTTER & GHEE" },
  { name: "COW BUTTER UNSALTED 1 KG", unit: "K", category: "BUTTER & GHEE" },
  { name: "GOAT BUTTER UNSALTED 1 KG", unit: "K", category: "BUTTER & GHEE" },
  { name: "COW YOGURT PLAIN 1000 GRAM", unit: "K", category: "GREEK YOGURT" },
  { name: "GOAT YOGURT PLAIN 1000 GRAM", unit: "K", category: "GREEK YOGURT" },
  { name: "COCONUT YOGURT 1000 GRAM", unit: "K", category: "GREEK YOGURT" },
  { name: "RAW COW MILK 2 LITER", unit: "K", category: "MILK & KEFIR" },
  { name: "RAW GOAT MILK 1 LITER", unit: "K", category: "MILK & KEFIR" },
  { name: "RAW GOAT MILK 500 ML", unit: "K", category: "MILK & KEFIR" },
  { name: "COW KEFIR 500 ML", unit: "K", category: "MILK & KEFIR" },
  { name: "GOAT KEFIR 500 ML", unit: "K", category: "MILK & KEFIR" },
  { name: "RAW BEE POLLEN 500 GRAM", unit: "K", category: "Honey" },
  { name: "BROWN RAW HONEY 550 ML", unit: "K", category: "Honey" },
  { name: "BLACK WILD RAW HONEY 550 ML", unit: "K", category: "Honey" },
  { name: "WHITE ROYAL JELLY HONEY 500 ML", unit: "K", category: "Honey" },
  { name: "AMINOS 1 LITER", unit: "K", category: "COCONUT" },
  { name: "VIRGIN COCONUT OIL 5 LITER", unit: "K", category: "COCONUT" },
  { name: "VIRGIN COCONUT OIL 500 ML", unit: "K", category: "COCONUT" },
  { name: "BLUEBERRY IMPORT 1 KG", unit: "K", category: "FROZEN FRUIT" },
  { name: "RASPBERRY LOCAL 1 KG", unit: "K", category: "FROZEN FRUIT" },
  { name: "MULBERRY LOCAL 1 KG", unit: "K", category: "FROZEN FRUIT" },
  { name: "STRAWBERRY LOCAL 1 KG", unit: "K", category: "FROZEN FRUIT" }
];

// Reconstruct the exact standardization prompt
function buildGeminiStandardizationPrompt(products) {
  const productList = products.map((product, index) => {
    return `${index + 1}. Name: "${product.name}", Unit: "${product.unit || 'unknown'}", Category: "${product.category || 'unknown'}"`;
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

// Expected output format for 47 products
const expectedOutputStructure = `[
  {
    "originalName": "HALLOUMI CHEESE",
    "standardizedName": "Cheese Halloumi",
    "originalUnit": "K",
    "standardizedUnit": "ribu",
    "category": "dairy",
    "confidence": 95
  }
]`;

// Calculate token usage
const prompt = buildGeminiStandardizationPrompt(valentaProducts);
const promptTokens = Math.ceil(prompt.length / 4);

// Expected output: 47 products × ~150 characters each
const outputCharsPerProduct = 150;
const expectedOutputTokens = Math.ceil((valentaProducts.length * outputCharsPerProduct) / 4);
const totalTokens = promptTokens + expectedOutputTokens;

console.log('📊 PROCESSING FLOW ANALYSIS:');
console.log('1. ✅ VALENTA cheese supplier.pdf (563KB) uploaded');
console.log('2. ✅ Gemini 2.0 Flash successfully extracted 47 products (Step 1)');
console.log('3. ❌ Gemini 1.5 Pro standardization failed with quota exceeded (Step 2)');
console.log('4. ❌ Upload stuck in "processing" status - no products created in database');

console.log('\n🔍 TOKEN CALCULATION ANALYSIS:');
console.log(`Products to standardize: ${valentaProducts.length}`);
console.log(`Prompt length: ${prompt.length.toLocaleString()} characters`);
console.log(`Estimated input tokens: ${promptTokens.toLocaleString()}`);
console.log(`Estimated output tokens: ${expectedOutputTokens.toLocaleString()}`);
console.log(`Total estimated tokens: ${totalTokens.toLocaleString()}`);

console.log('\n📋 GEMINI 1.5 PRO LIMITS:');
console.log('• Input limit: 1,048,576 tokens');
console.log('• Output limit: 8,192 tokens');
console.log('• Rate limit (free tier): 32,000 tokens per minute');

console.log('\n⚖️ QUOTA ANALYSIS:');
console.log(`Input vs capacity: ${promptTokens.toLocaleString()} / 1,048,576 (${(promptTokens/1048576*100).toFixed(3)}%)`);
console.log(`Output vs capacity: ${expectedOutputTokens.toLocaleString()} / 8,192 (${(expectedOutputTokens/8192*100).toFixed(1)}%)`);
console.log(`Total vs rate limit: ${totalTokens.toLocaleString()} / 32,000 (${(totalTokens/32000*100).toFixed(1)}%)`);

console.log('\n🎯 ROOT CAUSE ANALYSIS:');
if (totalTokens <= 32000) {
  console.log('✅ TOKEN USAGE: Well within all limits');
  console.log('❓ ACTUAL ISSUE: Likely NOT a token limit problem');
  console.log('');
  console.log('🔍 POSSIBLE CAUSES:');
  console.log('1. Rate limiting: Multiple requests in short time window');
  console.log('2. Google AI API billing/quota issues');
  console.log('3. API key permissions or authentication issues');
  console.log('4. Network/timeout issues during standardization request');
  console.log('5. Service temporarily unavailable');
} else {
  console.log('❌ QUOTA EXCEEDED: Request exceeds 32,000 tokens per minute');
  console.log('📝 RECOMMENDATION: Implement batch processing for large product lists');
}

console.log('\n📈 REQUEST IMPACT ASSESSMENT:');
console.log('• File size: 563KB (medium-large PDF)');
console.log('• Products extracted: 47 (moderate complexity)');
console.log('• All products have unit "K" requiring standardization');
console.log('• Request timing: Unknown (could be during high usage period)');

console.log('\n💡 SOLUTIONS & RECOMMENDATIONS:');
console.log('1. IMMEDIATE: Check Google AI Console for quota/billing status');
console.log('2. MONITORING: Add detailed logging to capture exact API errors');
console.log('3. RETRY LOGIC: Implement exponential backoff for quota exceeded');
console.log('4. BATCH PROCESSING: Split large product lists into smaller chunks');
console.log('5. FALLBACK: Use alternative standardization method for failures');

console.log('\n🔧 TECHNICAL DETAILS:');
console.log(`Model used: Gemini 1.5 Pro (for standardization)`);
console.log(`Temperature: 0.1 (low randomness)`);
console.log(`Max output tokens: 8,192`);
console.log(`Expected response size: ~${(expectedOutputTokens * 4).toLocaleString()} characters`);

console.log('\n📋 SAMPLE STANDARDIZATION REQUEST:');
console.log('Input format per product:');
console.log('  Name: "HALLOUMI CHEESE", Unit: "K", Category: "COW CHEESE"');
console.log('Expected output format:');
console.log('  {');
console.log('    "originalName": "HALLOUMI CHEESE",');
console.log('    "standardizedName": "Cheese Halloumi",');
console.log('    "originalUnit": "K",');
console.log('    "standardizedUnit": "ribu",');
console.log('    "category": "dairy",');
console.log('    "confidence": 95');
console.log('  }');

console.log('\n🚨 CONCLUSION:');
console.log('The standardization request should be well within token limits.');
console.log('The failure is likely due to:');
console.log('• API quota/billing issues');
console.log('• Rate limiting from multiple requests');
console.log('• Temporary service unavailability');
console.log('');
console.log('This appears to be a QUOTA/RATE LIMIT issue, not a token capacity issue.');