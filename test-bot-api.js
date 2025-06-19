/**
 * Test the bot API with stress test products to verify AI standardization
 */

// Complex test cases that should trigger AI standardization
const STRESS_TEST_PRODUCTS = [
  // Multilingual duplication patterns - these were problematic before
  { product_name: "daun bawang", scanned_price: 5000, unit: "bunch", quantity: 1 },
  { product_name: "mangga harum 2pcs", scanned_price: 15000, unit: "pcs", quantity: 2 },
  { product_name: "wortel / carrot", scanned_price: 8000, unit: "kg", quantity: 1 },
  
  // Complex multilingual cases
  { product_name: "paprika merah / red bell pepper", scanned_price: 12000, unit: "pcs", quantity: 1 },
  { product_name: "timun jepang / japanese cucumber", scanned_price: 10000, unit: "pcs", quantity: 3 },
  { product_name: "jamur shitake / shiitake mushroom", scanned_price: 25000, unit: "pack", quantity: 1 },
  { product_name: "terong ungu / purple eggplant", scanned_price: 8000, unit: "kg", quantity: 1 },
  { product_name: "kentang baby / baby potato", scanned_price: 18000, unit: "kg", quantity: 1 },
  
  // OCR-like errors with multilingual
  { product_name: "ayam fillet / chicken filet", scanned_price: 45000, unit: "kg", quantity: 1 },
  { product_name: "bawang putlh / white onion", scanned_price: 12000, unit: "kg", quantity: 1 },
  
  // Complex quantity + multilingual  
  { product_name: "pisang cavendish 1kg / banana cavendish", scanned_price: 20000, unit: "kg", quantity: 1 },
  { product_name: "apel fuji 2pcs / fuji apple", scanned_price: 15000, unit: "pcs", quantity: 2 }
];

async function testBotAPI() {
  const SERVER_URL = 'http://209.38.85.196:3000';
  const API_KEY = 'monito-bot-2024'; // Bot API key
  
  console.log('🚀 Testing Bot API with Complex Product Names');
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Testing ${STRESS_TEST_PRODUCTS.length} products...\n`);
  
  let foundCount = 0;
  let totalCount = STRESS_TEST_PRODUCTS.length;
  const results = [];
  
  try {
    const response = await fetch(`${SERVER_URL}/api/bot/prices/compare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-API-Key': API_KEY
      },
      body: JSON.stringify({
        items: STRESS_TEST_PRODUCTS
      })
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('📊 API RESPONSE SUMMARY:');
    console.log(`Total items: ${data.summary.total_items}`);
    console.log(`Found items: ${data.summary.found_items}`);
    console.log(`Success rate: ${Math.round((data.summary.found_items / data.summary.total_items) * 100)}%\n`);
    
    console.log('📋 DETAILED RESULTS:');
    data.comparisons.forEach((comp, index) => {
      const testProduct = STRESS_TEST_PRODUCTS[index];
      const isFound = comp.status !== 'not_found';
      
      console.log(`\n${index + 1}. ${isFound ? '✅' : '❌'} "${testProduct.product_name}"`);
      
      if (isFound) {
        console.log(`   Matched: "${comp.matched_product.name}"`);
        console.log(`   Status: ${comp.status}`);
        if (comp.price_analysis) {
          console.log(`   Price Analysis: ${comp.price_analysis.supplier_count} suppliers`);
          console.log(`   Better Deals: ${comp.price_analysis.has_better_deals ? 'Yes' : 'No'}`);
        }
        foundCount++;
      } else {
        console.log(`   Status: ${comp.status}`);
        console.log(`   No match found - likely saved to unmatched queue`);
      }
      
      results.push({
        input: testProduct.product_name,
        found: isFound,
        matched_product: comp.matched_product?.name || 'None',
        status: comp.status
      });
    });
    
    // Analysis by category
    console.log('\n📈 ANALYSIS:');
    console.log(`Overall Success Rate: ${Math.round((foundCount / totalCount) * 100)}%`);
    
    const statusCounts = {};
    data.comparisons.forEach(comp => {
      statusCounts[comp.status] = (statusCounts[comp.status] || 0) + 1;
    });
    
    console.log('\nStatus Distribution:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} items`);
    });
    
    // Show improvements
    const previouslyFailedProducts = [
      'daun bawang',
      'mangga harum 2pcs'
    ];
    
    console.log('\n🎯 PREVIOUSLY PROBLEMATIC PRODUCTS:');
    previouslyFailedProducts.forEach(productName => {
      const result = results.find(r => r.input === productName);
      if (result) {
        console.log(`   "${productName}": ${result.found ? '✅ NOW FOUND' : '❌ Still not found'} ${result.found ? `(${result.matched_product})` : ''}`);
      }
    });
    
    console.log('\n💡 SYSTEM IMPROVEMENTS:');
    if (foundCount > 8) { // More than 2/3 success
      console.log('   ✅ AI standardization is working well for multilingual products');
      console.log('   ✅ Complex naming patterns are being handled effectively');
    } else {
      console.log('   ⚠️  Consider further prompt improvements');
      console.log('   ⚠️  Some multilingual patterns still challenging');
    }
    
    if (data.summary.found_items > data.summary.total_items * 0.7) {
      console.log('   ✅ Overall system performance is good (>70% success rate)');
    }
    
    return {
      totalTests: totalCount,
      foundCount,
      successRate: (foundCount / totalCount) * 100,
      results,
      summary: data.summary
    };
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
    return null;
  }
}

// Run the test
if (require.main === module) {
  testBotAPI()
    .then(result => {
      if (result) {
        console.log(`\n🏆 Final Result: ${Math.round(result.successRate)}% success rate`);
        process.exit(result.successRate >= 70 ? 0 : 1);
      } else {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testBotAPI, STRESS_TEST_PRODUCTS };