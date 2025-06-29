/**
 * Тестовый фреймворк для сравнения GPT-4o и o3-mini по стандартизации продуктов
 */

const fs = require('fs');
const path = require('path');

// Загрузим реальные данные
const realProducts = JSON.parse(fs.readFileSync('test-real-products.json', 'utf8'));

// Конфигурация моделей
const models = {
  'gpt-4o': {
    name: 'gpt-4o',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    inputCostPer1K: 0.0025,
    outputCostPer1K: 0.01
  },
  'o3-mini': {
    name: 'o3-mini-2025-01-31', 
    endpoint: 'https://api.openai.com/v1/chat/completions',
    inputCostPer1K: 0.003,
    outputCostPer1K: 0.012
  }
};

// Системный промпт для стандартизации
const systemPrompt = `You are "Monito-Normalizer"

You receive a JSON array of raw product rows extracted from Indonesian price lists, invoices, catalogues, etc.  
Your task is to return a new JSON array with every row normalised, so that all names are in clean English and all units follow a single canonical list.

NORMALISATION RULES:
A. **Name Translation Rules**  
   • Translate Indonesian → English using EXACT terms that exist in grocery databases.
   • Fix spelling / duplicated spaces.  
   • Format: "<Main noun> <Descriptor>", e.g. "Cheese Mozzarella", "Chicken Fillet Fresh". Remove brand names & packaging words.  
   • USE STANDARD GROCERY TERMS - avoid unusual combinations.

CRITICAL INDONESIAN → ENGLISH MAPPINGS:
• "daun bawang" → "Chives" (NOT "Onion Green")
• "bawang merah" → "Onion Red" 
• "bawang putih" → "Garlic"
• "wortel" → "Carrot"
• "kentang" → "Potato" 
• "tomat" → "Tomato"
• "selada" → "Lettuce"
• "kriting/keriting" → "Curly"
• "harum" → "Sweet" (for fruits, NOT "Fragrant")
• "mangga" → "Mango"
• "pisang" → "Banana"
• "apel" → "Apple"
• "jeruk" → "Orange"
• "ayam" → "Chicken"
• "daging" → "Beef"
• "ikan" → "Fish"
• "udang" → "Shrimp"
• "sawi" → "Mustard Green"
• "kangkung" → "Water Spinach"
• "bayam" → "Spinach"

B. **Units**  
   • Canonical list (lower-case): kg, g, l, ml, pcs, pack, box, bottle, can, bunch, sheet, sack.  
   • Indonesian ⇒ English mapping: sisir → bunch · butir → pcs · lembar → sheet · karung → sack.  

C. **Category list**  
   dairy, meat, seafood, vegetables, fruits, spices, grains, bakery, beverages, oils, sweeteners, condiments, disposables, other.

D. **Confidence**  
   100 perfect → spelling obvious & unit clear;  
   80–99 high → minor guess (translation, plural/singular);  
   60–79 medium → unit guessed or ambiguous name;  
   <60 low → unsure (return anyway).

Return JSON array with: originalName, standardizedName, originalUnit, quantity, standardizedUnit, category, confidence.`;

class ModelTester {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY not found in environment variables');
    }
    this.results = {};
  }

  async testModel(modelConfig, testProducts) {
    console.log(`🧪 Testing ${modelConfig.name}...`);
    
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    
    try {
      // Оценим количество входных токенов (примерно)
      const inputText = systemPrompt + JSON.stringify(testProducts);
      inputTokens = Math.ceil(inputText.length / 4); // Примерная оценка токенов
      
      const response = await fetch(modelConfig.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelConfig.name,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user', 
              content: JSON.stringify(testProducts)
            }
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
                      required: [
                        "originalName", "standardizedName",
                        "originalUnit", "quantity",
                        "standardizedUnit", "category", "confidence"
                      ],
                      properties: {
                        originalName: { type: "string" },
                        standardizedName: { type: "string" },
                        originalUnit: { type: ["string", "null"] },
                        quantity: { type: ["number", "null"] },
                        standardizedUnit: { type: ["string", "null"] },
                        category: { type: "string" },
                        confidence: { type: "integer", minimum: 0, maximum: 100 }
                      },
                      additionalProperties: false
                    }
                  }
                },
                required: ["products"],
                additionalProperties: false
              },
              strict: true
            }
          },
          stream: false,
          max_completion_tokens: 16384
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      const endTime = Date.now();
      
      // Получаем токены из ответа (если доступно)
      if (result.usage) {
        inputTokens = result.usage.prompt_tokens;
        outputTokens = result.usage.completion_tokens;
      } else {
        // Оценим выходные токены
        const outputText = result.choices?.[0]?.message?.content || '';
        outputTokens = Math.ceil(outputText.length / 4);
      }
      
      // Парсим результат
      const content = result.choices?.[0]?.message?.content;
      let standardizedProducts = [];
      
      if (content) {
        try {
          const parsedResponse = JSON.parse(content);
          standardizedProducts = parsedResponse.products || parsedResponse;
        } catch (parseError) {
          console.error(`❌ Failed to parse response from ${modelConfig.name}`);
          throw parseError;
        }
      }
      
      // Вычисляем стоимость
      const inputCost = (inputTokens / 1000) * modelConfig.inputCostPer1K;
      const outputCost = (outputTokens / 1000) * modelConfig.outputCostPer1K;
      const totalCost = inputCost + outputCost;
      
      // Анализируем качество результатов
      const qualityMetrics = this.analyzeQuality(testProducts, standardizedProducts);
      
      return {
        model: modelConfig.name,
        success: true,
        processingTime: endTime - startTime,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        inputCost,
        outputCost,
        totalCost,
        productsProcessed: standardizedProducts.length,
        qualityMetrics,
        results: standardizedProducts
      };
      
    } catch (error) {
      console.error(`❌ Error testing ${modelConfig.name}:`, error.message);
      return {
        model: modelConfig.name,
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0
      };
    }
  }

  analyzeQuality(original, standardized) {
    if (!standardized || standardized.length !== original.length) {
      return {
        completionRate: standardized ? (standardized.length / original.length) * 100 : 0,
        averageConfidence: 0,
        categoryAccuracy: 0,
        unitStandardization: 0
      };
    }
    
    // Вычисляем метрики качества
    const confidenceScores = standardized.map(p => p.confidence || 0);
    const averageConfidence = confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;
    
    // Проверяем категории (должны быть из допустимого списка)
    const validCategories = ['dairy', 'meat', 'seafood', 'vegetables', 'fruits', 'spices', 'grains', 'bakery', 'beverages', 'oils', 'sweeteners', 'condiments', 'disposables', 'other'];
    const validCategoryCount = standardized.filter(p => validCategories.includes(p.category)).length;
    const categoryAccuracy = (validCategoryCount / standardized.length) * 100;
    
    // Проверяем стандартизацию единиц
    const validUnits = ['kg', 'g', 'l', 'ml', 'pcs', 'pack', 'box', 'bottle', 'can', 'bunch', 'sheet', 'sack'];
    const standardizedUnitsCount = standardized.filter(p => 
      !p.standardizedUnit || validUnits.includes(p.standardizedUnit.toLowerCase())
    ).length;
    const unitStandardization = (standardizedUnitsCount / standardized.length) * 100;
    
    return {
      completionRate: 100,
      averageConfidence: Math.round(averageConfidence),
      categoryAccuracy: Math.round(categoryAccuracy),
      unitStandardization: Math.round(unitStandardization)
    };
  }

  async runComparison(testSize = 25) {
    console.log(`🚀 Запуск сравнительного тестирования (${testSize} продуктов)\\n`);
    
    // Берем подвыборку для тестирования
    const testProducts = realProducts.slice(0, testSize).map(p => ({
      name: p.rawName,
      unit: p.originalUnit,
      price: p.price
    }));
    
    console.log(`📊 Тестовая выборка: ${testProducts.length} продуктов`);
    console.log(`📝 Примеры: ${testProducts.slice(0, 3).map(p => p.name).join(', ')}...\\n`);
    
    const results = {};
    
    // Тестируем каждую модель
    for (const [modelKey, modelConfig] of Object.entries(models)) {
      console.log(`⏳ Тестирование ${modelConfig.name}...`);
      results[modelKey] = await this.testModel(modelConfig, testProducts);
      console.log(`✅ ${modelConfig.name} завершен\\n`);
      
      // Пауза между запросами
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return results;
  }

  generateReport(results) {
    console.log('📊 СРАВНИТЕЛЬНЫЙ ОТЧЕТ ПО МОДЕЛЯМ\\n');
    console.log('='.repeat(80));
    
    // Заголовок таблицы
    console.log('| Модель           | Время(мс) | Токены | Стоимость | Качество | Успех |');
    console.log('|------------------|-----------|---------|-----------|----------|-------|');
    
    // Данные по каждой модели
    Object.entries(results).forEach(([key, result]) => {
      if (result.success) {
        const model = result.model.padEnd(16, ' ');
        const time = result.processingTime.toString().padEnd(9, ' ');
        const tokens = `${result.totalTokens}`.padEnd(7, ' ');
        const cost = `$${result.totalCost.toFixed(4)}`.padEnd(9, ' ');
        const quality = `${result.qualityMetrics.averageConfidence}%`.padEnd(8, ' ');
        const success = '✅';
        
        console.log(`| ${model} | ${time} | ${tokens} | ${cost} | ${quality} | ${success} |`);
      } else {
        const model = result.model.padEnd(16, ' ');
        console.log(`| ${model} | ERROR     | -       | -         | -        | ❌    |`);
      }
    });
    
    console.log('='.repeat(80));
    
    // Детальная аналитика
    console.log('\\n📈 ДЕТАЛЬНАЯ АНАЛИТИКА:\\n');
    
    Object.entries(results).forEach(([key, result]) => {
      if (result.success) {
        console.log(`🤖 ${result.model}:`);
        console.log(`   ⏱️  Скорость: ${result.processingTime}ms`);
        console.log(`   🎯 Токены: ${result.inputTokens} вход + ${result.outputTokens} выход = ${result.totalTokens}`);
        console.log(`   💰 Стоимость: $${result.totalCost.toFixed(4)} ($${result.inputCost.toFixed(4)} + $${result.outputCost.toFixed(4)})`);
        console.log(`   📊 Качество:`);
        console.log(`      - Завершенность: ${result.qualityMetrics.completionRate}%`);
        console.log(`      - Средняя уверенность: ${result.qualityMetrics.averageConfidence}%`);
        console.log(`      - Точность категорий: ${result.qualityMetrics.categoryAccuracy}%`);
        console.log(`      - Стандартизация единиц: ${result.qualityMetrics.unitStandardization}%`);
        console.log('');
      } else {
        console.log(`❌ ${result.model}: ${result.error}\\n`);
      }
    });
    
    // Сравнительные выводы
    const successfulResults = Object.values(results).filter(r => r.success);
    if (successfulResults.length >= 2) {
      console.log('🏆 ВЫВОДЫ:\\n');
      
      // Самая быстрая
      const fastest = successfulResults.reduce((a, b) => 
        a.processingTime < b.processingTime ? a : b
      );
      console.log(`⚡ Самая быстрая: ${fastest.model} (${fastest.processingTime}ms)`);
      
      // Самая дешевая
      const cheapest = successfulResults.reduce((a, b) => 
        a.totalCost < b.totalCost ? a : b
      );
      console.log(`💰 Самая дешевая: ${cheapest.model} ($${cheapest.totalCost.toFixed(4)})`);
      
      // Лучшее качество
      const bestQuality = successfulResults.reduce((a, b) => 
        a.qualityMetrics.averageConfidence > b.qualityMetrics.averageConfidence ? a : b
      );
      console.log(`🎯 Лучшее качество: ${bestQuality.model} (${bestQuality.qualityMetrics.averageConfidence}% уверенность)`);
      
      // Рекомендация
      console.log('\\n💡 РЕКОМЕНДАЦИЯ:');
      if (cheapest.model === fastest.model && cheapest.model === bestQuality.model) {
        console.log(`   ${cheapest.model} - лучший выбор по всем параметрам`);
      } else {
        console.log(`   Для скорости: ${fastest.model}`);
        console.log(`   Для экономии: ${cheapest.model}`);
        console.log(`   Для качества: ${bestQuality.model}`);
      }
    }
    
    // Сохраняем результаты
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = `model-comparison-${timestamp}.json`;
    fs.writeFileSync(reportFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      testSize: Object.values(results)[0]?.productsProcessed || 0,
      results
    }, null, 2));
    
    console.log(`\\n💾 Детальные результаты сохранены в: ${reportFile}`);
  }
}

// Запуск тестирования
async function main() {
  try {
    const tester = new ModelTester();
    const results = await tester.runComparison(25); // Тестируем на 25 продуктах
    tester.generateReport(results);
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
  }
}

// Проверяем наличие API ключа
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Не найден OPENAI_API_KEY в переменных окружения');
  process.exit(1);
}

main();