import OpenAI from 'openai';
import { z } from 'zod';

// Schema для нормализованных продуктов
const NormalizedProductSchema = z.object({
  originalName: z.string(),
  standardName: z.string().describe('Standardized product name in English, singular'),
  localName: z.string().optional().describe('Local language name if different'),
  category: z.string().describe('Product category: Vegetables, Fruits, Meat, Seafood, Dairy, Grains, Spices, Other'),
  subcategory: z.string().optional(),
  
  price: z.number().describe('Normalized price as number'),
  currency: z.string().default('IDR'),
  
  quantity: z.number().default(1),
  unit: z.string().describe('Standardized unit: kg, g, l, ml, pcs, bunch, pack'),
  unitMultiplier: z.number().default(1).describe('Multiplier to base unit (e.g., 1000 for kg to g)'),
  
  brand: z.string().optional(),
  grade: z.string().optional().describe('Quality grade if applicable'),
  origin: z.string().optional().describe('Country or region of origin'),
  
  attributes: z.array(z.string()).optional().describe('Additional attributes: organic, fresh, frozen, etc'),
  confidence: z.number().min(0).max(1).describe('Normalization confidence')
});

const BatchNormalizationSchema = z.object({
  products: z.array(NormalizedProductSchema),
  summary: z.object({
    totalProcessed: z.number(),
    successfullyNormalized: z.number(),
    lowConfidenceCount: z.number(),
    categoriesFound: z.array(z.string())
  })
});

export type NormalizedProduct = z.infer<typeof NormalizedProductSchema>;
export type BatchNormalizationResult = z.infer<typeof BatchNormalizationSchema>;

interface NormalizationOptions {
  targetLanguage?: 'en' | 'id' | 'auto';
  includeBrandDetection?: boolean;
  includeGradeDetection?: boolean;
  strictMode?: boolean; // Более строгая нормализация
  batchSize?: number;
}

export class AIDataNormalizer {
  private openai: OpenAI;
  private defaultModel = 'gpt-4.1-mini'; // Экономичная модель для нормализации

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Батчевая нормализация продуктов
   */
  async normalizeBatch(
    products: Array<{
      name: string;
      price?: string | number | null;
      unit?: string | null;
      category?: string | null;
    }>,
    options: NormalizationOptions = {}
  ): Promise<BatchNormalizationResult> {
    const batchSize = options.batchSize || 50; // Оптимальный размер батча
    const allResults: NormalizedProduct[] = [];

    // Обрабатываем батчами для оптимизации
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const batchResult = await this.processBatch(batch, options);
      allResults.push(...batchResult.products);
    }

    // Составляем итоговую статистику
    const summary = {
      totalProcessed: allResults.length,
      successfullyNormalized: allResults.filter(p => p.confidence > 0.7).length,
      lowConfidenceCount: allResults.filter(p => p.confidence <= 0.7).length,
      categoriesFound: [...new Set(allResults.map(p => p.category))]
    };

    return {
      products: allResults,
      summary
    };
  }

  /**
   * Обработка одного батча
   */
  private async processBatch(
    products: Array<any>,
    options: NormalizationOptions
  ): Promise<BatchNormalizationResult> {
    const prompt = this.buildNormalizationPrompt(options);
    const productsText = products.map((p, idx) => 
      `${idx + 1}. Name: "${p.name}", Price: ${p.price || 'N/A'}, Unit: ${p.unit || 'N/A'}, Category: ${p.category || 'Unknown'}`
    ).join('\n');

    try {
      const response = await this.openai.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: `You are an expert at normalizing and standardizing product data for inventory management systems. 

CRITICAL: Each product MUST have these exact fields:
- originalName: the original product name as provided
- standardName: the standardized English name (singular form)
- price: a NUMBER (not object) representing the price value
- currency: string like "IDR", "USD", etc.
- category: a STRING like "Vegetables", "Fruits", "Meat", etc.
- unit: standardized unit string like "kg", "g", "pcs", etc.

The response must be valid JSON matching EXACTLY this structure:
${JSON.stringify(BatchNormalizationSchema.shape, null, 2)}`
          },
          {
            role: 'user',
            content: `${prompt}\n\nProducts to normalize:\n${productsText}`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 4000
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No response content');
      }
      const parsed = JSON.parse(content) as BatchNormalizationResult;

      return parsed;
    } catch (error) {
      console.error('Error in batch normalization:', error);
      // Fallback: возвращаем минимально обработанные данные
      return this.fallbackNormalization(products);
    }
  }

  /**
   * Построение промпта для нормализации
   */
  private buildNormalizationPrompt(options: NormalizationOptions): string {
    const language = options.targetLanguage === 'en' ? 'English' : 
                    options.targetLanguage === 'id' ? 'Indonesian' : 
                    'the most appropriate language';

    return `Normalize the following products with these requirements:

1. NAMING:
   - Standardize product names to ${language}
   - Use singular form for countable items
   - Remove unnecessary words (fresh, organic, etc - move to attributes)
   - Detect and extract brand names if present
   ${options.includeBrandDetection ? '- Identify and separate brand names' : ''}
   ${options.includeGradeDetection ? '- Identify quality grades (A, B, Premium, etc)' : ''}

2. CATEGORIZATION:
   - Assign to main categories: Vegetables, Fruits, Meat, Seafood, Dairy, Grains, Spices, Other
   - Add subcategory when applicable (e.g., Leafy Greens, Citrus Fruits)

3. UNITS & QUANTITIES:
   - Standardize units: kg, g, l, ml, pcs, bunch, pack
   - Convert to base units when needed (e.g., 0.5kg → 500g)
   - Extract quantity if embedded in name

4. PRICING:
   - Extract numeric price value
   - Identify currency (default: IDR)
   - Handle price ranges by taking the average

5. ATTRIBUTES:
   - Extract attributes: organic, fresh, frozen, imported, local, etc.
   - Identify origin if mentioned

6. CONFIDENCE:
   - High (0.9-1.0): Clear, unambiguous data
   - Medium (0.7-0.9): Minor ambiguities
   - Low (0.0-0.7): Significant uncertainties

${options.strictMode ? 'Apply STRICT normalization - when in doubt, mark low confidence rather than guess.' : ''}`;
  }

  /**
   * Fallback нормализация при ошибке AI
   */
  private fallbackNormalization(products: Array<any>): BatchNormalizationResult {
    const normalized = products.map(p => ({
      originalName: p.name,
      standardName: this.basicCleanup(p.name),
      category: this.guessCategory(p.name),
      price: this.parsePrice(p.price),
      currency: 'IDR',
      quantity: 1,
      unit: this.normalizeUnit(p.unit),
      unitMultiplier: 1,
      confidence: 0.5
    }));

    return {
      products: normalized,
      summary: {
        totalProcessed: normalized.length,
        successfullyNormalized: 0,
        lowConfidenceCount: normalized.length,
        categoriesFound: [...new Set(normalized.map(p => p.category))]
      }
    };
  }

  /**
   * Базовая очистка названия
   */
  private basicCleanup(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Простое определение категории
   */
  private guessCategory(name: string): string {
    const lowerName = name.toLowerCase();
    
    const categoryKeywords = {
      'Vegetables': ['vegetable', 'sayur', 'cabbage', 'carrot', 'potato', 'tomato', 'onion'],
      'Fruits': ['fruit', 'buah', 'apple', 'banana', 'orange', 'mango'],
      'Meat': ['meat', 'daging', 'beef', 'chicken', 'pork', 'lamb'],
      'Seafood': ['fish', 'ikan', 'shrimp', 'seafood', 'salmon', 'tuna'],
      'Dairy': ['milk', 'susu', 'cheese', 'yogurt', 'butter'],
      'Grains': ['rice', 'beras', 'wheat', 'flour', 'bread'],
      'Spices': ['spice', 'rempah', 'pepper', 'salt', 'garlic']
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => lowerName.includes(keyword))) {
        return category;
      }
    }

    return 'Other';
  }

  /**
   * Парсинг цены
   */
  private parsePrice(price: string | number | null | undefined): number {
    if (typeof price === 'number') return price;
    if (!price) return 0;
    
    const cleaned = price.toString()
      .replace(/[^\d.,]/g, '')
      .replace(/,/g, '.');
    
    return parseFloat(cleaned) || 0;
  }

  /**
   * Нормализация единиц измерения
   */
  private normalizeUnit(unit: string | null | undefined): string {
    if (!unit) return 'pcs';
    
    const lowerUnit = unit.toLowerCase().trim();
    
    const unitMap: Record<string, string> = {
      'kilogram': 'kg',
      'gram': 'g',
      'liter': 'l',
      'litre': 'l',
      'milliliter': 'ml',
      'piece': 'pcs',
      'pieces': 'pcs',
      'buah': 'pcs',
      'biji': 'pcs',
      'ikat': 'bunch',
      'sisir': 'bunch'
    };

    return unitMap[lowerUnit] || lowerUnit;
  }

  /**
   * Умное объединение дубликатов
   */
  async deduplicateProducts(
    products: NormalizedProduct[]
  ): Promise<NormalizedProduct[]> {
    const prompt = `Review these normalized products and identify duplicates.
    Consider products duplicate if they represent the same item despite:
    - Minor spelling differences
    - Different units (if convertible)
    - Brand variations of same product
    
    Return only unique products, merging duplicate information intelligently.`;

    // Здесь можно добавить AI логику для дедупликации
    // Пока возвращаем как есть
    return products;
  }
}

// Экспорт singleton экземпляра
export const aiDataNormalizer = new AIDataNormalizer();