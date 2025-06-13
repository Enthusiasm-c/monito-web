import { prisma } from '@/lib/prisma';
import { put } from '@vercel/blob';
import { geminiUnifiedProcessor } from './GeminiUnifiedProcessor';
import { ExtractedData } from '../ai-optimized/schemas';
import { generateStandardizedData } from '../standardization/index';

export interface UploadedFile {
  originalName: string;
  buffer: Buffer;
  mimeType: string;
  size: number;
}

export interface ProcessOptions {
  supplierId?: string;
  model?: 'gemini-2.0-flash-exp' | 'gemini-2.0-flash' | 'gemini-1.5-pro' | 'gemini-1.5-flash';
  skipApproval?: boolean;
}

export interface ProcessResult {
  uploadId: string;
  supplierId: string;
  supplierName: string;
  isNewSupplier: boolean;
  stats: {
    totalExtracted: number;
    successfullyProcessed: number;
    newProducts: number;
    updatedProducts: number;
    errors: number;
    processingTimeMs: number;
    estimatedCostUsd: number;
  };
  insights: string[];
  errors?: string[];
}

export class GeminiPipeline {
  /**
   * Main entry point for file processing
   */
  async processUpload(
    file: UploadedFile,
    options: ProcessOptions = {}
  ): Promise<ProcessResult> {
    const startTime = Date.now();
    console.log(`[GeminiPipeline] Starting processing of ${file.originalName}`);
    
    try {
      // 1. Extract data using Gemini
      // For large files, use compact format to avoid truncation
      const isLargeFile = (
        (file.mimeType === 'application/pdf' && file.size > 500000) ||
        (file.mimeType?.includes('spreadsheet') || file.mimeType?.includes('excel'))
      );
      const maxProducts = isLargeFile ? 300 : undefined;
      
      const extracted = await geminiUnifiedProcessor.processDocument(
        file.buffer,
        file.originalName,
        { 
          model: options.model,
          maxProducts: maxProducts
        }
      );
      
      // 2. Resolve or create supplier
      const supplier = await this.resolveSupplier(
        extracted.supplierName,
        extracted.supplierContact,
        options.supplierId,
        file.originalName
      );
      
      // 3. Save file to blob storage
      const fileUrl = await this.uploadToBlob(file, supplier.id);
      
      // 4. Create upload record
      const upload = await this.createUploadRecord(
        supplier.id,
        file.originalName,
        fileUrl,
        file.mimeType,
        file.size,
        extracted
      );
      
      // 5. Process products
      const productStats = await this.processProducts(
        extracted.products,
        supplier.id,
        upload.id,
        options.skipApproval
      );
      
      // 6. Calculate processing time and cost
      const processingTimeMs = Date.now() - startTime;
      const estimatedCostUsd = this.calculateCost(extracted, options.model);
      
      // 7. Generate insights
      const insights = this.generateInsights(extracted, productStats);
      
      // 8. Update upload status
      await prisma.upload.update({
        where: { id: upload.id },
        data: {
          status: productStats.errors > 0 ? 'partial' : 'completed',
          extractedData: {
            ...(upload.extractedData as any),
            totalProducts: productStats.totalExtracted,
            successfulProducts: productStats.successfullyProcessed,
            failedProducts: productStats.errors,
            processingCompleted: true
          },
          processingTimeMs: processingTimeMs,
          processingCostUsd: estimatedCostUsd
        }
      });
      
      console.log(`[GeminiPipeline] Processing completed in ${processingTimeMs}ms`);
      
      return {
        uploadId: upload.id,
        supplierId: supplier.id,
        supplierName: supplier.name,
        isNewSupplier: supplier.isNew,
        stats: {
          totalExtracted: productStats.totalExtracted,
          successfullyProcessed: productStats.successfullyProcessed,
          newProducts: productStats.newProducts,
          updatedProducts: productStats.updatedProducts,
          errors: productStats.errors,
          processingTimeMs,
          estimatedCostUsd
        },
        insights,
        errors: productStats.errorMessages
      };
      
    } catch (error) {
      console.error('[GeminiPipeline] Processing error:', error);
      throw new Error(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Resolve or create supplier
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
    
    // Use filename as fallback if no supplier name extracted
    const supplierName = extractedName || `Auto-detected from ${fileName || 'upload'}`;
    
    // Search for existing supplier
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
    
    // Create new supplier
    const newSupplier = await prisma.supplier.create({
      data: {
        id: this.generateId('supplier'),
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
   * Upload file to blob storage
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
   * Create upload record
   */
  private async createUploadRecord(
    supplierId: string,
    fileName: string,
    fileUrl: string,
    mimeType: string,
    fileSize: number,
    extracted: ExtractedData
  ) {
    return await prisma.upload.create({
      data: {
        id: this.generateId('upload'),
        supplierId,
        fileName,
        url: fileUrl,
        originalName: fileName,
        mimeType: mimeType,
        fileSize,
        status: 'processing',
        extractedData: {
          documentType: extracted.documentType,
          extractionQuality: extracted.extractionQuality,
          processor: 'gemini',
          model: extracted.metadata?.model || 'gemini-2.0-flash-exp',
          totalProducts: extracted.products.length,
          successfulProducts: 0,
          failedProducts: 0,
          products: extracted.products
        }
      }
    });
  }
  
  /**
   * Process extracted products
   */
  private async processProducts(
    products: ExtractedData['products'],
    supplierId: string,
    uploadId: string,
    skipApproval?: boolean
  ) {
    const stats = {
      totalExtracted: products.length,
      successfullyProcessed: 0,
      newProducts: 0,
      updatedProducts: 0,
      errors: 0,
      errorMessages: [] as string[]
    };
    
    for (const product of products) {
      try {
        // Generate standardized name and unit
        const { standardizedName, standardizedUnit } = generateStandardizedData(
          product.name,
          product.unit
        );
        
        // Check if product exists by standardized name
        const existing = await prisma.product.findFirst({
          where: {
            standardizedName: { equals: standardizedName, mode: 'insensitive' },
            standardizedUnit: standardizedUnit
          }
        });
        
        if (existing) {
          // Create price record for existing product
          await prisma.price.create({
            data: {
              id: this.generateId('price'),
              productId: existing.id,
              supplierId,
              uploadId,
              amount: product.price || 0,
              unit: product.unit || standardizedUnit,
              validFrom: new Date()
            }
          });
          stats.updatedProducts++;
        } else {
          // Create new product with standardized name
          const newProduct = await prisma.product.create({
            data: {
              id: this.generateId('product'),
              rawName: product.name,
              name: product.name,
              standardizedName,
              unit: product.unit || 'pcs',
              standardizedUnit,
              category: product.category,
              description: product.description
            }
          });
          
          // Create initial price record
          await prisma.price.create({
            data: {
              id: this.generateId('price'),
              productId: newProduct.id,
              supplierId,
              uploadId,
              amount: product.price || 0,
              unit: product.unit || standardizedUnit,
              validFrom: new Date()
            }
          });
          
          stats.newProducts++;
        }
        
        stats.successfullyProcessed++;
        
      } catch (error) {
        stats.errors++;
        stats.errorMessages.push(`Product "${product.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error(`[GeminiPipeline] Error processing product "${product.name}":`, error);
      }
    }
    
    return stats;
  }
  
  /**
   * Calculate processing cost
   */
  private calculateCost(extracted: ExtractedData, model?: string): number {
    const modelName = model || 'gemini-2.0-flash-exp';
    
    // Estimate tokens (rough approximation)
    const estimatedInputTokens = JSON.stringify(extracted).length / 4;
    const estimatedOutputTokens = extracted.products.length * 50;
    
    return geminiUnifiedProcessor.getCostEstimate(modelName, estimatedInputTokens, estimatedOutputTokens);
  }
  
  /**
   * Generate insights from processing
   */
  private generateInsights(extracted: ExtractedData, stats: any): string[] {
    const insights: string[] = [];
    
    // Price insights
    const productsWithPrices = extracted.products.filter(p => p.price);
    if (productsWithPrices.length > 0) {
      const avgPrice = productsWithPrices.reduce((sum, p) => sum + (p.price || 0), 0) / productsWithPrices.length;
      insights.push(`Average product price: ${avgPrice.toFixed(2)} ${extracted.metadata?.currency || 'IDR'}`);
    }
    
    // Quality insights
    if (extracted.extractionQuality > 0.9) {
      insights.push('High quality document with clear structure');
    } else if (extracted.extractionQuality < 0.7) {
      insights.push('Document quality issues may have affected extraction accuracy');
    }
    
    // New products insight
    if (stats.newProducts > 10) {
      insights.push(`${stats.newProducts} new products added - significant catalog expansion`);
    }
    
    // Category insights
    const categories = [...new Set(extracted.products.map(p => p.category).filter(Boolean))];
    if (categories.length > 0) {
      insights.push(`Product categories found: ${categories.join(', ')}`);
    }
    
    return insights;
  }
  
  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${prefix}_${timestamp}_${random}`;
  }
}

// Export singleton
export const geminiPipeline = new GeminiPipeline();