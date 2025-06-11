import OpenAI from 'openai';
import { z } from 'zod';

// Schema для структурированного вывода
const ProductSchema = z.object({
  name: z.string().describe('Product name in English, singular form'),
  price: z.number().nullable().describe('Numeric price value'),
  unit: z.string().describe('Standardized unit: kg, pcs, l, etc'),
  category: z.string().nullable().describe('Product category'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1')
});

const ExtractedDataSchema = z.object({
  documentType: z.enum(['price_list', 'invoice', 'catalog', 'order', 'unknown']),
  supplierName: z.string().nullable(),
  supplierContact: z.object({
    email: z.string().nullable(),
    phone: z.string().nullable(),
    address: z.string().nullable()
  }).nullable(),
  products: z.array(ProductSchema),
  extractionQuality: z.number().min(0).max(1).describe('Overall extraction quality 0-1'),
  metadata: z.object({
    totalPages: z.number().optional(),
    language: z.string().optional(),
    currency: z.string().optional(),
    dateExtracted: z.string().optional()
  }).optional()
});

export type ExtractedData = z.infer<typeof ExtractedDataSchema>;

interface ProcessOptions {
  maxProducts?: number;
  model?: 'gpt-4o' | 'gpt-o3' | 'gpt-o3-mini';
  includeMetadata?: boolean;
  preferredLanguage?: string;
}

export class UnifiedAIProcessor {
  private openai: OpenAI;
  private defaultModel = 'o3'; // Мощная модель для извлечения данных

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Универсальный метод обработки любого документа
   */
  async processDocument(
    content: string | Buffer,
    fileName: string,
    options: ProcessOptions = {}
  ): Promise<ExtractedData> {
    const model = options.model || this.defaultModel;
    const isImage = this.isImageFile(fileName);
    
    try {
      if (isImage && typeof content !== 'string') {
        return await this.processWithVision(content, fileName, model, options);
      } else {
        return await this.processWithText(
          typeof content === 'string' ? content : content.toString(),
          fileName,
          model,
          options
        );
      }
    } catch (error) {
      console.error('Error processing document:', error);
      throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Обработка изображений через Vision API
   */
  private async processWithVision(
    imageBuffer: Buffer,
    fileName: string,
    model: string,
    options: ProcessOptions
  ): Promise<ExtractedData> {
    const base64Image = imageBuffer.toString('base64');
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    const prompt = this.buildExtractionPrompt(options);

    const response = await this.openai.chat.completions.create({
      model: model === 'o3' ? 'o3' : model, // Vision использует ту же модель o3
      messages: [
        {
          role: 'system',
          content: `You must respond with a valid JSON object matching this schema:\n${JSON.stringify(ExtractedDataSchema.shape, null, 2)}`
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 4000
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response content');
    }
    const parsed = JSON.parse(content) as ExtractedData;

    return this.enhanceExtractedData(parsed, fileName);
  }

  /**
   * Обработка текстовых документов
   */
  private async processWithText(
    text: string,
    fileName: string,
    model: string,
    options: ProcessOptions
  ): Promise<ExtractedData> {
    const prompt = this.buildExtractionPrompt(options);
    
    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are an expert at extracting structured data from documents. Focus on accuracy and completeness. You must respond with a valid JSON object matching this schema:\n${JSON.stringify(ExtractedDataSchema.shape, null, 2)}`
        },
        {
          role: 'user',
          content: `${prompt}\n\nDocument content:\n${text.substring(0, 15000)}` // Ограничиваем размер
        }
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 4000
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response content');
    }
    const parsed = JSON.parse(content) as ExtractedData;

    return this.enhanceExtractedData(parsed, fileName);
  }

  /**
   * Построение оптимального промпта для извлечения
   */
  private buildExtractionPrompt(options: ProcessOptions): string {
    const maxProducts = options.maxProducts || 1000;
    const language = options.preferredLanguage || 'English';

    return `Extract all information from this document:

1. Identify document type (price list, invoice, catalog, order)
2. Extract supplier information (name, contact details)
3. Extract ALL products with:
   - Name (standardized to ${language}, singular form)
   - Price (numeric value only)
   - Unit (standardized: kg, pcs, l, ml, g, etc)
   - Category (if identifiable)
   - Confidence score for each product

Important:
- Extract up to ${maxProducts} products
- Normalize product names to be consistent
- Convert all prices to numbers
- Standardize units
- Skip headers, totals, and non-product lines
- Set high confidence for clear data, low for ambiguous

Return structured data according to the schema.`;
  }

  /**
   * Дополнение извлеченных данных метаданными
   */
  private enhanceExtractedData(data: ExtractedData, fileName: string): ExtractedData {
    return {
      ...data,
      metadata: {
        ...data.metadata,
        dateExtracted: new Date().toISOString(),
        currency: data.metadata?.currency || this.detectCurrency(data.products)
      }
    };
  }

  /**
   * Определение валюты из продуктов
   */
  private detectCurrency(products: any[]): string {
    // Простая эвристика для определения валюты
    // В реальности AI уже должен это определить
    return 'IDR'; // По умолчанию для индонезийского рынка
  }

  /**
   * Проверка, является ли файл изображением
   */
  private isImageFile(fileName: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
  }

  /**
   * Батчевая обработка нескольких страниц/файлов
   */
  async processBatch(
    files: Array<{ content: string | Buffer; fileName: string }>,
    options: ProcessOptions = {}
  ): Promise<ExtractedData[]> {
    // Обрабатываем параллельно, но с ограничением
    const batchSize = 3;
    const results: ExtractedData[] = [];

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(file => this.processDocument(file.content, file.fileName, options))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Выбор оптимальной модели на основе задачи
   */
  selectOptimalModel(documentType: string, complexity: 'low' | 'medium' | 'high'): string {
    // Умный выбор модели для экономии
    if (complexity === 'low') return 'gpt-o3-mini';
    if (complexity === 'medium') return 'gpt-o3';
    if (documentType === 'complex_pdf' || complexity === 'high') return 'gpt-4o';
    return 'gpt-o3-mini';
  }
}

// Экспорт singleton экземпляра
export const unifiedAIProcessor = new UnifiedAIProcessor();