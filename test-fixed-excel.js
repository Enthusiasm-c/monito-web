const XLSX = require('xlsx');
const fs = require('fs');

async function testFixedExcelReading() {
  try {
    console.log('🧪 Testing fixed Excel reading with fallback mechanism...');
    
    const filePath = '/Users/denisdomashenko/Downloads/Widi Wiguna 03_07.xlsx';
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ File not found:', filePath);
      return;
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    console.log(`📁 File size: ${Math.round(fileBuffer.length / 1024)}KB`);
    
    // Test the same fallback mechanism we added to the extractor
    let workbook;
    try {
      console.log('📊 Trying XLSX.read with array type...');
      workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true, cellNF: false });
      console.log('✅ Success with array type!');
    } catch (xlsxError) {
      console.warn('⚠️ XLSX failed with array type, trying with buffer type:', xlsxError.message);
      try {
        workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true, codepage: 65001 });
        console.log('✅ Success with buffer type fallback!');
      } catch (bufferError) {
        console.error('❌ Both XLSX methods failed:', bufferError.message);
        console.error('Original error:', xlsxError.message);
        return;
      }
    }
    
    console.log(`📄 Found ${workbook.SheetNames.length} sheets:`);
    
    let totalProducts = 0;
    workbook.SheetNames.forEach((sheetName, index) => {
      console.log(`\n${index + 1}. Sheet: "${sheetName}"`);
      
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      // Filter out completely empty rows
      const nonEmptyRows = jsonData.filter(row => 
        row && row.some(cell => cell !== null && cell !== undefined && cell !== '')
      );
      
      console.log(`   📋 Non-empty rows: ${nonEmptyRows.length}`);
      
      if (nonEmptyRows.length > 0) {
        // Show first few rows
        console.log(`   📊 Sample data:`);
        nonEmptyRows.slice(0, 3).forEach((row, rowIndex) => {
          const displayRow = row.slice(0, 4).map(cell => {
            if (typeof cell === 'string' && cell.length > 20) {
              return cell.substring(0, 17) + '...';
            }
            return cell;
          });
          console.log(`      Row ${rowIndex + 1}: [${displayRow.join(' | ')}]`);
        });
        
        // Count potential products (rows with at least name and price-like data)
        const potentialProducts = nonEmptyRows.filter((row, index) => {
          if (index === 0) return false; // Skip header
          return row.length >= 2 && 
                 row[0] && 
                 (typeof row[1] === 'number' || /\d/.test(String(row[1])));
        });
        
        console.log(`   🎯 Potential products: ${potentialProducts.length}`);
        totalProducts += potentialProducts.length;
      }
    });
    
    console.log(`\n🎯 TOTAL ESTIMATED PRODUCTS: ${totalProducts}`);
    
    if (totalProducts > 0) {
      console.log('✅ Excel file can now be read successfully with fallback mechanism!');
    } else {
      console.log('⚠️ No products detected - may need further analysis');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFixedExcelReading();