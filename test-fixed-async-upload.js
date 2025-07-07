const fs = require('fs');
const path = require('path');

async function testFixedAsyncUpload() {
  try {
    console.log('🧪 ТЕСТ ИСПРАВЛЕННОГО ASYNC-UPLOAD');
    console.log('=' .repeat(60));
    
    // Тестировать несколько разных файлов для проверки поставщиков
    const testFiles = [
      'AF Seafood 03_07.pdf', // Новый поставщик
      'PT.Bali boga sejati 03_07.pdf', // Должен маппиться к Bali Boga
      'SAI FRESH 03_07.pdf' // Должен маппиться к Sai Fresh
    ];
    
    const supplierFolderPath = '/Users/denisdomashenko/Downloads/ SUPPLIER JULY 2025';
    const results = [];
    
    for (const testFile of testFiles) {
      const filePath = path.join(supplierFolderPath, testFile);
      
      if (!fs.existsSync(filePath)) {
        console.log(`❌ Файл не найден: ${testFile}`);
        continue;
      }
      
      const fileBuffer = fs.readFileSync(filePath);
      const fileSize = Math.round(fileBuffer.length / 1024);
      
      console.log(`\n📁 Тестирование: ${testFile}`);
      console.log(`📊 Размер: ${fileSize}KB`);
      
      try {
        const fetch = (await import('node-fetch')).default;
        const FormData = require('form-data');
        
        const form = new FormData();
        form.append('file', fileBuffer, {
          filename: testFile,
          contentType: 'application/pdf'
        });
        form.append('autoApprove', 'true');
        form.append('batchSize', '50');
        // Не передаем supplierName, чтобы тестировать извлечение из имени файла
        
        const startTime = Date.now();
        
        const uploadResponse = await fetch('http://localhost:3000/api/async-upload', {
          method: 'POST',
          body: form,
          headers: form.getHeaders(),
          timeout: 120000
        });
        
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        
        console.log(`⏱️ Время запроса: ${Math.round(processingTime/1000)}s`);
        console.log(`📊 HTTP статус: ${uploadResponse.status}`);
        
        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.log(`❌ Ошибка: ${errorText}`);
          results.push({
            file: testFile,
            success: false,
            error: errorText
          });
          continue;
        }
        
        const result = await uploadResponse.json();
        console.log(`✅ Загрузка успешна`);
        console.log(`   🆔 Upload ID: ${result.uploadId}`);
        console.log(`   📊 Статус: ${result.status}`);
        
        results.push({
          file: testFile,
          success: true,
          uploadId: result.uploadId,
          status: result.status,
          processingTime
        });
        
      } catch (error) {
        console.log(`❌ Ошибка загрузки: ${error.message}`);
        results.push({
          file: testFile,
          success: false,
          error: error.message
        });
      }
      
      // Пауза между тестами
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Проверить результаты в БД
    console.log('\n🔍 ПРОВЕРКА РЕЗУЛЬТАТОВ В БАЗЕ ДАННЫХ...');
    
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_h6GaENYK1qSs@ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
        }
      }
    });
    
    const uploadIds = results.filter(r => r.success).map(r => r.uploadId);
    
    if (uploadIds.length > 0) {
      const uploads = await prisma.upload.findMany({
        where: {
          id: {
            in: uploadIds
          }
        },
        include: {
          supplier: true,
          _count: {
            select: {
              prices: true
            }
          }
        }
      });
      
      console.log(`\n📊 Найдено в БД: ${uploads.length} загрузок`);
      
      uploads.forEach((upload, index) => {
        console.log(`\n${index + 1}. ${upload.originalName || upload.fileName}`);
        console.log(`   🏢 Поставщик: ${upload.supplier.name} (${upload.supplier.id})`);
        console.log(`   📊 Статус: ${upload.status}`);
        console.log(`   📦 Товаров: ${upload._count.prices}`);
        console.log(`   📅 Создано: ${upload.createdAt.toLocaleString()}`);
        
        // Проверить правильность маппинга поставщика
        const expectedMappings = {
          'AF Seafood 03_07.pdf': ['Af Seafood', 'AF Seafood'],
          'PT.Bali boga sejati 03_07.pdf': ['Bali Boga', 'Bali Boga Sejati'],
          'SAI FRESH 03_07.pdf': ['Sai Fresh', 'SAI FRESH']
        };
        
        const expected = expectedMappings[upload.originalName || upload.fileName];
        if (expected && expected.some(name => upload.supplier.name.includes(name))) {
          console.log(`   ✅ Поставщик корректно определен`);
        } else if (upload.supplier.name === 'Temporary Processing') {
          console.log(`   ⚠️ Поставщик не определен - попал в Temporary Processing`);
        } else {
          console.log(`   🆕 Создан новый поставщик`);
        }
      });
      
      // Проверить новых поставщиков
      const newSuppliers = await prisma.supplier.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 10 * 60 * 1000) // Последние 10 минут
          }
        }
      });
      
      if (newSuppliers.length > 0) {
        console.log(`\n🆕 НОВЫЕ ПОСТАВЩИКИ (последние 10 минут):`);
        newSuppliers.forEach((supplier, index) => {
          console.log(`${index + 1}. ${supplier.name} (${supplier.id})`);
          console.log(`   📧 Email: ${supplier.email}`);
          console.log(`   📅 Создан: ${supplier.createdAt.toLocaleString()}`);
        });
      }
    }
    
    await prisma.$disconnect();
    
    // Итоги
    console.log(`\n🎯 ИТОГИ ТЕСТИРОВАНИЯ:`);
    console.log(`📊 Файлов протестировано: ${results.length}`);
    console.log(`✅ Успешно: ${results.filter(r => r.success).length}`);
    console.log(`❌ Неудачно: ${results.filter(r => !r.success).length}`);
    
    return results;
    
  } catch (error) {
    console.error('❌ Критическая ошибка теста:', error.message);
  }
}

testFixedAsyncUpload();