const fs = require('fs');

async function testFixedExtractorDirect() {
  try {
    console.log('🧪 Testing fixed Excel extractor directly on Widi Wiguna 03_07.xlsx...');
    
    const filePath = '/Users/denisdomashenko/Downloads/Widi Wiguna 03_07.xlsx';
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ File not found:', filePath);
      return;
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    console.log(`📁 File size: ${Math.round(fileBuffer.length / 1024)}KB`);
    
    // Import and use the updated extractor
    const { enhancedExcelExtractor } = require('./app/services/enhancedExcelExtractor.ts');
    
    console.log('🔧 Initializing enhanced Excel extractor...');
    
    console.log('📊 Processing Excel file with fallback mechanism...');
    const startTime = Date.now();
    
    const result = await enhancedExcelExtractor.processDocument(fileBuffer, 'Widi Wiguna 03_07.xlsx');
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log(`⏱️ Processing completed in ${duration} seconds`);
    console.log('✅ Processing result:', {
      success: result.success,
      hasProducts: !!(result && result.products),
      productCount: result && result.products ? result.products.length : 0
    });
    
    if (result && result.products) {
      console.log(`🎯 PRODUCTS DETECTED: ${result.products.length}`);
      
      if (result.products.length > 0) {
        console.log('📋 Sample products:');
        result.products.slice(0, 10).forEach((product, index) => {
          console.log(`   ${index + 1}. ${product.name} - ${product.price} ${product.unit || 'N/A'}`);
        });
        
        if (result.products.length > 10) {
          console.log(`   ... and ${result.products.length - 10} more products`);
        }
      }
    }
    
    if (result && result.metadata) {
      console.log('🔧 Processing metadata:', {
        sheets: result.metadata.sheets?.length || 0,
        completenessRatio: result.metadata.completenessRatio,
        errors: result.metadata.errors?.length || 0
      });
      
      if (result.metadata.errors && result.metadata.errors.length > 0) {
        console.log('⚠️ Processing errors:');
        result.metadata.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error}`);
        });
      }
    }
    
    // Save detailed results
    if (result) {
      const outputFile = `fixed-extractor-test-results-${Date.now()}.json`;
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
      console.log(`💾 Detailed results saved to: ${outputFile}`);
    }
    
  } catch (error) {
    console.error('❌ Direct extractor test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testFixedExtractorDirect();