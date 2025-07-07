const fs = require('fs');
const path = require('path');

// Путь к папке с файлами поставщиков
const supplierFolderPath = '/Users/denisdomashenko/Downloads/ SUPPLIER JULY 2025';

async function quickSupplierUpload() {
  try {
    console.log('🏢 БЫСТРАЯ ЗАГРУЗКА ПОСТАВЩИКОВ (первые 5 файлов)');
    console.log('=' .repeat(60));
    
    // Получить первые 5 PDF файлов
    const files = fs.readdirSync(supplierFolderPath);
    const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf')).slice(0, 5);
    
    console.log(`📋 Тестируем ${pdfFiles.length} PDF файлов:`);
    pdfFiles.forEach((file, index) => {
      console.log(`${index + 1}. ${file}`);
    });
    
    const results = [];
    
    for (const file of pdfFiles) {
      const supplierName = extractSupplierName(file);
      console.log(`\n📄 Загружаем: ${file}`);
      console.log(`🏢 Поставщик: ${supplierName}`);
      
      try {
        const result = await uploadSingleFile(file, supplierName);
        results.push({
          file,
          supplier: supplierName,
          ...result
        });
        
        if (result.success) {
          console.log(`   ✅ Успешно: ${result.productsCount} товаров за ${Math.round(result.processingTime/1000)}s`);
        } else {
          console.log(`   ❌ Ошибка: ${result.error}`);
        }
        
      } catch (error) {
        console.log(`   ❌ Исключение: ${error.message}`);
        results.push({
          file,
          supplier: supplierName,
          success: false,
          error: error.message
        });
      }
    }
    
    // Итоги
    const successful = results.filter(r => r.success).length;
    console.log(`\n🎯 ИТОГИ: ${successful}/${results.length} успешно`);
    
    // Сохранить результаты
    const reportFile = `quick-supplier-test-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
    console.log(`💾 Отчет: ${reportFile}`);
    
    return results;
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

async function uploadSingleFile(fileName, supplierName) {
  try {
    const filePath = path.join(supplierFolderPath, fileName);
    const fileBuffer = fs.readFileSync(filePath);
    
    const fetch = (await import('node-fetch')).default;
    const FormData = require('form-data');
    
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename: fileName,
      contentType: 'application/pdf'
    });
    form.append('supplierName', supplierName);
    
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/upload-unified', {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
      timeout: 60000
    });
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}`,
        processingTime
      };
    }
    
    const result = await response.json();
    
    return {
      success: true,
      processingTime,
      productsCount: result.stats?.productsExtracted || 0
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      processingTime: 0
    };
  }
}

function extractSupplierName(fileName) {
  let name = fileName.replace(/\.pdf$/i, '');
  name = name.replace(/\s+\d{2}_\d{2}.*$/, '');
  name = name.replace(/\s+\d+$/, '');
  name = name.trim()
    .replace(/\s+/g, ' ')
    .replace(/^(PT\.?|CV)\s*/i, '')
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return name;
}

quickSupplierUpload();