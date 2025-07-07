const fs = require('fs');
const path = require('path');

// Путь к папке с файлами поставщиков
const supplierFolderPath = '/Users/denisdomashenko/Downloads/ SUPPLIER JULY 2025';

// Поддерживаемые форматы файлов
const supportedExtensions = ['.pdf', '.xlsx', '.xls', '.csv', '.jpg', '.jpeg', '.png'];

// Результаты загрузки
const uploadResults = {
  total: 0,
  successful: 0,
  failed: 0,
  suppliers: {},
  errors: [],
  uploadIds: []
};

async function bulkAsyncUpload() {
  try {
    console.log('🏢 МАССОВАЯ ASYNC ЗАГРУЗКА ПОСТАВЩИКОВ JULY 2025');
    console.log('=' .repeat(70));
    console.log(`📁 Папка: ${supplierFolderPath}`);
    
    // Получить список файлов
    const files = fs.readdirSync(supplierFolderPath);
    const supportedFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return supportedExtensions.includes(ext);
    });
    
    console.log(`📋 Найдено поддерживаемых файлов: ${supportedFiles.length}`);
    
    if (supportedFiles.length === 0) {
      console.log('❌ Нет поддерживаемых файлов для загрузки');
      return;
    }
    
    // Сортировать файлы: сначала маленькие PDF, потом Excel, потом изображения
    const pdfFiles = supportedFiles.filter(f => f.toLowerCase().endsWith('.pdf'));
    const excelFiles = supportedFiles.filter(f => f.toLowerCase().endsWith('.xlsx') || f.toLowerCase().endsWith('.xls'));
    const imageFiles = supportedFiles.filter(f => f.toLowerCase().match(/\.(jpg|jpeg|png)$/));
    
    // Отсортировать PDF по размеру (маленькие сначала)
    const sortedPdfFiles = pdfFiles.map(file => {
      const filePath = path.join(supplierFolderPath, file);
      const size = fs.statSync(filePath).size;
      return { file, size };
    }).sort((a, b) => a.size - b.size).map(item => item.file);
    
    const sortedFiles = [...excelFiles, ...imageFiles, ...sortedPdfFiles];
    
    console.log('\n📋 ПЛАН ЗАГРУЗКИ:');
    console.log(`📊 Excel файлы: ${excelFiles.length}`);
    console.log(`🖼️ Изображения: ${imageFiles.length}`);  
    console.log(`📄 PDF файлы: ${sortedPdfFiles.length} (отсортированы по размеру)`);
    
    // Показать размеры файлов
    console.log('\n📏 РАЗМЕРЫ PDF ФАЙЛОВ:');
    sortedPdfFiles.slice(0, 10).forEach(file => {
      const filePath = path.join(supplierFolderPath, file);
      const sizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(1);
      console.log(`   ${file}: ${sizeMB}MB`);
    });
    
    console.log('\n🚀 НАЧИНАЕМ ЗАГРУЗКУ...\n');
    uploadResults.total = sortedFiles.length;
    
    const startTime = Date.now();
    
    // Загружать файлы по одному
    for (let i = 0; i < sortedFiles.length; i++) {
      const file = sortedFiles[i];
      const supplierName = extractSupplierName(file);
      const fileType = getFileType(file);
      const filePath = path.join(supplierFolderPath, file);
      const fileSizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(1);
      
      console.log(`📄 [${i+1}/${sortedFiles.length}] ${file}`);
      console.log(`🏢 Поставщик: ${supplierName}`);
      console.log(`📋 Тип: ${fileType} | 📏 Размер: ${fileSizeMB}MB`);
      
      // Пропустить файлы больше 10MB (лимит API)
      if (fs.statSync(filePath).size > 10 * 1024 * 1024) {
        console.log(`   ⚠️ Файл больше 10MB - пропускаем`);
        uploadResults.failed++;
        uploadResults.errors.push({
          file,
          supplier: supplierName,
          type: fileType,
          error: 'File size exceeds 10MB limit'
        });
        continue;
      }
      
      try {
        const result = await uploadSingleFileAsync(file, supplierName);
        
        if (result.success) {
          uploadResults.successful++;
          uploadResults.uploadIds.push(result.uploadId);
          
          if (!uploadResults.suppliers[supplierName]) {
            uploadResults.suppliers[supplierName] = {
              files: 0,
              uploadIds: [],
              types: []
            };
          }
          
          uploadResults.suppliers[supplierName].files++;
          uploadResults.suppliers[supplierName].uploadIds.push(result.uploadId);
          uploadResults.suppliers[supplierName].types.push(fileType);
          
          console.log(`   ✅ Успешно загружено: ID ${result.uploadId}`);
          console.log(`   📊 Статус: ${result.status || 'pending'}`);
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
      
      // Пауза между загрузками
      const pauseTime = fileType === 'Excel' ? 2000 : 3000;
      console.log(`   ⏳ Пауза ${pauseTime/1000}s...\n`);
      await sleep(pauseTime);
    }
    
    // Итоговый отчет загрузки
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    console.log('\n🎯 ИТОГОВЫЙ ОТЧЕТ ЗАГРУЗКИ');
    console.log('=' .repeat(70));
    console.log(`⏱️ Общее время: ${Math.floor(totalTime/60)}м ${totalTime%60}с`);
    console.log(`📊 Всего файлов: ${uploadResults.total}`);
    console.log(`✅ Успешно: ${uploadResults.successful}`);
    console.log(`❌ Неудачно: ${uploadResults.failed}`);
    console.log(`📈 Процент успеха: ${Math.round((uploadResults.successful / uploadResults.total) * 100)}%`);
    console.log(`🆔 Upload IDs создано: ${uploadResults.uploadIds.length}`);
    
    console.log('\n🏢 СТАТИСТИКА ПО ПОСТАВЩИКАМ:');
    Object.entries(uploadResults.suppliers).forEach(([supplier, stats]) => {
      console.log(`📊 ${supplier}:`);
      console.log(`   📁 Файлов: ${stats.files}`);
      console.log(`   🆔 IDs: ${stats.uploadIds.join(', ')}`);
      console.log(`   📋 Типы: ${[...new Set(stats.types)].join(', ')}`);
    });
    
    if (uploadResults.failed > 0) {
      console.log('\n❌ ОШИБКИ:');
      uploadResults.errors.forEach(error => {
        console.log(`   ${error.file} (${error.supplier}, ${error.type}): ${error.error}`);
      });
    }
    
    // Ожидание обработки
    console.log('\n⏳ ОЖИДАНИЕ ОБРАБОТКИ ЗАГРУЗОК (60 секунд)...');
    await sleep(60000);
    
    // Проверить результаты в БД
    await checkDatabaseResults();
    
    // Сохранить отчет
    const reportFile = `bulk-async-upload-report-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(uploadResults, null, 2));
    console.log(`\n💾 Отчет сохранен: ${reportFile}`);
    
    return uploadResults;
    
  } catch (error) {
    console.error('❌ Критическая ошибка загрузки:', error.message);
  }
}

async function uploadSingleFileAsync(fileName, supplierName) {
  try {
    const filePath = path.join(supplierFolderPath, fileName);
    const fileBuffer = fs.readFileSync(filePath);
    
    const fetch = (await import('node-fetch')).default;
    const FormData = require('form-data');
    
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename: fileName,
      contentType: getMimeType(fileName)
    });
    form.append('autoApprove', 'true');
    form.append('batchSize', '50');
    
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/async-upload', {
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
        error: `HTTP ${response.status}: ${errorText.substring(0, 100)}...`,
        processingTime
      };
    }
    
    const result = await response.json();
    
    return {
      success: true,
      processingTime,
      uploadId: result.uploadId,
      status: result.status,
      message: result.message
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      processingTime: 0
    };
  }
}

async function checkDatabaseResults() {
  try {
    console.log('\n🔍 ПРОВЕРКА РЕЗУЛЬТАТОВ В БД...');
    
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_h6GaENYK1qSs@ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
        }
      }
    });
    
    // Найти загрузки по ID
    const foundUploads = await prisma.upload.findMany({
      where: {
        id: {
          in: uploadResults.uploadIds
        }
      },
      include: {
        supplier: true,
        _count: {
          select: {
            prices: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`📊 Найдено в БД: ${foundUploads.length}/${uploadResults.uploadIds.length} загрузок`);
    
    let totalProductsFound = 0;
    const statusCounts = {};
    
    foundUploads.forEach((upload, index) => {
      console.log(`${index + 1}. ${upload.originalName || upload.fileName} (${upload.supplier.name})`);
      console.log(`   📊 Статус: ${upload.status} | 📦 Товаров: ${upload._count.prices}`);
      console.log(`   🆔 ID: ${upload.id}`);
      
      totalProductsFound += upload._count.prices;
      statusCounts[upload.status] = (statusCounts[upload.status] || 0) + 1;
      
      if (upload.errorMessage) {
        console.log(`   ⚠️ Ошибки: ${upload.errorMessage.substring(0, 100)}...`);
      }
    });
    
    console.log(`\n📈 ИТОГИ ОБРАБОТКИ:`);
    console.log(`📦 Всего товаров извлечено: ${totalProductsFound}`);
    console.log(`📊 Статусы загрузок:`);
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} загрузок`);
    });
    
    await prisma.$disconnect();
    
    return {
      foundUploads: foundUploads.length,
      totalProducts: totalProductsFound,
      statusCounts
    };
    
  } catch (error) {
    console.error('❌ Ошибка проверки БД:', error.message);
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
bulkAsyncUpload();