/**
 * Enhanced PDF Extractor  
 * Converts PDF to images and uses UnifiedGeminiService
 * Now extends BaseProcessor for consistency
 */

import { spawn } from 'child_process';
import path from 'path';
import { BaseProcessor } from '../lib/core/BaseProcessor';
import { ProcessOptions, ProcessingResult } from '../lib/core/Interfaces';
import { UnifiedGeminiService } from './core/UnifiedGeminiService';

interface PdfExtractionResult {
  supplier?: {
    name: string;
    email?: string;
    phone?: string; 
    address?: string;
  };
  products: ExtractedProduct[];
  totalRowsDetected: number;
  totalRowsProcessed: number;
  completenessRatio: number;
  processingTimeMs: number;
  tokensUsed: number;
  costUsd: number;
  errors: string[];
  extractionMethods: {
    aiVision?: { pages: number; products: number };
    bestMethod: string;
  };
}

interface ExtractedProduct {
  name: string;
  price: number;
  unit: string;
  category?: string;
  description?: string;
  sourcePage?: number;
  sourceMethod?: string;
}

class EnhancedPdfExtractor extends BaseProcessor {
  private geminiService: UnifiedGeminiService;
  
  private readonly config = {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024,
    maxPages: parseInt(process.env.AI_VISION_MAX_PAGES || '8'),
  };

  public static getInstance(): EnhancedPdfExtractor {
    return super.getInstance.call(this) as EnhancedPdfExtractor;
  }

  constructor() {
    super('EnhancedPdfExtractor');
    this.geminiService = new UnifiedGeminiService();
  }

  /**
   * Required implementation from BaseProcessor
   */
  async processDocument(
    fileContent: Buffer | string,
    fileName: string,
    options?: ProcessOptions
  ): Promise<ProcessingResult> {
    // Convert buffer to URL if needed - this is a simplified implementation
    const fileUrl = typeof fileContent === 'string' ? fileContent : '';
    const result = await this.extractFromPdf(fileUrl, fileName);
    
    return {
      success: true,
      products: result.products,
      supplier: result.supplier,
      totalProducts: result.products.length,
      processingTimeMs: result.processingTimeMs,
      tokensUsed: result.tokensUsed,
      costUsd: result.costUsd,
      metadata: {
        completenessRatio: result.completenessRatio,
        extractionMethods: result.extractionMethods,
        errors: result.errors
      }
    };
  }

  /**
   * Main extraction method for PDF files - converts to images and uses Gemini
   */
  async extractFromPdf(fileUrl: string, fileName: string): Promise<PdfExtractionResult> {
    const startTime = Date.now();
    console.log(`🔍 PDF extraction starting: ${fileName}`);

    try {
      // Check file size
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > this.config.maxFileSize) {
        throw new Error(`PDF too large: ${contentLength} bytes > ${this.config.maxFileSize} bytes`);
      }

      // Convert PDF to images and process with Gemini
      console.log(`🤖 Converting PDF to images and processing with Gemini Flash 2.0: ${fileName}`);
      
      const images = await this.convertPdfToImages(fileUrl);
      
      if (images.length === 0) {
        throw new Error('Failed to convert PDF to images');
      }

      console.log(`📄 Processing ${images.length} pages with Gemini...`);
      
      // Process each image with Gemini
      let allProducts: ExtractedProduct[] = [];
      let totalTokens = 0;
      let totalCost = 0;
      let supplier: any = null;
      const errors: string[] = [];

      for (let i = 0; i < images.length; i++) {
        try {
          console.log(`🔍 Processing page ${i + 1}/${images.length}...`);
          
          // Use Gemini service to process the image
          const result = await this.geminiService.processDocument(
            images[i],
            `${fileName}_page_${i + 1}.png`,
            {
              model: 'gemini-2.0-flash-exp',
              maxProducts: 1000,
              includeMetadata: true
            }
          );

          if (result.success && result.extractedData) {
            const pageProducts = result.extractedData.products || [];
            
            // Add page info to products
            pageProducts.forEach(product => {
              product.sourcePage = i + 1;
              product.sourceMethod = 'gemini_vision';
            });
            
            allProducts = allProducts.concat(pageProducts);
            
            // Get supplier info from first successful page
            if (!supplier && result.extractedData.supplier) {
              supplier = result.extractedData.supplier;
            }

            totalTokens += result.tokensUsed || 0;
            totalCost += result.costUsd || 0;
            
            console.log(`✅ Page ${i + 1}: ${pageProducts.length} products extracted`);
          } else {
            const error = `Page ${i + 1}: ${result.error || 'Unknown error'}`;
            errors.push(error);
            console.log(`⚠️ ${error}`);
          }
        } catch (pageError) {
          const error = `Page ${i + 1}: ${pageError instanceof Error ? pageError.message : 'Processing failed'}`;
          errors.push(error);
          console.log(`❌ ${error}`);
        }
      }

      const processingTime = Date.now() - startTime;
      
      console.log(`🎉 PDF processing completed: ${allProducts.length} products from ${images.length} pages in ${processingTime}ms`);
      console.log(`💰 Total cost: $${totalCost.toFixed(6)} (${totalTokens} tokens)`);

      return {
        supplier,
        products: allProducts,
        totalRowsDetected: allProducts.length,
        totalRowsProcessed: allProducts.length,
        completenessRatio: allProducts.length > 0 ? 1.0 : 0,
        processingTimeMs: processingTime,
        tokensUsed: totalTokens,
        costUsd: totalCost,
        errors,
        extractionMethods: {
          aiVision: {
            pages: images.length,
            products: allProducts.length
          },
          bestMethod: 'gemini_vision'
        }
      };

    } catch (error) {
      console.error(`❌ PDF extraction failed: ${error}`);
      return {
        supplier: undefined,
        products: [],
        totalRowsDetected: 0,
        totalRowsProcessed: 0,
        completenessRatio: 0,
        processingTimeMs: Date.now() - startTime,
        tokensUsed: 0,
        costUsd: 0,
        errors: [`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        extractionMethods: {
          bestMethod: 'failed'
        }
      };
    }
  }

  /**
   * Convert PDF to base64 images using Python script
   */
  private async convertPdfToImages(fileUrl: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(process.cwd(), 'scripts', 'pdf_to_images.py');
      
      const pythonProcess = spawn('python3', [
        scriptPath,
        fileUrl,
        this.config.maxPages.toString()
      ]);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`PDF to images conversion failed: ${stderr}`);
          reject(new Error(`PDF conversion failed: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          if (result.success && result.images) {
            resolve(result.images);
          } else {
            reject(new Error(result.error || 'Failed to convert PDF to images'));
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse conversion result: ${parseError}`));
        }
      });
    });
  }
}

// Export singleton instance
const enhancedPdfExtractor = EnhancedPdfExtractor.getInstance();
export { enhancedPdfExtractor, type PdfExtractionResult, type ExtractedProduct };