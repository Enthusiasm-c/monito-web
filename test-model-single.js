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
const RESULTS_FILE = 'comprehensive-model-test-results.json';

async function loadExistingResults() {
  try {
    if (fs.existsSync(RESULTS_FILE)) {
      return JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading existing results:', error);
  }
  return {
    testDate: new Date().toISOString(),
    models: {}
  };
}

async function saveResults(results) {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${RESULTS_FILE}`);
}

async function testFile(filePath, fileName, model) {
  try {
    const formData = new FormData();
    formData.append('files', fs.createReadStream(filePath), fileName);
    formData.append('model', model);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📄 Testing: ${fileName}`);
    console.log(`🤖 Model: ${model.toUpperCase()}`);
    console.log(`📏 File size: ${(fs.statSync(filePath).size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`${'='.repeat(60)}`);
    
    const startTime = Date.now();
    console.log('⏳ Processing started at:', new Date().toLocaleTimeString());

    const response = await fetch('http://localhost:3000/api/upload-ai', {
      method: 'POST',
      body: formData,
      timeout: 300000 // 5 minutes timeout
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
    } else {
      console.log('\n❌ FAILED:');
      console.log(`   Error: ${result.error || 'Unknown error'}`);
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

async function runModelTest(model, skipFiles = []) {
  console.log('\n' + '🧪'.repeat(30));
  console.log(`🔬 TESTING ${model.toUpperCase()} MODEL`);
  console.log('🧪'.repeat(30));
  console.log('⏰ Started at:', new Date().toLocaleString());

  const results = [];
  let totalProducts = 0;
  let totalNewProducts = 0;
  let totalTime = 0;
  let totalCost = 0;
  let successCount = 0;

  for (let i = 0; i < TEST_FILES.length; i++) {
    const fileName = TEST_FILES[i];
    
    if (skipFiles.includes(fileName)) {
      console.log(`\n⏩ Skipping ${fileName} (already tested)`);
      continue;
    }
    
    const filePath = path.join(TEST_DIR, fileName);
    
    if (!fs.existsSync(filePath)) {
      console.log(`\n⚠️  Skipping ${fileName} - file not found`);
      continue;
    }

    console.log(`\n\n📍 File ${i + 1}/${TEST_FILES.length}`);
    
    const result = await testFile(filePath, fileName, model);
    results.push(result);
    
    if (result.success) {
      totalProducts += result.productsExtracted;
      totalNewProducts += result.newProducts;
      totalTime += result.processingTime;
      totalCost += result.cost;
      successCount++;
    }

    // Save progress after each file
    const allResults = await loadExistingResults();
    if (!allResults.models[model]) {
      allResults.models[model] = {
        files: [],
        summary: {}
      };
    }
    allResults.models[model].files.push(result);
    await saveResults(allResults);

    // Wait 2 seconds between files
    if (i < TEST_FILES.length - 1 && !skipFiles.includes(TEST_FILES[i + 1])) {
      console.log('\n⏸️  Waiting 2 seconds before next file...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Final summary for this model
  const summary = {
    timestamp: new Date().toISOString(),
    filesProcessed: results.length,
    successfulFiles: successCount,
    totalProducts,
    totalNewProducts,
    totalTime,
    totalCost,
    avgTimePerFile: totalTime / successCount || 0,
    avgProductsPerFile: totalProducts / successCount || 0,
    avgCostPerFile: totalCost / successCount || 0,
    costPerProduct: totalCost / totalProducts || 0
  };

  console.log('\n' + '='.repeat(70));
  console.log(`📊 SUMMARY - ${model.toUpperCase()}`);
  console.log('='.repeat(70));
  console.log(`✅ Successfully processed: ${successCount}/${results.length} files`);
  console.log(`📦 Total products extracted: ${totalProducts}`);
  console.log(`✨ Total new products: ${totalNewProducts}`);
  console.log(`⏱️  Total processing time: ${totalTime.toFixed(1)}s`);
  console.log(`💰 Total cost: $${totalCost.toFixed(4)}`);
  console.log(`💎 Cost per product: $${(totalCost / totalProducts || 0).toFixed(5)}`);

  // Update final results
  const allResults = await loadExistingResults();
  allResults.models[model].summary = summary;
  await saveResults(allResults);

  return summary;
}

async function clearDatabase() {
  console.log('\n🗑️  Clearing database...');
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    await prisma.product.deleteMany({});
    await prisma.upload.deleteMany({});
    await prisma.supplier.deleteMany({});
    
    console.log('✅ Database cleared successfully\n');
  } catch (error) {
    console.error('❌ Failed to clear database:', error.message);
  }
}

// Main execution
const model = process.argv[2];
const action = process.argv[3];

if (!model || !['gpt-4o-mini', 'gpt-4o', 'claude-3-sonnet', 'claude-3-haiku', 'claude-3-opus'].includes(model)) {
  console.log('Usage: node test-model-single.js <model> [clear]');
  console.log('Models: gpt-4o-mini, gpt-4o, claude-3-sonnet, claude-3-haiku, claude-3-opus');
  console.log('Add "clear" to clear database before test');
  process.exit(1);
}

async function main() {
  if (action === 'clear') {
    await clearDatabase();
  }

  // Check for existing results to skip already tested files
  const existingResults = await loadExistingResults();
  const skipFiles = [];
  
  if (existingResults.models[model]?.files) {
    existingResults.models[model].files.forEach(file => {
      if (file.success) {
        skipFiles.push(file.fileName);
      }
    });
  }

  console.log(`🚀 Starting ${model.toUpperCase()} test...`);
  if (skipFiles.length > 0) {
    console.log(`📝 Will skip ${skipFiles.length} already tested files`);
  }
  
  await runModelTest(model, skipFiles);
  console.log('\n✅ Test completed!');
}

main().catch(error => {
  console.error('\n❌ Test failed:', error);
});