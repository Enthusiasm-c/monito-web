/**
 * Comprehensive stress test for AI standardization system
 * Tests complex multilingual product names and edge cases
 */

// Simple API test using fetch instead of direct module import
async function standardizeProducts(products) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'o3-mini-2025-01-31',
      messages: [
        {
          role: 'system',
          content: `You are "Monito-Normalizer"

You receive a JSON array of raw product rows extracted from Indonesian price lists, invoices, catalogues, etc.  
Your task is to return a new JSON array with every row normalised, so that all names are in clean English and all units follow a single canonical list.

NORMALISATION RULES:
A. **Name Translation Rules**  
   • Translate Indonesian → English using EXACT terms that exist in grocery databases.
   • Fix spelling / duplicated spaces.  
   • Format: "<Main noun> <Descriptor>", e.g. "Cheese Mozzarella", "Chicken Fillet Fresh". Remove brand names & packaging words.  
   • USE STANDARD GROCERY TERMS - avoid unusual combinations.

CRITICAL INDONESIAN → ENGLISH MAPPINGS:
• "daun bawang" → "Chives" (NOT "Onion Green")
• "bawang merah" → "Onion Red" 
• "bawang putih" → "Garlic"
• "wortel" → "Carrot"
• "kentang" → "Potato" 
• "tomat" → "Tomato"
• "selada" → "Lettuce"
• "kriting/keriting" → "Curly"
• "harum" → "Sweet" (for fruits, NOT "Fragrant")
• "mangga" → "Mango"
• "pisang" → "Banana"
• "apel" → "Apple"
• "jeruk" → "Orange"
• "ayam" → "Chicken"
• "daging" → "Beef"
• "ikan" → "Fish"
• "udang" → "Shrimp"
• "sawi" → "Mustard Green"
• "kangkung" → "Water Spinach"
• "bayam" → "Spinach"

PREFERRED GROCERY TERMS:
• Green onions: "Chives" or "Spring Onion"
• Sweet fruits: use "Sweet" not "Fragrant"
• Curly vegetables: "Curly" not "Kriting"
• Local varieties: include "Local" when specified

B. **Units**  
   • Canonical list (lower-case): kg, g, l, ml, pcs, pack, box, bottle, can, bunch, sheet, sack.  
   • Indonesian ⇒ English mapping: sisir → bunch · butir → pcs · lembar → sheet · karung → sack.  
   • Accept dotted, spaced or mixed-case variants: "KG.", "Kg", "250 ML" → standardizedUnit:"ml", quantity:250.  
   • If unit token is k, K, ribu, rb, treat it as price suffix, not a measurement – set standardizedUnit and quantity to null.  
   • If unit unclear or absent → both fields null, confidence ≤ 80.

C. **Quantity**  
   • If unit string contains a leading number ("250ml", "1kg", "2 x 5kg"), extract the first numeric value as quantity.  
   • Otherwise null.

D. **Category list**  
   dairy, meat, seafood, vegetables, fruits, spices, grains, bakery, beverages, oils, sweeteners, condiments, disposables, other.

E. **Confidence**  
   100 perfect → spelling obvious & unit clear;  
   80–99 high → minor guess (translation, plural/singular);  
   60–79 medium → unit guessed or ambiguous name;  
   <60 low → unsure (return anyway).

F. **General**  
   • Keep output order identical to input.  
   • Do not add or remove rows.`
        },
        {
          role: 'user',
          content: JSON.stringify(products)
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "normalize_products",
          schema: {
            type: "object",
            properties: {
              products: {
                type: "array",
                items: {
                  type: "object",
                  required: [
                    "originalName", "standardizedName",
                    "originalUnit", "quantity",
                    "standardizedUnit", "category", "confidence"
                  ],
                  properties: {
                    originalName: { type: "string" },
                    standardizedName: { type: "string" },
                    originalUnit: { type: ["string", "null"] },
                    quantity: { type: ["number", "null"] },
                    standardizedUnit: { type: ["string", "null"] },
                    category: { type: "string" },
                    confidence: { type: "integer", minimum: 0, maximum: 100 }
                  },
                  additionalProperties: false
                }
              }
            },
            required: ["products"],
            additionalProperties: false
          },
          strict: true
        }
      },
      stream: false,
      max_completion_tokens: 16384
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  
  if (content) {
    const parsedResponse = JSON.parse(content);
    return parsedResponse.products || parsedResponse;
  }
  
  return [];
}

// Complex test cases with challenging multilingual naming patterns
const STRESS_TEST_PRODUCTS = [
  // Multilingual duplication patterns
  { name: "wortel / carrot", expected: "Carrot" },
  { name: "paprika merah / red bell pepper", expected: "Bell Pepper Red" },
  { name: "timun jepang / japanese cucumber", expected: "Cucumber Japanese" },
  { name: "jamur shitake / shiitake mushroom", expected: "Mushroom Shiitake" },
  { name: "terong ungu / purple eggplant", expected: "Eggplant Purple" },
  { name: "daun bawang / chives", expected: "Chives" },
  { name: "mangga harum / sweet mango", expected: "Mango Sweet" },
  { name: "kentang baby / baby potato", expected: "Potato Baby" },
  
  // Complex OCR-like errors with multilingual
  { name: "wortei / carrot 500g", expected: "Carrot" },
  { name: "ayam fillet / chicken filet", expected: "Chicken Fillet" },
  { name: "bawang putlh / white onion", expected: "Onion White" },
  { name: "tomat cerry / cherry tomato", expected: "Tomato Cherry" },
  
  // Indonesian brand + English descriptor
  { name: "keju mozarella / mozzarella cheese", expected: "Cheese Mozzarella" },
  { name: "susu segar / fresh milk", expected: "Milk Fresh" },
  { name: "roti tawar / white bread", expected: "Bread White" },
  
  // Complex quantity + multilingual
  { name: "pisang cavendish 1kg / banana cavendish", expected: "Banana Cavendish" },
  { name: "apel fuji 2pcs / fuji apple", expected: "Apple Fuji" },
  { name: "jeruk manis 500ml / sweet orange juice", expected: "Orange Juice Sweet" },
  
  // Mixed language with modifiers
  { name: "kentang goreng beku / frozen french fries", expected: "Potato Fries Frozen" },
  { name: "daging sapi giling / ground beef", expected: "Beef Ground" },
  { name: "ikan salmon fillet / salmon fillet", expected: "Fish Salmon Fillet" },
  
  // Regional variations
  { name: "cabe rawit / bird's eye chili", expected: "Chili Birds Eye" },
  { name: "beras merah / brown rice", expected: "Rice Brown" },
  { name: "gula aren / palm sugar", expected: "Sugar Palm" },
  
  // Complex packaging descriptions
  { name: "minyak goreng tropical 1L / cooking oil", expected: "Oil Cooking" },
  { name: "kecap manis abc 250ml / sweet soy sauce", expected: "Soy Sauce Sweet" },
  { name: "sambal oelek 200g / chili paste", expected: "Chili Paste" }
];

async function runStressTest() {
  console.log('🚀 Starting AI Standardization Stress Test');
  console.log(`Testing ${STRESS_TEST_PRODUCTS.length} complex product names...\n`);
  
  let successCount = 0;
  let totalCount = STRESS_TEST_PRODUCTS.length;
  const results = [];
  
  for (let i = 0; i < STRESS_TEST_PRODUCTS.length; i++) {
    const testCase = STRESS_TEST_PRODUCTS[i];
    console.log(`\n--- Test ${i + 1}/${totalCount} ---`);
    console.log(`Input: "${testCase.name}"`);
    console.log(`Expected: "${testCase.expected}"`);
    
    try {
      const standardized = await standardizeProducts([{
        name: testCase.name,
        unit: 'pcs',
        quantity: 1,
        price: 10000
      }]);
      
      if (standardized.length > 0) {
        const result = standardized[0];
        console.log(`AI Result: "${result.standardizedName}"`);
        console.log(`Confidence: ${result.confidence}%`);
        console.log(`Category: ${result.category}`);
        
        // Check if standardized name contains expected key terms
        const expectedWords = testCase.expected.toLowerCase().split(' ');
        const resultWords = result.standardizedName.toLowerCase().split(' ');
        
        const matchedWords = expectedWords.filter(word => 
          resultWords.some(rWord => rWord.includes(word) || word.includes(rWord))
        );
        
        const matchRatio = matchedWords.length / expectedWords.length;
        const isSuccess = matchRatio >= 0.7 && result.confidence >= 70;
        
        if (isSuccess) {
          console.log(`✅ SUCCESS (${Math.round(matchRatio * 100)}% word match)`);
          successCount++;
        } else {
          console.log(`❌ FAILED (${Math.round(matchRatio * 100)}% word match, confidence: ${result.confidence}%)`);
        }
        
        results.push({
          input: testCase.name,
          expected: testCase.expected,
          actual: result.standardizedName,
          confidence: result.confidence,
          category: result.category,
          success: isSuccess,
          matchRatio: matchRatio
        });
      } else {
        console.log(`❌ FAILED - No standardization result`);
        results.push({
          input: testCase.name,
          expected: testCase.expected,
          actual: 'No result',
          confidence: 0,
          category: 'unknown',
          success: false,
          matchRatio: 0
        });
      }
    } catch (error) {
      console.error(`❌ ERROR: ${error.message}`);
      results.push({
        input: testCase.name,
        expected: testCase.expected,
        actual: 'Error',
        confidence: 0,
        category: 'error',
        success: false,
        matchRatio: 0,
        error: error.message
      });
    }
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('🎯 STRESS TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${totalCount}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${totalCount - successCount}`);
  console.log(`Success Rate: ${Math.round((successCount / totalCount) * 100)}%`);
  
  // Detailed breakdown
  console.log('\n📊 DETAILED RESULTS:');
  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.success ? '✅' : '❌'} "${result.input}"`);
    console.log(`   Expected: "${result.expected}"`);
    console.log(`   AI Result: "${result.actual}"`);
    if (result.confidence) {
      console.log(`   Confidence: ${result.confidence}% | Match: ${Math.round(result.matchRatio * 100)}%`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  // Categories analysis
  const categories = {};
  results.forEach(r => {
    if (r.category !== 'error' && r.category !== 'unknown') {
      categories[r.category] = (categories[r.category] || 0) + 1;
    }
  });
  
  console.log('\n📈 CATEGORY DISTRIBUTION:');
  Object.entries(categories).forEach(([cat, count]) => {
    console.log(`   ${cat}: ${count} products`);
  });
  
  // Performance recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  if (successRate < 70) {
    console.log('   - Consider enhancing AI prompt with more Indonesian→English mappings');
    console.log('   - Add more context about product categories and variations');
  }
  if (results.some(r => r.confidence < 80)) {
    console.log('   - Review low-confidence results for prompt improvements');
  }
  console.log('   - Monitor real-world performance and adjust thresholds as needed');
  
  const successRate = (successCount / totalCount) * 100;
  console.log(`\n🏆 Overall System Performance: ${Math.round(successRate)}%`);
  
  return {
    totalTests: totalCount,
    successCount,
    successRate,
    results
  };
}

// Run the stress test
if (require.main === module) {
  runStressTest()
    .then(summary => {
      console.log('\n✨ Stress test completed!');
      process.exit(summary.successRate >= 70 ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Stress test failed:', error);
      process.exit(1);
    });
}

module.exports = { runStressTest, STRESS_TEST_PRODUCTS };