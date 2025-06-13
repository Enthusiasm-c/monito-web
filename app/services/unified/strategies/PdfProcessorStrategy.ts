import { BaseFileProcessorStrategy, ProcessingOptions, ProcessingResult } from '../FileProcessorStrategy';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import OpenAI from 'openai';
import { parsePrice, standardizeUnit, categorizeProduct, safeJsonParse } from '@/app/utils/common';

export class PdfProcessorStrategy extends BaseFileProcessorStrategy {
  private openai: OpenAI | null = null;
  
  constructor() {
    super('PdfProcessor');
    
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }
  
  canHandle(fileName: string, mimeType?: string): boolean {
    const extensions = ['.pdf'];
    const mimeTypes = ['application/pdf'];
    
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
    let products: ProcessingResult['products'] = [];
    
    try {
      // Try different extraction methods based on options
      if (options.useAI && this.openai) {
        // Try AI Vision first for better accuracy
        try {
          products = await this.processWithAIVision(filePath, options);
        } catch (error) {
          errors.push(`AI Vision failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          // Fallback to Python processor
          products = await this.processWithPython(filePath, options);
        }
      } else {
        // Use Python processor
        products = await this.processWithPython(filePath, options);
      }
      
      // Apply limit if specified
      if (options.maxProducts && products.length > options.maxProducts) {
        products = products.slice(0, options.maxProducts);
      }
      
      return this.createResult(products, errors, startTime);
    } catch (error) {
      errors.push(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return this.createResult([], errors, startTime);
    }
  }
  
  private async processWithPython(
    filePath: string,
    options: ProcessingOptions
  ): Promise<ProcessingResult['products']> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(process.cwd(), 'scripts', 'enhanced_pdf_processor.py');
      const outputPath = filePath.replace('.pdf', '_extracted.json');
      
      const args = [scriptPath, filePath, outputPath];
      if (options.forceOCR) args.push('--force-ocr');
      
      const pythonProcess = spawn('python3', args);
      
      let stderr = '';
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      pythonProcess.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error(`Python process failed: ${stderr}`));
          return;
        }
        
        try {
          const jsonContent = await fs.readFile(outputPath, 'utf-8');
          const extractedData = safeJsonParse(jsonContent, { products: [] });
          
          // Clean up temp file
          await fs.unlink(outputPath).catch(() => {});
          
          // Convert to our format
          const products = this.convertExtractedData(extractedData.products || []);
          resolve(products);
        } catch (error) {
          reject(error);
        }
      });
      
      // Set timeout
      if (options.timeout) {
        setTimeout(() => {
          pythonProcess.kill();
          reject(new Error('Processing timeout'));
        }, options.timeout);
      }
    });
  }
  
  private async processWithAIVision(
    filePath: string,
    options: ProcessingOptions
  ): Promise<ProcessingResult['products']> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }
    
    // Convert PDF to images first
    const imagePaths = await this.convertPdfToImages(filePath);
    const products: ProcessingResult['products'] = [];
    
    try {
      for (const imagePath of imagePaths) {
        const imageData = await fs.readFile(imagePath);
        const base64Image = imageData.toString('base64');
        
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4-vision-preview',
          messages: [
            {
              role: 'system',
              content: 'You are a data extraction specialist. Extract product information from price lists and catalogs.',
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Extract all products from this price list image. For each product, provide:
                  - name: product name
                  - price: numeric price value
                  - unit: unit of measurement (kg, piece, box, etc)
                  - category: product category if visible
                  - brand: brand name if visible
                  
                  Return as JSON array. Example:
                  [{"name": "Product 1", "price": 100, "unit": "kg", "category": "Food", "brand": "Brand A"}]`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 4000,
          temperature: 0.1,
        });
        
        const content = response.choices[0]?.message?.content || '[]';
        const extractedProducts = safeJsonParse(content, []);
        
        if (Array.isArray(extractedProducts)) {
          const converted = this.convertExtractedData(extractedProducts);
          products.push(...converted);
        }
      }
    } finally {
      // Clean up images
      for (const imagePath of imagePaths) {
        await fs.unlink(imagePath).catch(() => {});
      }
    }
    
    return products;
  }
  
  private async convertPdfToImages(pdfPath: string): Promise<string[]> {
    const outputDir = path.dirname(pdfPath);
    const baseName = path.basename(pdfPath, '.pdf');
    
    return new Promise((resolve, reject) => {
      const args = [
        '-density', '150',
        '-quality', '90',
        pdfPath,
        path.join(outputDir, `${baseName}_%d.png`),
      ];
      
      const convertProcess = spawn('convert', args);
      
      convertProcess.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error('Failed to convert PDF to images'));
          return;
        }
        
        // Find generated images
        const files = await fs.readdir(outputDir);
        const imagePaths = files
          .filter(f => f.startsWith(`${baseName}_`) && f.endsWith('.png'))
          .map(f => path.join(outputDir, f))
          .sort();
          
        resolve(imagePaths);
      });
    });
  }
  
  private convertExtractedData(rawProducts: any[]): ProcessingResult['products'] {
    const products: ProcessingResult['products'] = [];
    
    for (const item of rawProducts) {
      if (!item || typeof item !== 'object') continue;
      
      const name = String(item.name || item.product_name || item.item || '').trim();
      const priceValue = item.price || item.harga || item.cost;
      const price = parsePrice(priceValue);
      
      if (!name || price === null) continue;
      
      const unit = standardizeUnit(item.unit || item.satuan || item.uom || 'PIECE');
      const category = item.category || item.kategori || categorizeProduct(name, unit);
      
      products.push({
        name,
        unit,
        price,
        category,
        brand: item.brand || item.merk || undefined,
        barcode: item.barcode || item.code || undefined,
        description: item.description || undefined,
      });
    }
    
    return products;
  }
}