const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const GOOGLE_API_KEY = 'AIzaSyBfvhR-T-x0HUirPLaQUktogi9O7vt5oAc';
const TEST_DIR = '/Users/denisdomashenko/Downloads/AIbuyer';

async function testGeminiWithPDF(fileName, model = 'gemini-2.0-flash-exp') {
  console.log('\n' + '='.repeat(60));
  console.log(`🚀 Testing ${fileName} with Google ${model}`);
  console.log('='.repeat(60));
  
  const filePath = path.join(TEST_DIR, fileName);
  const fileBuffer = fs.readFileSync(filePath);
  const base64Data = fileBuffer.toString('base64');
  
  console.log(`📏 File size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`);
  
  // Determine MIME type
  let mimeType = 'application/pdf';
  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) mimeType = 'image/jpeg';
  if (fileName.endsWith('.png')) mimeType = 'image/png';
  
  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: `You are analyzing a document. Extract all product information from this document.

IMPORTANT: This might be a price list, catalog, invoice or order form. Look for:
- Tables with products and prices
- Lists of items with costs
- Any product names with associated numbers

Extract the following information and return as JSON:
{
  "documentType": "price_list" | "invoice" | "catalog" | "order" | "unknown",
  "supplierName": "Company name from document",
  "supplierContact": {
    "email": "email if found or null",
    "phone": "phone if found or null", 
    "address": "address if found or null"
  },
  "products": [
    {
      "name": "Product name",
      "price": numeric_value,
      "unit": "kg|pcs|l|ml|g|pack|box|etc",
      "category": "category if visible or null",
      "confidence": 0.0-1.0
    }
  ],
  "extractionQuality": 0.0-1.0,
  "metadata": {
    "totalPages": number,
    "language": "detected language",
    "currency": "detected currency"
  }
}

Rules:
- Extract ALL products you can see from ALL pages
- Include products even if price is unclear (use null for price if not found)
- If you see a table, extract EVERY row that looks like a product
- Convert all prices to numbers (remove currency symbols)
- If unit is not clear, use "pcs" as default
- Set confidence based on clarity of information
- Process ALL pages in multi-page PDFs

IMPORTANT: Respond ONLY with valid JSON, no markdown formatting, no explanations.`
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      topP: 0.95,
      topK: 40
    }
  };

  const startTime = Date.now();
  console.log('⏳ Sending request to Gemini API...');
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );

    const processingTime = (Date.now() - startTime) / 1000;
    
    if (!response.ok) {
      const error = await response.text();
      console.log(`❌ API Error ${response.status}:`, error);
      return { success: false, error: error };
    }

    const result = await response.json();
    
    if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.log('❌ No content in response');
      return { success: false, error: 'No content' };
    }

    const content = result.candidates[0].content.parts[0].text;
    
    // Clean markdown if present
    let cleanContent = content;
    if (content.includes('```json')) {
      cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }
    
    // Additional cleaning for common JSON issues
    cleanContent = cleanContent
      .replace(/,\s*}/g, '}')  // Remove trailing commas before }
      .replace(/,\s*]/g, ']')  // Remove trailing commas before ]
      .replace(/:\s*,/g, ': null,')  // Replace empty values with null
      .replace(/:\s*}/g, ': null}')  // Replace empty values at end with null
      .trim();
    
    let data;
    try {
      data = JSON.parse(cleanContent);
    } catch (parseError) {
      console.log('❌ JSON Parse Error:', parseError.message);
      console.log('Response preview:', cleanContent.substring(0, 200) + '...');
      
      // Try to extract products count from the response
      const productsMatch = cleanContent.match(/"products"\s*:\s*\[([\s\S]*?)\]/);
      const productCount = productsMatch ? (productsMatch[1].match(/{/g) || []).length : 0;
      
      return {
        success: false,
        error: 'JSON parse error',
        processingTime,
        estimatedProducts: productCount
      };
    }
    
    console.log(`\n✅ Processing completed in ${processingTime.toFixed(1)}s`);
    console.log(`📦 Products extracted: ${data.products?.length || 0}`);
    console.log(`🏢 Supplier: ${data.supplierName || 'Not detected'}`);
    console.log(`📄 Document type: ${data.documentType}`);
    console.log(`🎯 Extraction quality: ${(data.extractionQuality * 100).toFixed(0)}%`);
    
    // Show sample products
    if (data.products && data.products.length > 0) {
      console.log(`\n📦 Sample products:`);
      data.products.slice(0, 3).forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name} - ${p.price || 'N/A'} ${p.unit} (conf: ${p.confidence})`);
      });
      if (data.products.length > 3) {
        console.log(`   ... and ${data.products.length - 3} more products`);
      }
    }
    
    return {
      success: true,
      processingTime,
      productsCount: data.products?.length || 0,
      supplier: data.supplierName,
      data
    };
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('\n' + '🧪'.repeat(30));
  console.log('🔬 GOOGLE GEMINI DIRECT PDF PROCESSING TEST');
  console.log('🧪'.repeat(30));
  console.log('\n🎯 Key advantages:');
  console.log('  ✅ Direct PDF processing - NO conversion needed!');
  console.log('  ✅ Processes ALL pages automatically');
  console.log('  ✅ Faster than GPT models');
  console.log('  ✅ Lower cost (or free for experimental models)');
  
  const testFiles = [
    'milk up.pdf',                   // Multi-page PDF (6 pages)
    'bali boga.pdf',                 // Medium PDF
    'VALENTA cheese supplier.pdf',   // Cheese supplier PDF
    'munch bakery.jpg',              // Image file
    'sai fresh.xlsx'                 // Excel file (will be skipped)
  ];
  
  const results = [];
  let totalTime = 0;
  let totalProducts = 0;
  
  for (const file of testFiles) {
    // Skip Excel files as Gemini doesn't support them directly
    if (file.endsWith('.xlsx')) {
      console.log(`\n⏩ Skipping ${file} - Excel files need pre-processing`);
      continue;
    }
    
    const result = await testGeminiWithPDF(file);
    results.push({ file, ...result });
    
    if (result.success) {
      totalTime += result.processingTime;
      totalProducts += result.productsCount;
    } else if (result.estimatedProducts) {
      console.log(`   📊 Estimated products in response: ~${result.estimatedProducts}`);
    }
    
    // Wait 2 seconds between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(70));
  
  const successful = results.filter(r => r.success).length;
  console.log(`✅ Success rate: ${successful}/${results.length}`);
  console.log(`📦 Total products: ${totalProducts}`);
  console.log(`⏱️  Total time: ${totalTime.toFixed(1)}s`);
  console.log(`⚡ Avg time per file: ${(totalTime / successful).toFixed(1)}s`);
  console.log(`📈 Avg products per file: ${Math.round(totalProducts / successful)}`);
  
  console.log('\n📊 DETAILED COMPARISON WITH GPT MODELS:');
  console.log('=' + '='.repeat(69));
  console.log('| Metric | Gemini 2.0 | GPT-4O-MINI | GPT-4O |');
  console.log('|' + '-'.repeat(20) + '|' + '-'.repeat(15) + '|' + '-'.repeat(15) + '|' + '-'.repeat(15) + '|');
  console.log(`| Avg time/file | ${(totalTime / successful).toFixed(1)}s | 143.8s | 128.9s |`);
  console.log(`| Avg products/file | ${Math.round(totalProducts / successful)} | 51 | 36 |`);
  console.log(`| PDF conversion | NO ✅ | YES ❌ | YES ❌ |`);
  console.log(`| Multi-page native | YES ✅ | NO ❌ | NO ❌ |`);
  console.log(`| Process all pages | YES ✅ | 4 pages max | 2 pages max |`);
  console.log(`| Cost per file | FREE* | $0.0011 | $0.0223 |`);
  console.log(`| Speed improvement | - | ${((143.8 / (totalTime / successful) - 1) * 100).toFixed(0)}% faster | ${((128.9 / (totalTime / successful) - 1) * 100).toFixed(0)}% faster |`);
  console.log('=' + '='.repeat(69));
  console.log('\n* Gemini 2.0 Flash Experimental is free during preview');
  console.log('* Speed improvement shows how much faster Gemini is compared to GPT models');
  
  // Save results
  fs.writeFileSync('gemini-test-results.json', JSON.stringify({
    model: 'gemini-2.0-flash-exp',
    timestamp: new Date().toISOString(),
    summary: {
      filesProcessed: results.length,
      successful,
      totalProducts,
      totalTime,
      avgTimePerFile: totalTime / successful,
      avgProductsPerFile: totalProducts / successful
    },
    files: results
  }, null, 2));
  
  console.log('\n💾 Results saved to: gemini-test-results.json');
}

// Run the test
console.log('🚀 Starting Gemini test...\n');
runTests().catch(error => {
  console.error('❌ Test failed:', error);
});