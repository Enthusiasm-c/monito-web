const ExcelJS = require('exceljs');
const fs = require('fs');

async function extractProductsCorrectly() {
  try {
    console.log('🧪 Extracting products correctly from Widi Wiguna 03_07.xlsx...');
    
    const filePath = '/Users/denisdomashenko/Downloads/Widi Wiguna 03_07.xlsx';
    const fileBuffer = fs.readFileSync(filePath);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);
    
    const worksheet = workbook.getWorksheet('Sheet1');
    console.log(`📋 Processing Sheet1 with ${worksheet.rowCount} rows`);
    
    const extractedProducts = [];
    
    // Based on the analysis:
    // Row 6 is the header: [NO | Item | /Unit | Price]
    // Data starts from row 7
    // Column structure: [Number, ProductName, Unit, Price]
    
    console.log('📊 Extracting products from row 7 onwards...');
    
    for (let rowNum = 7; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      if (row.hasValues) {
        const values = row.values.slice(1); // Skip index 0
        
        if (values.length >= 4) {
          const number = values[0];
          const productName = values[1];
          const unit = values[2];
          const price = values[3];
          
          // Validate data
          if (productName && typeof productName === 'string' && productName.trim().length > 0 &&
              price && (typeof price === 'number' || !isNaN(parseFloat(price))) && parseFloat(price) > 0) {
            
            const cleanName = productName.trim();
            const cleanUnit = unit && typeof unit === 'string' ? unit.trim() : 'KG';
            const numericPrice = typeof price === 'number' ? price : parseFloat(price);
            
            // Skip obvious non-products
            if (!cleanName.toLowerCase().includes('total') && 
                !cleanName.toLowerCase().includes('subtotal') &&
                cleanName.length > 1) {
              
              extractedProducts.push({
                number: number,
                name: cleanName,
                unit: cleanUnit,
                price: numericPrice,
                row: rowNum
              });
            }
          }
        }
      }
    }
    
    console.log(`🎯 TOTAL PRODUCTS EXTRACTED: ${extractedProducts.length}`);
    
    if (extractedProducts.length > 0) {
      console.log('\n📋 Sample extracted products:');
      extractedProducts.slice(0, 15).forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.name} - ${product.price} ${product.unit} (Row ${product.row})`);
      });
      
      if (extractedProducts.length > 15) {
        console.log(`   ... and ${extractedProducts.length - 15} more products`);
      }
      
      // Show some statistics
      const units = {};
      const priceRanges = { low: 0, medium: 0, high: 0 };
      
      extractedProducts.forEach(product => {
        // Count units
        units[product.unit] = (units[product.unit] || 0) + 1;
        
        // Count price ranges
        if (product.price < 20000) priceRanges.low++;
        else if (product.price < 100000) priceRanges.medium++;
        else priceRanges.high++;
      });
      
      console.log('\n📊 Statistics:');
      console.log(`   Units distribution:`, Object.entries(units).slice(0, 5));
      console.log(`   Price ranges: Low (<20k): ${priceRanges.low}, Medium (20k-100k): ${priceRanges.medium}, High (>100k): ${priceRanges.high}`);
      
      // Save results
      const outputFile = `corrected-extraction-results-${Date.now()}.json`;
      fs.writeFileSync(outputFile, JSON.stringify({
        totalProducts: extractedProducts.length,
        extractedProducts: extractedProducts
      }, null, 2));
      console.log(`💾 Results saved to: ${outputFile}`);
      
      console.log(`\n✅ Successfully extracted ${extractedProducts.length} products from Widi Wiguna 03_07.xlsx!`);
    }
    
  } catch (error) {
    console.error('❌ Extraction failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

extractProductsCorrectly();