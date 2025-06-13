const fs = require('fs');
const path = require('path');

// Configuration - use port 3001
const API_URL = 'http://localhost:3001/api/upload-gemini';
const testFile = '/Users/denisdomashenko/Downloads/AIbuyer/munch bakery.jpg';

async function testSingleUpload() {
  console.log('Testing single file upload...\n');
  console.log(`File: ${path.basename(testFile)}`);
  
  try {
    const fileBuffer = fs.readFileSync(testFile);
    console.log(`Size: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
    
    // Create form data
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
    formData.append('files', blob, path.basename(testFile));
    formData.append('model', 'gemini-2.0-flash-exp');
    
    console.log('\nUploading to API...');
    const startTime = Date.now();
    
    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData
    });
    
    const processingTime = (Date.now() - startTime) / 1000;
    console.log(`Response received in ${processingTime.toFixed(1)}s`);
    
    const responseText = await response.text();
    
    if (!response.ok) {
      console.error(`\n❌ Error ${response.status}:`);
      console.log(responseText.substring(0, 500));
      return;
    }
    
    const result = JSON.parse(responseText);
    
    console.log('\n✅ Upload successful!');
    console.log(`Upload ID: ${result.uploadId}`);
    console.log(`Supplier: ${result.supplier.name}`);
    console.log(`Products extracted: ${result.stats.totalExtracted}`);
    console.log(`Products saved: ${result.stats.successfullyProcessed}`);
    console.log(`Errors: ${result.stats.errors}`);
    
    if (result.stats.errors > 0 && result.errors && result.errors.length > 0) {
      console.log('\nFirst error:', result.errors[0].substring(0, 200) + '...');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testSingleUpload();