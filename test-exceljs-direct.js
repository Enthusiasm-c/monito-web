const ExcelJS = require('exceljs');
const fs = require('fs');

async function testExcelJSDirect() {
  try {
    console.log('🧪 Testing ExcelJS directly on Widi Wiguna 03_07.xlsx...');
    
    const filePath = '/Users/denisdomashenko/Downloads/Widi Wiguna 03_07.xlsx';
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ File not found:', filePath);
      return;
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    console.log(`📁 File size: ${Math.round(fileBuffer.length / 1024)}KB`);
    
    console.log('📊 Loading workbook with ExcelJS...');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);
    
    console.log('✅ ExcelJS successfully loaded the file!');
    console.log(`📄 Found ${workbook.worksheets.length} worksheets:`);
    
    let totalProducts = 0;
    const extractedProducts = [];
    
    for (const worksheet of workbook.worksheets) {
      console.log(`\n📋 Processing worksheet: "${worksheet.name}"`);
      console.log(`   Rows: ${worksheet.rowCount}, Columns: ${worksheet.columnCount}`);
      
      if (worksheet.rowCount < 3) {
        console.log(`   ⚠️ Skipping: too few rows`);
        continue;
      }
      
      // Sample first few rows to understand structure
      console.log(`   📊 Sample data:`);
      for (let rowNum = 1; rowNum <= Math.min(5, worksheet.rowCount); rowNum++) {
        const row = worksheet.getRow(rowNum);
        if (row.hasValues) {
          const values = row.values.slice(1, 6); // Skip index 0, show first 5 columns
          console.log(`      Row ${rowNum}: [${values.join(' | ')}]`);
        }
      }
      
      // Try to detect header row and product data
      let headerRow = null;
      let dataStartRow = 2;
      
      // Look for a row that looks like headers
      for (let rowNum = 1; rowNum <= Math.min(10, worksheet.rowCount); rowNum++) {
        const row = worksheet.getRow(rowNum);
        if (row.hasValues) {
          const values = row.values.slice(1);
          const hasProductLikeHeaders = values.some(cell => {
            if (typeof cell === 'string') {
              const cellLower = cell.toLowerCase();
              return cellLower.includes('product') || 
                     cellLower.includes('item') || 
                     cellLower.includes('name') ||
                     cellLower.includes('price') ||
                     cellLower.includes('harga');
            }
            return false;
          });
          
          if (hasProductLikeHeaders) {
            headerRow = rowNum;
            dataStartRow = rowNum + 1;
            console.log(`   📋 Detected headers at row ${rowNum}: [${values.slice(0, 5).join(' | ')}]`);
            break;
          }
        }
      }
      
      // Extract products starting from data row
      let sheetProducts = 0;
      for (let rowNum = dataStartRow; rowNum <= worksheet.rowCount; rowNum++) {
        const row = worksheet.getRow(rowNum);
        if (row.hasValues) {
          const values = row.values.slice(1); // Skip index 0
          
          // Look for rows with product name and price
          if (values.length >= 2 && values[0] && values[1]) {
            const name = String(values[0]).trim();
            const price = values[1];
            
            // Skip if name is too short or looks like header
            if (name.length < 2 || name.toLowerCase().includes('total') || 
                name.toLowerCase().includes('subtotal')) {
              continue;
            }
            
            // Try to extract price
            let numericPrice = null;
            if (typeof price === 'number') {
              numericPrice = price;
            } else if (typeof price === 'string') {
              const priceMatch = price.match(/[\d,\.]+/);
              if (priceMatch) {
                numericPrice = parseFloat(priceMatch[0].replace(/,/g, ''));
              }
            }
            
            if (numericPrice && numericPrice > 0) {
              extractedProducts.push({
                name: name,
                price: numericPrice,
                unit: values[2] ? String(values[2]).trim() : 'pcs',
                sheet: worksheet.name,
                row: rowNum
              });
              sheetProducts++;
            }
          }
        }
      }
      
      console.log(`   🎯 Products extracted from "${worksheet.name}": ${sheetProducts}`);
      totalProducts += sheetProducts;
    }
    
    console.log(`\n🎯 TOTAL PRODUCTS EXTRACTED: ${totalProducts}`);
    
    if (totalProducts > 0) {
      console.log('\n📋 Sample extracted products:');
      extractedProducts.slice(0, 10).forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.name} - ${product.price} ${product.unit} (${product.sheet}:${product.row})`);
      });
      
      if (extractedProducts.length > 10) {
        console.log(`   ... and ${extractedProducts.length - 10} more products`);
      }
      
      // Save results
      const outputFile = `exceljs-extraction-results-${Date.now()}.json`;
      fs.writeFileSync(outputFile, JSON.stringify({
        totalProducts: totalProducts,
        extractedProducts: extractedProducts
      }, null, 2));
      console.log(`💾 Results saved to: ${outputFile}`);
    }
    
  } catch (error) {
    console.error('❌ ExcelJS test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testExcelJSDirect();