// Test script for Monito Bot API endpoints
const API_URL = 'http://localhost:3000/api/bot';
const API_KEY = process.env.BOT_API_KEY || 'test-api-key-123';

async function testAPI() {
  console.log('🧪 Testing Monito Bot API...\n');

  try {
    // Test 1: Product Search
    console.log('1️⃣ Testing Product Search...');
    const searchRes = await fetch(`${API_URL}/products/search?q=beras&limit=3`, {
      headers: { 'X-Bot-API-Key': API_KEY }
    });
    
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      console.log('✅ Product Search OK');
      console.log(`   Found ${searchData.count} products`);
      if (searchData.products[0]) {
        const product = searchData.products[0];
        console.log(`   Example: ${product.name} - ${product.unit}`);
        console.log(`   Price range: ${product.price_range.min} - ${product.price_range.max} IDR`);
      }
    } else {
      console.log('❌ Product Search Failed:', searchRes.status, await searchRes.text());
    }

    console.log('\n');

    // Test 2: Supplier Search
    console.log('2️⃣ Testing Supplier Search...');
    const supplierRes = await fetch(`${API_URL}/suppliers/search?name=Toko%20Sembako`, {
      headers: { 'X-Bot-API-Key': API_KEY }
    });
    
    if (supplierRes.ok) {
      const supplierData = await supplierRes.json();
      console.log('✅ Supplier Search OK');
      if (supplierData.supplier) {
        console.log(`   Found: ${supplierData.supplier.name} (ID: ${supplierData.supplier.id})`);
      } else if (supplierData.suggestions.length > 0) {
        console.log(`   Found ${supplierData.suggestions.length} suggestions`);
      }
    } else {
      console.log('❌ Supplier Search Failed:', supplierRes.status);
    }

    console.log('\n');

    // Test 3: Price Comparison
    console.log('3️⃣ Testing Price Comparison...');
    const compareRes = await fetch(`${API_URL}/prices/compare`, {
      method: 'POST',
      headers: {
        'X-Bot-API-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [
          { product_name: 'Beras Premium', scanned_price: 70000 },
          { product_name: 'Minyak Goreng', scanned_price: 35000 },
          { product_name: 'Ayam Potong', scanned_price: 45000 }
        ]
      })
    });
    
    if (compareRes.ok) {
      const compareData = await compareRes.json();
      console.log('✅ Price Comparison OK');
      console.log(`   Total items: ${compareData.summary.total_items}`);
      console.log(`   Found items: ${compareData.summary.found_items}`);
      console.log(`   Overpriced: ${compareData.summary.overpriced_items}`);
      console.log(`   Good deals: ${compareData.summary.good_deals}`);
      
      // Show first comparison
      if (compareData.comparisons[0]) {
        const comp = compareData.comparisons[0];
        console.log(`\n   Example: ${comp.product_name}`);
        console.log(`   Scanned: ${comp.scanned_price} IDR`);
        console.log(`   Status: ${comp.status}`);
        if (comp.price_analysis) {
          console.log(`   Market range: ${comp.price_analysis.min_price} - ${comp.price_analysis.max_price} IDR`);
          console.log(`   Deviation: ${comp.price_analysis.deviation_percent}%`);
        }
      }
    } else {
      console.log('❌ Price Comparison Failed:', compareRes.status);
    }

    console.log('\n✨ API tests completed!');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Test invalid API key
async function testAuth() {
  console.log('\n🔐 Testing Authentication...');
  
  const res = await fetch(`${API_URL}/products/search?q=test`, {
    headers: { 'X-Bot-API-Key': 'invalid-key' }
  });
  
  if (res.status === 401) {
    console.log('✅ Authentication correctly rejects invalid key');
  } else {
    console.log('❌ Authentication test failed');
  }
}

// Run tests
console.log('API URL:', API_URL);
console.log('API Key:', API_KEY);
console.log('---\n');

testAPI()
  .then(() => testAuth())
  .catch(console.error);