const fs = require('fs');

async function quickTestUpload() {
  try {
    console.log('🧪 Quick test: Uploading Widi Wiguna 03_07.xlsx...');
    
    const filePath = '/Users/denisdomashenko/Downloads/Widi Wiguna 03_07.xlsx';
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ File not found:', filePath);
      return;
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    console.log(`📁 File size: ${Math.round(fileBuffer.length / 1024)}KB`);
    
    const fetch = (await import('node-fetch')).default;
    const FormData = require('form-data');
    
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename: 'Widi Wiguna 03_07.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    form.append('supplierName', 'Widi Wiguna Test');
    
    console.log('🚀 Uploading...');
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/upload-unified', {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
      timeout: 120000 // 2 minutes timeout
    });
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log(`⏱️ Request completed in ${duration} seconds`);
    console.log(`📊 Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Upload failed:`, errorText);
      return;
    }
    
    const result = await response.json();
    console.log('✅ Upload result:', {
      status: result.status,
      uploadId: result.uploadId,
      message: result.message
    });
    
    if (result.extractedData && result.extractedData.products) {
      console.log(`🎯 PRODUCTS DETECTED: ${result.extractedData.products.length}`);
    } else {
      console.log('⚠️ No products in extractedData');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

quickTestUpload();