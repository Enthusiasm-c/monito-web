const fs = require('fs');
const path = require('path');

// Путь к папке с файлами поставщиков
const supplierFolderPath = '/Users/denisdomashenko/Downloads/ SUPPLIER JULY 2025';

// Поддерживаемые форматы файлов
const supportedExtensions = ['.pdf', '.xlsx', '.xls', '.csv', '.jpg', '.jpeg', '.png', '.docx'];

// Результаты загрузки
const uploadResults = {
  total: 0,
  successful: 0,
  failed: 0,
  suppliers: {},
  errors: []
};

async function bulkUploadSuppliers() {
  try {
    console.log('🏢 МАССОВАЯ ЗАГРУЗКА ФАЙЛОВ ПОСТАВЩИКОВ');
    console.log('=' .repeat(60));
    console.log(`📁 Папка: ${supplierFolderPath}`);
    
    // Получить список файлов
    const files = fs.readdirSync(supplierFolderPath);
    const supportedFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return supportedExtensions.includes(ext);
    });
    
    console.log(`📋 Найдено поддерживаемых файлов: ${supportedFiles.length}`);
    console.log(`🚫 Пропущено файлов: ${files.length - supportedFiles.length}`);
    
    if (supportedFiles.length === 0) {
      console.log('❌ Нет поддерживаемых файлов для загрузки');
      return;
    }
    
    // Список файлов для загрузки
    console.log('\n📋 ФАЙЛЫ ДЛЯ ЗАГРУЗКИ:');
    supportedFiles.forEach((file, index) => {
      const supplierName = extractSupplierName(file);
      console.log(`${index + 1}. ${file} → ${supplierName}`);
    });
    
    console.log('\n🚀 НАЧИНАЕМ ЗАГРУЗКУ...\n');
    uploadResults.total = supportedFiles.length;
    
    // Загружать файлы по одному
    for (const file of supportedFiles) {
      const supplierName = extractSupplierName(file);
      console.log(`📄 Загружаем: ${file}`);
      console.log(`🏢 Поставщик: ${supplierName}`);
      
      try {
        const result = await uploadSingleFile(file, supplierName);
        
        if (result.success) {
          uploadResults.successful++;
          
          if (!uploadResults.suppliers[supplierName]) {
            uploadResults.suppliers[supplierName] = {
              files: 0,
              products: 0,
              avgTime: 0,
              times: []
            };
          }
          
          uploadResults.suppliers[supplierName].files++;
          uploadResults.suppliers[supplierName].products += result.productsCount;
          uploadResults.suppliers[supplierName].times.push(result.processingTime);
          uploadResults.suppliers[supplierName].avgTime = Math.round(
            uploadResults.suppliers[supplierName].times.reduce((a, b) => a + b, 0) / 
            uploadResults.suppliers[supplierName].times.length
          );
          
          console.log(`   ✅ Успешно: ${result.productsCount} товаров за ${result.processingTime}ms`);
        } else {
          uploadResults.failed++;
          uploadResults.errors.push({
            file,
            supplier: supplierName,
            error: result.error
          });
          console.log(`   ❌ Ошибка: ${result.error}`);
        }
        
      } catch (error) {
        uploadResults.failed++;
        uploadResults.errors.push({
          file,
          supplier: supplierName,
          error: error.message
        });
        console.log(`   ❌ Исключение: ${error.message}`);
      }
      
      // Пауза между загрузками
      console.log('   ⏳ Пауза 2 секунды...\n');
      await sleep(2000);
    }
    
    // Итоговый отчет
    console.log('🎯 ИТОГОВЫЙ ОТЧЕТ ЗАГРУЗКИ');
    console.log('=' .repeat(50));
    console.log(`Всего файлов: ${uploadResults.total}`);
    console.log(`Успешно: ${uploadResults.successful}`);
    console.log(`Неудачно: ${uploadResults.failed}`);
    console.log(`Процент успеха: ${Math.round((uploadResults.successful / uploadResults.total) * 100)}%`);
    
    console.log('\n🏢 СТАТИСТИКА ПО ПОСТАВЩИКАМ:');
    for (const [supplier, stats] of Object.entries(uploadResults.suppliers)) {
      console.log(`📊 ${supplier}:`);
      console.log(`   Файлов: ${stats.files}`);
      console.log(`   Товаров: ${stats.products}`);
      console.log(`   Среднее время: ${stats.avgTime}ms`);
    }
    
    if (uploadResults.failed > 0) {
      console.log('\n❌ ОШИБКИ:');
      uploadResults.errors.forEach(error => {
        console.log(`   ${error.file} (${error.supplier}): ${error.error}`);
      });
    }
    
    // Сохранить отчет
    const reportFile = `supplier-upload-report-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(uploadResults, null, 2));
    console.log(`\n💾 Отчет сохранен: ${reportFile}`);
    
    return uploadResults;
    
  } catch (error) {
    console.error('❌ Критическая ошибка загрузки:', error.message);
  }
}

async function uploadSingleFile(fileName, supplierName) {
  try {
    const filePath = path.join(supplierFolderPath, fileName);
    const fileBuffer = fs.readFileSync(filePath);
    const mimeType = getMimeType(fileName);
    
    const fetch = (await import('node-fetch')).default;
    const FormData = require('form-data');
    
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename: fileName,
      contentType: mimeType
    });
    form.append('supplierName', supplierName);
    
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/upload-unified', {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
      timeout: 120000 // 2 минуты
    });
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        processingTime
      };
    }
    
    const result = await response.json();
    
    return {
      success: true,
      processingTime,
      productsCount: result.stats?.productsExtracted || 0,
      data: result
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
  // Извлечь имя поставщика из имени файла
  let name = fileName.replace(/\.(pdf|xlsx|xls|csv|jpg|jpeg|png|docx)$/i, '');
  
  // Убрать даты в формате DD_MM
  name = name.replace(/\s+\d{2}_\d{2}.*$/, '');
  
  // Убрать цифры в конце (например "1", "2")
  name = name.replace(/\s+\d+$/, '');
  
  // Очистить и нормализовать
  name = name.trim()
    .replace(/\s+/g, ' ')
    .replace(/^(PT\.?|CV)\s*/i, '') // Убрать префиксы PT, CV
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  return name;
}

function getMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.csv': 'text/csv',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Запуск загрузки
bulkUploadSuppliers();