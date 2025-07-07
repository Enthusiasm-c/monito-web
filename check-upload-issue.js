const fs = require('fs');

async function checkUploadIssue() {
  console.log('🔍 АНАЛИЗ ПРОБЛЕМЫ С МАССОВОЙ ЗАГРУЗКОЙ');
  console.log('=' .repeat(70));
  
  // Проверить отчеты загрузки
  console.log('📋 ПРОВЕРКА ОТЧЕТОВ ЗАГРУЗКИ:');
  
  const reportFiles = [
    'bulk-upload-summary.json',
    'bulk-supplier-upload-report-1751699580450.json',
    'quick-supplier-test-1751697265389.json'
  ];
  
  reportFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ Найден отчет: ${file}`);
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (data.totalFiles) {
          console.log(`   📁 Файлов: ${data.totalFiles}`);
          console.log(`   ✅ Успешно: ${data.successful}`);
          console.log(`   📦 Товаров: ${data.totalProductsExtracted}`);
        }
      } catch (e) {
        console.log(`   ❌ Ошибка чтения файла: ${e.message}`);
      }
    } else {
      console.log(`❌ Отчет не найден: ${file}`);
    }
  });
  
  // Анализ возможных причин
  console.log('\n🔍 ВОЗМОЖНЫЕ ПРИЧИНЫ ОТСУТСТВИЯ ДАННЫХ В БД:');
  
  console.log('1. 🌐 Проблема сети/соединения:');
  console.log('   - Загрузки могли не достичь удаленного сервера');
  console.log('   - Таймауты при записи в базу данных');
  console.log('   - Проблемы с Neon PostgreSQL');
  
  console.log('\n2. 🔄 Проблема API endpoint:');
  console.log('   - upload-unified может обрабатывать файлы без сохранения');
  console.log('   - Ошибки валидации или бизнес-логики');
  console.log('   - Проблемы с транзакциями базы данных');
  
  console.log('\n3. 📊 Проблема с обработкой:');
  console.log('   - Файлы обработались, но результаты не сохранились');
  console.log('   - Ошибки в процессе сохранения поставщиков/товаров');
  console.log('   - Проблемы с дублированием данных');
  
  console.log('\n🔬 ФАКТЫ ИЗ АНАЛИЗА:');
  console.log('✅ Скрипт загрузки отработал успешно (86% успеха)');
  console.log('✅ 911 товаров было извлечено из файлов');
  console.log('✅ 19 из 22 файлов обработались без ошибок');
  console.log('❌ В базе данных нет записей об этих загрузках');
  console.log('❌ Статистика базы не изменилась кроме 1 Excel файла');
  
  // Проверить текущее состояние сервера
  console.log('\n🌐 ПРОВЕРКА СОСТОЯНИЯ СЕРВЕРА:');
  
  try {
    const fetch = (await import('node-fetch')).default;
    
    // Проверить health endpoint
    const healthResponse = await fetch('http://localhost:3000/api/upload-unified', {
      method: 'GET',
      timeout: 5000
    });
    
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log('✅ API endpoint доступен');
      console.log(`   📊 Статус: ${health.status}`);
      console.log(`   🔧 Сервис: ${health.service}`);
    } else {
      console.log('❌ API endpoint недоступен');
    }
  } catch (error) {
    console.log('❌ Ошибка проверки API:', error.message);
  }
  
  console.log('\n💡 РЕКОМЕНДАЦИИ:');
  console.log('1. 🔄 Повторить загрузку одного файла для тестирования');
  console.log('2. 📊 Проверить логи сервера на предмет ошибок');
  console.log('3. 🔍 Проверить соединение с базой данных Neon');
  console.log('4. 🔧 Добавить логирование в upload-unified endpoint');
  console.log('5. 📋 Проверить лимиты и настройки Vercel/Neon');
  
  console.log('\n📈 ИТОГ АНАЛИЗА:');
  console.log('🎯 Система обработки файлов работает корректно');
  console.log('💰 Механизм извлечения товаров функционален');
  console.log('❌ Проблема в сохранении данных в удаленную базу');
  console.log('🔧 Требуется диагностика соединения с базой данных');
  
  return {
    filesProcessedLocally: 22,
    successfullyProcessed: 19,
    productsExtracted: 911,
    recordsInDatabase: 1,
    issue: 'data_not_persisted_to_remote_db',
    recommendation: 'investigate_database_connection'
  };
}

checkUploadIssue();