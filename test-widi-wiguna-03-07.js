const fs = require('fs');
const path = require('path');

async function testWidiWiguna0307() {
  try {
    console.log('🧪 Testing Widi Wiguna 03_07.xlsx with updated Excel processing...');
    
    const filePath = '/Users/denisdomashenko/Downloads/Widi Wiguna 03_07.xlsx';
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ File not found:', filePath);
      return;
    }
    
    const stats = fs.statSync(filePath);
    console.log(`📁 File size: ${Math.round(stats.size / 1024)}KB`);
    
    // Read file as buffer
    const fileBuffer = fs.readFileSync(filePath);
    
    // Create form data manually for upload
    const fetch = (await import('node-fetch')).default;
    const FormData = require('form-data');
    
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename: 'Widi Wiguna 03_07.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    form.append('supplierName', 'Widi Wiguna');
    
    console.log('🚀 Uploading to unified processing endpoint...');
    console.log('🕐 Testing fixed Excel processing fallback mechanisms...');
    
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/upload-unified', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log(`⏱️ Processing completed in ${duration} seconds`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Upload failed (${response.status}):`, errorText);
      return;
    }
    
    const result = await response.json();
    
    console.log('✅ Upload completed!');
    console.log('📊 Results:', {
      uploadId: result.uploadId,
      status: result.status,
      message: result.message
    });
    
    // Check for specific product count
    if (result.extractedData && result.extractedData.products) {
      const productCount = result.extractedData.products.length;
      console.log(`🎯 PRODUCTS DETECTED: ${productCount}`);
      
      if (productCount > 0) {
        console.log('📋 Sample products:');
        result.extractedData.products.slice(0, 5).forEach((product, index) => {
          console.log(`   ${index + 1}. ${product.name} - ${product.price} ${product.unit}`);
        });
        
        if (productCount > 5) {
          console.log(`   ... and ${productCount - 5} more products`);
        }
      } else {
        console.log('⚠️ NO PRODUCTS DETECTED - Excel processing may have failed');
      }
    }
    
    if (result.processingDetails) {
      console.log('🔧 Processing Details:');
      console.log(`   Processor: ${result.processingDetails.processor}`);
      console.log(`   AI Quality: ${result.processingDetails.extractionQuality}`);
      if (result.processingDetails.fallbackUsed) {
        console.log('   ⚡ Fallback mechanism was used');
      }
    }
    
    // Save detailed results
    const outputFile = `widi-wiguna-test-results-${Date.now()}.json`;
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`💾 Detailed results saved to: ${outputFile}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('🔌 Make sure the development server is running on http://localhost:3000');
    }
  }
}

testWidiWiguna0307();