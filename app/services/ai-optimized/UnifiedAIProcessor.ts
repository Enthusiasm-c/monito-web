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
  model?: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-3.5-turbo';
  includeMetadata?: boolean;
  preferredLanguage?: string;
}

export class UnifiedAIProcessor {
  private openai: OpenAI;
  private defaultModel = 'gpt-4o-mini'; // Оптимальная модель для извлечения данных

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
    let base64Image: string;
    let mimeType = 'image/jpeg';
    
    // Для PDF файлов нужна специальная обработка
    if (fileName.toLowerCase().endsWith('.pdf')) {
      console.log('Converting PDF to images for Vision API...');
      const convertedImages = await this.convertPdfToImage(imageBuffer);
      
      // Для многостраничных PDF используем специальный подход
      if (convertedImages.images && convertedImages.images.length > 1) {
        console.log(`Processing ${convertedImages.images.length} PDF pages...`);
        return await this.processPdfPages(convertedImages.images, fileName, model, options);
      } else {
        base64Image = convertedImages.images[0];
        mimeType = 'image/jpeg';
      }
    } else {
      base64Image = imageBuffer.toString('base64');
    }
    
    const imageUrl = `data:${mimeType};base64,${base64Image}`;

    const prompt = this.buildExtractionPrompt(options);

    const response = await this.openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: `You are an expert at extracting structured product data from images. You must respond ONLY with valid JSON (no markdown). EVERY product MUST have a confidence score. Example response:
{
  "documentType": "price_list",
  "supplierName": "Company Name",
  "supplierContact": {"email": "test@example.com", "phone": "+123456", "address": "123 Street"},
  "products": [{"name": "Product 1", "price": 100, "unit": "kg", "category": "Food", "confidence": 0.95}],
  "extractionQuality": 0.9,
  "metadata": {"totalPages": 1, "language": "en", "currency": "USD"}
}`
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 4000
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response content');
    }
    
    console.log('AI Response:', content);
    console.log('Response length:', content.length);
    
    // Clean response if wrapped in markdown code blocks
    let cleanContent = content;
    if (content.includes('```json')) {
      cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (content.includes('```')) {
      cleanContent = content.replace(/```\n?/g, '').trim();
    }
    
    // Parse and validate with Zod
    let rawData = JSON.parse(cleanContent);
    console.log('Parsed data - supplierName:', rawData.supplierName);
    console.log('Parsed data - products count:', rawData.products?.length || 0);
    
    // Fix common AI response issues
    if (rawData.documentType === 'price list') {
      rawData.documentType = 'price_list';
    }
    
    // Ensure supplierContact exists
    if (!rawData.supplierContact) {
      rawData.supplierContact = {
        email: null,
        phone: null,
        address: null
      };
    } else {
      // Convert "not provided" strings to null
      if (rawData.supplierContact.email === 'not provided') rawData.supplierContact.email = null;
      if (rawData.supplierContact.address === 'not provided') rawData.supplierContact.address = null;
      if (rawData.supplierContact.phone === 'not provided') rawData.supplierContact.phone = null;
    }
    
    const validated = ExtractedDataSchema.parse(rawData);
    return this.enhanceExtractedData(validated, fileName);
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
    
    console.log('Processing text document:', fileName);
    console.log('Document preview:', text.substring(0, 200));
    
    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are an expert at extracting structured product data from text documents. You must respond ONLY with valid JSON (no markdown). Example response:
{
  "documentType": "price_list",
  "supplierName": "Company Name",
  "supplierContact": {"email": "test@example.com", "phone": "+123456", "address": "123 Street"},
  "products": [{"name": "Product 1", "price": 100, "unit": "kg", "category": "Food", "confidence": 0.95}],
  "extractionQuality": 0.9,
  "metadata": {"totalPages": 1, "language": "en", "currency": "USD"}
}`
        },
        {
          role: 'user',
          content: `${prompt}\n\nDocument content:\n${text.substring(0, 15000)}` // Ограничиваем размер
        }
      ],
      temperature: 0.1,
      max_tokens: 4000
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response content');
    }
    
    // Parse and validate with Zod
    const rawData = JSON.parse(content);
    const validated = ExtractedDataSchema.parse(rawData);
    return this.enhanceExtractedData(validated, fileName);
  }

  /**
   * Построение оптимального промпта для извлечения
   */
  private buildExtractionPrompt(options: ProcessOptions): string {
    const maxProducts = options.maxProducts || 1000;
    const language = options.preferredLanguage || 'English';

    return `You are analyzing a document image. Extract all product information visible in this image.

IMPORTANT: This might be a price list, catalog, invoice or order form. Look for:
- Tables with products and prices
- Lists of items with costs
- Any product names with associated numbers

Extract:
1. Document type - MUST be one of: "price_list", "invoice", "catalog", "order", "unknown" (use underscore, not space)
2. Supplier/Company name (look at headers, logos, titles)
3. ALL products you can see with:
   - name (exactly as written, then standardize to ${language})
   - price (numeric value, look for numbers near product names)
   - unit (kg, pcs, l, ml, g, pack, box, etc - look for unit indicators)
   - category (if visible or can be inferred)
   - confidence (number between 0 and 1, how confident you are about this product)

Rules:
- Extract up to ${maxProducts} products
- Include ALL products you can see, even if price is unclear
- If you see a table, extract EVERY row that looks like a product
- Convert all prices to numbers (remove currency symbols)
- If unit is not clear, use "pcs" as default
- Set confidence based on clarity of information

Focus on extracting as many products as possible from the image.`;
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
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.pdf'];
    return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
  }

  /**
   * Конвертация PDF в изображение для обработки через Vision API
   */
  private async convertPdfToImage(pdfBuffer: Buffer): Promise<{ images: string[], page_count?: number }> {
    const { spawn } = require('child_process');
    const path = require('path');
    const fs = require('fs').promises;
    const os = require('os');
    
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-convert-'));
    const pdfPath = path.join(tempDir, 'input.pdf');
    const outputPath = path.join(tempDir, 'output.png');
    
    try {
      // Сохраняем PDF во временный файл
      await fs.writeFile(pdfPath, pdfBuffer);
      
      // Используем Python скрипт для конвертации
      const pythonScript = path.join(process.cwd(), 'scripts', 'pdf_to_image_converter.py');
      
      return new Promise((resolve, reject) => {
        const python = spawn('python3', [
          pythonScript,
          pdfPath,
          '--output-format', 'base64',
          '--single-page'
        ]);
        
        let output = '';
        let error = '';
        
        python.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        python.stderr.on('data', (data) => {
          error += data.toString();
        });
        
        python.on('close', async (code) => {
          // Очищаем временные файлы
          try {
            await fs.rmdir(tempDir, { recursive: true });
          } catch {}
          
          if (code !== 0) {
            console.error('PDF conversion error:', error);
            reject(new Error(`PDF conversion failed: ${error}`));
          } else {
            try {
              const result = JSON.parse(output);
              if (result.images && result.images.length > 0) {
                resolve({ images: result.images, page_count: result.page_count });
              } else {
                reject(new Error('No images extracted from PDF'));
              }
            } catch (parseError) {
              reject(new Error(`Failed to parse conversion result: ${parseError}`));
            }
          }
        });
      });
    } catch (error) {
      // Очищаем временные файлы в случае ошибки
      try {
        await fs.rmdir(tempDir, { recursive: true });
      } catch {}
      throw error;
    }
  }

  /**
   * Обработка многостраничного PDF
   */
  private async processPdfPages(
    pageImages: string[],
    fileName: string,
    model: string,
    options: ProcessOptions
  ): Promise<ExtractedData> {
    console.log(`Processing ${pageImages.length} pages from PDF...`);
    
    const allProducts: any[] = [];
    let supplierName: string | null = null;
    let supplierContact: any = null;
    let documentType = 'price_list';
    
    // Обрабатываем первые 2 страницы для моделей gpt-4o (более дорогие)
    const pagesToProcess = model === 'gpt-4o' ? Math.min(pageImages.length, 2) : Math.min(pageImages.length, 4);
    
    // ОПТИМИЗАЦИЯ: Параллельная обработка страниц
    const pagePromises = [];
    
    for (let i = 0; i < pagesToProcess; i++) {
      console.log(`Queuing page ${i + 1}/${pagesToProcess} for parallel processing...`);
      
      // Определяем формат изображения (после оптимизации это JPEG)
      const imageUrl = `data:image/jpeg;base64,${pageImages[i]}`;
      const prompt = this.buildExtractionPrompt(options);
      
      // Создаем промис для каждой страницы
      const pagePromise = (async (pageIndex: number) => {
        try {
          const response = await this.openai.chat.completions.create({
            model: model,
            messages: [
              {
                role: 'system',
                content: `You are an expert at extracting structured product data from images. This is page ${pageIndex + 1} of a multi-page document. Extract ALL products you can see. EVERY product MUST have a confidence score. Example response:
{
  "documentType": "price_list",
  "supplierName": "Company Name",
  "supplierContact": {"email": "test@example.com", "phone": "+123456", "address": "123 Street"},
  "products": [{"name": "Product 1", "price": 100, "unit": "kg", "category": "Food", "confidence": 0.95}],
  "extractionQuality": 0.9,
  "metadata": {"totalPages": 1, "language": "en", "currency": "USD"}
}`
              },
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt + `\n\nThis is page ${pageIndex + 1} of ${pageImages.length}. Focus on extracting ALL products visible on this page.` },
                  { type: 'image_url', image_url: { url: imageUrl } }
                ]
              }
            ],
            temperature: 0.1,
            max_tokens: 4000
          });
          
          const content = response.choices[0].message.content;
          if (content) {
            console.log(`Page ${pageIndex + 1} AI Response received`);
            
            // Clean response if wrapped in markdown
            let cleanContent = content;
            if (content.includes('```json')) {
              cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            }
            
            let pageData = JSON.parse(cleanContent);
            console.log(`Page ${pageIndex + 1} - Supplier: ${pageData.supplierName}, Products: ${pageData.products?.length || 0}`);
            
            // Fix common issues
            if (pageData.documentType === 'price list') {
              pageData.documentType = 'price_list';
            }
            
            return { pageIndex, pageData, success: true };
          }
          
          return { pageIndex, success: false };
        } catch (error) {
          console.error(`Error processing page ${pageIndex + 1}:`, error);
          return { pageIndex, success: false };
        }
      })(i);
      
      pagePromises.push(pagePromise);
    }
    
    // Ждем завершения всех страниц параллельно
    console.log(`Processing ${pagesToProcess} pages in parallel...`);
    const startParallel = Date.now();
    const pageResults = await Promise.all(pagePromises);
    console.log(`Parallel processing completed in ${((Date.now() - startParallel) / 1000).toFixed(1)}s`);
    
    // Обрабатываем результаты в правильном порядке
    pageResults.sort((a, b) => a.pageIndex - b.pageIndex);
    
    pageResults.forEach((result) => {
      if (result.success && result.pageData) {
        // Collect supplier info from first page
        if (result.pageIndex === 0) {
          supplierName = result.pageData.supplierName;
          supplierContact = result.pageData.supplierContact;
          documentType = result.pageData.documentType;
        }
        
        // Collect all products
        if (result.pageData.products && Array.isArray(result.pageData.products)) {
          console.log(`Found ${result.pageData.products.length} products on page ${result.pageIndex + 1}`);
          allProducts.push(...result.pageData.products);
        }
      }
    });
    
    console.log(`Total products extracted from PDF: ${allProducts.length}`);
    
    // Build final result
    const result: ExtractedData = {
      documentType: documentType as any,
      supplierName: supplierName,
      supplierContact: supplierContact || { email: null, phone: null, address: null },
      products: allProducts,
      extractionQuality: allProducts.length > 0 ? 0.85 : 0,
      metadata: {
        totalPages: pageImages.length,
        language: 'en',
        currency: 'IDR',
        dateExtracted: new Date().toISOString()
      }
    };
    
    return result;
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
    if (complexity === 'low') return 'gpt-4o-mini';
    if (complexity === 'medium') return 'gpt-4o-mini';
    if (documentType === 'complex_pdf' || complexity === 'high') return 'gpt-4o';
    return 'gpt-4o-mini';
  }
}

// Экспорт singleton экземпляра
export const unifiedAIProcessor = new UnifiedAIProcessor();