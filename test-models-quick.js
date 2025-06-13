const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

// Test files - select a few representative files
const TEST_FILES = [
  'milk up.pdf',                    // Multi-page PDF
  'munch bakery.jpg',              // Image file
  'Oka veg supplier.xlsx',         // Excel file
  'bali sustainable seafood.pdf',  // Single page PDF
  'suppliers list Buyer + - Поставщики FOOD.csv'  // CSV file
];

const TEST_DIR = '/Users/denisdomashenko/Downloads/AIbuyer';

// Current model (we'll change this manually between tests)
const CURRENT_MODEL = 'gpt-4o';

// Test single file
async function testFile(filePath, fileName) {
  try {
    const formData = new FormData();
    formData.append('files', fs.createReadStream(filePath), fileName);
    formData.append('model', CURRENT_MODEL);

    console.log(`\n📄 Testing: ${fileName}`);
    console.log(`🤖 Model: ${CURRENT_MODEL}`);
    process.stdout.write('⏳ Processing...');

    const startTime = Date.now();
    const response = await fetch('http://localhost:3000/api/upload-ai', {
      method: 'POST',
      body: formData
    });

    const endTime = Date.now();
    const result = await response.json();
    
    process.stdout.write('\r');
    
    const testResult = {
      fileName,
      model: CURRENT_MODEL,
      status: response.status,
      success: result.success || false,
      productsExtracted: result.stats?.totalExtracted || 0,
      newProducts: result.stats?.newProducts || 0,
      errors: result.stats?.errors || 0,
      processingTime: (endTime - startTime) / 1000,
      cost: result.stats?.estimatedCostUsd || 0,
      supplier: result.supplier?.name || 'Unknown',
      error: result.error || null
    };

    if (testResult.success) {
      console.log(`✅ Success!`);
      console.log(`   📦 Products extracted: ${testResult.productsExtracted}`);
      console.log(`   ✨ New products: ${testResult.newProducts}`);
      console.log(`   🏢 Supplier: ${testResult.supplier}`);
      console.log(`   ⏱️  Time: ${testResult.processingTime.toFixed(1)}s`);
      console.log(`   💰 Cost: $${testResult.cost.toFixed(4)}`);
    } else {
      console.log(`❌ Failed: ${testResult.error || 'Unknown error'}`);
    }

    return testResult;
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return {
      fileName,
      model: CURRENT_MODEL,
      status: 'error',
      success: false,
      productsExtracted: 0,
      newProducts: 0,
      errors: 1,
      processingTime: 0,
      cost: 0,
      error: error.message
    };
  }
}

// Main test function
async function runModelTest() {
  console.log(`\n🧪 AI Model Test - ${CURRENT_MODEL}`);
  console.log(`📁 Testing ${TEST_FILES.length} files\n`);

  const results = [];
  let totalProducts = 0;
  let totalTime = 0;
  let totalCost = 0;
  let successCount = 0;

  for (const fileName of TEST_FILES) {
    const filePath = path.join(TEST_DIR, fileName);
    
    if (!fs.existsSync(filePath)) {
      console.log(`\n⚠️  Skipping ${fileName} - file not found`);
      continue;
    }

    const result = await testFile(filePath, fileName);
    results.push(result);
    
    if (result.success) {
      totalProducts += result.productsExtracted;
      totalTime += result.processingTime;
      totalCost += result.cost;
      successCount++;
    }

    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log(`📊 SUMMARY - ${CURRENT_MODEL}`);
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount}/${TEST_FILES.length} files`);
  console.log(`📦 Total products extracted: ${totalProducts}`);
  console.log(`⏱️  Total processing time: ${totalTime.toFixed(1)}s`);
  console.log(`⚡ Average time per file: ${(totalTime / successCount || 0).toFixed(1)}s`);
  console.log(`📈 Average products per file: ${(totalProducts / successCount || 0).toFixed(1)}`);
  console.log(`💰 Total cost: $${totalCost.toFixed(4)}`);
  console.log(`💵 Average cost per file: $${(totalCost / successCount || 0).toFixed(4)}`);

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsPath = `test-results-${CURRENT_MODEL}-${timestamp}.json`;
  fs.writeFileSync(resultsPath, JSON.stringify({
    model: CURRENT_MODEL,
    timestamp: new Date().toISOString(),
    summary: {
      filesProcessed: TEST_FILES.length,
      successfulFiles: successCount,
      totalProducts,
      totalTime,
      totalCost,
      avgTimePerFile: totalTime / successCount || 0,
      avgProductsPerFile: totalProducts / successCount || 0,
      avgCostPerFile: totalCost / successCount || 0
    },
    details: results
  }, null, 2));
  
  console.log(`\n💾 Results saved to: ${resultsPath}`);
}

// Run the test
runModelTest().catch(console.error);