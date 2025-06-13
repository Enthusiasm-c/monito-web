const fs = require('fs');
const path = require('path');

// Test configuration
const API_URL = 'http://localhost:3000/api/upload-gemini';

const testFiles = [
  { path: '/Users/denisdomashenko/Downloads/AIbuyer/bali boga.pdf', type: 'PDF', expected: '>200 products' },
  { path: '/Users/denisdomashenko/Downloads/AIbuyer/VALENTA cheese supplier.pdf', type: 'PDF', expected: '~47 products' },
  { path: '/Users/denisdomashenko/Downloads/AIbuyer/munch bakery.jpg', type: 'Image', expected: '~48 products' },
  { path: '/Users/denisdomashenko/Downloads/AIbuyer/Oka veg supplier.xlsx', type: 'Excel', expected: 'Many vegetable products' },
  { path: '/Users/denisdomashenko/Downloads/AIbuyer/sri 2 vegetables supplier.xlsx', type: 'Excel', expected: 'Vegetable products' }
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
    // Read file
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
    else if (filePath.endsWith('.csv')) mimeType = 'text/csv';
    
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
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`\n❌ API Error ${response.status}`);
      console.log('Error details:', error.substring(0, 500));
      return { 
        success: false, 
        file: fileName,
        type: fileType,
        error: `API Error ${response.status}`,
        time: processingTime
      };
    }
    
    const result = await response.json();
    
    console.log(`\n✅ Upload successful in ${processingTime.toFixed(1)}s`);
    console.log(`Status: ${result.status}`);
    console.log(`Upload ID: ${result.uploadId}`);
    console.log(`Supplier: ${result.supplier.name} (${result.supplier.isNew ? 'NEW' : 'EXISTING'})`);
    console.log(`\nExtraction Results:`);
    console.log(`- Total Extracted: ${result.stats.totalExtracted}`);
    console.log(`- Successfully Saved: ${result.stats.successfullyProcessed}`);
    console.log(`- New Products: ${result.stats.newProducts}`);
    console.log(`- Updated Products: ${result.stats.updatedProducts}`);
    console.log(`- Errors: ${result.stats.errors}`);
    
    if (result.stats.errors > 0 && result.errors && result.errors.length > 0) {
      console.log(`\nFirst error: ${result.errors[0]}`);
    }
    
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
  console.log('Testing Gemini Upload API with all file types...\n');
  
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
  
  if (successful.length > 0) {
    console.log('\n✅ Successful files:');
    successful.forEach(r => {
      const saveRate = r.productsSaved > 0 ? 
        ` (${Math.round(r.productsSaved/r.productsExtracted*100)}% saved)` : 
        ' (0% saved due to errors)';
      console.log(`  - ${r.file} (${r.type}): ${r.productsExtracted} extracted, ${r.productsSaved} saved${saveRate} in ${r.time.toFixed(1)}s`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed files:');
    failed.forEach(r => {
      console.log(`  - ${r.file} (${r.type}): ${r.error}`);
    });
  }
  
  // Database stats
  console.log('\nChecking final database state...');
  try {
    const statsResponse = await fetch('http://localhost:3000/api/stats');
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log(`\nDatabase totals:`);
      console.log(`- Products: ${stats.products}`);
      console.log(`- Suppliers: ${stats.suppliers}`);
      console.log(`- Uploads: ${stats.uploads}`);
    }
  } catch (error) {
    console.log('Could not fetch database stats');
  }
}

// Check if server is running
fetch('http://localhost:3000/api/stats')
  .then(() => {
    console.log('Server is running, starting tests...\n');
    runAllTests();
  })
  .catch(() => {
    console.error('Error: Server is not running. Please start the server with: npm run dev');
  });