const fs = require('fs');
const path = require('path');

// Configuration - use port 3001
const API_URL = 'http://localhost:3001/api/upload-gemini';

const excelFiles = [
  '/Users/denisdomashenko/Downloads/AIbuyer/Oka veg supplier.xlsx',
  '/Users/denisdomashenko/Downloads/AIbuyer/sri 2 vegetables supplier.xlsx',
  '/Users/denisdomashenko/Downloads/AIbuyer/plaga farm bali.xlsx',
  '/Users/denisdomashenko/Downloads/AIbuyer/widi wiguna.xlsx',
  '/Users/denisdomashenko/Downloads/AIbuyer/sai fresh.xlsx'
];

async function testExcelFile(filePath) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${path.basename(filePath)}`);
  console.log('='.repeat(60));
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ File not found');
    return { success: false, error: 'File not found' };
  }
  
  try {
    const fileBuffer = fs.readFileSync(filePath);
    console.log(`Size: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
    
    // Create form data
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    formData.append('files', blob, path.basename(filePath));
    formData.append('model', 'gemini-2.0-flash-exp');
    
    console.log('Uploading...');
    const startTime = Date.now();
    
    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData
    });
    
    const processingTime = (Date.now() - startTime) / 1000;
    console.log(`Response in ${processingTime.toFixed(1)}s`);
    
    const responseText = await response.text();
    
    if (!response.ok) {
      console.error(`❌ Error ${response.status}`);
      const errorData = JSON.parse(responseText);
      console.log('Error:', errorData.message);
      return { 
        success: false, 
        file: path.basename(filePath),
        error: errorData.message,
        time: processingTime
      };
    }
    
    const result = JSON.parse(responseText);
    
    console.log(`✅ Success!`);
    console.log(`- Supplier: ${result.supplier.name}`);
    console.log(`- Products extracted: ${result.stats.totalExtracted}`);
    console.log(`- Products saved: ${result.stats.successfullyProcessed}`);
    
    return {
      success: true,
      file: path.basename(filePath),
      productsExtracted: result.stats.totalExtracted,
      productsSaved: result.stats.successfullyProcessed,
      time: processingTime
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return { 
      success: false, 
      file: path.basename(filePath),
      error: error.message 
    };
  }
}

async function testAllExcelFiles() {
  console.log('Testing Excel file processing with improved preprocessor...\n');
  
  const results = [];
  
  for (const file of excelFiles) {
    const result = await testExcelFile(file);
    results.push(result);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\nTotal files: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);
  
  if (successful.length > 0) {
    console.log('\n✅ Successful:');
    successful.forEach(r => {
      console.log(`  - ${r.file}: ${r.productsExtracted} products in ${r.time.toFixed(1)}s`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed:');
    failed.forEach(r => {
      console.log(`  - ${r.file}: ${r.error}`);
    });
  }
}

testAllExcelFiles();