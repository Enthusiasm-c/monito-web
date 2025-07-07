const XLSX = require('xlsx');
const fs = require('fs');

async function testAdvancedExcelFallback() {
  try {
    console.log('🧪 Testing advanced Excel reading with multiple fallback methods...');
    
    const filePath = '/Users/denisdomashenko/Downloads/Widi Wiguna 03_07.xlsx';
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ File not found:', filePath);
      return;
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    console.log(`📁 File size: ${Math.round(fileBuffer.length / 1024)}KB`);
    
    // Method 1: Standard array
    try {
      console.log('📊 Method 1: XLSX.read with array type...');
      const workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true, cellNF: false });
      console.log('✅ Success with method 1!');
      return await analyzeWorkbook(workbook);
    } catch (error) {
      console.log('❌ Method 1 failed:', error.message);
    }
    
    // Method 2: Buffer with codepage
    try {
      console.log('📊 Method 2: XLSX.read with buffer type and codepage...');
      const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true, codepage: 65001 });
      console.log('✅ Success with method 2!');
      return await analyzeWorkbook(workbook);
    } catch (error) {
      console.log('❌ Method 2 failed:', error.message);
    }
    
    // Method 3: Binary string
    try {
      console.log('📊 Method 3: Converting to binary string...');
      const binaryString = Array.from(fileBuffer, byte => String.fromCharCode(byte)).join('');
      const workbook = XLSX.read(binaryString, { type: 'binary', cellDates: true });
      console.log('✅ Success with method 3!');
      return await analyzeWorkbook(workbook);
    } catch (error) {
      console.log('❌ Method 3 failed:', error.message);
    }
    
    // Method 4: Base64
    try {
      console.log('📊 Method 4: Converting to base64...');
      const base64 = fileBuffer.toString('base64');
      const workbook = XLSX.read(base64, { type: 'base64', cellDates: true });
      console.log('✅ Success with method 4!');
      return await analyzeWorkbook(workbook);
    } catch (error) {
      console.log('❌ Method 4 failed:', error.message);
    }
    
    // Method 5: Minimal options
    try {
      console.log('📊 Method 5: Minimal options...');
      const workbook = XLSX.read(fileBuffer, { type: 'array' });
      console.log('✅ Success with method 5!');
      return await analyzeWorkbook(workbook);
    } catch (error) {
      console.log('❌ Method 5 failed:', error.message);
    }
    
    // Method 6: Try different library (ExcelJS)
    try {
      console.log('📊 Method 6: Trying ExcelJS library...');
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(fileBuffer);
      
      console.log('✅ Success with ExcelJS!');
      
      let totalProducts = 0;
      console.log(`📄 Found ${workbook.worksheets.length} worksheets:`);
      
      workbook.worksheets.forEach((worksheet, index) => {
        console.log(`\n${index + 1}. Worksheet: "${worksheet.name}"`);
        console.log(`   📋 Rows: ${worksheet.rowCount}, Columns: ${worksheet.columnCount}`);
        
        // Count potential products
        let potentialProducts = 0;
        for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
          const row = worksheet.getRow(rowNum);
          if (row.hasValues) {
            const values = row.values;
            if (values && values.length >= 2 && values[1] && values[2]) {
              potentialProducts++;
            }
          }
        }
        
        console.log(`   🎯 Potential products: ${potentialProducts}`);
        totalProducts += potentialProducts;
        
        // Show sample data
        if (worksheet.rowCount > 0) {
          console.log(`   📊 Sample data:`);
          for (let rowNum = 1; rowNum <= Math.min(3, worksheet.rowCount); rowNum++) {
            const row = worksheet.getRow(rowNum);
            const values = row.values ? row.values.slice(1, 5) : []; // Skip index 0
            console.log(`      Row ${rowNum}: [${values.join(' | ')}]`);
          }
        }
      });
      
      console.log(`\n🎯 TOTAL ESTIMATED PRODUCTS: ${totalProducts}`);
      return totalProducts;
      
    } catch (error) {
      console.log('❌ Method 6 (ExcelJS) failed:', error.message);
    }
    
    console.log('❌ All methods failed. File may be corrupted or use unsupported format.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function analyzeWorkbook(workbook) {
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
  return totalProducts;
}

testAdvancedExcelFallback();