#!/usr/bin/env node

/**
 * Прямое тестирование enhancedPdfExtractor без JobQueue
 * Обходит проблемный background processor
 */

const fs = require('fs');
const path = require('path');

async function testDirectPdfExtractor() {
  console.log('🧪 ПРЯМОЕ ТЕСТИРОВАНИЕ PDF→Images→Gemini Flash 2.0');
  console.log('================================================');
  console.log('');

  try {
    // Загрузим файл на сервер без async-upload
    const fileUrl = 'https://cdc1w79ssc4kg6xh.public.blob.vercel-storage.com/Island%20Organics%20Bali-wfQOZrvhymEkhEcTw2UjMLYurMsyUC.pdf';
    const fileName = 'Island Organics Bali.pdf';

    console.log(`📁 Файл: ${fileName}`);
    console.log(`🔗 URL: ${fileUrl}`);
    console.log('');

    // Прямой вызов enhancedPdfExtractor через API
    const startTime = Date.now();
    
    console.log('🚀 Запускаем прямой вызов enhancedPdfExtractor...');
    
    const testScript = `
const { enhancedPdfExtractor } = require('./app/services/enhancedPdfExtractor');

async function testExtraction() {
  console.log('🔍 PDF extraction starting: ${fileName}');
  
  const result = await enhancedPdfExtractor.extractFromPdf('${fileUrl}', '${fileName}');
  
  console.log('📊 Результат:');
  console.log('  Продукты:', result.products.length);
  console.log('  Время:', result.processingTimeMs + 'ms');
  console.log('  Метод:', result.extractionMethods.bestMethod);
  console.log('  Ошибки:', result.errors.length);
  console.log('  Стоимость: $' + result.costUsd);
  
  if (result.extractionMethods.step1_pdf_to_images) {
    console.log('  Step 1:', result.extractionMethods.step1_pdf_to_images);
  }
  if (result.extractionMethods.step2_gemini_flash_2_0) {
    console.log('  Step 2:', result.extractionMethods.step2_gemini_flash_2_0);
  }
  
  if (result.errors.length > 0) {
    console.log('❌ Ошибки:');
    result.errors.slice(0, 3).forEach((error, i) => {
      console.log('  ' + (i+1) + '. ' + error);
    });
  }
  
  return result;
}

testExtraction()
  .then(result => {
    console.log('✅ Тест завершен успешно!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Тест провалился:', error.message);
    process.exit(1);
  });
`;

    console.log('📝 Создаем временный тестовый скрипт на сервере...');
    
    // Создать тестовый скрипт на сервере
    const { spawn } = require('child_process');
    
    const sshProcess = spawn('ssh', [
      '-o', 'StrictHostKeyChecking=no',
      'root@209.38.85.196',
      `cd /opt/monito-web && cat > test-direct-extraction.js << 'EOF'${testScript}EOF`
    ]);

    sshProcess.on('close', async (code) => {
      if (code !== 0) {
        throw new Error(`Failed to create test script: ${code}`);
      }
      
      console.log('✅ Скрипт создан');
      console.log('🏃 Запускаем тест...');
      console.log('');

      // Запустить тест
      const runProcess = spawn('ssh', [
        '-o', 'StrictHostKeyChecking=no',
        'root@209.38.85.196',
        'cd /opt/monito-web && timeout 300 node test-direct-extraction.js'
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
  testDirectPdfExtractor().catch(error => {
    console.error('\n💥 Тест провалился!');
    process.exit(1);
  });
}

module.exports = { testDirectPdfExtractor };