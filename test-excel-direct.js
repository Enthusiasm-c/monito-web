const fs = require('fs');
const path = require('path');

async function testExcelDirectly() {
  try {
    console.log('🧪 Testing Widi Wiguna 03_07.xlsx directly with enhanced extractor...');
    
    const filePath = '/Users/denisdomashenko/Downloads/Widi Wiguna 03_07.xlsx';
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ File not found:', filePath);
      return;
    }
    
    // Read file as buffer
    const fileBuffer = fs.readFileSync(filePath);
    console.log(`📁 File size: ${Math.round(fileBuffer.length / 1024)}KB`);
    
    // Import the enhanced extractor
    const { EnhancedExcelExtractor } = require('./app/services/extractors/EnhancedExcelExtractor');
    
    console.log('🔧 Initializing enhanced Excel extractor...');
    const extractor = EnhancedExcelExtractor.getInstance();
    
    console.log('📊 Processing Excel file...');
    const startTime = Date.now();
    
    const result = await extractor.processDocument(fileBuffer, 'Widi Wiguna 03_07.xlsx');
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log(`⏱️ Processing completed in ${duration} seconds`);
    console.log('✅ Processing result:', {
      success: !!result,
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
        processor: result.metadata.processor,
        extractionQuality: result.metadata.extractionQuality,
        dateExtracted: result.metadata.dateExtracted
      });
    }
    
    // Save detailed results
    if (result) {
      const outputFile = `excel-direct-test-results-${Date.now()}.json`;
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
      console.log(`💾 Detailed results saved to: ${outputFile}`);
    }
    
  } catch (error) {
    console.error('❌ Direct Excel test failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Try with basic XLSX library
    console.log('\n🔄 Trying with basic XLSX library...');
    try {
      const XLSX = require('xlsx');
      const fileBuffer = fs.readFileSync('/Users/denisdomashenko/Downloads/Widi Wiguna 03_07.xlsx');
      
      console.log('📊 Reading with XLSX...');
      const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true, cellNF: false });
      
      console.log(`📄 Found ${workbook.SheetNames.length} sheets:`);
      workbook.SheetNames.forEach((sheetName, index) => {
        console.log(`   ${index + 1}. ${sheetName}`);
        
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const dataRows = jsonData.filter(row => row && row.some(cell => cell !== null && cell !== undefined && cell !== ''));
        
        console.log(`      Rows with data: ${dataRows.length}`);
        
        if (dataRows.length > 0 && dataRows.length <= 5) {
          console.log(`      Sample data:`);
          dataRows.forEach((row, rowIndex) => {
            console.log(`         Row ${rowIndex + 1}: [${row.slice(0, 3).join(', ')}...]`);
          });
        }
      });
      
    } catch (xlsxError) {
      console.error('❌ Basic XLSX reading also failed:', xlsxError.message);
    }
  }
}

testExcelDirectly();