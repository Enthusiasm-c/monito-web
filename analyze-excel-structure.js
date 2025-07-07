const ExcelJS = require('exceljs');
const fs = require('fs');

async function analyzeExcelStructure() {
  try {
    console.log('🔍 Analyzing Excel structure of Widi Wiguna 03_07.xlsx...');
    
    const filePath = '/Users/denisdomashenko/Downloads/Widi Wiguna 03_07.xlsx';
    const fileBuffer = fs.readFileSync(filePath);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);
    
    console.log(`📄 Found ${workbook.worksheets.length} worksheets`);
    
    for (const worksheet of workbook.worksheets) {
      if (worksheet.rowCount === 0) continue;
      
      console.log(`\n📋 Analyzing worksheet: "${worksheet.name}"`);
      console.log(`   Total rows: ${worksheet.rowCount}, Total columns: ${worksheet.columnCount}`);
      
      // Show detailed structure for first 20 rows
      console.log(`\n   📊 Detailed row analysis (first 20 rows):`);
      for (let rowNum = 1; rowNum <= Math.min(20, worksheet.rowCount); rowNum++) {
        const row = worksheet.getRow(rowNum);
        if (row.hasValues) {
          const values = row.values.slice(1); // Skip index 0
          const displayValues = values.map((val, index) => {
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'string') {
              return val.length > 30 ? val.substring(0, 27) + '...' : val;
            }
            return String(val);
          });
          
          console.log(`      Row ${rowNum}: [${displayValues.join(' | ')}]`);
          
          // Mark potential header rows
          if (values.some(cell => {
            if (typeof cell === 'string') {
              const cellLower = cell.toLowerCase();
              return cellLower.includes('product') || 
                     cellLower.includes('item') || 
                     cellLower.includes('name') ||
                     cellLower.includes('price') ||
                     cellLower.includes('harga') ||
                     cellLower.includes('unit');
            }
            return false;
          })) {
            console.log(`         ^^^ POTENTIAL HEADER ROW ^^^`);
          }
        }
      }
      
      // Look for patterns in data starting from row 10 onwards
      console.log(`\n   🔍 Looking for data patterns (rows 10-30):`);
      let potentialProductRows = [];
      
      for (let rowNum = 10; rowNum <= Math.min(30, worksheet.rowCount); rowNum++) {
        const row = worksheet.getRow(rowNum);
        if (row.hasValues) {
          const values = row.values.slice(1);
          
          // Check if this looks like a product row
          let hasName = false;
          let hasPrice = false;
          let productName = '';
          let price = null;
          
          for (let colIndex = 0; colIndex < values.length; colIndex++) {
            const cellValue = values[colIndex];
            
            // Check for product name (string with reasonable length)
            if (typeof cellValue === 'string' && cellValue.trim().length > 2 && 
                !cellValue.toLowerCase().includes('total') &&
                !cellValue.match(/^\d+$/)) { // Not just a number
              hasName = true;
              productName = cellValue.trim();
            }
            
            // Check for price (number > 0)
            if (typeof cellValue === 'number' && cellValue > 0) {
              hasPrice = true;
              price = cellValue;
            }
          }
          
          if (hasName && hasPrice) {
            potentialProductRows.push({
              row: rowNum,
              name: productName,
              price: price,
              fullRow: values.slice(0, 6)
            });
          }
        }
      }
      
      console.log(`   🎯 Found ${potentialProductRows.length} potential product rows:`);
      potentialProductRows.slice(0, 5).forEach((product, index) => {
        console.log(`      ${index + 1}. Row ${product.row}: "${product.name}" - ${product.price}`);
        console.log(`         Full row: [${product.fullRow.join(' | ')}]`);
      });
      
      if (potentialProductRows.length > 5) {
        console.log(`      ... and ${potentialProductRows.length - 5} more potential products`);
      }
    }
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

analyzeExcelStructure();