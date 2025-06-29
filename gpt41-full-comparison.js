/**
 * Полное сравнение всех пяти моделей: GPT-4o, o3-mini, GPT-4.1-mini, GPT-4.1-nano
 */

const fs = require('fs');

const realProducts = JSON.parse(fs.readFileSync('test-real-products.json', 'utf8'));

const models = {
  'gpt-4o': { name: 'gpt-4o', inputCost: 0.0025, outputCost: 0.01 },
  'o3-mini': { name: 'o3-mini-2025-01-31', inputCost: 0.003, outputCost: 0.012 },
  'gpt-4.1-mini': { name: 'gpt-4.1-mini', inputCost: 0.0006, outputCost: 0.0024 },
  'gpt-4.1-nano': { name: 'gpt-4.1-nano', inputCost: 0.00015, outputCost: 0.0006 }
};

const systemPrompt = `You are "Monito-Normalizer" - normalize Indonesian food products to English with standard units and categories.

CRITICAL RULES:
- daun bawang → Chives (NOT Green Onion)
- bawang merah → Onion Red 
- bawang putih → Garlic
- wortel → Carrot
- kentang → Potato
- ayam → Chicken
- daging → Beef
- ikan → Fish
- udang → Shrimp
- sawi → Mustard Green
- kangkung → Water Spinach
- bayam → Spinach

Units: ikat→bunch, sisir→bunch, kg/g/l/ml/pcs remain same.
Categories: dairy, meat, seafood, vegetables, fruits, spices, grains, bakery, beverages, oils, sweeteners, condiments, disposables, other.

Return JSON with: originalName, standardizedName, originalUnit, quantity, standardizedUnit, category, confidence (0-100).`;

async function testAllModels() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found');
  }

  const testProducts = realProducts.slice(0, 15).map(p => ({
    name: p.rawName,
    unit: p.originalUnit,
    price: p.price
  }));

  console.log('🧪 ПОЛНОЕ СРАВНЕНИЕ ВСЕХ МОДЕЛЕЙ');
  console.log('=' .repeat(60));
  console.log(`📊 Тестовая выборка: ${testProducts.length} продуктов`);
  console.log(`📝 Примеры: ${testProducts.slice(0, 3).map(p => p.name).join(', ')}...\n`);

  const results = {};

  for (const [key, model] of Object.entries(models)) {
    console.log(`🤖 Тестирование ${model.name}...`);
    const startTime = Date.now();

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model.name,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(testProducts) }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "normalize_products",
              schema: {
                type: "object",
                properties: {
                  products: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["originalName", "standardizedName", "originalUnit", "quantity", "standardizedUnit", "category", "confidence"],
                      properties: {
                        originalName: { type: "string" },
                        standardizedName: { type: "string" },
                        originalUnit: { type: ["string", "null"] },
                        quantity: { type: ["number", "null"] },
                        standardizedUnit: { type: ["string", "null"] },
                        category: { type: "string" },
                        confidence: { type: "integer", minimum: 0, maximum: 100 }
                      }
                    }
                  }
                }
              }
            }
          },
          max_completion_tokens: 8192
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Ошибка API для ${model.name}: ${response.status} - ${errorText}`);
        
        results[key] = {
          model: model.name,
          success: false,
          error: `API Error: ${response.status} - ${errorText}`,
          processingTime: Date.now() - startTime
        };
        continue;
      }

      const result = await response.json();
      const endTime = Date.now();
      
      const content = result.choices?.[0]?.message?.content;
      const parsedResult = JSON.parse(content);
      const products = parsedResult.products || parsedResult;
      
      const inputTokens = result.usage?.prompt_tokens || 0;
      const outputTokens = result.usage?.completion_tokens || 0;
      const totalCost = (inputTokens / 1000) * model.inputCost + (outputTokens / 1000) * model.outputCost;
      
      const averageConfidence = products.reduce((sum, p) => sum + (p.confidence || 0), 0) / products.length;
      
      results[key] = {
        model: model.name,
        success: true,
        processingTime: endTime - startTime,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        totalCost,
        productsCount: products.length,
        averageConfidence: Math.round(averageConfidence),
        products: products.slice(0, 3) // Сохраняем первые 3 для анализа
      };
      
      console.log(`✅ ${model.name}: ${endTime - startTime}ms, $${totalCost.toFixed(4)}, ${Math.round(averageConfidence)}% confidence`);
      
    } catch (error) {
      console.error(`❌ Ошибка ${model.name}:`, error.message);
      results[key] = {
        model: model.name,
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
    
    // Пауза между запросами
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  return results;
}

function generateFullReport(results) {
  console.log('\n\n📊 ПОЛНЫЙ СРАВНИТЕЛЬНЫЙ ОТЧЕТ');
  console.log('=' .repeat(80));
  
  // Таблица результатов
  console.log('\n📈 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:\n');
  console.log('| Модель           | Время(мс) | Токены | Стоимость | Качество | Статус |');
  console.log('|------------------|-----------|--------|-----------|----------|--------|');
  
  Object.entries(results).forEach(([key, result]) => {
    if (result.success) {
      const model = result.model.padEnd(16, ' ');
      const time = result.processingTime.toString().padEnd(9, ' ');
      const tokens = result.totalTokens.toString().padEnd(6, ' ');
      const cost = `$${result.totalCost.toFixed(4)}`.padEnd(9, ' ');
      const quality = `${result.averageConfidence}%`.padEnd(8, ' ');
      console.log(`| ${model} | ${time} | ${tokens} | ${cost} | ${quality} | ✅     |`);
    } else {
      const model = result.model.padEnd(16, ' ');
      console.log(`| ${model} | ERROR     | -      | -         | -        | ❌     |`);
    }
  });
  
  // Анализ по категориям
  const successfulResults = Object.values(results).filter(r => r.success);
  if (successfulResults.length >= 2) {
    console.log('\n\n🏆 АНАЛИЗ ПО КАТЕГОРИЯМ:\n');
    
    // Скорость
    const fastest = successfulResults.reduce((a, b) => 
      a.processingTime < b.processingTime ? a : b
    );
    console.log(`⚡ Самая быстрая: ${fastest.model} (${fastest.processingTime}ms)`);
    
    // Стоимость
    const cheapest = successfulResults.reduce((a, b) => 
      a.totalCost < b.totalCost ? a : b
    );
    console.log(`💰 Самая дешевая: ${cheapest.model} ($${cheapest.totalCost.toFixed(4)})`);
    
    // Качество
    const bestQuality = successfulResults.reduce((a, b) => 
      a.averageConfidence > b.averageConfidence ? a : b
    );
    console.log(`🎯 Лучшее качество: ${bestQuality.model} (${bestQuality.averageConfidence}% уверенность)`);
    
    // Эффективность (соотношение качество/цена)
    const efficiency = successfulResults.map(r => ({
      ...r,
      efficiency: r.averageConfidence / (r.totalCost * 1000)
    }));
    const mostEfficient = efficiency.reduce((a, b) => 
      a.efficiency > b.efficiency ? a : b
    );
    console.log(`📊 Лучшая эффективность: ${mostEfficient.model} (${mostEfficient.efficiency.toFixed(0)} качество/$)`);
    
    // Подробное сравнение
    console.log('\n📋 ПОДРОБНОЕ СРАВНЕНИЕ:\n');
    
    successfulResults.forEach(result => {
      const productsCount = 15; // Фиксированное количество для расчетов
      console.log(`🤖 ${result.model}:`);
      console.log(`   ⏱️  Скорость: ${result.processingTime}ms (${(result.processingTime / productsCount).toFixed(0)}ms/продукт)`);
      console.log(`   💰 Стоимость: $${result.totalCost.toFixed(4)} ($${(result.totalCost / productsCount).toFixed(5)}/продукт)`);
      console.log(`   🎯 Качество: ${result.averageConfidence}%`);
      console.log(`   📊 Токены: ${result.totalTokens} (${result.inputTokens} + ${result.outputTokens})`);
      
      // Сравнение с самой быстрой
      if (result !== fastest) {
        const speedDiff = (result.processingTime / fastest.processingTime).toFixed(1);
        console.log(`   📈 Скорость vs ${fastest.model}: в ${speedDiff}x раз медленнее`);
      }
      
      // Сравнение с самой дешевой
      if (result !== cheapest) {
        const costDiff = (result.totalCost / cheapest.totalCost).toFixed(1);
        console.log(`   💸 Стоимость vs ${cheapest.model}: в ${costDiff}x раз дороже`);
      }
      
      console.log('');
    });
    
    // Итоговые рекомендации
    console.log('🎯 ИТОГОВЫЕ РЕКОМЕНДАЦИИ:\n');
    
    console.log('📊 Для разных сценариев использования:');
    console.log(`   🚀 Максимальная скорость: ${fastest.model}`);
    console.log(`   💰 Минимальная стоимость: ${cheapest.model}`);
    console.log(`   🎯 Максимальное качество: ${bestQuality.model}`);
    console.log(`   ⚖️  Лучшая эффективность: ${mostEfficient.model}`);
    
    console.log('\n💡 Практические рекомендации:');
    if (cheapest.model.includes('4.1-nano')) {
      console.log('   🏆 GPT-4.1-nano - идеальный выбор для массовой обработки (дешево и быстро)');
    }
    if (bestQuality.model.includes('o3-mini')) {
      console.log('   🎯 o3-mini - используйте для критически важных переводов');
    }
    if (fastest.model.includes('4.1')) {
      console.log('   ⚡ GPT-4.1 серия - отличная скорость и новые возможности');
    }
  }
  
  // Сохраняем результаты
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = `full-model-comparison-${timestamp}.json`;
  fs.writeFileSync(reportFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    testSize: testProducts.length,
    results
  }, null, 2));
  
  console.log(`\n💾 Подробные результаты сохранены в: ${reportFile}`);
}

// Запуск тестирования
async function main() {
  try {
    const results = await testAllModels();
    generateFullReport(results);
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
  }
}

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Не найден OPENAI_API_KEY');
  process.exit(1);
}

main();