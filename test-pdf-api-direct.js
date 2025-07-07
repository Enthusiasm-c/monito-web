#!/usr/bin/env node

/**
 * Тестирование PDF через прямой HTTP API вызов
 * Обходит проблемы с импортами TypeScript
 */

const https = require('https');
const http = require('http');

async function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const protocol = options.port === 443 ? https : http;
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: result });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

async function testPdfApiDirect() {
  console.log('🧪 ТЕСТИРОВАНИЕ PDF ЧЕРЕЗ HTTP API');
  console.log('==================================');
  console.log('');

  const fileUrl = 'https://cdc1w79ssc4kg6xh.public.blob.vercel-storage.com/Island%20Organics%20Bali-wfQOZrvhymEkhEcTw2UjMLYurMsyUC.pdf';
  const fileName = 'Island Organics Bali.pdf';

  console.log(`📁 Файл: ${fileName}`);
  console.log(`🔗 URL: ${fileUrl}`);
  console.log('');

  try {
    // Создаем FormData для отправки
    const boundary = '----formdata-boundary-' + Math.random().toString(36);
    const formData = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="fileUrl"',
      '',
      fileUrl,
      `--${boundary}`,
      'Content-Disposition: form-data; name="fileName"',
      '',
      fileName,
      `--${boundary}`,
      'Content-Disposition: form-data; name="direct"',
      '',
      'true',
      `--${boundary}--`
    ].join('\r\n');

    console.log('🚀 Отправляем HTTP запрос на сервер...');
    
    const startTime = Date.now();

    // Прямой вызов к серверу
    const options = {
      hostname: '209.38.85.196',
      port: 3000,
      path: '/api/test-pdf-direct',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(formData)
      }
    };

    console.log('📞 Вызываем API...');
    const result = await makeRequest(options, formData);
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    console.log('');
    console.log('📊 РЕЗУЛЬТАТ API ВЫЗОВА:');
    console.log('========================');
    console.log('  📡 HTTP статус:', result.statusCode);
    console.log('  ⏱️  Время запроса:', totalTime + 'ms (' + (totalTime/1000).toFixed(1) + 's)');
    console.log('');

    if (result.statusCode === 200 && result.data) {
      console.log('  📦 Продукты:', result.data.products?.length || 0);
      console.log('  🤖 Метод:', result.data.extractionMethods?.bestMethod || 'N/A');
      console.log('  ❌ Ошибки:', result.data.errors?.length || 0);
      console.log('  💰 Стоимость: $' + (result.data.costUsd || '0.00'));
      console.log('  ⏱️  Время обработки:', (result.data.processingTimeMs || 0) + 'ms');
      
      if (result.data.errors && result.data.errors.length > 0) {
        console.log('');
        console.log('❌ ОШИБКИ:');
        result.data.errors.slice(0, 5).forEach((error, i) => {
          console.log('  ' + (i+1) + '. ' + error);
        });
      }

      if (result.data.products && result.data.products.length > 0) {
        console.log('');
        console.log('✅ ПЕРВЫЕ ПРОДУКТЫ:');
        result.data.products.slice(0, 3).forEach((product, i) => {
          console.log('  ' + (i+1) + '. ' + (product.name || 'Безымянный') + ' - ' + (product.price || 'No price'));
        });
      }

      console.log('');
      console.log('🎉 API ТЕСТИРОВАНИЕ ЗАВЕРШЕНО!');
    } else {
      console.log('❌ API Error:', result.data);
    }

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
    throw error;
  }
}

// Запустить тест
if (require.main === module) {
  testPdfApiDirect().catch(error => {
    console.error('\n💥 Тест провалился!');
    process.exit(1);
  });
}

module.exports = { testPdfApiDirect };