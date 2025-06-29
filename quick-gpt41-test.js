/**
 * Быстрый тест новых моделей GPT-4.1-mini и GPT-4.1-nano
 */

const fs = require('fs');

// Загрузим небольшую выборку для быстрого теста
const realProducts = JSON.parse(fs.readFileSync('test-real-products.json', 'utf8'));
const testProducts = realProducts.slice(0, 5).map(p => ({
  name: p.rawName,
  unit: p.originalUnit,
  price: p.price
}));

const models = [
  { name: 'gpt-4.1-mini', inputCost: 0.0006, outputCost: 0.0024 },
  { name: 'gpt-4.1-nano', inputCost: 0.00015, outputCost: 0.0006 }
];

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

async function testGPT41Models() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found');
  }

  console.log('🧪 БЫСТРЫЙ ТЕСТ GPT-4.1 МОДЕЛЕЙ');
  console.log('=' .repeat(50));
  console.log(`📊 Тестовая выборка: ${testProducts.length} продуктов`);
  console.log(`📝 Продукты: ${testProducts.map(p => p.name).join(', ')}\n`);

  const results = {};

  for (const model of models) {
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
          max_completion_tokens: 4096
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Ошибка API для ${model.name}: ${response.status} - ${errorText}`);
        
        results[model.name] = {
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
      
      results[model.name] = {
        success: true,
        processingTime: endTime - startTime,
        inputTokens,
        outputTokens,
        totalCost,
        productsCount: products.length,
        averageConfidence: Math.round(averageConfidence),
        products: products
      };
      
      console.log(`✅ ${model.name}: ${endTime - startTime}ms, $${totalCost.toFixed(4)}, ${Math.round(averageConfidence)}% confidence`);
      
    } catch (error) {
      console.error(`❌ Ошибка ${model.name}:`, error.message);
      results[model.name] = {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
    
    // Пауза между запросами
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n📊 РЕЗУЛЬТАТЫ БЫСТРОГО ТЕСТА:');
  console.log('=' .repeat(50));
  
  Object.entries(results).forEach(([modelName, result]) => {
    if (result.success) {
      console.log(`\n🤖 ${modelName}:`);
      console.log(`   ⏱️  Время: ${result.processingTime}ms`);
      console.log(`   🎯 Токены: ${result.inputTokens} + ${result.outputTokens} = ${result.inputTokens + result.outputTokens}`);
      console.log(`   💰 Стоимость: $${result.totalCost.toFixed(4)}`);
      console.log(`   📊 Уверенность: ${result.averageConfidence}%`);
      console.log(`   📝 Продуктов: ${result.productsCount}`);
    } else {
      console.log(`\n❌ ${modelName}: ${result.error}`);
    }
  });

  // Сохраняем результаты
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = `quick-gpt41-test-${timestamp}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
  
  console.log(`\n💾 Результаты сохранены в: ${reportFile}`);
  return results;
}

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Не найден OPENAI_API_KEY');
  process.exit(1);
}

testGPT41Models().catch(console.error);