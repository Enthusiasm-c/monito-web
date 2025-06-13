const fs = require('fs');

console.log('📋 Извлекаем список продуктов из последнего теста...\n');

try {
  const log = fs.readFileSync('/Users/denisdomashenko/monito-web/server.log', 'utf8');
  const lines = log.split('\n');
  
  // Найти последний JSON блок
  let jsonStart = -1;
  let jsonEnd = -1;
  
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('=== ENHANCED_JSON_END ===')) {
      jsonEnd = i;
    }
    if (lines[i].includes('=== ENHANCED_JSON_START ===') && jsonEnd > 0) {
      jsonStart = i + 1;
      break;
    }
  }
  
  if (jsonStart === -1 || jsonEnd === -1) {
    console.log('❌ Не найден JSON блок с продуктами');
    process.exit(1);
  }
  
  // Собираем JSON
  let jsonText = '';
  for (let i = jsonStart; i < jsonEnd; i++) {
    const line = lines[i];
    // Убираем префикс логов
    const cleanLine = line.replace(/^\s*\d+→/, '').replace(/^📤 Python output: /, '');
    jsonText += cleanLine + '\n';
  }
  
  // Парсим JSON
  const data = JSON.parse(jsonText);
  const products = data.products || [];
  
  console.log(`🎯 Всего извлечено: ${products.length} продуктов\n`);
  console.log('📋 СПИСОК ИЗВЛЕЧЕННЫХ ПРОДУКТОВ:\n');
  console.log('=' .repeat(80));
  
  // Группируем по страницам
  const productsByPage = {};
  products.forEach(product => {
    const page = product.source_page || 'unknown';
    if (!productsByPage[page]) {
      productsByPage[page] = [];
    }
    productsByPage[page].push(product);
  });
  
  // Выводим по страницам
  Object.keys(productsByPage).sort((a, b) => parseInt(a) - parseInt(b)).forEach(page => {
    console.log(`\n📄 СТРАНИЦА ${page} (${productsByPage[page].length} продуктов):`);
    console.log('-'.repeat(50));
    
    productsByPage[page].forEach((product, index) => {
      const price = new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(product.price);
      
      const size = product.size ? ` (${product.size})` : '';
      const priceType = product.price_type ? ` [${product.price_type}]` : '';
      const notes = product.notes ? ` | ${product.notes}` : '';
      
      console.log(`${String(index + 1).padStart(2)}. ${product.name}${size}`);
      console.log(`    💰 ${price} per ${product.unit || 'unit'}${priceType}${notes}`);
    });
  });
  
  console.log('\n' + '='.repeat(80));
  
  // Статистика
  const priceTypes = {};
  const categories = {};
  const units = {};
  
  products.forEach(product => {
    const priceType = product.price_type || 'unknown';
    const unit = product.unit || 'unknown';
    
    priceTypes[priceType] = (priceTypes[priceType] || 0) + 1;
    units[unit] = (units[unit] || 0) + 1;
  });
  
  console.log('\n📊 СТАТИСТИКА ИЗВЛЕЧЕНИЯ:');
  console.log(`   📦 Всего продуктов: ${products.length}`);
  console.log(`   📄 Страниц обработано: ${Object.keys(productsByPage).length}`);
  
  console.log('\n💰 Типы цен:');
  Object.entries(priceTypes).forEach(([type, count]) => {
    console.log(`   ${type}: ${count} продуктов`);
  });
  
  console.log('\n📏 Единицы измерения:');
  Object.entries(units).forEach(([unit, count]) => {
    console.log(`   ${unit || 'не указано'}: ${count} продуктов`);
  });
  
  // Ценовой диапазон
  const prices = products.map(p => p.price).filter(p => p > 0);
  if (prices.length > 0) {
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    
    console.log('\n💵 Ценовой диапазон:');
    console.log(`   Минимум: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(minPrice)}`);
    console.log(`   Максимум: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(maxPrice)}`);
    console.log(`   Среднее: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(avgPrice)}`);
  }
  
} catch (error) {
  console.error('❌ Ошибка при извлечении продуктов:', error.message);
}