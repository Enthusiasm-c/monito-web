/**
 * Enhanced PDF Extractor  
 * ONLY PDF to Image conversion + Gemini Vision processing
 * No Python processing - Pure image-based extraction only
 * Extends BaseProcessor for consistency
 */

import { spawn } from 'child_process';
import path from 'path';
import { BaseProcessor } from '../lib/core/BaseProcessor';
import { ProcessOptions, ProcessingResult } from '../lib/core/Interfaces';
import { UnifiedGeminiService } from './core/UnifiedGeminiService';
import { UploadProgressTracker } from './UploadProgressTracker';

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

  public static getInstance(): EnhancedPdfExtractor { // BaseProcessor
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
  async extractFromPdf(fileUrl: string, fileName: string, uploadId?: string): Promise<PdfExtractionResult> {
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

      // Step 1: Convert PDF to images
      console.log(`📄 Step 1: Converting PDF to images: ${fileName}`);
      const images = await this.convertPdfToImages(fileUrl);
      
      if (images.length === 0) {
        throw new Error('Failed to convert PDF to images');
      }
      
      console.log(`✅ Converted to ${images.length} images`);
      
      // Step 2: Process images with Gemini Flash 2.0
      console.log(`🤖 Step 2: Processing images with Gemini Flash 2.0...`);
      
      // Process each image with Gemini
      let allProducts: ExtractedProduct[] = [];
      let totalTokens = 0;
      let totalCost = 0;
      let supplier: any = null;
      const errors: string[] = [];

      for (let i = 0; i < images.length; i++) {
        try {
          console.log(`🔍 Processing image ${i + 1}/${images.length} with Gemini Flash 2.0...`);
          
          // Update progress during image processing
          if (uploadId) {
            const progress = 10 + ((i + 1) / images.length) * 20; // Progress from 10% to 30%
            await UploadProgressTracker.updateProgress(
              uploadId, 
              `Processing PDF page ${i + 1} of ${images.length}...`, 
              progress,
              {
                totalRows: images.length,
                processedRows: i + 1
              }
            );
          }
          
          // Convert base64 image to Buffer for Gemini Flash 2.0
          const base64Data = images[i].replace(/^data:image\/[a-z]+;base64,/, '');
          const imageBuffer = Buffer.from(base64Data, 'base64');
          
          // Show image to Gemini Flash 2.0
          const geminiResult = await this.geminiService.processDocument(
            imageBuffer,
            `${fileName}_page_${i + 1}.png`,
            {
              model: 'gemini-2.0-flash-exp',
              maxProducts: 1000,
              includeMetadata: true
            }
          );

          // Wrap result in expected format
          const result = {
            success: geminiResult.products && geminiResult.products.length >= 0,
            extractedData: geminiResult,
            tokensUsed: 0,
            costUsd: 0,
            error: geminiResult.products ? undefined : 'No products found'
          };

          if (result.success && result.extractedData) {
            const pageProducts = result.extractedData.products || [];
            
            // Add page info to products
            pageProducts.forEach(product => {
              product.sourcePage = i + 1;
              product.sourceMethod = 'pdf_to_image_gemini_flash_2.0';
            });
            
            allProducts = allProducts.concat(pageProducts);
            
            // Get supplier info from first successful page
            if (!supplier && result.extractedData.supplier) {
              supplier = result.extractedData.supplier;
            }

            totalTokens += result.tokensUsed || 0;
            totalCost += result.costUsd || 0;
            
            console.log(`✅ Image ${i + 1}: ${pageProducts.length} products extracted by Gemini Flash 2.0`);
            
            // Update progress with extraction details
            if (uploadId) {
              await UploadProgressTracker.updateProgress(
                uploadId, 
                `Extracted ${allProducts.length} products from ${i + 1} pages...`, 
                10 + ((i + 1) / images.length) * 20,
                {
                  extractedProducts: allProducts.length,
                  totalRows: images.length,
                  processedRows: i + 1
                }
              );
            }
          } else {
            const error = `Image ${i + 1}: ${result.error || 'Gemini Flash 2.0 processing failed'}`;
            errors.push(error);
            console.log(`⚠️ ${error}`);
          }
        } catch (imageError) {
          const errorMessage = imageError instanceof Error ? imageError.message : 'Gemini Flash 2.0 processing failed';
          const error = `Image ${i + 1}: ${errorMessage}`;
          errors.push(error);
          console.log(`❌ ${error}`);
          
          // Check for quota exhaustion
          if (errorMessage.includes('quota') || errorMessage.includes('exceeded') || errorMessage.includes('limit')) {
            console.log(`🚫 QUOTA EXHAUSTED: ${errorMessage}`);
            console.log(`⚠️ Gemini API quota limit reached. Consider upgrading plan or try again later.`);
            // Stop processing remaining images to avoid further quota usage
            if (errors.filter(e => e.includes('quota')).length >= 2) {
              console.log(`🛑 Stopping PDF processing due to quota exhaustion`);
              break;
            }
          }
        }
      }

      const processingTime = Date.now() - startTime;
      
      // Check if quota issues were encountered
      const quotaErrors = errors.filter(e => e.includes('quota') || e.includes('exceeded') || e.includes('limit'));
      
      if (quotaErrors.length > 0) {
        console.log(`🚫 PDF processing stopped due to API quota exhaustion: ${allProducts.length} products from ${images.length} images`);
        console.log(`⚠️ ${quotaErrors.length} quota-related errors encountered`);
        console.log(`💡 Recommendation: Upgrade Gemini API plan or try again later`);
      } else {
        console.log(`🎉 PDF→Images→Gemini Flash 2.0 completed: ${allProducts.length} products from ${images.length} images in ${processingTime}ms`);
      }
      
      console.log(`💰 Gemini Flash 2.0 cost: $${totalCost.toFixed(6)} (${totalTokens} tokens)`);

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
        quotaExhausted: quotaErrors.length > 0,
        quotaErrorCount: quotaErrors.length,
        extractionMethods: {
          step1_pdf_to_images: {
            images_created: images.length
          },
          step2_gemini_flash_2_0: {
            images_processed: images.length,
            products_extracted: allProducts.length,
            quota_errors: quotaErrors.length
          },
          bestMethod: 'pdf_to_images_then_gemini_flash_2_0',
          issues: quotaErrors.length > 0 ? ['gemini_api_quota_exhausted'] : []
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
        errors: [`PDF→Images→Gemini Flash 2.0 failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        extractionMethods: {
          bestMethod: 'pdf_to_images_then_gemini_flash_2_0_failed'
        }
      };
    }
  }

  /**
   * Step 1: Convert PDF to base64 images using pdf_to_images.py
   * Pure conversion only - no text extraction or processing
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

export { type PdfExtractionResult, type ExtractedProduct };