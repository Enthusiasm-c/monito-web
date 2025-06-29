/**
 * Расширенный тест моделей с разными размерами выборок и индонезийскими данными
 */

const fs = require('fs');

// Дополнительные индонезийские тестовые данные для лучшего сравнения
const indonesianTestData = [
  { name: "Daun Bawang Segar", unit: "ikat", price: "2500" },
  { name: "Bawang Merah Brebes", unit: "kg", price: "25000" },
  { name: "Bawang Putih Kating", unit: "kg", price: "35000" },
  { name: "Wortel Import", unit: "kg", price: "18000" },
  { name: "Kentang Granola", unit: "kg", price: "12000" },
  { name: "Tomat Buah", unit: "kg", price: "8000" },
  { name: "Selada Keriting", unit: "ikat", price: "3000" },
  { name: "Mangga Harum Manis", unit: "kg", price: "15000" },
  { name: "Pisang Cavendish", unit: "sisir", price: "12000" },
  { name: "Apel Fuji Import", unit: "kg", price: "45000" },
  { name: "Jeruk Manis Pontianak", unit: "kg", price: "20000" },
  { name: "Ayam Potong Segar", unit: "kg", price: "32000" },
  { name: "Daging Sapi Has Dalam", unit: "kg", price: "150000" },
  { name: "Ikan Nila Segar", unit: "kg", price: "28000" },
  { name: "Udang Windu", unit: "kg", price: "85000" },
  { name: "Sawi Hijau", unit: "ikat", price: "2000" },
  { name: "Kangkung Darat", unit: "ikat", price: "1500" },
  { name: "Bayam Merah", unit: "ikat", price: "2000" },
  { name: "Cabe Rawit Merah", unit: "kg", price: "45000" },
  { name: "Keju Mozzarella", unit: "250g", price: "35000" }
];

class ExtendedModelTester {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY not found');
    }
  }

  async testWithDifferentSizes() {
    const testSizes = [10, 25, 50];
    const models = ['gpt-4o', 'o3-mini-2025-01-31', 'gpt-4.1-mini', 'gpt-4.1-nano'];
    const results = {};

    console.log('🧪 РАСШИРЕННОЕ ТЕСТИРОВАНИЕ МОДЕЛЕЙ');
    console.log('=' .repeat(60));

    for (const size of testSizes) {
      console.log(`\\n📊 Тестирование с ${size} продуктами...`);
      results[size] = {};

      // Комбинируем реальные данные с индонезийскими
      const realData = JSON.parse(fs.readFileSync('test-real-products.json', 'utf8'));
      const combinedData = [...realData.slice(0, Math.floor(size/2)), ...indonesianTestData.slice(0, Math.ceil(size/2))];
      const testData = combinedData.slice(0, size);

      for (const model of models) {
        console.log(`   🤖 Тестирование ${model}...`);
        const result = await this.testSingleModel(model, testData);
        results[size][model] = result;
        
        // Пауза между запросами
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    return results;
  }

  async testSingleModel(modelName, testData) {
    const startTime = Date.now();
    
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

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(testData) }
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
          max_completion_tokens: 16384
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      const result = await response.json();
      const endTime = Date.now();
      
      const content = result.choices?.[0]?.message?.content;
      const parsedResult = JSON.parse(content);
      const products = parsedResult.products || parsedResult;
      
      // Вычисляем стоимость
      const inputTokens = result.usage?.prompt_tokens || 0;
      const outputTokens = result.usage?.completion_tokens || 0;
      
      const costs = {
        'gpt-4o': { input: 0.0025, output: 0.01 },
        'o3-mini-2025-01-31': { input: 0.003, output: 0.012 },
        'gpt-4.1-mini': { input: 0.0006, output: 0.0024 },
        'gpt-4.1-nano': { input: 0.00015, output: 0.0006 }
      };
      
      const modelCosts = costs[modelName] || costs['gpt-4o'];
      const totalCost = (inputTokens / 1000) * modelCosts.input + (outputTokens / 1000) * modelCosts.output;
      
      // Анализ качества
      const qualityMetrics = this.analyzeQuality(testData, products);
      
      return {
        success: true,
        processingTime: endTime - startTime,
        inputTokens,
        outputTokens,
        totalCost,
        productsCount: products.length,
        qualityMetrics,
        samples: products.slice(0, 5) // Первые 5 результатов для анализа
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  analyzeQuality(original, standardized) {
    if (!standardized || standardized.length === 0) {
      return { completionRate: 0, averageConfidence: 0, translationAccuracy: 0 };
    }

    const completionRate = (standardized.length / original.length) * 100;
    const averageConfidence = standardized.reduce((sum, p) => sum + (p.confidence || 0), 0) / standardized.length;
    
    // Проверяем качество перевода индонезийских слов
    let translationAccuracy = 0;
    const translationTests = [
      { original: /daun\s*bawang/i, expected: /chives/i },
      { original: /bawang\s*merah/i, expected: /onion.*red/i },
      { original: /bawang\s*putih/i, expected: /garlic/i },
      { original: /wortel/i, expected: /carrot/i },
      { original: /ayam/i, expected: /chicken/i },
      { original: /daging/i, expected: /beef/i },
      { original: /ikan/i, expected: /fish/i },
      { original: /udang/i, expected: /shrimp/i }
    ];
    
    let correctTranslations = 0;
    let totalTranslationTests = 0;
    
    standardized.forEach(product => {
      translationTests.forEach(test => {
        if (test.original.test(product.originalName)) {
          totalTranslationTests++;
          if (test.expected.test(product.standardizedName)) {
            correctTranslations++;
          }
        }
      });
    });
    
    translationAccuracy = totalTranslationTests > 0 ? (correctTranslations / totalTranslationTests) * 100 : 100;

    return {
      completionRate: Math.round(completionRate),
      averageConfidence: Math.round(averageConfidence),
      translationAccuracy: Math.round(translationAccuracy)
    };
  }

  generateExtendedReport(results) {
    console.log('\\n\\n📊 РАСШИРЕННЫЙ СРАВНИТЕЛЬНЫЙ ОТЧЕТ');
    console.log('=' .repeat(80));
    
    // Сводная таблица
    console.log('\\n📈 ПРОИЗВОДИТЕЛЬНОСТЬ ПО РАЗМЕРАМ ВЫБОРКИ:\\n');
    
    Object.entries(results).forEach(([size, sizeResults]) => {
      console.log(`🔢 Выборка ${size} продуктов:`);
      console.log('| Модель           | Время(с) | Токены | Стоимость | Качество | Перевод |');
      console.log('|------------------|----------|--------|-----------|----------|---------|');
      
      Object.entries(sizeResults).forEach(([model, result]) => {
        if (result.success) {
          const modelName = model.padEnd(16, ' ');
          const time = (result.processingTime / 1000).toFixed(1).padEnd(8, ' ');
          const tokens = result.inputTokens + result.outputTokens;
          const tokensStr = tokens.toString().padEnd(6, ' ');
          const cost = `$${result.totalCost.toFixed(4)}`.padEnd(9, ' ');
          const quality = `${result.qualityMetrics.averageConfidence}%`.padEnd(8, ' ');
          const translation = `${result.qualityMetrics.translationAccuracy}%`.padEnd(7, ' ');
          
          console.log(`| ${modelName} | ${time} | ${tokensStr} | ${cost} | ${quality} | ${translation} |`);
        } else {
          console.log(`| ${model.padEnd(16, ' ')} | ERROR    | -      | -         | -        | -       |`);
        }
      });
      console.log('');
    });

    // Анализ эффективности
    console.log('\\n💡 АНАЛИЗ ЭФФЕКТИВНОСТИ:\\n');
    
    ['gpt-4o', 'o3-mini-2025-01-31'].forEach(model => {
      console.log(`🤖 ${model}:`);
      
      Object.entries(results).forEach(([size, sizeResults]) => {
        const result = sizeResults[model];
        if (result && result.success) {
          const timePerProduct = result.processingTime / parseInt(size);
          const costPerProduct = result.totalCost / parseInt(size);
          
          console.log(`   📊 ${size} продуктов: ${timePerProduct.toFixed(0)}ms/продукт, $${costPerProduct.toFixed(4)}/продукт`);
        }
      });
      console.log('');
    });

    // Масштабируемость
    console.log('\\n📈 МАСШТАБИРУЕМОСТЬ:\\n');
    
    ['gpt-4o', 'o3-mini-2025-01-31', 'gpt-4.1-mini', 'gpt-4.1-nano'].forEach(model => {
      const modelResults = Object.entries(results)
        .map(([size, sizeResults]) => ({
          size: parseInt(size),
          result: sizeResults[model]
        }))
        .filter(item => item.result && item.result.success);
      
      if (modelResults.length >= 2) {
        const efficiency = modelResults.map(item => ({
          size: item.size,
          timePerProduct: item.result.processingTime / item.size,
          costPerProduct: item.result.totalCost / item.size
        }));
        
        console.log(`🤖 ${model}:`);
        efficiency.forEach(e => {
          console.log(`   ${e.size} продуктов: ${e.timePerProduct.toFixed(0)}ms/продукт, $${e.costPerProduct.toFixed(5)}/продукт`);
        });
        
        // Тренд эффективности
        const timeEfficiencyTrend = efficiency[efficiency.length - 1].timePerProduct / efficiency[0].timePerProduct;
        const costEfficiencyTrend = efficiency[efficiency.length - 1].costPerProduct / efficiency[0].costPerProduct;
        
        console.log(`   📊 Тренд времени: ${timeEfficiencyTrend > 1 ? '📈' : '📉'} ${(timeEfficiencyTrend * 100).toFixed(0)}%`);
        console.log(`   💰 Тренд стоимости: ${costEfficiencyTrend > 1 ? '📈' : '📉'} ${(costEfficiencyTrend * 100).toFixed(0)}%`);
        console.log('');
      }
    });

    // Итоговые рекомендации
    console.log('🎯 ИТОГОВЫЕ РЕКОМЕНДАЦИИ:\\n');
    
    // Найдем лучшую модель для разных сценариев
    const size25Results = results['25'];
    if (size25Results) {
      const gpt4o = size25Results['gpt-4o'];
      const o3mini = size25Results['o3-mini-2025-01-31'];
      
      if (gpt4o?.success && o3mini?.success) {
        console.log('📊 Для производственного использования (на основе 25 продуктов):');
        console.log(`   ⚡ Скорость: GPT-4o в ${(o3mini.processingTime / gpt4o.processingTime).toFixed(1)}x раз быстрее`);
        console.log(`   💰 Стоимость: GPT-4o в ${(o3mini.totalCost / gpt4o.totalCost).toFixed(1)}x раз дешевле`);
        console.log(`   🎯 Качество: o3-mini на ${o3mini.qualityMetrics.averageConfidence - gpt4o.qualityMetrics.averageConfidence}% точнее`);
        console.log(`   🌍 Перевод: o3-mini ${o3mini.qualityMetrics.translationAccuracy}% vs GPT-4o ${gpt4o.qualityMetrics.translationAccuracy}%`);
        
        if (gpt4o.totalCost < o3mini.totalCost && gpt4o.processingTime < o3mini.processingTime) {
          console.log('\\n💡 РЕКОМЕНДАЦИЯ: GPT-4o для продакшна (быстрее и дешевле)');
          console.log('   📝 o3-mini использовать для критически важных переводов');
        } else {
          console.log('\\n💡 РЕКОМЕНДАЦИЯ: Hybrid подход');
          console.log('   🚀 GPT-4o для массовой обработки');
          console.log('   🎯 o3-mini для качественных переводов');
        }
      }
    }
    
    // Сохраняем подробный отчет
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = `extended-model-comparison-${timestamp}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
    
    console.log(`\\n💾 Подробные результаты сохранены в: ${reportFile}`);
  }
}

// Запуск расширенного тестирования
async function runExtendedTest() {
  try {
    const tester = new ExtendedModelTester();
    const results = await tester.testWithDifferentSizes();
    tester.generateExtendedReport(results);
  } catch (error) {
    console.error('❌ Ошибка расширенного тестирования:', error.message);
  }
}

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Не найден OPENAI_API_KEY');
  process.exit(1);
}

runExtendedTest();