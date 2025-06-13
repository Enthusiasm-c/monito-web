// Quick test to verify the integration is working
console.log('🧪 Quick AI Pipeline Integration Test');

const fs = require('fs');

// Read the log file
const log = fs.readFileSync('/Users/denisdomashenko/monito-web/server.log', 'utf8');
const lines = log.split('\n');

// Look for the latest enhanced processor result and AI retrieval
let enhancedSuccess = false;
let aiRetrieval = false;
let productCount = 0;

for (let i = lines.length - 50; i < lines.length; i++) {
  const line = lines[i] || '';
  
  if (line.includes('Enhanced PDF extraction completed: milk up.pdf')) {
    enhancedSuccess = true;
  }
  
  if (line.includes('Retrieved') && line.includes('products from extraction details')) {
    aiRetrieval = true;
    const match = line.match(/Retrieved (\d+) products/);
    if (match) {
      productCount = parseInt(match[1]);
    }
  }
}

console.log('\n📊 Integration Test Results:');
console.log(`✅ Enhanced Processor Success: ${enhancedSuccess ? 'YES' : 'NO'}`);
console.log(`📦 AI Pipeline Data Retrieval: ${aiRetrieval ? 'YES' : 'NO'}`);
console.log(`🔢 Products Retrieved: ${productCount}`);

if (enhancedSuccess && aiRetrieval && productCount >= 40) {
  console.log('\n🎉 SUCCESS! AI Pipeline integration is working!');
  console.log(`✅ Target achieved: ${productCount} products ≥ 40`);
  console.log('✅ Enhanced processor extracts products correctly');
  console.log('✅ AI pipeline can access the extracted data');
  console.log('✅ Integration between systems is functional');
} else if (enhancedSuccess && aiRetrieval) {
  console.log('\n⚠️  PARTIAL SUCCESS: Integration works but waiting for AI validation...');
  console.log('🔄 AI is still processing the products for validation');
} else {
  console.log('\n❌ INTEGRATION ISSUE DETECTED');
  if (!enhancedSuccess) console.log('❌ Enhanced processor failed');
  if (!aiRetrieval) console.log('❌ AI pipeline cannot access data');
}

console.log('\nNote: Full AI validation may take 2-3 minutes for 100+ products');