const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

async function detailedAnalysis() {
  try {
    const genAI = new GoogleGenerativeAI('AIzaSyBfvhR-T-x0HUirPLaQUktogi9O7vt5oAc');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    const widiwigunaData = JSON.parse(fs.readFileSync('./widi_wiguna_products.json', 'utf8'));
    
    // Анализ категорий
    const categories = {};
    let highestPrice = 0;
    let lowestPrice = Infinity;
    
    widiwigunaData.products.forEach(product => {
      if (!categories[product.category]) {
        categories[product.category] = [];
      }
      categories[product.category].push(product);
      
      if (product.price > highestPrice) {
        highestPrice = product.price;
      }
      if (product.price < lowestPrice) {
        lowestPrice = product.price;
      }
    });
    
    // Топ-10 самых дорогих и дешевых
    const sortedByPrice = [...widiwigunaData.products].sort((a, b) => b.price - a.price);
    const expensiveItems = sortedByPrice.slice(0, 10);
    const cheapItems = sortedByPrice.slice(-10).reverse();
    
    const categoriesText = Object.keys(categories).map(cat => 
      `${cat}: ${categories[cat].length} товаров (средняя цена: ${Math.round(categories[cat].reduce((sum, p) => sum + p.price, 0) / categories[cat].length).toLocaleString()} IDR)`
    ).join('\n');
    
    const expensiveText = expensiveItems.map((item, i) => 
      `${i+1}. ${item.name}: ${item.price.toLocaleString()} IDR/${item.unit}`
    ).join('\n');
    
    const cheapText = cheapItems.map((item, i) => 
      `${i+1}. ${item.name}: ${item.price.toLocaleString()} IDR/${item.unit}`
    ).join('\n');
    
    const prompt = `Создай подробный бизнес-анализ для поставщика Widi Wiguna на основе ПОЛНЫХ данных о 204 продуктах:

СТАТИСТИКА ПО КАТЕГОРИЯМ:
${categoriesText}

ТОП-10 САМЫХ ДОРОГИХ ТОВАРОВ:
${expensiveText}

ТОП-10 САМЫХ ДЕШЕВЫХ ТОВАРОВ:
${cheapText}

ОБЩАЯ СТАТИСТИКА:
- Всего продуктов: ${widiwigunaData.products.length}
- Максимальная цена: ${highestPrice.toLocaleString()} IDR
- Минимальная цена: ${lowestPrice.toLocaleString()} IDR
- Средняя цена: ${Math.round(widiwigunaData.metrics.avg_price).toLocaleString()} IDR

СОЗДАЙ ДЕТАЛЬНЫЙ ОТЧЕТ:
1. Анализ ассортиментной матрицы
2. Ценовое позиционирование по сегментам
3. Конкурентные преимущества
4. Рекомендации по оптимизации для HORECA
5. Прогноз рентабельности партнерства

Ответ должен быть структурированным и профессиональным для презентации руководству.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    console.log('=== ДЕТАЛЬНЫЙ БИЗНЕС-АНАЛИЗ WIDI WIGUNA ===\n');
    console.log(response.text());
    
  } catch (error) {
    console.error('Ошибка:', error.message);
  }
}

detailedAnalysis();