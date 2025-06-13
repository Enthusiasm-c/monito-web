const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

// Test files directory
const TEST_DIR = '/Users/denisdomashenko/Downloads/AIbuyer';

// Models to test
const MODELS = ['gpt-4o-mini', 'gpt-4o'];

// Get all test files
function getTestFiles() {
  const files = fs.readdirSync(TEST_DIR);
  return files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.pdf', '.xlsx', '.xls', '.csv', '.jpg', '.jpeg', '.png'].includes(ext);
  });
}

// Test single file with specific model
async function testFile(filePath, fileName, model) {
  try {
    const formData = new FormData();
    formData.append('files', fs.createReadStream(filePath), fileName);
    formData.append('model', model);

    const startTime = Date.now();
    const response = await fetch('http://localhost:3000/api/upload-ai', {
      method: 'POST',
      body: formData
    });

    const endTime = Date.now();
    const result = await response.json();
    
    return {
      fileName,
      model,
      status: response.status,
      success: result.success || false,
      productsExtracted: result.stats?.totalExtracted || 0,
      newProducts: result.stats?.newProducts || 0,
      errors: result.stats?.errors || 0,
      processingTime: (endTime - startTime) / 1000,
      cost: result.stats?.estimatedCostUsd || 0,
      error: result.error || null
    };
  } catch (error) {
    return {
      fileName,
      model,
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
async function runTests() {
  const testFiles = getTestFiles();
  console.log(`\n🧪 Starting AI Model Comparison Test`);
  console.log(`📁 Found ${testFiles.length} files to test`);
  console.log(`🤖 Models to test: ${MODELS.join(', ')}\n`);

  const results = {
    byModel: {},
    byFile: {}
  };

  // Initialize results structure
  for (const model of MODELS) {
    results.byModel[model] = {
      totalFiles: 0,
      successfulFiles: 0,
      totalProducts: 0,
      totalNewProducts: 0,
      totalErrors: 0,
      totalTime: 0,
      totalCost: 0,
      files: []
    };
  }

  // Test each file with each model
  for (const fileName of testFiles) {
    console.log(`\n📄 Testing: ${fileName}`);
    results.byFile[fileName] = {};

    for (const model of MODELS) {
      console.log(`  🤖 Model: ${model}`);
      process.stdout.write('  ⏳ Processing...');
      
      const filePath = path.join(TEST_DIR, fileName);
      const result = await testFile(filePath, fileName, model);
      
      // Clear the processing message
      process.stdout.write('\r');
      
      if (result.success) {
        console.log(`  ✅ Success: ${result.productsExtracted} products in ${result.processingTime.toFixed(1)}s`);
      } else {
        console.log(`  ❌ Failed: ${result.error || 'Unknown error'}`);
      }

      // Update statistics
      results.byModel[model].totalFiles++;
      if (result.success) {
        results.byModel[model].successfulFiles++;
      }
      results.byModel[model].totalProducts += result.productsExtracted;
      results.byModel[model].totalNewProducts += result.newProducts;
      results.byModel[model].totalErrors += result.errors;
      results.byModel[model].totalTime += result.processingTime;
      results.byModel[model].totalCost += result.cost;
      results.byModel[model].files.push(result);
      
      results.byFile[fileName][model] = result;
      
      // Wait a bit between requests to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));

  for (const model of MODELS) {
    const stats = results.byModel[model];
    console.log(`\n🤖 Model: ${model}`);
    console.log(`  📁 Files processed: ${stats.successfulFiles}/${stats.totalFiles}`);
    console.log(`  📦 Total products extracted: ${stats.totalProducts}`);
    console.log(`  ✨ New products created: ${stats.totalNewProducts}`);
    console.log(`  ❌ Total errors: ${stats.totalErrors}`);
    console.log(`  ⏱️  Total time: ${stats.totalTime.toFixed(1)}s`);
    console.log(`  💰 Total cost: $${stats.totalCost.toFixed(4)}`);
    console.log(`  📈 Avg products/file: ${(stats.totalProducts / stats.successfulFiles || 0).toFixed(1)}`);
    console.log(`  ⚡ Avg time/file: ${(stats.totalTime / stats.totalFiles).toFixed(1)}s`);
  }

  // Save detailed results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsPath = `test-results-${timestamp}.json`;
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Detailed results saved to: ${resultsPath}`);

  // Create comparison report
  createComparisonReport(results);
}

// Create detailed comparison report
function createComparisonReport(results) {
  const reportPath = `model-comparison-report-${new Date().toISOString().slice(0, 10)}.md`;
  let report = '# AI Model Comparison Report\n\n';
  report += `Date: ${new Date().toISOString()}\n\n`;

  // Overall comparison
  report += '## Overall Performance\n\n';
  report += '| Metric | GPT-4o-mini | GPT-4o |\n';
  report += '|--------|-------------|--------|\n';
  
  for (const model of MODELS) {
    const stats = results.byModel[model];
    if (model === 'gpt-4o-mini') {
      report += `| Success Rate | ${((stats.successfulFiles / stats.totalFiles) * 100).toFixed(0)}% |`;
    } else {
      report += ` ${((stats.successfulFiles / stats.totalFiles) * 100).toFixed(0)}% |\n`;
    }
  }
  
  for (const model of MODELS) {
    const stats = results.byModel[model];
    if (model === 'gpt-4o-mini') {
      report += `| Total Products | ${stats.totalProducts} |`;
    } else {
      report += ` ${stats.totalProducts} |\n`;
    }
  }
  
  for (const model of MODELS) {
    const stats = results.byModel[model];
    if (model === 'gpt-4o-mini') {
      report += `| Avg Products/File | ${(stats.totalProducts / stats.successfulFiles || 0).toFixed(1)} |`;
    } else {
      report += ` ${(stats.totalProducts / stats.successfulFiles || 0).toFixed(1)} |\n`;
    }
  }
  
  for (const model of MODELS) {
    const stats = results.byModel[model];
    if (model === 'gpt-4o-mini') {
      report += `| Avg Time/File | ${(stats.totalTime / stats.totalFiles).toFixed(1)}s |`;
    } else {
      report += ` ${(stats.totalTime / stats.totalFiles).toFixed(1)}s |\n`;
    }
  }
  
  for (const model of MODELS) {
    const stats = results.byModel[model];
    if (model === 'gpt-4o-mini') {
      report += `| Total Cost | $${stats.totalCost.toFixed(4)} |`;
    } else {
      report += ` $${stats.totalCost.toFixed(4)} |\n`;
    }
  }

  // File-by-file comparison
  report += '\n## File-by-File Results\n\n';
  
  for (const fileName of Object.keys(results.byFile)) {
    report += `### ${fileName}\n\n`;
    report += '| Model | Products | Time | Status |\n';
    report += '|-------|----------|------|--------|\n';
    
    for (const model of MODELS) {
      const result = results.byFile[fileName][model];
      if (result) {
        report += `| ${model} | ${result.productsExtracted} | ${result.processingTime.toFixed(1)}s | ${result.success ? '✅' : '❌'} |\n`;
      }
    }
    report += '\n';
  }

  fs.writeFileSync(reportPath, report);
  console.log(`📄 Comparison report saved to: ${reportPath}`);
}

// Run the tests
runTests().catch(console.error);