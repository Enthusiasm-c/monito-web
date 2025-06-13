import OpenAI from 'openai';
import { z } from 'zod';
import { ExtractedData, ExtractedDataSchema, ProcessOptions } from './UnifiedAIProcessor';

export class UnifiedAIProcessorOptimized {
  private openai: OpenAI;
  private defaultModel = 'gpt-4o-mini';

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Оптимизированная обработка многостраничного PDF
   */
  async processPdfPagesOptimized(
    pageImages: string[],
    fileName: string,
    model: string,
    options: ProcessOptions
  ): Promise<ExtractedData> {
    console.log(`Processing ${pageImages.length} pages from PDF...`);
    
    // Оптимизация: обрабатываем только первые 2 страницы для всех моделей
    const pagesToProcess = Math.min(pageImages.length, 2);
    
    // Параллельная обработка страниц
    const pagePromises = [];
    
    for (let i = 0; i < pagesToProcess; i++) {
      console.log(`Queuing page ${i + 1}/${pagesToProcess} for processing...`);
      
      const imageUrl = `data:image/png;base64,${pageImages[i]}`;
      const prompt = this.buildExtractionPrompt(options);
      
      const pagePromise = this.processPage(imageUrl, prompt, i, pageImages.length, model);
      pagePromises.push(pagePromise);
    }
    
    // Ждем завершения всех страниц параллельно
    console.log(`Processing ${pagesToProcess} pages in parallel...`);
    const pageResults = await Promise.all(pagePromises);
    
    // Объединяем результаты
    const allProducts: any[] = [];
    let supplierName: string | null = null;
    let supplierContact: any = null;
    let documentType = 'price_list';
    
    pageResults.forEach((result, index) => {
      if (result.success && result.data) {
        // Собираем информацию о поставщике с первой страницы
        if (index === 0) {
          supplierName = result.data.supplierName;
          supplierContact = result.data.supplierContact;
          documentType = result.data.documentType;
        }
        
        // Собираем все продукты
        if (result.data.products && Array.isArray(result.data.products)) {
          console.log(`Found ${result.data.products.length} products on page ${index + 1}`);
          allProducts.push(...result.data.products);
        }
      }
    });
    
    console.log(`Total products extracted from PDF: ${allProducts.length}`);
    
    // Строим финальный результат
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

  private async processPage(
    imageUrl: string,
    prompt: string,
    pageIndex: number,
    totalPages: number,
    model: string
  ): Promise<{ success: boolean; data?: any }> {
    try {
      const response = await this.openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting structured product data from images. This is page ${pageIndex + 1} of a multi-page document. Extract ALL products you can see. EVERY product MUST have a confidence score. Respond with valid JSON only.`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt + `\n\nThis is page ${pageIndex + 1} of ${totalPages}. Focus on extracting ALL products visible on this page.` },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      });
      
      const content = response.choices[0].message.content;
      if (content) {
        // Очистка от markdown
        let cleanContent = content;
        if (content.includes('```json')) {
          cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        }
        
        let pageData = JSON.parse(cleanContent);
        
        // Исправление common issues
        if (pageData.documentType === 'price list') {
          pageData.documentType = 'price_list';
        }
        
        return { success: true, data: pageData };
      }
      
      return { success: false };
    } catch (error) {
      console.error(`Error processing page ${pageIndex + 1}:`, error);
      return { success: false };
    }
  }

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
}