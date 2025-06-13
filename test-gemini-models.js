const fs = require('fs');
const path = require('path');
const { GeminiProcessor } = require('./app/services/ai-optimized/GeminiProcessor');

// Test files
const TEST_FILES = [
  'milk up.pdf',                   // Multi-page PDF (6 pages)
  'bali boga.pdf',                 // Medium PDF
  'VALENTA cheese supplier.pdf',   // Cheese supplier PDF
  'munch bakery.jpg',             // Image file
  'sai fresh.xlsx'                // Excel file (will need special handling)
];

const TEST_DIR = '/Users/denisdomashenko/Downloads/AIbuyer';
const RESULTS_FILE = 'gemini-test-results.json';

async function testFile(processor, filePath, fileName, model) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📄 Testing: ${fileName}`);
    console.log(`🤖 Model: ${model}`);
    console.log(`📏 File size: ${(fs.statSync(filePath).size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`${'='.repeat(60)}`);
    
    const fileBuffer = fs.readFileSync(filePath);
    const startTime = Date.now();
    console.log('⏳ Processing started at:', new Date().toLocaleTimeString());
    
    const result = await processor.processDocument(fileBuffer, fileName, { model });
    
    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000;
    
    console.log('✅ Processing completed at:', new Date().toLocaleTimeString());
    console.log(`⏱️  Total processing time: ${processingTime.toFixed(1)}s`);
    
    console.log('\n📊 RESULTS:');
    console.log(`   ✅ Status: SUCCESS`);
    console.log(`   📦 Products extracted: ${result.products.length}`);
    console.log(`   🏢 Supplier: ${result.supplierName || 'Not detected'}`);
    console.log(`   📄 Document type: ${result.documentType}`);
    console.log(`   🎯 Extraction quality: ${(result.extractionQuality * 100).toFixed(0)}%`);
    
    // Show first 3 products as sample
    if (result.products.length > 0) {
      console.log(`\n   📦 Sample products:`);
      result.products.slice(0, 3).forEach((p, i) => {
        console.log(`      ${i + 1}. ${p.name} - ${p.price} ${p.unit} (confidence: ${p.confidence})`);
      });
      if (result.products.length > 3) {
        console.log(`      ... and ${result.products.length - 3} more products`);
      }
    }
    
    return {
      fileName,
      fileSize: fs.statSync(filePath).size,
      success: true,
      productsExtracted: result.products.length,
      processingTime,
      supplier: result.supplierName || 'Unknown',
      documentType: result.documentType,
      extractionQuality: result.extractionQuality
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

async function runGeminiTest(model = 'gemini-2.0-flash-exp') {
  console.log('\n' + '🧪'.repeat(30));
  console.log(`🔬 TESTING GOOGLE ${model.toUpperCase()}`);
  console.log('🧪'.repeat(30));
  console.log('\n🎯 Key advantages:');
  console.log('  ✅ Direct PDF processing (no conversion needed!)');
  console.log('  ✅ Handles multi-page PDFs natively');
  console.log('  ✅ Lower costs than GPT-4');
  console.log('  ✅ Faster processing times');
  console.log('\n⏰ Started at:', new Date().toLocaleString());

  const processor = new GeminiProcessor();
  const results = [];
  let totalProducts = 0;
  let totalTime = 0;
  let successCount = 0;

  for (let i = 0; i < TEST_FILES.length; i++) {
    const fileName = TEST_FILES[i];
    const filePath = path.join(TEST_DIR, fileName);
    
    if (!fs.existsSync(filePath)) {
      console.log(`\n⚠️  Skipping ${fileName} - file not found`);
      continue;
    }

    // Skip Excel files for now (Gemini doesn't support them directly)
    if (fileName.endsWith('.xlsx')) {
      console.log(`\n⏩ Skipping ${fileName} - Excel files need pre-processing`);
      continue;
    }

    console.log(`\n\n📍 File ${i + 1}/${TEST_FILES.length}`);
    
    const result = await testFile(processor, filePath, fileName, model);
    results.push(result);
    
    if (result.success) {
      totalProducts += result.productsExtracted;
      totalTime += result.processingTime;
      successCount++;
    }

    // Wait 2 seconds between files
    if (i < TEST_FILES.length - 1) {
      console.log('\n⏸️  Waiting 2 seconds before next file...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Summary
  console.log('\n\n' + '='.repeat(70));
  console.log(`📊 FINAL SUMMARY - ${model.toUpperCase()}`);
  console.log('='.repeat(70));
  console.log(`✅ Successfully processed: ${successCount}/${results.length} files`);
  console.log(`📦 Total products extracted: ${totalProducts}`);
  console.log(`⏱️  Total processing time: ${totalTime.toFixed(1)}s (${(totalTime/60).toFixed(1)} minutes)`);
  console.log(`⚡ Average time per file: ${(totalTime / successCount || 0).toFixed(1)}s`);
  console.log(`📈 Average products per file: ${(totalProducts / successCount || 0).toFixed(1)}`);
  
  // Cost estimation
  const estimatedCost = model === 'gemini-2.0-flash-exp' ? 0 : totalProducts * 0.00001;
  console.log(`💰 Estimated cost: $${estimatedCost.toFixed(4)} ${model === 'gemini-2.0-flash-exp' ? '(FREE during experimental phase!)' : ''}`);
  console.log('⏰ Completed at:', new Date().toLocaleString());

  // Comparison with GPT models
  console.log('\n📊 COMPARISON WITH GPT MODELS:');
  console.log('----------------------------------------------------------------------');
  console.log('| Metric | Gemini | GPT-4O-MINI | GPT-4O |');
  console.log('|--------|---------|-------------|---------|');
  console.log(`| Avg time/file | ${(totalTime / successCount || 0).toFixed(1)}s | 143.8s | 128.9s |`);
  console.log(`| Avg products/file | ${(totalProducts / successCount || 0).toFixed(0)} | 51 | 36 |`);
  console.log(`| PDF conversion needed | NO ✅ | YES ❌ | YES ❌ |`);
  console.log(`| Direct multi-page PDF | YES ✅ | NO ❌ | NO ❌ |`);
  
  // Save results
  fs.writeFileSync(RESULTS_FILE, JSON.stringify({
    model,
    timestamp: new Date().toISOString(),
    summary: {
      filesProcessed: results.length,
      successfulFiles: successCount,
      totalProducts,
      totalTime,
      avgTimePerFile: totalTime / successCount || 0,
      avgProductsPerFile: totalProducts / successCount || 0,
      estimatedCost
    },
    files: results
  }, null, 2));
  
  console.log(`\n💾 Results saved to: ${RESULTS_FILE}`);
}

// Check if we can import the module first
try {
  // Test import
  require('./app/services/ai-optimized/GeminiProcessor');
  
  // Run test with newest Gemini model
  runGeminiTest('gemini-2.0-flash-exp').catch(error => {
    console.error('\n❌ Test failed:', error);
  });
} catch (error) {
  console.error('❌ Cannot load GeminiProcessor. Building standalone test...');
  
  // If module import fails, include the processor inline
  const fetch = require('node-fetch');
  
  // Simplified inline processor
  async function testGeminiDirect() {
    const apiKey = 'AIzaSyBfvhR-T-x0HUirPLaQUktogi9O7vt5oAc';
    const model = 'gemini-2.0-flash-exp';
    
    console.log('\n🚀 Testing Gemini with direct API call...');
    
    const pdfPath = path.join(TEST_DIR, 'bali boga.pdf');
    const pdfBuffer = fs.readFileSync(pdfPath);
    const base64Data = pdfBuffer.toString('base64');
    
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `Extract all product information from this PDF document. Return JSON with:
              - documentType
              - supplierName
              - products array with: name, price, unit, category, confidence (0-1)
              - extractionQuality (0-1)
              
              Extract ALL products from ALL pages. Respond with JSON only, no markdown.`
            },
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192
      }
    };

    const startTime = Date.now();
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );

    const result = await response.json();
    const processingTime = (Date.now() - startTime) / 1000;
    
    console.log(`⏱️  Processing time: ${processingTime.toFixed(1)}s`);
    
    if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
      const content = result.candidates[0].content.parts[0].text;
      const data = JSON.parse(content.replace(/```json\n?|```\n?/g, ''));
      console.log(`✅ Success! Found ${data.products?.length || 0} products`);
      console.log(`🏢 Supplier: ${data.supplierName}`);
    } else {
      console.log('❌ Error:', result);
    }
  }
  
  testGeminiDirect().catch(console.error);
}