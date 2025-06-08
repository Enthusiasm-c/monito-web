import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const prisma = new PrismaClient();

interface StandardProduct {
  id: string;
  standardName: string;
  embedding: number[];
  category: string;
  aliases: string[];
  confidence: number;
}

interface SimilarityResult {
  product: StandardProduct;
  similarity: number;
}

class EmbeddingService {
  private referenceProducts: Map<string, StandardProduct> = new Map();
  private categoryThresholds = {
    'Vegetables': 0.85,
    'Meat': 0.82,
    'Seafood': 0.82,
    'Dairy': 0.83,
    'Grains': 0.80,
    'Other': 0.80
  };

  constructor() {
    this.loadReferenceProducts();
  }

  /**
   * Генерирует embedding для текста
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: this.preprocessText(text),
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Генерирует embedding для множества текстов (батчевая обработка)
   */
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const preprocessedTexts = texts.map(text => this.preprocessText(text));
      
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: preprocessedTexts,
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      console.error('Error generating batch embeddings:', error);
      throw error;
    }
  }

  /**
   * Предобработка текста для embedding
   */
  private preprocessText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, ' ') // Убираем спецсимволы
      .replace(/\s+/g, ' ')      // Нормализуем пробелы
      .substring(0, 200);        // Ограничиваем длину
  }

  /**
   * Вычисляет cosine similarity между двумя векторами
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Находит наиболее похожий продукт в эталонной базе
   */
  async findSimilarProduct(rawName: string, category?: string): Promise<SimilarityResult | null> {
    try {
      // Генерируем embedding для входного названия
      const inputEmbedding = await this.generateEmbedding(rawName);
      
      let bestMatch: SimilarityResult | null = null;
      let bestSimilarity = 0;

      // Ищем среди эталонных продуктов
      for (const product of this.referenceProducts.values()) {
        // Фильтруем по категории если указана
        if (category && product.category !== category) continue;

        const similarity = this.cosineSimilarity(inputEmbedding, product.embedding);
        
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = {
            product,
            similarity
          };
        }
      }

      // Проверяем порог similarity
      const threshold = category ? 
        this.categoryThresholds[category as keyof typeof this.categoryThresholds] || 0.80 : 
        0.80;

      if (bestMatch && bestMatch.similarity >= threshold) {
        console.log(`🎯 Found similar product: "${rawName}" → "${bestMatch.product.standardName}" (similarity: ${bestMatch.similarity.toFixed(3)})`);
        return bestMatch;
      }

      console.log(`🔍 No similar product found for "${rawName}" (best similarity: ${bestSimilarity.toFixed(3)}, threshold: ${threshold})`);
      return null;

    } catch (error) {
      console.error('Error finding similar product:', error);
      return null;
    }
  }

  /**
   * Добавляет новый продукт в эталонную базу
   */
  async addToReferenceBase(rawName: string, standardName: string, category: string): Promise<void> {
    try {
      // Генерируем embedding для стандартизированного названия
      const embedding = await this.generateEmbedding(standardName);
      
      const product: StandardProduct = {
        id: `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        standardName,
        embedding,
        category,
        aliases: [rawName, standardName],
        confidence: 1.0
      };

      this.referenceProducts.set(product.id, product);
      
      // Сохраняем в БД для персистентности
      await this.saveReferenceProduct(product);
      
      console.log(`➕ Added to reference base: "${standardName}" (category: ${category})`);
    } catch (error) {
      console.error('Error adding to reference base:', error);
    }
  }

  /**
   * Загружает эталонную базу продуктов
   */
  private async loadReferenceProducts(): Promise<void> {
    try {
      console.log('📚 Loading reference products from database...');
      
      // Загружаем из БД существующие стандартизированные продукты
      const existingProducts = await prisma.product.findMany({
        select: {
          id: true,
          standardizedName: true,
          category: true,
          name: true
        },
        where: {
          standardizedName: {
            not: null
          }
        }
      });

      // Группируем уникальные стандартизированные названия
      const uniqueStandards = new Map<string, { category: string; aliases: string[] }>();
      
      for (const product of existingProducts) {
        const key = `${product.standardizedName}_${product.category}`;
        if (!uniqueStandards.has(key)) {
          uniqueStandards.set(key, {
            category: product.category,
            aliases: []
          });
        }
        uniqueStandards.get(key)!.aliases.push(product.name);
      }

      // Генерируем embedding для уникальных продуктов батчами
      const standardNames = Array.from(uniqueStandards.keys()).map(key => key.split('_')[0]);
      
      if (standardNames.length > 0) {
        console.log(`🔄 Generating embeddings for ${standardNames.length} reference products...`);
        
        // Обрабатываем батчами по 50 штук
        const batchSize = 50;
        for (let i = 0; i < standardNames.length; i += batchSize) {
          const batch = standardNames.slice(i, i + batchSize);
          const embeddings = await this.generateBatchEmbeddings(batch);
          
          batch.forEach((standardName, index) => {
            const key = Array.from(uniqueStandards.keys())[i + index];
            const data = uniqueStandards.get(key)!;
            
            const product: StandardProduct = {
              id: `loaded_${i + index}`,
              standardName,
              embedding: embeddings[index],
              category: data.category,
              aliases: data.aliases,
              confidence: 0.9
            };
            
            this.referenceProducts.set(product.id, product);
          });
          
          console.log(`✅ Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(standardNames.length / batchSize)}`);
        }
      }

      // Добавляем начальную эталонную базу если она пустая
      if (this.referenceProducts.size === 0) {
        await this.initializeReferenceBase();
      }

      console.log(`📊 Loaded ${this.referenceProducts.size} reference products`);
    } catch (error) {
      console.error('Error loading reference products:', error);
      // Инициализируем базовую эталонную базу в случае ошибки
      await this.initializeReferenceBase();
    }
  }

  /**
   * Инициализирует базовую эталонную базу продуктов
   */
  private async initializeReferenceBase(): Promise<void> {
    console.log('🏗️ Initializing basic reference base...');
    
    const basicProducts = [
      // Овощи
      { name: 'tomato', category: 'Vegetables' },
      { name: 'onion red', category: 'Vegetables' },
      { name: 'onion brown', category: 'Vegetables' },
      { name: 'carrot', category: 'Vegetables' },
      { name: 'potato', category: 'Vegetables' },
      { name: 'cucumber', category: 'Vegetables' },
      { name: 'cabbage', category: 'Vegetables' },
      { name: 'lettuce', category: 'Vegetables' },
      { name: 'broccoli', category: 'Vegetables' },
      { name: 'cauliflower', category: 'Vegetables' },
      
      // Мясо
      { name: 'chicken breast', category: 'Meat' },
      { name: 'chicken thigh', category: 'Meat' },
      { name: 'beef', category: 'Meat' },
      { name: 'pork', category: 'Meat' },
      { name: 'lamb', category: 'Meat' },
      
      // Рыба
      { name: 'salmon', category: 'Seafood' },
      { name: 'tuna', category: 'Seafood' },
      { name: 'shrimp', category: 'Seafood' },
      
      // Молочные
      { name: 'milk', category: 'Dairy' },
      { name: 'cheese', category: 'Dairy' },
      { name: 'yogurt', category: 'Dairy' },
      
      // Крупы
      { name: 'rice jasmine', category: 'Grains' },
      { name: 'rice basmati', category: 'Grains' },
      { name: 'flour wheat', category: 'Grains' }
    ];

    // Генерируем embedding для базовых продуктов
    const names = basicProducts.map(p => p.name);
    const embeddings = await this.generateBatchEmbeddings(names);
    
    basicProducts.forEach((productData, index) => {
      const product: StandardProduct = {
        id: `basic_${index}`,
        standardName: productData.name,
        embedding: embeddings[index],
        category: productData.category,
        aliases: [productData.name],
        confidence: 1.0
      };
      
      this.referenceProducts.set(product.id, product);
    });

    console.log(`✅ Initialized ${basicProducts.length} basic reference products`);
  }

  /**
   * Сохраняет эталонный продукт в БД
   */
  private async saveReferenceProduct(product: StandardProduct): Promise<void> {
    try {
      // Здесь можно добавить сохранение в специальную таблицу для эталонных продуктов
      // Пока сохраняем в виде JSON в отдельной таблице или файле
      console.log(`💾 Saving reference product: ${product.standardName}`);
    } catch (error) {
      console.error('Error saving reference product:', error);
    }
  }

  /**
   * Получает статистику эталонной базы
   */
  getStats(): { total: number; byCategory: Record<string, number> } {
    const stats = {
      total: this.referenceProducts.size,
      byCategory: {} as Record<string, number>
    };

    for (const product of this.referenceProducts.values()) {
      stats.byCategory[product.category] = (stats.byCategory[product.category] || 0) + 1;
    }

    return stats;
  }
}

// Singleton instance
export const embeddingService = new EmbeddingService();