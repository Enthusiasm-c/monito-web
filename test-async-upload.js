const fs = require('fs');
const path = require('path');

async function testAsyncUpload() {
  try {
    console.log('🧪 ТЕСТ ASYNC-UPLOAD ДЛЯ СОХРАНЕНИЯ В БД');
    console.log('=' .repeat(60));
    
    // Выбрать небольшой PDF файл для теста
    const testFile = 'Cheese work  04_07.pdf';
    const supplierFolderPath = '/Users/denisdomashenko/Downloads/ SUPPLIER JULY 2025';
    const filePath = path.join(supplierFolderPath, testFile);
    
    if (!fs.existsSync(filePath)) {
      console.log(`❌ Тестовый файл не найден: ${testFile}`);
      return;
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    const fileSize = Math.round(fileBuffer.length / 1024);
    
    console.log(`📁 Тестовый файл: ${testFile}`);
    console.log(`📊 Размер: ${fileSize}KB`);
    console.log(`🏢 Поставщик: Cheese Work`);
    
    // Выполнить тестовую загрузку через async-upload
    console.log('\n🔍 Выполнение загрузки через async-upload...');
    
    const fetch = (await import('node-fetch')).default;
    const FormData = require('form-data');
    
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename: testFile,
      contentType: 'application/pdf'
    });
    form.append('autoApprove', 'true');
    form.append('batchSize', '50');
    
    const startTime = Date.now();
    
    try {
      const uploadResponse = await fetch('http://localhost:3000/api/async-upload', {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
        timeout: 180000 // 3 минуты
      });
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      console.log(`⏱️ Время запроса: ${Math.round(processingTime/1000)}s`);
      console.log(`📊 HTTP статус: ${uploadResponse.status}`);
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.log(`❌ Ошибка загрузки: ${errorText}`);
        return;
      }
      
      const result = await uploadResponse.json();
      console.log('✅ Async загрузка выполнена успешно');
      console.log(`   🆔 Upload ID: ${result.uploadId || 'N/A'}`);
      console.log(`   📊 Статус: ${result.status || 'N/A'}`);
      console.log(`   💬 Сообщение: ${result.message || 'N/A'}`);
      
      // Ждем некоторое время для обработки
      console.log('\n⏳ Ожидание обработки (30 секунд)...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      // Проверить, появились ли данные в БД
      console.log('\n🔍 Проверка данных в БД...');
      
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_h6GaENYK1qSs@ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
          }
        }
      });
      
      // Найти загрузку по ID
      if (result.uploadId) {
        const upload = await prisma.upload.findUnique({
          where: { id: result.uploadId },
          include: {
            supplier: true,
            _count: {
              select: {
                prices: true
              }
            }
          }
        });
        
        if (upload) {
          console.log(`✅ Загрузка найдена в БД:`);
          console.log(`   📁 Файл: ${upload.originalName || upload.fileName}`);
          console.log(`   🏢 Поставщик: ${upload.supplier.name}`);
          console.log(`   📊 Статус: ${upload.status}`);
          console.log(`   📦 Товаров: ${upload._count.prices}`);
          console.log(`   📅 Создано: ${upload.createdAt.toLocaleString()}`);
          console.log(`   ⏱️ Время обработки: ${upload.processingTimeMs}ms`);
          
          if (upload.errorMessage) {
            console.log(`   ⚠️ Проблемы: ${upload.errorMessage.substring(0, 200)}...`);
          }
        } else {
          console.log(`❌ Загрузка с ID ${result.uploadId} не найдена в БД`);
        }
      }
      
      // Найти последние загрузки
      const recentUploads = await prisma.upload.findMany({
        where: {
          createdAt: {
            gte: new Date(startTime)
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
      
      console.log(`\n📊 Всего новых загрузок с ${new Date(startTime).toLocaleTimeString()}: ${recentUploads.length}`);
      
      recentUploads.forEach((upload, index) => {
        console.log(`${index + 1}. ${upload.originalName || upload.fileName} (${upload.supplier.name})`);
        console.log(`   📦 ${upload._count.prices} товаров | 📊 ${upload.status}`);
      });
      
      await prisma.$disconnect();
      
      return {
        success: true,
        uploadId: result.uploadId,
        processingTime,
        savedToDatabase: recentUploads.length > 0
      };
      
    } catch (error) {
      console.log(`❌ Ошибка при загрузке: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
    
  } catch (error) {
    console.error('❌ Критическая ошибка теста:', error.message);
  }
}

testAsyncUpload();