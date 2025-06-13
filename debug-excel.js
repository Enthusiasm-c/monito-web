const ExcelJS = require('exceljs');
const fs = require('fs');

async function debugExcel(filename) {
  const filePath = `/Users/denisdomashenko/Downloads/AIbuyer/${filename}`;
  
  console.log(`🔍 Debugging Excel file: ${filename}`);
  
  try {
    const buffer = fs.readFileSync(filePath);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    console.log(`📊 Worksheets: ${workbook.worksheets.length}`);
    
    workbook.worksheets.forEach((worksheet, index) => {
      console.log(`\n📋 Sheet ${index + 1}: "${worksheet.name}"`);
      console.log(`   Rows: ${worksheet.rowCount}`);
      
      // Показываем первые 10 строк для анализа
      let rowsShown = 0;
      worksheet.eachRow((row, rowNumber) => {
        if (rowsShown < 10 && rowNumber <= 20) {
          const values = row.values;
          if (values && values.length > 1) {
            const cleanValues = values.slice(1).map(v => {
              if (v === null || v === undefined) return 'NULL';
              if (typeof v === 'object' && v.result !== undefined) return v.result;
              return String(v).trim();
            });
            
            if (cleanValues.some(v => v && v !== 'NULL')) {
              console.log(`   Row ${rowNumber}: [${cleanValues.join(' | ')}]`);
              rowsShown++;
            }
          }
        }
      });
      
      if (rowsShown === 0) {
        console.log('   ⚠️ No data found in first 20 rows');
      }
    });
    
  } catch (error) {
    console.error('❌ Error reading Excel:', error.message);
  }
}

// Тестируем файл
const filename = process.argv[2] || 'widi wiguna.xlsx';
debugExcel(filename);