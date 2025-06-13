import { PrismaClient, Prisma } from '@prisma/client';
import { put } from '@vercel/blob';
import * as crypto from 'crypto';
import { Redis } from '@upstash/redis';

import { unifiedAIProcessor, ExtractedData } from './UnifiedAIProcessor';
import { aiDataNormalizer, NormalizedProduct } from './AIDataNormalizer';
import { aiProductMatcher, ProductMatch } from './AIProductMatcher';

const prisma = new PrismaClient();

// Инициализация Redis для кэширования
const redis = process.env.UPSTASH_REDIS_REST_URL ? new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
}) : null;

interface UploadedFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

interface ProcessingOptions {
  supplierId?: string;
  autoApprove?: boolean;
  skipCache?: boolean;
  model?: 'gpt-4o' | 'gpt-4o-mini';
}

interface ProcessingResult {
  uploadId: string;
  status: 'success' | 'partial' | 'failed';
  stats: {
    totalExtracted: number;
    successfullyProcessed: number;
    newProducts: number;
    updatedProducts: number;
    errors: number;
    processingTimeMs: number;
    estimatedCostUsd: number;
  };
  supplier: {
    id: string;
    name: string;
    isNew: boolean;
  };
  insights: string[];
}

export class UnifiedAIPipeline {
  private costEstimator = {
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 }
  };

  /**
   * Главный метод обработки загруженного файла
   */
  async processUpload(
    file: UploadedFile,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const fileHash = this.calculateFileHash(file.buffer);
    
    // Проверка кэша
    if (!options.skipCache && redis) {
      const cached = await this.getCachedResult(fileHash);
      if (cached) {
        console.log('🚀 Returning cached result');
        return cached;
      }
    }

    try {
      // 1. Извлечение данных с помощью AI
      console.log('📄 Extracting data from document...');
      const extracted = await unifiedAIProcessor.processDocument(
        file.buffer,
        file.originalName,
        { model: options.model }
      );

      // 2. Определение или создание поставщика
      const supplier = await this.resolveSupplier(
        extracted.supplierName,
        extracted.supplierContact,
        options.supplierId,
        file.originalName
      );

      // 3. Сохранение файла в blob storage
      const fileUrl = await this.uploadToBlob(file, supplier.id);

      // 4. Создание записи загрузки
      const upload = await this.createUploadRecord(
        supplier.id,
        file.originalName,
        fileUrl,
        extracted,
        file.size,
        file.mimeType
      );

      // 5. Нормализация продуктов
      console.log('🔧 Normalizing products...');
      const normalized = await aiDataNormalizer.normalizeBatch(
        extracted.products,
        { targetLanguage: 'en', includeBrandDetection: true }
      );

      // 6. Сопоставление с существующими продуктами
      console.log('🔍 Matching products...');
      const matches = await aiProductMatcher.matchProducts(
        normalized.products,
        { threshold: 0.75, considerVariants: true }
      );

      // 7. Сохранение продуктов и цен
      const saveResult = await this.saveProductsAndPrices(
        normalized.products,
        matches.matches,
        supplier.id,
        upload.id
      );

      // 8. Обновление статуса загрузки
      await this.updateUploadStatus(
        upload.id,
        saveResult.errors === 0 ? 'completed' : 'partial',
        options.autoApprove
      );

      // 9. Расчет метрик и стоимости
      const processingTime = Date.now() - startTime;
      const estimatedCost = this.estimateCost(
        extracted.products.length,
        options.model || 'gpt-4o-mini'
      );

      const result: ProcessingResult = {
        uploadId: upload.id,
        status: saveResult.errors === 0 ? 'success' : 'partial',
        stats: {
          totalExtracted: extracted.products.length,
          successfullyProcessed: saveResult.processed,
          newProducts: saveResult.newProducts,
          updatedProducts: saveResult.updatedProducts,
          errors: saveResult.errors,
          processingTimeMs: processingTime,
          estimatedCostUsd: estimatedCost
        },
        supplier: {
          id: supplier.id,
          name: supplier.name,
          isNew: supplier.isNew
        },
        insights: this.generateInsights(extracted, normalized, matches, saveResult)
      };

      // Сохранение в кэш
      if (redis && !options.skipCache) {
        await this.cacheResult(fileHash, result);
      }

      return result;

    } catch (error) {
      console.error('❌ Pipeline error:', error);
      throw new Error(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Определение или создание поставщика
   */
  private async resolveSupplier(
    extractedName: string | null,
    contactInfo: any,
    providedId?: string,
    fileName?: string
  ) {
    if (providedId) {
      const existing = await prisma.supplier.findUnique({
        where: { id: providedId }
      });
      if (existing) {
        return { ...existing, isNew: false };
      }
    }

    // Если имя не извлечено, используем имя файла как fallback
    const supplierName = extractedName || `Auto-detected from ${fileName || 'upload'}`;

    // Поиск существующего поставщика
    const existing = await prisma.supplier.findFirst({
      where: {
        OR: [
          { name: { equals: supplierName, mode: 'insensitive' } },
          { name: { contains: supplierName, mode: 'insensitive' } }
        ]
      }
    });

    if (existing) {
      return { ...existing, isNew: false };
    }

    // Создание нового поставщика
    const newSupplier = await prisma.supplier.create({
      data: {
        id: `supplier_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: supplierName,
        email: contactInfo?.email,
        phone: contactInfo?.phone,
        address: contactInfo?.address,
        contactInfo: JSON.stringify(contactInfo)
      }
    });

    return { ...newSupplier, isNew: true };
  }

  /**
   * Загрузка файла в blob storage
   */
  private async uploadToBlob(file: UploadedFile, supplierId: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${supplierId}/${timestamp}_${file.originalName}`;

    const { url } = await put(fileName, file.buffer, {
      access: 'public',
      contentType: file.mimeType
    });

    return url;
  }

  /**
   * Создание записи загрузки
   */
  private async createUploadRecord(
    supplierId: string,
    fileName: string,
    fileUrl: string,
    extractedData: ExtractedData,
    fileSize: number,
    mimeType: string
  ) {
    return await prisma.upload.create({
      data: {
        id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        supplierId,
        originalName: fileName,
        fileName: fileName,
        url: fileUrl,
        status: 'processing',
        approvalStatus: 'pending_review',
        extractedData: extractedData as any,
        fileSize: fileSize,
        mimeType: mimeType
      }
    });
  }

  /**
   * Сохранение продуктов и цен
   */
  private async saveProductsAndPrices(
    normalizedProducts: NormalizedProduct[],
    matches: ProductMatch[],
    supplierId: string,
    uploadId: string
  ) {
    let processed = 0;
    let newProducts = 0;
    let updatedProducts = 0;
    let errors = 0;

    for (let i = 0; i < normalizedProducts.length; i++) {
      const product = normalizedProducts[i];
      const match = matches[i];
      
      try {

        let productId: string;

        if (match.matchedProductId && match.suggestedAction === 'use_existing') {
          // Используем существующий продукт
          productId = match.matchedProductId;
          updatedProducts++;
        } else {
          // Создаем новый продукт
          const newProduct = await prisma.product.create({
            data: {
              id: `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: product.originalName,
              rawName: product.originalName,
              standardizedName: product.standardName,
              category: product.category,
              unit: product.unit,
              standardizedUnit: product.unit,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
          productId = newProduct.id;
          newProducts++;
        }

        // Сохраняем цену
        await prisma.price.create({
          data: {
            id: `price_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            productId,
            supplierId,
            uploadId,
            amount: new Prisma.Decimal(product.price),
            unit: product.unit,
            validFrom: new Date()
          }
        });

        processed++;
      } catch (error) {
        console.error(`Error saving product ${i} (${product.originalName}):`, error);
        console.error('Product data:', { product, match });
        errors++;
      }
    }

    return { processed, newProducts, updatedProducts, errors };
  }

  /**
   * Обновление статуса загрузки
   */
  private async updateUploadStatus(
    uploadId: string,
    status: string,
    autoApprove: boolean = false
  ) {
    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        status,
        approvalStatus: autoApprove ? 'approved' : 'pending_review',
        autoApproved: autoApprove
      }
    });
  }

  /**
   * Генерация инсайтов
   */
  private generateInsights(
    extracted: ExtractedData,
    normalized: any,
    matches: any,
    saveResult: any
  ): string[] {
    const insights: string[] = [];

    // Качество извлечения
    if (extracted.extractionQuality > 0.9) {
      insights.push('High quality document with clear structure');
    } else if (extracted.extractionQuality < 0.7) {
      insights.push('Document quality issues detected - manual review recommended');
    }

    // Анализ цен
    const avgPrice = extracted.products.reduce((sum, p) => sum + (p.price || 0), 0) / extracted.products.length;
    insights.push(`Average product price: ${avgPrice.toFixed(2)} ${extracted.metadata?.currency || 'IDR'}`);

    // Новые продукты
    if (saveResult.newProducts > 10) {
      insights.push(`${saveResult.newProducts} new products added - significant catalog expansion`);
    }

    // Дубликаты
    const duplicateRate = (saveResult.updatedProducts / saveResult.processed) * 100;
    if (duplicateRate > 70) {
      insights.push(`High duplicate rate (${duplicateRate.toFixed(0)}%) - regular supplier update`);
    }

    return insights;
  }

  /**
   * Расчет стоимости обработки
   */
  private estimateCost(productCount: number, model: string): number {
    const costs = this.costEstimator[model as keyof typeof this.costEstimator] || this.costEstimator['gpt-4o-mini'];
    
    // Примерная оценка токенов
    const avgTokensPerProduct = 50;
    const totalTokens = productCount * avgTokensPerProduct;
    
    const inputCost = (totalTokens / 1000) * costs.input;
    const outputCost = (totalTokens / 1000) * costs.output * 0.5; // Output обычно меньше
    
    return inputCost + outputCost;
  }

  /**
   * Хеширование файла для кэширования
   */
  private calculateFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Получение результата из кэша
   */
  private async getCachedResult(fileHash: string): Promise<ProcessingResult | null> {
    if (!redis) return null;
    
    try {
      const cached = await redis.get(`file:${fileHash}`);
      return cached as ProcessingResult | null;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  /**
   * Сохранение результата в кэш
   */
  private async cacheResult(fileHash: string, result: ProcessingResult): Promise<void> {
    if (!redis) return;
    
    try {
      // Кэшируем на 24 часа
      await redis.set(`file:${fileHash}`, result, { ex: 86400 });
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }
}

// Экспорт singleton экземпляра
export const unifiedAIPipeline = new UnifiedAIPipeline();