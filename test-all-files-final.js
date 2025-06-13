const fs = require('fs');
const path = require('path');

// Configuration - use port 3001
const API_URL = 'http://localhost:3001/api/upload-gemini';

const testFiles = [
  // PDFs
  { path: '/Users/denisdomashenko/Downloads/AIbuyer/bali boga.pdf', type: 'PDF', expected: '>200 products' },
  { path: '/Users/denisdomashenko/Downloads/AIbuyer/VALENTA cheese supplier.pdf', type: 'PDF', expected: '~47 products' },
  { path: '/Users/denisdomashenko/Downloads/AIbuyer/milk up.pdf', type: 'PDF', expected: '~72 products' },
  
  // Images
  { path: '/Users/denisdomashenko/Downloads/AIbuyer/munch bakery.jpg', type: 'Image', expected: '~48 products' },
  
  // Excel files
  { path: '/Users/denisdomashenko/Downloads/AIbuyer/Oka veg supplier.xlsx', type: 'Excel', expected: 'Many vegetable products' },
  { path: '/Users/denisdomashenko/Downloads/AIbuyer/sri 2 vegetables supplier.xlsx', type: 'Excel', expected: 'Vegetable products' },
  { path: '/Users/denisdomashenko/Downloads/AIbuyer/plaga farm bali.xlsx', type: 'Excel', expected: 'Farm products' }
];

async function testFileUpload(filePath, fileType, expected) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing ${fileType}: ${path.basename(filePath)}`);
  console.log(`Expected: ${expected}`);
  console.log('='.repeat(60));
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ File not found');
    return { success: false, error: 'File not found' };
  }
  
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    console.log(`Size: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
    
    // Determine mime type
    let mimeType = 'application/octet-stream';
    if (filePath.endsWith('.pdf')) mimeType = 'application/pdf';
    else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) mimeType = 'image/jpeg';
    else if (filePath.endsWith('.png')) mimeType = 'image/png';
    else if (filePath.endsWith('.xlsx')) mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    else if (filePath.endsWith('.xls')) mimeType = 'application/vnd.ms-excel';
    
    // Create form data
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('files', blob, fileName);
    formData.append('model', 'gemini-2.0-flash-exp');
    
    console.log('Uploading to API...');
    const startTime = Date.now();
    
    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData
    });
    
    const processingTime = (Date.now() - startTime) / 1000;
    
    const responseText = await response.text();
    
    if (!response.ok) {
      console.error(`\n❌ API Error ${response.status}`);
      const errorData = JSON.parse(responseText);
      console.log('Error:', errorData.message);
      return { 
        success: false, 
        file: fileName,
        type: fileType,
        error: `API Error ${response.status}: ${errorData.message}`,
        time: processingTime
      };
    }
    
    const result = JSON.parse(responseText);
    
    console.log(`\n✅ Upload successful in ${processingTime.toFixed(1)}s`);
    console.log(`Status: ${result.status}`);
    console.log(`Supplier: ${result.supplier.name} (${result.supplier.isNew ? 'NEW' : 'EXISTING'})`);
    console.log(`\nExtraction Results:`);
    console.log(`- Total Extracted: ${result.stats.totalExtracted}`);
    console.log(`- Successfully Saved: ${result.stats.successfullyProcessed}`);
    console.log(`- Errors: ${result.stats.errors}`);
    
    return {
      success: true,
      file: fileName,
      type: fileType,
      productsExtracted: result.stats.totalExtracted,
      productsSaved: result.stats.successfullyProcessed,
      errors: result.stats.errors,
      time: processingTime,
      uploadId: result.uploadId
    };
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    return { 
      success: false, 
      file: path.basename(filePath),
      type: fileType,
      error: error.message 
    };
  }
}

async function runAllTests() {
  console.log('=== FINAL TEST OF ALL FILE TYPES ===\n');
  console.log('Server: http://localhost:3001');
  console.log('Model: gemini-2.0-flash-exp');
  console.log('Features: Compact format for large files\n');
  
  const results = [];
  
  for (const test of testFiles) {
    const result = await testFileUpload(test.path, test.type, test.expected);
    results.push(result);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\nTotal files tested: ${results.length}`);
  console.log(`Successful uploads: ${successful.length}`);
  console.log(`Failed uploads: ${failed.length}`);
  
  console.log('\n📊 Success Rate by Type:');
  const types = [...new Set(results.map(r => r.type))];
  types.forEach(type => {
    const typeResults = results.filter(r => r.type === type);
    const typeSuccess = typeResults.filter(r => r.success).length;
    const rate = (typeSuccess / typeResults.length * 100).toFixed(0);
    console.log(`  - ${type}: ${typeSuccess}/${typeResults.length} (${rate}%)`);
  });
  
  if (successful.length > 0) {
    console.log('\n✅ Successful files:');
    successful.forEach(r => {
      const saveRate = r.productsSaved > 0 ? 
        ` (${Math.round(r.productsSaved/r.productsExtracted*100)}% saved)` : 
        ' (0% saved)';
      console.log(`  - ${r.file} (${r.type}): ${r.productsExtracted} extracted${saveRate} in ${r.time.toFixed(1)}s`);
    });
    
    const totalProducts = successful.reduce((sum, r) => sum + r.productsExtracted, 0);
    const totalSaved = successful.reduce((sum, r) => sum + r.productsSaved, 0);
    console.log(`\n  Total products: ${totalProducts} extracted, ${totalSaved} saved`);
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed files:');
    failed.forEach(r => {
      console.log(`  - ${r.file} (${r.type}): ${r.error}`);
    });
  }
  
  // Database stats
  console.log('\n📊 Final database state:');
  try {
    const statsResponse = await fetch('http://localhost:3001/api/stats');
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log(`  - Products: ${stats.products}`);
      console.log(`  - Suppliers: ${stats.suppliers}`);
      console.log(`  - Uploads: ${stats.uploads}`);
    }
  } catch (error) {
    console.log('  Could not fetch database stats');
  }
}

// Run tests
runAllTests();