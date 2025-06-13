const fs = require('fs');
const path = require('path');

// Test configuration
const testFile = '/Users/denisdomashenko/Downloads/AIbuyer/bali boga.pdf';
const API_URL = 'http://localhost:3000/api/upload-gemini';

async function testUploadBaliBoga() {
  console.log('Testing Bali Boga upload with updated Gemini processor...\n');
  
  try {
    // Read file
    const fileBuffer = fs.readFileSync(testFile);
    const fileName = path.basename(testFile);
    
    console.log(`File: ${fileName}`);
    console.log(`Size: ${(fileBuffer.length / 1024).toFixed(2)} KB (>${500}KB triggers compact format)`);
    
    // Create form data
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    formData.append('files', blob, fileName);
    formData.append('model', 'gemini-2.0-flash-exp');
    
    console.log('\nSending to upload API...');
    const startTime = Date.now();
    
    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData
    });
    
    const processingTime = (Date.now() - startTime) / 1000;
    console.log(`Response received in ${processingTime.toFixed(1)} seconds`);
    
    if (!response.ok) {
      const error = await response.text();
      console.error('\nAPI Error:', response.status, error);
      return;
    }
    
    const result = await response.json();
    
    console.log('\n=== UPLOAD RESULTS ===');
    console.log(`Status: ${result.status}`);
    console.log(`Upload ID: ${result.uploadId}`);
    console.log(`Supplier: ${result.supplier.name} (${result.supplier.isNew ? 'NEW' : 'EXISTING'})`);
    
    console.log('\nExtraction Stats:');
    console.log(`- Total Extracted: ${result.stats.totalExtracted}`);
    console.log(`- Successfully Processed: ${result.stats.successfullyProcessed}`);
    console.log(`- New Products: ${result.stats.newProducts}`);
    console.log(`- Updated Products: ${result.stats.updatedProducts}`);
    console.log(`- Errors: ${result.stats.errors}`);
    console.log(`- Processing Time: ${(result.stats.processingTimeMs / 1000).toFixed(1)}s`);
    
    if (result.stats.totalExtracted > 200) {
      console.log(`\n✅ SUCCESS: Extracted ${result.stats.totalExtracted} products (target was 200+)`);
    } else {
      console.log(`\n⚠️  Only extracted ${result.stats.totalExtracted} products (expected 200+)`);
    }
    
    if (result.insights && result.insights.length > 0) {
      console.log('\nInsights:');
      result.insights.forEach((insight) => {
        console.log(`- ${insight}`);
      });
    }
    
    if (result.errors && result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((error) => {
        console.log(`- ${error}`);
      });
    }
    
  } catch (error) {
    console.error('\nTest failed:', error.message);
  }
}

// Check if server is running
fetch('http://localhost:3000/api/stats')
  .then(() => {
    console.log('Server is running, starting test...\n');
    testUploadBaliBoga();
  })
  .catch(() => {
    console.error('Error: Server is not running. Please start the server with: npm run dev');
  });