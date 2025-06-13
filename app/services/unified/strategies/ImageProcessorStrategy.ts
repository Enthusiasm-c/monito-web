import { BaseFileProcessorStrategy, ProcessingOptions, ProcessingResult } from '../FileProcessorStrategy';
import * as fs from 'fs/promises';
import OpenAI from 'openai';
import sharp from 'sharp';
import { parsePrice, standardizeUnit, categorizeProduct, safeJsonParse } from '@/app/utils/common';

export class ImageProcessorStrategy extends BaseFileProcessorStrategy {
  private openai: OpenAI | null = null;
  
  constructor() {
    super('ImageProcessor');
    
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }
  
  canHandle(fileName: string, mimeType?: string): boolean {
    const extensions = ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.bmp'];
    const mimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/tiff',
      'image/bmp',
    ];
    
    const hasValidExtension = extensions.some(ext => fileName.toLowerCase().endsWith(ext));
    const hasValidMimeType = mimeType ? mimeTypes.includes(mimeType) : true;
    
    return hasValidExtension && hasValidMimeType;
  }
  
  async process(
    filePath: string,
    fileName: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    
    if (!this.openai) {
      errors.push('OpenAI API key not configured');
      return this.createResult([], errors, startTime);
    }
    
    try {
      // Optimize image for processing
      const optimizedImagePath = await this.optimizeImage(filePath);
      
      try {
        // Process with AI Vision
        const products = await this.processWithVision(optimizedImagePath, options);
        
        // Apply limit if specified
        if (options.maxProducts && products.length > options.maxProducts) {
          products.splice(options.maxProducts);
        }
        
        return this.createResult(products, errors, startTime);
      } finally {
        // Clean up optimized image if different from original
        if (optimizedImagePath !== filePath) {
          await fs.unlink(optimizedImagePath).catch(() => {});
        }
      }
    } catch (error) {
      errors.push(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return this.createResult([], errors, startTime);
    }
  }
  
  private async optimizeImage(imagePath: string): Promise<string> {
    try {
      const metadata = await sharp(imagePath).metadata();
      
      // Check if optimization is needed
      const needsOptimization = 
        (metadata.width && metadata.width > 2048) ||
        (metadata.height && metadata.height > 2048) ||
        metadata.format === 'tiff';
      
      if (!needsOptimization) {
        return imagePath;
      }
      
      // Create optimized version
      const optimizedPath = imagePath.replace(/\.[^/.]+$/, '_optimized.jpg');
      
      await sharp(imagePath)
        .resize(2048, 2048, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toFile(optimizedPath);
      
      return optimizedPath;
    } catch (error) {
      // If optimization fails, use original
      return imagePath;
    }
  }
  
  private async processWithVision(
    imagePath: string,
    options: ProcessingOptions
  ): Promise<ProcessingResult['products']> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }
    
    const imageData = await fs.readFile(imagePath);
    const base64Image = imageData.toString('base64');
    
    const systemPrompt = options.mode === 'debug' 
      ? 'You are a data extraction specialist. Extract ALL product information visible in the image, including partial or unclear items.'
      : 'You are a data extraction specialist. Extract product information from price lists and catalogs.';
    
    const userPrompt = `Extract all products from this price list/catalog image. For each product, provide:
    - name: product name (required)
    - price: numeric price value (required)
    - unit: unit of measurement like kg, piece, box, pack, etc (default to "piece" if not visible)
    - category: product category if determinable
    - brand: brand name if visible
    - barcode: barcode/SKU if visible
    - description: any additional product details
    
    ${options.validationLevel === 'lenient' ? 'Include items even if some information is unclear.' : ''}
    ${options.validationLevel === 'strict' ? 'Only include items with complete information.' : ''}
    
    Return as a JSON array. Example:
    [
      {
        "name": "Fresh Milk 1L",
        "price": 25000,
        "unit": "bottle",
        "category": "Dairy",
        "brand": "Brand X"
      }
    ]
    
    Important: Return ONLY the JSON array, no additional text.`;
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userPrompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 4000,
      temperature: 0.1,
    });
    
    const content = response.choices[0]?.message?.content || '[]';
    
    // Try to extract JSON from the response
    let jsonContent = content;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    }
    
    const extractedProducts = safeJsonParse(jsonContent, []);
    
    if (!Array.isArray(extractedProducts)) {
      throw new Error('Invalid response format from AI');
    }
    
    // Convert and validate products
    const products: ProcessingResult['products'] = [];
    
    for (const item of extractedProducts) {
      if (!item || typeof item !== 'object') continue;
      
      const name = String(item.name || '').trim();
      const price = parsePrice(item.price);
      
      if (!name || price === null) continue;
      
      const unit = standardizeUnit(item.unit || 'PIECE');
      const category = item.category || categorizeProduct(name, unit);
      
      const product: ProcessingResult['products'][0] = {
        name,
        unit,
        price,
        category,
      };
      
      // Add optional fields
      if (item.brand) product.brand = String(item.brand).trim();
      if (item.barcode) product.barcode = String(item.barcode).trim();
      if (item.description) product.description = String(item.description).trim();
      
      // Apply validation
      if (options.validationLevel === 'strict') {
        if (!product.category || product.category === 'Other') continue;
        if (!product.brand && !product.barcode) continue;
      }
      
      products.push(product);
    }
    
    return products;
  }
}