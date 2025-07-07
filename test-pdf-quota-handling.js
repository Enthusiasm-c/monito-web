const fs = require('fs');
const path = require('path');

async function testPdfQuotaHandling() {
  try {
    console.log('🧪 ТЕСТ ОБРАБОТКИ QUOTA EXHAUSTION В PDF');
    console.log('=' .repeat(60));
    
    // Тестировать небольшой PDF файл для проверки обработки квоты
    const testFile = 'Cheese work  04_07.pdf';
    const supplierFolderPath = '/Users/denisdomashenko/Downloads/ SUPPLIER JULY 2025';
    const filePath = path.join(supplierFolderPath, testFile);
    
    if (!fs.existsSync(filePath)) {
      console.log(`❌ Файл не найден: ${testFile}`);
      return;
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    const fileSize = Math.round(fileBuffer.length / 1024);
    
    console.log(`📁 Тестирование: ${testFile}`);
    console.log(`📊 Размер: ${fileSize}KB`);
    
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
    
    console.log('\n🔍 Загружаем файл через async-upload...');
    
    const uploadResponse = await fetch('http://localhost:3000/api/async-upload', {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
      timeout: 120000
    });
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log(`⏱️ Время загрузки: ${Math.round(processingTime/1000)}s`);
    console.log(`📊 HTTP статус: ${uploadResponse.status}`);
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.log(`❌ Ошибка загрузки: ${errorText}`);
      return;
    }
    
    const result = await uploadResponse.json();
    console.log(`✅ Загрузка выполнена`);
    console.log(`   🆔 Upload ID: ${result.uploadId}`);
    console.log(`   📊 Статус: ${result.status}`);
    
    // Проверить детали в БД
    console.log('\n🔍 Проверка деталей обработки в БД...');
    
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_h6GaENYK1qSs@ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
        }
      }
    });
    
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
      console.log(`\n📊 ДЕТАЛИ ЗАГРУЗКИ:`);
      console.log(`📁 Файл: ${upload.originalName}`);
      console.log(`🏢 Поставщик: ${upload.supplier.name}`);
      console.log(`📊 Статус: ${upload.status}`);
      console.log(`📦 Товаров: ${upload._count.prices}`);
      console.log(`⏱️ Время обработки: ${upload.processingTimeMs}ms`);
      
      if (upload.errorMessage) {
        console.log(`\n⚠️ СООБЩЕНИЯ ОБ ОШИБКАХ:`);
        const errorMsg = upload.errorMessage;
        
        // Проверить наличие информации о квоте
        if (errorMsg.includes('quota') || errorMsg.includes('exceeded') || errorMsg.includes('limit')) {
          console.log(`🚫 ОБНАРУЖЕНА ПРОБЛЕМА С КВОТОЙ:`);
          console.log(`   ${errorMsg.substring(0, 200)}...`);
          console.log(`\n💡 РЕКОМЕНДАЦИИ:`);
          console.log(`   1. Проверить план подписки Gemini API`);
          console.log(`   2. Обновить план до платного`);
          console.log(`   3. Попробовать снова позже`);
          console.log(`   4. Рассмотреть использование альтернативных моделей`);
        } else {
          console.log(`   Другие ошибки: ${errorMsg.substring(0, 200)}...`);
        }
      } else {
        console.log(`✅ Обработка завершена без ошибок`);
      }
      
      // Проверить детали обработки если есть
      if (upload.extractedData) {
        try {
          const extractedData = typeof upload.extractedData === 'string' 
            ? JSON.parse(upload.extractedData) 
            : upload.extractedData;
          
          console.log(`\n🔬 ДЕТАЛИ ИЗВЛЕЧЕНИЯ:`);
          if (extractedData.quotaExhausted) {
            console.log(`🚫 Квота исчерпана: ${extractedData.quotaErrorCount} ошибок`);
          }
          if (extractedData.extractionMethods) {
            const methods = extractedData.extractionMethods;
            console.log(`📸 Изображений создано: ${methods.step1_pdf_to_images?.images_created || 0}`);
            console.log(`🤖 Изображений обработано: ${methods.step2_gemini_flash_2_0?.images_processed || 0}`);
            console.log(`🚫 Quota ошибок: ${methods.step2_gemini_flash_2_0?.quota_errors || 0}`);
            if (methods.issues && methods.issues.length > 0) {
              console.log(`⚠️ Проблемы: ${methods.issues.join(', ')}`);
            }
          }
        } catch (e) {
          console.log(`⚠️ Не удалось разобрать данные извлечения`);
        }
      }
    }
    
    await prisma.$disconnect();
    
    console.log(`\n🎯 ВЫВОДЫ:`);
    if (upload._count.prices === 0) {
      console.log(`❌ Извлечено 0 товаров - скорее всего проблема с квотой API`);
      console.log(`💡 Решение: обновить план Gemini API или попробовать позже`);
    } else {
      console.log(`✅ Извлечено ${upload._count.prices} товаров - система работает`);
    }
    
    return {
      success: true,
      uploadId: result.uploadId,
      productsExtracted: upload._count.prices,
      quotaIssue: upload.errorMessage?.includes('quota') || false
    };
    
  } catch (error) {
    console.error('❌ Критическая ошибка теста:', error.message);
  }
}

testPdfQuotaHandling();