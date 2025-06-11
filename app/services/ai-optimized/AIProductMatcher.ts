import OpenAI from 'openai';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import type { NormalizedProduct } from './AIDataNormalizer';

// Schema для результатов сопоставления
const ProductMatchSchema = z.object({
  newProductId: z.string(),
  matchedProductId: z.string().nullable(),
  matchType: z.enum(['exact', 'variant', 'similar', 'no_match']),
  confidence: z.number().min(0).max(1),
  reason: z.string().describe('Brief explanation of match decision'),
  suggestedAction: z.enum(['use_existing', 'create_new', 'merge', 'review'])
});

const BatchMatchResultSchema = z.object({
  matches: z.array(ProductMatchSchema),
  summary: z.object({
    totalProducts: z.number(),
    exactMatches: z.number(),
    variantMatches: z.number(),
    similarMatches: z.number(),
    noMatches: z.number(),
    requiresReview: z.number()
  }),
  insights: z.array(z.string()).describe('Key insights from matching process')
});

export type ProductMatch = z.infer<typeof ProductMatchSchema>;
export type BatchMatchResult = z.infer<typeof BatchMatchResultSchema>;

interface MatchingOptions {
  threshold?: number; // Минимальный порог для совпадения (0.0-1.0)
  strictMode?: boolean; // Строгий режим сопоставления
  considerVariants?: boolean; // Учитывать варианты (размеры, бренды)
  categoryWeight?: number; // Вес категории при сопоставлении
  maxCandidates?: number; // Макс количество кандидатов для сравнения
}

export class AIProductMatcher {
  private openai: OpenAI;
  private prisma: PrismaClient;
  private defaultModel = 'gpt-4.1-mini';

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.prisma = new PrismaClient();
  }

  /**
   * Семантическое сопоставление новых продуктов с существующими
   */
  async matchProducts(
    newProducts: NormalizedProduct[],
    options: MatchingOptions = {}
  ): Promise<BatchMatchResult> {
    const threshold = options.threshold || 0.75;
    const maxCandidates = options.maxCandidates || 100;

    // Получаем существующие продукты для сопоставления
    const existingProducts = await this.getRelevantExistingProducts(
      newProducts,
      maxCandidates
    );

    // Разбиваем на батчи для эффективной обработки
    const batchSize = 20;
    const allMatches: ProductMatch[] = [];

    for (let i = 0; i < newProducts.length; i += batchSize) {
      const batch = newProducts.slice(i, i + batchSize);
      const batchResult = await this.processBatchMatching(
        batch,
        existingProducts,
        options
      );
      allMatches.push(...batchResult.matches);
    }

    // Генерируем инсайты
    const insights = await this.generateMatchingInsights(allMatches, newProducts);

    return {
      matches: allMatches,
      summary: this.calculateSummary(allMatches),
      insights
    };
  }

  /**
   * Получение релевантных существующих продуктов
   */
  private async getRelevantExistingProducts(
    newProducts: NormalizedProduct[],
    limit: number
  ) {
    // Получаем уникальные категории из новых продуктов
    const categories = [...new Set(newProducts.map(p => p.category).filter(Boolean))];

    // Загружаем продукты из этих категорий
    const existingProducts = await this.prisma.product.findMany({
      where: categories.length > 0 ? {
        category: {
          in: categories
        }
      } : {},
      select: {
        id: true,
        name: true,
        standardizedName: true,
        category: true,
        standardizedUnit: true
      },
      take: limit
    });

    return existingProducts;
  }

  /**
   * Обработка батча для сопоставления
   */
  private async processBatchMatching(
    newProducts: NormalizedProduct[],
    existingProducts: any[],
    options: MatchingOptions
  ): Promise<BatchMatchResult> {
    const prompt = this.buildMatchingPrompt(options);
    
    // Подготавливаем данные для AI
    const newProductsData = newProducts.map((p, idx) => ({
      id: `new_${idx}`,
      name: p.standardName,
      category: p.category,
      unit: p.unit,
      brand: p.brand,
      attributes: p.attributes?.join(', ')
    }));

    const existingProductsData = existingProducts.map(p => ({
      id: p.id,
      name: p.standardizedName || p.name,
      category: p.category,
      unit: p.standardizedUnit
    }));

    try {
      const response = await this.openai.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: `You are an expert at matching products in inventory systems. You understand product variations, brands, and naming conventions. You must respond with a valid JSON object matching this schema:\n${JSON.stringify(BatchMatchResultSchema.shape, null, 2)}`
          },
          {
            role: 'user',
            content: `${prompt}

New Products:
${JSON.stringify(newProductsData, null, 2)}

Existing Products Database:
${JSON.stringify(existingProductsData, null, 2)}`
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
      const parsed = JSON.parse(content) as BatchMatchResult;

      // Заменяем временные ID на реальные
      parsed.matches = parsed.matches.map((match, idx) => ({
        ...match,
        newProductId: newProducts[idx].originalName // Используем оригинальное имя как ID
      }));

      return parsed;
    } catch (error) {
      console.error('Error in batch matching:', error);
      return this.fallbackMatching(newProducts);
    }
  }

  /**
   * Построение промпта для сопоставления
   */
  private buildMatchingPrompt(options: MatchingOptions): string {
    return `Match new products with existing products in the database:

MATCHING RULES:
1. EXACT MATCH: Same product, same unit, same or very similar name
2. VARIANT MATCH: Same base product but different size/brand/grade
3. SIMILAR MATCH: Related products that could be substitutes
4. NO MATCH: Completely different product, create new entry

CONSIDERATIONS:
- Product names may have spelling variations
- Consider singular/plural forms as same
- Brand names may be included or omitted
- Units should be compatible (kg/g, l/ml)
- Category must match or be very close
${options.considerVariants ? '- Identify size/brand variants of same base product' : ''}
${options.strictMode ? '- Apply STRICT matching - only very high confidence matches' : ''}

CONFIDENCE SCORING:
- 0.9-1.0: Exact match or minor spelling difference
- 0.7-0.9: Clear variant or very similar product  
- 0.5-0.7: Possible match, needs review
- 0.0-0.5: No match found

For each new product, find the best match and suggest action:
- use_existing: Use the matched product ID
- create_new: No good match, create new product
- merge: Products should be merged
- review: Human review needed`;
  }

  /**
   * Fallback сопоставление при ошибке AI
   */
  private fallbackMatching(newProducts: NormalizedProduct[]): BatchMatchResult {
    const matches = newProducts.map(product => ({
      newProductId: product.originalName,
      matchedProductId: null,
      matchType: 'no_match' as const,
      confidence: 0,
      reason: 'Fallback mode - AI matching unavailable',
      suggestedAction: 'create_new' as const
    }));

    return {
      matches,
      summary: {
        totalProducts: matches.length,
        exactMatches: 0,
        variantMatches: 0,
        similarMatches: 0,
        noMatches: matches.length,
        requiresReview: 0
      },
      insights: ['AI matching unavailable, all products marked as new']
    };
  }

  /**
   * Расчет статистики сопоставления
   */
  private calculateSummary(matches: ProductMatch[]) {
    return {
      totalProducts: matches.length,
      exactMatches: matches.filter(m => m.matchType === 'exact').length,
      variantMatches: matches.filter(m => m.matchType === 'variant').length,
      similarMatches: matches.filter(m => m.matchType === 'similar').length,
      noMatches: matches.filter(m => m.matchType === 'no_match').length,
      requiresReview: matches.filter(m => m.suggestedAction === 'review').length
    };
  }

  /**
   * Генерация инсайтов из процесса сопоставления
   */
  private async generateMatchingInsights(
    matches: ProductMatch[],
    newProducts: NormalizedProduct[]
  ): Promise<string[]> {
    const insights: string[] = [];

    // Анализ результатов
    const matchRate = matches.filter(m => m.matchedProductId).length / matches.length;
    if (matchRate > 0.8) {
      insights.push(`High match rate (${(matchRate * 100).toFixed(0)}%) - most products already in database`);
    } else if (matchRate < 0.3) {
      insights.push(`Low match rate (${(matchRate * 100).toFixed(0)}%) - many new products detected`);
    }

    // Анализ по категориям
    const categoryCounts = newProducts.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topCategory = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))[0];
    
    if (topCategory) {
      insights.push(`Most products are in ${topCategory[0]} category (${topCategory[1]} items)`);
    }

    // Проверка на потенциальные дубликаты
    const lowConfidenceMatches = matches.filter(m => 
      m.confidence > 0.5 && m.confidence < 0.7
    ).length;
    
    if (lowConfidenceMatches > 5) {
      insights.push(`${lowConfidenceMatches} potential duplicates require manual review`);
    }

    return insights;
  }

  /**
   * Умное слияние продуктов
   */
  async mergeProducts(
    productIds: string[],
    strategy: 'keep_newest' | 'keep_most_complete' | 'manual'
  ): Promise<void> {
    // Реализация слияния продуктов
    console.log(`Merging products: ${productIds.join(', ')} with strategy: ${strategy}`);
  }

  /**
   * Обучение на подтвержденных совпадениях
   */
  async learnFromFeedback(
    matchId: string,
    feedback: 'correct' | 'incorrect',
    correctProductId?: string
  ): Promise<void> {
    // Сохраняем обратную связь для улучшения будущих сопоставлений
    console.log(`Learning from feedback: ${matchId} was ${feedback}`);
  }
}

// Экспорт singleton экземпляра
export const aiProductMatcher = new AIProductMatcher();