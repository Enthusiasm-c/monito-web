const fs = require('fs');
const path = require('path');

// Путь к папке с файлами поставщиков
const supplierFolderPath = '/Users/denisdomashenko/Downloads/ SUPPLIER JULY 2025';

// Уже загруженные файлы (из предыдущего теста)
const alreadyUploaded = [
  '0z britts 1 04_07.pdf',
  'AF Seafood 03_07.pdf', 
  'Bali diary 05_07 .pdf',
  'Benoa fish market 03_07.pdf'
];

// Поддерживаемые форматы файлов
const supportedExtensions = ['.pdf', '.xlsx', '.xls', '.csv', '.jpg', '.jpeg', '.png'];

// Результаты загрузки
const uploadResults = {
  total: 0,
  successful: 0,
  failed: 0,
  skipped: 0,
  suppliers: {},
  errors: [],
  timeline: []
};

async function bulkUploadRemainingFiles() {
  try {
    console.log('🏢 МАССОВАЯ ЗАГРУЗКА ОСТАВШИХСЯ ФАЙЛОВ ПОСТАВЩИКОВ');
    console.log('=' .repeat(70));
    console.log(`📁 Папка: ${supplierFolderPath}`);
    
    // Получить список файлов
    const files = fs.readdirSync(supplierFolderPath);
    const supportedFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return supportedExtensions.includes(ext);
    });
    
    // Отфильтровать уже загруженные файлы
    const remainingFiles = supportedFiles.filter(file => !alreadyUploaded.includes(file));
    
    console.log(`📋 Всего поддерживаемых файлов: ${supportedFiles.length}`);
    console.log(`✅ Уже загружено: ${alreadyUploaded.length}`);
    console.log(`📥 К загрузке: ${remainingFiles.length}`);
    
    if (remainingFiles.length === 0) {
      console.log('✨ Все файлы уже загружены!');
      return;
    }
    
    // Сортировать файлы: сначала Excel, потом PDF (Excel быстрее)
    const excelFiles = remainingFiles.filter(f => f.toLowerCase().endsWith('.xlsx') || f.toLowerCase().endsWith('.xls'));
    const pdfFiles = remainingFiles.filter(f => f.toLowerCase().endsWith('.pdf'));
    const imageFiles = remainingFiles.filter(f => f.toLowerCase().match(/\.(jpg|jpeg|png)$/));
    const docxFiles = remainingFiles.filter(f => f.toLowerCase().endsWith('.docx'));
    
    const sortedFiles = [...excelFiles, ...imageFiles, ...docxFiles, ...pdfFiles];
    
    console.log('\n📋 ПЛАН ЗАГРУЗКИ:');
    console.log(`📊 Excel файлы: ${excelFiles.length}`);
    console.log(`🖼️ Изображения: ${imageFiles.length}`);  
    console.log(`📝 DOCX файлы: ${docxFiles.length}`);
    console.log(`📄 PDF файлы: ${pdfFiles.length}`);
    
    console.log('\n🚀 НАЧИНАЕМ ЗАГРУЗКУ...\n');
    uploadResults.total = sortedFiles.length;
    
    const startTime = Date.now();
    
    // Загружать файлы по одному
    for (let i = 0; i < sortedFiles.length; i++) {
      const file = sortedFiles[i];
      const supplierName = extractSupplierName(file);
      const fileType = getFileType(file);
      
      console.log(`📄 [${i+1}/${sortedFiles.length}] ${file}`);
      console.log(`🏢 Поставщик: ${supplierName}`);
      console.log(`📋 Тип: ${fileType}`);
      
      try {
        const result = await uploadSingleFile(file, supplierName);
        
        uploadResults.timeline.push({
          file,
          supplier: supplierName,
          type: fileType,
          timestamp: new Date().toISOString(),
          ...result
        });
        
        if (result.success) {
          uploadResults.successful++;
          
          if (!uploadResults.suppliers[supplierName]) {
            uploadResults.suppliers[supplierName] = {
              files: 0,
              products: 0,
              avgTime: 0,
              times: [],
              types: []
            };
          }
          
          uploadResults.suppliers[supplierName].files++;
          uploadResults.suppliers[supplierName].products += result.productsCount;
          uploadResults.suppliers[supplierName].times.push(result.processingTime);
          uploadResults.suppliers[supplierName].types.push(fileType);
          uploadResults.suppliers[supplierName].avgTime = Math.round(
            uploadResults.suppliers[supplierName].times.reduce((a, b) => a + b, 0) / 
            uploadResults.suppliers[supplierName].times.length
          );
          
          console.log(`   ✅ Успешно: ${result.productsCount} товаров за ${Math.round(result.processingTime/1000)}s`);
        } else {
          uploadResults.failed++;
          uploadResults.errors.push({
            file,
            supplier: supplierName,
            type: fileType,
            error: result.error
          });
          console.log(`   ❌ Ошибка: ${result.error}`);
        }
        
      } catch (error) {
        uploadResults.failed++;
        uploadResults.errors.push({
          file,
          supplier: supplierName,
          type: fileType,
          error: error.message
        });
        console.log(`   ❌ Исключение: ${error.message}`);
      }
      
      // Показать прогресс
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const remaining = sortedFiles.length - (i + 1);
      const avgTimePerFile = elapsed / (i + 1);
      const estimatedRemaining = Math.round(remaining * avgTimePerFile);
      
      console.log(`   ⏱️ Прошло: ${elapsed}s | Осталось: ~${estimatedRemaining}s | Файлов: ${remaining}`);
      
      // Пауза между загрузками (короче для Excel, дольше для PDF)
      const pauseTime = fileType === 'Excel' ? 1000 : 3000;
      console.log(`   ⏳ Пауза ${pauseTime/1000}s...\n`);
      await sleep(pauseTime);
    }
    
    // Итоговый отчет
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    generateFinalReport(totalTime);
    
    return uploadResults;
    
  } catch (error) {
    console.error('❌ Критическая ошибка загрузки:', error.message);
  }
}

function generateFinalReport(totalTime) {
  console.log('\n🎯 ИТОГОВЫЙ ОТЧЕТ МАССОВОЙ ЗАГРУЗКИ');
  console.log('=' .repeat(70));
  console.log(`⏱️ Общее время: ${Math.floor(totalTime/60)}м ${totalTime%60}с`);
  console.log(`📊 Всего файлов: ${uploadResults.total}`);
  console.log(`✅ Успешно: ${uploadResults.successful}`);
  console.log(`❌ Неудачно: ${uploadResults.failed}`);
  console.log(`📈 Процент успеха: ${Math.round((uploadResults.successful / uploadResults.total) * 100)}%`);
  
  // Статистика по типам файлов
  const typeStats = {};
  uploadResults.timeline.forEach(entry => {
    if (!typeStats[entry.type]) {
      typeStats[entry.type] = { count: 0, successful: 0, totalProducts: 0, totalTime: 0 };
    }
    typeStats[entry.type].count++;
    if (entry.success) {
      typeStats[entry.type].successful++;
      typeStats[entry.type].totalProducts += entry.productsCount || 0;
      typeStats[entry.type].totalTime += entry.processingTime || 0;
    }
  });
  
  console.log('\n📋 СТАТИСТИКА ПО ТИПАМ ФАЙЛОВ:');
  Object.entries(typeStats).forEach(([type, stats]) => {
    const avgTime = stats.successful > 0 ? Math.round(stats.totalTime / stats.successful / 1000) : 0;
    const avgProducts = stats.successful > 0 ? Math.round(stats.totalProducts / stats.successful) : 0;
    console.log(`${type}: ${stats.successful}/${stats.count} файлов, ~${avgTime}s, ~${avgProducts} товаров`);
  });
  
  console.log('\n🏢 СТАТИСТИКА ПО ПОСТАВЩИКАМ:');
  const sortedSuppliers = Object.entries(uploadResults.suppliers)
    .sort(([,a], [,b]) => b.products - a.products);
  
  sortedSuppliers.slice(0, 10).forEach(([supplier, stats]) => {
    console.log(`📊 ${supplier}:`);
    console.log(`   📁 Файлов: ${stats.files} | 📦 Товаров: ${stats.products} | ⏱️ ${stats.avgTime}ms`);
    console.log(`   📋 Типы: ${[...new Set(stats.types)].join(', ')}`);
  });
  
  if (uploadResults.failed > 0) {
    console.log('\n❌ ОШИБКИ:');
    uploadResults.errors.forEach(error => {
      console.log(`   ${error.file} (${error.supplier}, ${error.type}): ${error.error}`);
    });
  }
  
  // Сохранить детальный отчет
  const reportFile = `bulk-supplier-upload-report-${Date.now()}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(uploadResults, null, 2));
  console.log(`\n💾 Детальный отчет сохранен: ${reportFile}`);
  
  // Создать краткую сводку
  const summary = {
    timestamp: new Date().toISOString(),
    totalFiles: uploadResults.total,
    successful: uploadResults.successful,
    failed: uploadResults.failed,
    successRate: Math.round((uploadResults.successful / uploadResults.total) * 100),
    totalProcessingTime: totalTime,
    totalProductsExtracted: Object.values(uploadResults.suppliers).reduce((sum, s) => sum + s.products, 0),
    newSuppliersCreated: Object.keys(uploadResults.suppliers).length,
    typeBreakdown: typeStats
  };
  
  fs.writeFileSync('bulk-upload-summary.json', JSON.stringify(summary, null, 2));
  console.log(`📋 Краткая сводка: bulk-upload-summary.json`);
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
      timeout: 180000 // 3 минуты
    });
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText.substring(0, 100)}...`,
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
  let name = fileName.replace(/\.(pdf|xlsx|xls|csv|jpg|jpeg|png|docx)$/i, '');
  name = name.replace(/\s+\d{2}_\d{2}.*$/, '');
  name = name.replace(/\s+\d+$/, '');
  name = name.trim()
    .replace(/\s+/g, ' ')
    .replace(/^(PT\.?|CV)\s*/i, '')
    .replace(/\+/g, ' ')
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return name;
}

function getFileType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (['.xlsx', '.xls'].includes(ext)) return 'Excel';
  if (ext === '.pdf') return 'PDF';
  if (['.jpg', '.jpeg', '.png'].includes(ext)) return 'Image';
  if (ext === '.docx') return 'DOCX';
  if (ext === '.csv') return 'CSV';
  return 'Unknown';
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
bulkUploadRemainingFiles();