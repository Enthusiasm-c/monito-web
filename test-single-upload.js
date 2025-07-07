const fs = require('fs');
const path = require('path');

async function testSingleUpload() {
  try {
    console.log('🧪 ТЕСТ ОДИНОЧНОЙ ЗАГРУЗКИ ДЛЯ ДИАГНОСТИКИ');
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
    
    // Шаг 1: Проверить endpoint GET
    console.log('\n🔍 Шаг 1: Проверка GET endpoint...');
    const fetch = (await import('node-fetch')).default;
    
    try {
      const getResponse = await fetch('http://localhost:3000/api/upload-unified', {
        method: 'GET',
        timeout: 10000
      });
      
      if (getResponse.ok) {
        const getResult = await getResponse.json();
        console.log('✅ GET endpoint работает');
        console.log(`   📊 Статус: ${getResult.status}`);
        console.log(`   🔧 Сервис: ${getResult.service}`);
        console.log(`   📋 Поддерживаемые типы: ${getResult.supportedFileTypes?.length || 0}`);
      } else {
        console.log(`❌ GET endpoint ошибка: ${getResponse.status}`);
      }
    } catch (error) {
      console.log(`❌ GET endpoint недоступен: ${error.message}`);
      return;
    }
    
    // Шаг 2: Проверить подключение к базе данных
    console.log('\n🔍 Шаг 2: Проверка подключения к БД...');
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_h6GaENYK1qSs@ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
          }
        }
      });
      
      const supplierCount = await prisma.supplier.count();
      console.log(`✅ Подключение к БД работает`);
      console.log(`   🏢 Поставщиков в БД: ${supplierCount}`);
      await prisma.$disconnect();
    } catch (error) {
      console.log(`❌ Ошибка подключения к БД: ${error.message}`);
      return;
    }
    
    // Шаг 3: Выполнить тестовую загрузку
    console.log('\n🔍 Шаг 3: Выполнение тестовой загрузки...');
    
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename: testFile,
      contentType: 'application/pdf'
    });
    form.append('supplierName', 'Cheese Work');
    
    const startTime = Date.now();
    
    try {
      const uploadResponse = await fetch('http://localhost:3000/api/upload-unified', {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
        timeout: 120000 // 2 минуты
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
      console.log('✅ Загрузка выполнена успешно');
      console.log(`   📦 Товаров извлечено: ${result.stats?.productsExtracted || 0}`);
      console.log(`   ⏱️ Время обработки: ${result.stats?.processingTimeMs || 0}ms`);
      console.log(`   🔧 Стратегия: ${result.stats?.strategy}`);
      console.log(`   🤖 Модель: ${result.stats?.model}`);
      
      // Шаг 4: Проверить, появились ли данные в БД
      console.log('\n🔍 Шаг 4: Проверка данных в БД...');
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Ждем 2 секунды
      
      const prisma2 = new (require('@prisma/client')).PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_h6GaENYK1qSs@ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
          }
        }
      });
      
      // Найти последние загрузки
      const recentUploads = await prisma2.upload.findMany({
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
      
      if (recentUploads.length > 0) {
        console.log(`✅ Найдено ${recentUploads.length} новых загрузок в БД:`);
        recentUploads.forEach((upload, index) => {
          console.log(`   ${index + 1}. ${upload.originalName || upload.fileName}`);
          console.log(`      🏢 ${upload.supplier.name}`);
          console.log(`      📦 ${upload._count.prices} товаров`);
          console.log(`      📊 ${upload.status}`);
          console.log(`      📅 ${upload.createdAt.toLocaleString()}`);
        });
      } else {
        console.log('❌ Новых загрузок в БД не найдено');
        console.log('⚠️ Проблема: данные не сохраняются в удаленную БД');
      }
      
      await prisma2.$disconnect();
      
      return {
        success: true,
        processingTime,
        productsExtracted: result.stats?.productsExtracted || 0,
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

testSingleUpload();