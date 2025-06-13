const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

// Selected 5 diverse files for testing
const TEST_FILES = [
  'milk up.pdf',                   // Multi-page PDF (6 pages)
  'bali boga.pdf',                 // Medium PDF
  'VALENTA cheese supplier.pdf',   // Cheese supplier PDF
  'munch bakery.jpg',             // Image file
  'sai fresh.xlsx'                // Excel file
];

const TEST_DIR = '/Users/denisdomashenko/Downloads/AIbuyer';

async function testFile(filePath, fileName) {
  try {
    const formData = new FormData();
    formData.append('files', fs.createReadStream(filePath), fileName);
    formData.append('model', 'gpt-4o');

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📄 Testing: ${fileName}`);
    console.log(`🤖 Model: GPT-4O`);
    console.log(`📏 File size: ${(fs.statSync(filePath).size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`${'='.repeat(60)}`);
    
    const startTime = Date.now();
    console.log('⏳ Processing started at:', new Date().toLocaleTimeString());

    const response = await fetch('http://localhost:3000/api/upload-ai', {
      method: 'POST',
      body: formData,
      timeout: 600000 // 10 minutes timeout
    });

    const endTime = Date.now();
    const result = await response.json();
    
    console.log('✅ Processing completed at:', new Date().toLocaleTimeString());
    console.log(`⏱️  Total processing time: ${((endTime - startTime) / 1000).toFixed(1)}s`);
    
    if (result.success) {
      console.log('\n📊 RESULTS:');
      console.log(`   ✅ Status: SUCCESS`);
      console.log(`   📦 Products extracted: ${result.stats.totalExtracted}`);
      console.log(`   ✨ New products created: ${result.stats.newProducts}`);
      console.log(`   🔄 Updated products: ${result.stats.updatedProducts}`);
      console.log(`   ❌ Errors: ${result.stats.errors}`);
      console.log(`   🏢 Supplier: ${result.supplier.name}`);
      console.log(`   💰 Processing cost: $${result.stats.estimatedCostUsd.toFixed(4)}`);
      
      if (result.insights && result.insights.length > 0) {
        console.log(`   💡 Insights:`);
        result.insights.forEach(insight => console.log(`      - ${insight}`));
      }
    } else {
      console.log('\n❌ FAILED:');
      console.log(`   Error: ${result.error || 'Unknown error'}`);
      if (result.message) {
        console.log(`   Message: ${result.message}`);
      }
    }

    return {
      fileName,
      fileSize: fs.statSync(filePath).size,
      success: result.success || false,
      productsExtracted: result.stats?.totalExtracted || 0,
      newProducts: result.stats?.newProducts || 0,
      updatedProducts: result.stats?.updatedProducts || 0,
      errors: result.stats?.errors || 0,
      processingTime: (endTime - startTime) / 1000,
      cost: result.stats?.estimatedCostUsd || 0,
      supplier: result.supplier?.name || 'Unknown',
      error: result.error || null
    };

  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
    return {
      fileName,
      success: false,
      error: error.message
    };
  }
}

async function runFullTest() {
  console.log('\n' + '🧪'.repeat(30));
  console.log('🔬 COMPREHENSIVE GPT-4O MODEL TEST');
  console.log('🧪'.repeat(30));
  console.log(`\n📁 Testing ${TEST_FILES.length} files`);
  console.log('⏰ Started at:', new Date().toLocaleString());

  const results = [];
  let totalProducts = 0;
  let totalNewProducts = 0;
  let totalTime = 0;
  let totalCost = 0;
  let successCount = 0;

  for (let i = 0; i < TEST_FILES.length; i++) {
    const fileName = TEST_FILES[i];
    const filePath = path.join(TEST_DIR, fileName);
    
    if (!fs.existsSync(filePath)) {
      console.log(`\n⚠️  Skipping ${fileName} - file not found`);
      continue;
    }

    console.log(`\n\n📍 File ${i + 1}/${TEST_FILES.length}`);
    
    const result = await testFile(filePath, fileName);
    results.push(result);
    
    if (result.success) {
      totalProducts += result.productsExtracted;
      totalNewProducts += result.newProducts;
      totalTime += result.processingTime;
      totalCost += result.cost;
      successCount++;
    }

    // Wait 5 seconds between files to avoid rate limits
    if (i < TEST_FILES.length - 1) {
      console.log('\n⏸️  Waiting 5 seconds before next file...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Final summary
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 FINAL SUMMARY - GPT-4O');
  console.log('='.repeat(70));
  console.log(`✅ Successfully processed: ${successCount}/${TEST_FILES.length} files`);
  console.log(`📦 Total products extracted: ${totalProducts}`);
  console.log(`✨ Total new products: ${totalNewProducts}`);
  console.log(`⏱️  Total processing time: ${totalTime.toFixed(1)}s (${(totalTime/60).toFixed(1)} minutes)`);
  console.log(`⚡ Average time per file: ${(totalTime / successCount || 0).toFixed(1)}s`);
  console.log(`📈 Average products per file: ${(totalProducts / successCount || 0).toFixed(1)}`);
  console.log(`💰 Total cost: $${totalCost.toFixed(4)}`);
  console.log(`💵 Average cost per file: $${(totalCost / successCount || 0).toFixed(4)}`);
  console.log(`💎 Cost per product: $${(totalCost / totalProducts || 0).toFixed(5)}`);
  console.log('⏰ Completed at:', new Date().toLocaleString());

  // Detailed breakdown
  console.log('\n📋 DETAILED RESULTS:');
  console.log('-'.repeat(70));
  results.forEach(r => {
    console.log(`\n${r.fileName}:`);
    console.log(`  Status: ${r.success ? '✅ Success' : '❌ Failed'}`);
    if (r.success) {
      console.log(`  Products: ${r.productsExtracted} (${r.newProducts} new)`);
      console.log(`  Time: ${r.processingTime.toFixed(1)}s`);
      console.log(`  Cost: $${r.cost.toFixed(4)}`);
      console.log(`  Supplier: ${r.supplier}`);
    } else {
      console.log(`  Error: ${r.error}`);
    }
  });

  // Save detailed results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsPath = `gpt4o-test-results-${timestamp}.json`;
  fs.writeFileSync(resultsPath, JSON.stringify({
    model: 'gpt-4o',
    timestamp: new Date().toISOString(),
    testDuration: `${totalTime.toFixed(1)}s`,
    summary: {
      filesProcessed: TEST_FILES.length,
      successfulFiles: successCount,
      totalProducts,
      totalNewProducts,
      totalTime,
      totalCost,
      avgTimePerFile: totalTime / successCount || 0,
      avgProductsPerFile: totalProducts / successCount || 0,
      avgCostPerFile: totalCost / successCount || 0,
      costPerProduct: totalCost / totalProducts || 0
    },
    files: results
  }, null, 2));
  
  console.log(`\n💾 Detailed results saved to: ${resultsPath}`);
}

// Run the comprehensive test
console.log('🚀 Starting comprehensive GPT-4O test...');
console.log('⚠️  This may take several minutes...\n');

runFullTest().catch(error => {
  console.error('\n❌ Test failed:', error);
});