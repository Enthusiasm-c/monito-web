/**
 * Test API analytics endpoint
 */

const fetch = require('node-fetch');

async function testAPIAnalytics() {
  try {
    console.log('🧪 ТЕСТИРОВАНИЕ API АНАЛИТИКИ');
    console.log('=' .repeat(40));
    
    // Test product analytics for a known product
    const productId = 'cmbzyfjtv0003s2w06smuyqge'; // Ciabatta
    
    console.log(`📊 Тест аналитики для продукта: ${productId}`);
    
    const apiUrl = `http://localhost:3000/api/admin/analytics/prices?type=product&productId=${productId}`;
    console.log(`🔗 URL: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Note: In production, this would require proper authentication
        'Cookie': 'session-token=test'
      }
    });
    
    console.log(`📡 HTTP Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Ответ API получен успешно');
      
      if (data.success) {
        console.log(`📦 Название продукта: ${data.data.productName}`);
        console.log(`📊 Текущих цен: ${data.data.currentPrices.length}`);
        console.log(`📈 Истории цен: ${data.data.priceHistory.length}`);
        console.log(`📅 Точек средних цен: ${data.data.averagePriceHistory.length}`);
        
        // Show statistics
        const stats = data.data.statistics;
        console.log('\n💰 Статистика:');
        console.log(`   Средняя цена: ${Math.round(stats.currentAveragePrice).toLocaleString()} IDR`);
        console.log(`   Мин. цена: ${Math.round(stats.currentMinPrice).toLocaleString()} IDR`);
        console.log(`   Макс. цена: ${Math.round(stats.currentMaxPrice).toLocaleString()} IDR`);
        console.log(`   Поставщиков: ${stats.supplierCount}`);
        console.log(`   Изменений: ${stats.totalPriceChanges}`);
        
        // Show current prices
        if (data.data.currentPrices.length > 0) {
          console.log('\n💵 Текущие цены:');
          data.data.currentPrices.forEach((price, index) => {
            console.log(`   ${index + 1}. ${Math.round(price.price).toLocaleString()} IDR - ${price.supplierName}`);
          });
        }
        
        // Show recent price history
        if (data.data.averagePriceHistory.length > 0) {
          console.log('\n📈 Последние точки истории (первые 5):');
          data.data.averagePriceHistory.slice(0, 5).forEach((point, index) => {
            const date = new Date(point.date).toLocaleDateString();
            const avgPrice = Math.round(point.averagePrice).toLocaleString();
            console.log(`   ${index + 1}. ${date} - ${avgPrice} IDR (поставщиков: ${point.supplierCount})`);
          });
        }
        
        console.log('\n✅ API аналитики работает корректно!');
        console.log('📖 Данные готовы для отображения в React компоненте');
        
      } else {
        console.log('❌ API вернул ошибку:', data.error);
      }
      
    } else {
      const errorText = await response.text();
      console.log('❌ Ошибка HTTP:', response.status, response.statusText);
      console.log('📄 Содержимое ответа:', errorText.substring(0, 500));
      
      if (response.status === 401) {
        console.log('🔐 Возможно, требуется аутентификация');
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка тестирования API:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('🔌 Сервер не запущен на порту 3000');
      console.log('💡 Запустите: npm run dev');
    }
  }
}

testAPIAnalytics();