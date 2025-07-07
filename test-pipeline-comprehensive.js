const fs = require('fs');
const path = require('path');

// Список поддерживаемых форматов
const supportedFormats = [
  {
    name: 'PDF',
    type: 'application/pdf',
    extensions: ['.pdf'],
    testFiles: [
      '/Users/denisdomashenko/monito-web/test-pdf-1.pdf',
      '/Users/denisdomashenko/monito-web/test-pdf-2.pdf'
    ]
  },
  {
    name: 'Excel XLSX',
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensions: ['.xlsx'],
    testFiles: [
      '/Users/denisdomashenko/Downloads/Widi Wiguna 03_07.xlsx',
      '/Users/denisdomashenko/monito-web/test-excel-1.xlsx',
      '/Users/denisdomashenko/monito-web/test-excel-2.xlsx'
    ]
  },
  {
    name: 'Excel XLS',
    type: 'application/vnd.ms-excel',
    extensions: ['.xls'],
    testFiles: []
  },
  {
    name: 'CSV',
    type: 'text/csv',
    extensions: ['.csv'],
    testFiles: []
  },
  {
    name: 'JPEG',
    type: 'image/jpeg',
    extensions: ['.jpg', '.jpeg'],
    testFiles: []
  },
  {
    name: 'PNG',
    type: 'image/png',
    extensions: ['.png'],
    testFiles: []
  }
];

async function testPipelineComprehensive() {
  try {
    console.log('🔍 КОМПЛЕКСНОЕ ТЕСТИРОВАНИЕ PIPELINE ОБРАБОТКИ ФАЙЛОВ');
    console.log('=' .repeat(60));
    
    const results = {
      totalTests: 0,
      successful: 0,
      failed: 0,
      formats: {},
      performance: {}
    };
    
    for (const format of supportedFormats) {
      console.log(`\n📋 Тестирование формата: ${format.name}`);
      console.log('-'.repeat(40));
      
      // Найти доступные файлы для тестирования
      const availableFiles = format.testFiles.filter(file => {
        if (fs.existsSync(file)) {
          console.log(`✅ Найден тестовый файл: ${path.basename(file)}`);
          return true;
        }
        return false;
      });
      
      if (availableFiles.length === 0) {
        console.log(`⚠️ Нет доступных файлов для тестирования ${format.name}`);
        results.formats[format.name] = {
          status: 'skipped',
          reason: 'no_test_files',
          files: 0,
          avgTime: 0,
          avgProducts: 0
        };
        continue;
      }
      
      const formatResults = {
        files: availableFiles.length,
        successful: 0,
        failed: 0,
        times: [],
        products: [],
        errors: []
      };
      
      for (const filePath of availableFiles) {
        const fileName = path.basename(filePath);
        console.log(`\n🧪 Тестирование: ${fileName}`);
        
        try {
          const fileBuffer = fs.readFileSync(filePath);
          const fileSize = Math.round(fileBuffer.length / 1024);
          console.log(`   📁 Размер: ${fileSize}KB`);
          
          const testResult = await testSingleFile(filePath, format.type);
          
          if (testResult.success) {
            formatResults.successful++;
            formatResults.times.push(testResult.processingTime);
            formatResults.products.push(testResult.productsCount);
            
            console.log(`   ✅ Успешно: ${testResult.productsCount} товаров за ${testResult.processingTime}ms`);
          } else {
            formatResults.failed++;
            formatResults.errors.push({
              file: fileName,
              error: testResult.error
            });
            console.log(`   ❌ Ошибка: ${testResult.error}`);
          }
          
          results.totalTests++;
          
        } catch (error) {
          formatResults.failed++;
          formatResults.errors.push({
            file: fileName,
            error: error.message
          });
          console.log(`   ❌ Ошибка чтения файла: ${error.message}`);
        }
        
        // Пауза между тестами
        await sleep(1000);
      }
      
      // Подсчет статистики для формата
      const avgTime = formatResults.times.length > 0 
        ? Math.round(formatResults.times.reduce((a, b) => a + b, 0) / formatResults.times.length)
        : 0;
        
      const avgProducts = formatResults.products.length > 0
        ? Math.round(formatResults.products.reduce((a, b) => a + b, 0) / formatResults.products.length)
        : 0;
      
      results.formats[format.name] = {
        status: formatResults.successful > 0 ? 'working' : 'failed',
        files: formatResults.files,
        successful: formatResults.successful,
        failed: formatResults.failed,
        avgTime,
        avgProducts,
        errors: formatResults.errors
      };
      
      results.successful += formatResults.successful;
      results.failed += formatResults.failed;
      
      console.log(`📊 Статистика ${format.name}:`);
      console.log(`   Успешно: ${formatResults.successful}/${formatResults.files}`);
      console.log(`   Среднее время: ${avgTime}ms`);
      console.log(`   Средние товары: ${avgProducts}`);
    }
    
    // Итоговый отчет
    console.log('\n🎯 ИТОГОВЫЙ ОТЧЕТ PIPELINE');
    console.log('=' .repeat(50));
    console.log(`Всего тестов: ${results.totalTests}`);
    console.log(`Успешно: ${results.successful}`);
    console.log(`Неудачно: ${results.failed}`);
    console.log(`Процент успеха: ${Math.round((results.successful / results.totalTests) * 100)}%`);
    
    console.log('\n📋 ПОДДЕРЖКА ФОРМАТОВ:');
    for (const [formatName, data] of Object.entries(results.formats)) {
      const statusIcon = data.status === 'working' ? '✅' : 
                        data.status === 'skipped' ? '⚠️' : '❌';
      console.log(`${statusIcon} ${formatName}: ${data.status} (${data.successful}/${data.files} файлов, ~${data.avgTime}ms, ~${data.avgProducts} товаров)`);
    }
    
    if (results.failed > 0) {
      console.log('\n❌ ОШИБКИ:');
      for (const [formatName, data] of Object.entries(results.formats)) {
        if (data.errors && data.errors.length > 0) {
          console.log(`${formatName}:`);
          data.errors.forEach(error => {
            console.log(`  - ${error.file}: ${error.error}`);
          });
        }
      }
    }
    
    // Сохранить отчет
    const reportFile = `pipeline-test-report-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
    console.log(`\n💾 Отчет сохранен: ${reportFile}`);
    
    return results;
    
  } catch (error) {
    console.error('❌ Ошибка комплексного тестирования:', error.message);
  }
}

async function testSingleFile(filePath, mimeType) {
  try {
    const fileName = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);
    
    const fetch = (await import('node-fetch')).default;
    const FormData = require('form-data');
    
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename: fileName,
      contentType: mimeType
    });
    
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/upload-unified', {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
      timeout: 30000 // 30 секунд
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Запуск тестирования
testPipelineComprehensive();