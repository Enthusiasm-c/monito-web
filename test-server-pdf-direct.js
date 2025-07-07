#!/usr/bin/env node

/**
 * Прямое тестирование enhancedPdfExtractor на сервере
 * Использует правильный импорт для TypeScript
 */

const { spawn } = require('child_process');
const fs = require('fs');

async function testServerPdfDirect() {
  console.log('🧪 ПРЯМОЕ ТЕСТИРОВАНИЕ PDF→Images→Gemini Flash 2.0 НА СЕРВЕРЕ');
  console.log('===========================================================');
  console.log('');

  try {
    const fileUrl = 'https://cdc1w79ssc4kg6xh.public.blob.vercel-storage.com/Island%20Organics%20Bali-wfQOZrvhymEkhEcTw2UjMLYurMsyUC.pdf';
    const fileName = 'Island Organics Bali.pdf';

    console.log(`📁 Файл: ${fileName}`);
    console.log(`🔗 URL: ${fileUrl}`);
    console.log('');

    // Создаем правильный тестовый скрипт для сервера
    const testScript = `
// Тест enhancedPdfExtractor через прямой API вызов
import('../../app/services/enhancedPdfExtractor.js').then(async ({ enhancedPdfExtractor }) => {
  console.log('🔍 PDF extraction starting: ${fileName}');
  console.log('📄 URL: ${fileUrl}');
  console.log('');

  const startTime = Date.now();
  
  try {
    const result = await enhancedPdfExtractor.extractFromPdf(
      '${fileUrl}',
      '${fileName}'
    );
    
    const endTime = Date.now();
    const totalTimeMs = endTime - startTime;
    
    console.log('');
    console.log('📊 РЕЗУЛЬТАТ ПРЯМОГО ТЕСТИРОВАНИЯ:');
    console.log('=====================================');
    console.log('  📦 Продукты:', result.products.length);
    console.log('  ⏱️  Время:', totalTimeMs + 'ms (' + (totalTimeMs/1000).toFixed(1) + 's)');
    console.log('  🤖 Метод:', result.extractionMethods.bestMethod);
    console.log('  ❌ Ошибки:', result.errors.length);
    console.log('  💰 Стоимость: $' + result.costUsd);
    console.log('');
    
    if (result.extractionMethods.step1_pdf_to_images) {
      console.log('  📄 Step 1 (PDF→Images):', result.extractionMethods.step1_pdf_to_images);
    }
    if (result.extractionMethods.step2_gemini_flash_2_0) {
      console.log('  🤖 Step 2 (Gemini Flash 2.0):', result.extractionMethods.step2_gemini_flash_2_0);
    }
    console.log('');
    
    if (result.errors.length > 0) {
      console.log('❌ ОШИБКИ:');
      result.errors.slice(0, 5).forEach((error, i) => {
        console.log('  ' + (i+1) + '. ' + error);
      });
      console.log('');
    }
    
    if (result.products.length > 0) {
      console.log('✅ ПЕРВЫЕ ПРОДУКТЫ:');
      result.products.slice(0, 3).forEach((product, i) => {
        console.log('  ' + (i+1) + '. ' + (product.name || 'Безымянный') + ' - ' + (product.price || 'No price'));
      });
    }
    
    console.log('');
    console.log('🎉 ПРЯМОЕ ТЕСТИРОВАНИЕ ЗАВЕРШЕНО УСПЕШНО!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Ошибка извлечения:', error.message);
    console.error('❌ Stack:', error.stack);
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Ошибка импорта:', error.message);
  process.exit(1);
});
`;

    console.log('📝 Создаем тестовый скрипт на сервере...');
    
    // Создать тестовый скрипт на сервере
    const sshProcess = spawn('ssh', [
      '-o', 'StrictHostKeyChecking=no',
      'root@209.38.85.196',
      `cd /opt/monito-web && cat > test-direct-pdf-extract.mjs << 'EOF'${testScript}EOF`
    ]);

    sshProcess.on('close', async (code) => {
      if (code !== 0) {
        throw new Error(`Failed to create test script: ${code}`);
      }
      
      console.log('✅ Скрипт создан');
      console.log('🏃 Запускаем тест...');
      console.log('');

      const startTime = Date.now();

      // Запустить тест
      const runProcess = spawn('ssh', [
        '-o', 'StrictHostKeyChecking=no',
        'root@209.38.85.196',
        'cd /opt/monito-web && timeout 300 node --experimental-specifier-resolution=node test-direct-pdf-extract.mjs'
      ], {
        stdio: 'inherit'
      });

      runProcess.on('close', (runCode) => {
        const totalTime = Date.now() - startTime;
        console.log('');
        console.log(`⏱️ Общее время теста: ${(totalTime/1000).toFixed(1)}s`);
        
        if (runCode === 0) {
          console.log('🎉 ПРЯМОЕ ТЕСТИРОВАНИЕ УСПЕШНО!');
        } else {
          console.log(`❌ Тест завершился с кодом: ${runCode}`);
        }
      });
    });

  } catch (error) {
    console.error('❌ Ошибка теста:', error.message);
    throw error;
  }
}

// Запустить тест
if (require.main === module) {
  testServerPdfDirect().catch(error => {
    console.error('\n💥 Тест провалился!');
    process.exit(1);
  });
}

module.exports = { testServerPdfDirect };