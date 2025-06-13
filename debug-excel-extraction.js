const ExcelJS = require('exceljs');
const fs = require('fs');

async function debugExcelExtraction(filename) {
  const filePath = `/Users/denisdomashenko/Downloads/AIbuyer/${filename}`;
  
  console.log(`🔍 Debugging Excel extraction: ${filename}`);
  
  try {
    const buffer = fs.readFileSync(filePath);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    const productRows = [];
    
    for (const worksheet of workbook.worksheets) {
      console.log(`\n📋 Processing sheet: ${worksheet.name}`);
      
      let headerRowIndex = -1;
      let headers = [];
      
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 100) { // Ограничиваем для отладки
          const values = row.values;
          if (values && values.length > 1) {
            const cleanValues = values.slice(1).map(v => {
              if (v === null || v === undefined) return '';
              if (typeof v === 'object' && v.result !== undefined) return v.result;
              return String(v).trim();
            });
            
            // Ищем заголовки
            if (headerRowIndex === -1) {
              const rowText = cleanValues.join(' ').toLowerCase();
              if ((rowText.includes('item') || rowText.includes('product') || rowText.includes('name')) &&
                  (rowText.includes('price') || rowText.includes('cost'))) {
                headerRowIndex = rowNumber;
                headers = cleanValues.map(h => String(h).toLowerCase());
                console.log(`📋 Found headers in row ${rowNumber}:`, headers);
              }
            }
            
            // Если нашли заголовки, обрабатываем данные
            if (headerRowIndex > 0 && rowNumber > headerRowIndex && productRows.length < 10) {
              const hasProductName = cleanValues.some(v => v && v.length > 2 && isNaN(Number(v)));
              const hasPrice = cleanValues.some(v => v && !isNaN(Number(v)) && Number(v) > 0);
              
              if (hasProductName) {
                const productData = {};
                headers.forEach((header, index) => {
                  if (index < cleanValues.length) {
                    const value = cleanValues[index];
                    if (header.includes('item') || header.includes('product') || header.includes('name')) {
                      productData.name = value;
                    } else if (header.includes('price') || header.includes('cost')) {
                      const numValue = parseFloat(value);
                      productData.price = isNaN(numValue) ? null : numValue;
                    } else if (header.includes('unit')) {
                      productData.unit = value;
                    } else if (header.includes('no') || header.includes('#')) {
                      productData.number = value;
                    }
                  }
                });
                
                console.log(`Row ${rowNumber}:`, {
                  name: productData.name,
                  price: productData.price,
                  unit: productData.unit,
                  hasName: !!productData.name,
                  hasPrice: !!productData.price,
                  rawData: cleanValues
                });
                
                if (productData.name) {
                  productRows.push(productData);
                }
              }
            }
          }
        }
      });
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`Total products found: ${productRows.length}`);
    
    const withPrices = productRows.filter(p => p.price && p.price > 0);
    const withoutPrices = productRows.filter(p => !p.price || p.price <= 0);
    
    console.log(`With valid prices: ${withPrices.length}`);
    console.log(`Without prices: ${withoutPrices.length}`);
    
    if (withoutPrices.length > 0) {
      console.log('\n❌ Products without prices:');
      withoutPrices.slice(0, 5).forEach(p => {
        console.log(`  - "${p.name}": price = ${p.price}`);
      });
    }
    
    if (withPrices.length > 0) {
      console.log('\n✅ Products with prices:');
      withPrices.slice(0, 5).forEach(p => {
        console.log(`  - "${p.name}": ${p.price} ${p.unit || 'units'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Тестируем файл
const filename = process.argv[2] || 'widi wiguna.xlsx';
debugExcelExtraction(filename);