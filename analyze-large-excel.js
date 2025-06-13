const ExcelJS = require('exceljs');
const fs = require('fs');

async function analyzeLargeExcel(filename) {
  const filePath = `/Users/denisdomashenko/Downloads/AIbuyer/${filename}`;
  
  console.log(`🔍 Analyzing large Excel file: ${filename}`);
  
  try {
    const buffer = fs.readFileSync(filePath);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    let totalProducts = 0;
    const productsBySheet = [];
    
    for (const worksheet of workbook.worksheets) {
      console.log(`\n📋 Sheet: ${worksheet.name}`);
      
      let headerRowIndex = -1;
      let headers = [];
      const sheetProducts = [];
      
      worksheet.eachRow((row, rowNumber) => {
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
              console.log(`   📋 Headers found at row ${rowNumber}:`, headers);
            }
          }
          
          // Если нашли заголовки, считаем продукты
          if (headerRowIndex > 0 && rowNumber > headerRowIndex) {
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
                  }
                }
              });
              
              if (productData.name) {
                sheetProducts.push({
                  ...productData,
                  rowNumber,
                  sheetName: worksheet.name
                });
              }
            }
          }
        }
      });
      
      console.log(`   📦 Products in sheet: ${sheetProducts.length}`);
      productsBySheet.push({
        sheetName: worksheet.name,
        products: sheetProducts,
        count: sheetProducts.length
      });
      totalProducts += sheetProducts.length;
    }
    
    console.log(`\n📊 TOTAL ANALYSIS:`);
    console.log(`   📦 Total products: ${totalProducts}`);
    console.log(`   📋 Sheets: ${productsBySheet.length}`);
    
    // Рекомендация по батчам
    const batchSize = 50; // Оптимальный размер для AI
    const totalBatches = Math.ceil(totalProducts / batchSize);
    
    console.log(`\n🔄 BATCH PROCESSING PLAN:`);
    console.log(`   📦 Batch size: ${batchSize} products`);
    console.log(`   🔢 Total batches needed: ${totalBatches}`);
    
    let currentBatch = 1;
    let processedProducts = 0;
    
    for (const sheet of productsBySheet) {
      if (sheet.count > 0) {
        const batches = Math.ceil(sheet.count / batchSize);
        console.log(`   📋 Sheet "${sheet.sheetName}": ${sheet.count} products → ${batches} batches`);
        
        for (let i = 0; i < batches; i++) {
          const start = i * batchSize;
          const end = Math.min(start + batchSize, sheet.count);
          const batchProducts = sheet.products.slice(start, end);
          
          console.log(`      Batch ${currentBatch}: rows ${sheet.products[start].rowNumber}-${sheet.products[end-1].rowNumber} (${batchProducts.length} products)`);
          currentBatch++;
        }
      }
    }
    
    return {
      totalProducts,
      productsBySheet,
      batchSize,
      totalBatches
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Тестируем файл
analyzeLargeExcel('widi wiguna.xlsx');