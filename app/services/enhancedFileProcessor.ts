/**
 * Enhanced File Processor
 * Main orchestrator for the improved extraction pipeline
 */

import { PrismaClient } from '@prisma/client';
import { enhancedExcelExtractor, type ExcelExtractionResult } from './enhancedExcelExtractor';
import { enhancedPdfExtractor, type PdfExtractionResult } from './enhancedPdfExtractor';
import { tokenCostMonitor } from './tokenCostMonitor';
import { dataNormalizer } from './dataNormalizer';
import { embeddingService } from './embeddingService';
import { createProductValidator, defaultValidationRules } from '../../middleware/productValidation';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ProcessingResult {
  success: boolean;
  uploadId: string;
  supplierId: string;
  totalRowsDetected: number;
  totalRowsProcessed: number;
  productsCreated: number;
  completenessRatio: number;
  processingTimeMs: number;
  tokensUsed: number;
  costUsd: number;
  status: 'completed' | 'completed_with_errors' | 'failed' | 'too_large';
  errors: string[];
  extractionDetails?: any;
}

interface ProcessingMetrics {
  startTime: number;
  totalTokensUsed: number;
  totalCostUsd: number;
  errors: string[];
}

class EnhancedFileProcessor {
  private static instance: EnhancedFileProcessor;
  private processingLogger: ProcessingLogger;

  public static getInstance(): EnhancedFileProcessor {
    if (!EnhancedFileProcessor.instance) {
      EnhancedFileProcessor.instance = new EnhancedFileProcessor();
    }
    return EnhancedFileProcessor.instance;
  }

  constructor() {
    this.processingLogger = new ProcessingLogger();
  }
  
  /**
   * Automatic cleanup before processing
   */
  private async performAutomaticCleanup(): Promise<void> {
    try {
      const validator = createProductValidator(prisma, {
        ...defaultValidationRules,
        autoCleanup: true
      });
      
      const cleanup = await validator.cleanupOrphanProducts();
      if (cleanup.deletedProducts > 0 || cleanup.deletedSuppliers > 0) {
        console.log(`🧹 Auto-cleanup: removed ${cleanup.deletedProducts} orphan products, ${cleanup.deletedSuppliers} empty suppliers`);
      }
    } catch (error) {
      console.warn('⚠️ Auto-cleanup failed:', error);
    }
  }

  /**
   * Main file processing entry point
   */
  async processFile(uploadId: string): Promise<ProcessingResult> {
    const metrics: ProcessingMetrics = {
      startTime: Date.now(),
      totalTokensUsed: 0,
      totalCostUsd: 0,
      errors: []
    };

    try {
      console.log(`🚀 Enhanced processing starting for upload: ${uploadId}`);
      
      // Perform automatic cleanup before processing
      await this.performAutomaticCleanup();
      
      // Get upload record
      const upload = await prisma.upload.findUnique({
        where: { id: uploadId },
        include: { supplier: true }
      });

      if (!upload) {
        throw new Error('Upload not found');
      }

      // Check file size
      if (upload.fileSize && upload.fileSize > this.getMaxFileSize()) {
        await this.updateUploadStatus(uploadId, 'too_large', {
          errorMessage: `File too large: ${upload.fileSize} bytes`,
          totalRowsDetected: 0,
          totalRowsProcessed: 0,
          completenessRatio: 0
        });

        return {
          success: false,
          uploadId,
          supplierId: upload.supplierId,
          totalRowsDetected: 0,
          totalRowsProcessed: 0,
          productsCreated: 0,
          completenessRatio: 0,
          processingTimeMs: Date.now() - metrics.startTime,
          tokensUsed: 0,
          costUsd: 0,
          status: 'too_large',
          errors: ['File exceeds size limit']
        };
      }

      // Update status to processing
      await this.updateUploadStatus(uploadId, 'processing', {});

      // Extract data based on file type
      let extractedData: ExcelExtractionResult | PdfExtractionResult;
      
      if (upload.mimeType?.includes('pdf')) {
        extractedData = await enhancedPdfExtractor.extractFromPdf(upload.url || '', upload.originalName || '');
      } else if (upload.mimeType?.includes('excel') || upload.mimeType?.includes('sheet') || upload.mimeType?.includes('csv')) {
        extractedData = await enhancedExcelExtractor.extractFromFile(upload.url || '', upload.originalName || '');
      } else {
        throw new Error(`Unsupported file type: ${upload.mimeType}`);
      }

      // Track token usage
      metrics.totalTokensUsed += extractedData.tokensUsed;
      metrics.totalCostUsd += extractedData.costUsd;

      // Determine final supplier
      let finalSupplierId = upload.supplierId;
      if (extractedData.supplier && extractedData.supplier.name) {
        const detectedSupplier = await this.findOrCreateSupplier(extractedData.supplier);
        if (detectedSupplier.id !== upload.supplierId) {
          console.log(`📝 Supplier detection: "${extractedData.supplier.name}" → using ${detectedSupplier.id}`);
          finalSupplierId = detectedSupplier.id;
          
          await prisma.upload.update({
            where: { id: uploadId },
            data: { supplierId: finalSupplierId }
          });
        }
      }

      // Process and store products
      const productsCreated = await this.storeExtractedProducts(
        extractedData.products,
        finalSupplierId,
        uploadId,
        metrics
      );

      // Determine final status
      const status = this.determineStatus(extractedData, metrics.errors);

      // Calculate final completeness
      const completenessRatio = extractedData.totalRowsDetected > 0
        ? extractedData.totalRowsProcessed / extractedData.totalRowsDetected
        : 0;

      // Update upload with final results
      await this.updateUploadStatus(uploadId, status, {
        extractedData: extractedData as any,
        totalRowsDetected: extractedData.totalRowsDetected,
        totalRowsProcessed: extractedData.totalRowsProcessed,
        completenessRatio,
        sheetsProcessed: (extractedData as ExcelExtractionResult).sheets || null,
        processingTimeMs: Date.now() - metrics.startTime,
        tokensUsed: metrics.totalTokensUsed,
        processingCostUsd: metrics.totalCostUsd,
        errorMessage: metrics.errors.length > 0 ? metrics.errors.join('; ') : null
      });

      // Log processing results
      await this.processingLogger.logProcessing(uploadId, {
        fileName: upload.originalName || 'unknown',
        fileType: upload.mimeType || 'unknown',
        completenessRatio,
        totalRows: extractedData.totalRowsDetected,
        processedRows: extractedData.totalRowsProcessed,
        productsCreated,
        processingTimeMs: Date.now() - metrics.startTime,
        tokensUsed: metrics.totalTokensUsed,
        costUsd: metrics.totalCostUsd,
        status,
        errors: metrics.errors
      });

      console.log(`✅ Enhanced processing completed: ${uploadId}`);
      console.log(`   📊 Completeness: ${(completenessRatio * 100).toFixed(1)}%`);
      console.log(`   🛍️ Products: ${productsCreated}`);
      console.log(`   💰 Cost: $${metrics.totalCostUsd.toFixed(4)}`);

      return {
        success: status !== 'failed',
        uploadId,
        supplierId: finalSupplierId,
        totalRowsDetected: extractedData.totalRowsDetected,
        totalRowsProcessed: extractedData.totalRowsProcessed,
        productsCreated,
        completenessRatio,
        processingTimeMs: Date.now() - metrics.startTime,
        tokensUsed: metrics.totalTokensUsed,
        costUsd: metrics.totalCostUsd,
        status,
        errors: metrics.errors,
        extractionDetails: extractedData
      };

    } catch (error) {
      console.error(`❌ Enhanced processing failed: ${uploadId}`, error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      metrics.errors.push(errorMessage);

      // Update upload status to failed
      await this.updateUploadStatus(uploadId, 'failed', {
        errorMessage,
        totalRowsDetected: 0,
        totalRowsProcessed: 0,
        completenessRatio: 0,
        processingTimeMs: Date.now() - metrics.startTime,
        tokensUsed: metrics.totalTokensUsed,
        processingCostUsd: metrics.totalCostUsd
      });

      return {
        success: false,
        uploadId,
        supplierId: '',
        totalRowsDetected: 0,
        totalRowsProcessed: 0,
        productsCreated: 0,
        completenessRatio: 0,
        processingTimeMs: Date.now() - metrics.startTime,
        tokensUsed: metrics.totalTokensUsed,
        costUsd: metrics.totalCostUsd,
        status: 'failed',
        errors: metrics.errors
      };
    }
  }

  /**
   * Store extracted products in database
   */
  private async storeExtractedProducts(
    extractedProducts: any[],
    supplierId: string,
    uploadId: string,
    metrics: ProcessingMetrics
  ): Promise<number> {
    let productsCreated = 0;

    // Filter valid products first
    const validProducts = extractedProducts.filter(item => {
      const normalizedProduct = dataNormalizer.normalizeProduct(item);
      if (!normalizedProduct.price || normalizedProduct.price <= 0) {
        console.log(`⚠️ Skipping product with no price: "${normalizedProduct.name}"`);
        return false;
      }
      return true;
    });

    if (validProducts.length === 0) {
      console.log('⚠️ No valid products to process');
      return 0;
    }

    console.log(`📦 Processing ${validProducts.length} valid products...`);

    // Prepare products for batch AI standardization
    const productsForAI = validProducts.map(item => {
      const normalizedProduct = dataNormalizer.normalizeProduct(item);
      const category = normalizedProduct.category || this.categorizeProduct(normalizedProduct.name);
      return {
        name: normalizedProduct.name,
        category: category,
        originalItem: item,
        normalizedProduct: normalizedProduct
      };
    });

    // Batch AI standardization (limited products and skip if too many total products)
    const maxAiProducts = parseInt(process.env.MAX_AI_STANDARDIZATION_PRODUCTS || '20');
    const maxTotalForAI = parseInt(process.env.MAX_PRODUCTS_FOR_AI_STANDARDIZATION || '50');
    
    let standardizedNames: string[] = [];
    const aiStandardizationEnabled = process.env.AI_STANDARDIZATION_ENABLED === 'true';
    
    if (aiStandardizationEnabled && productsForAI.length <= maxTotalForAI) {
      console.log(`🤖 AI Batch Standardization: ${Math.min(maxAiProducts, productsForAI.length)} products`);
      standardizedNames = await this.standardizeProductNamesWithAI(
        productsForAI.slice(0, maxAiProducts),
        metrics
      );
    } else {
      console.log(`⚡ Skipping AI standardization: disabled or ${productsForAI.length} products > ${maxTotalForAI} limit`);
    }

    // Process all products (with AI standardization for first 20, fallback for rest)
    for (let i = 0; i < productsForAI.length; i++) {
      try {
        const { originalItem, normalizedProduct, category } = productsForAI[i];
        
        // Use AI standardization for first 20, fallback for rest
        const standardizedName = i < standardizedNames.length 
          ? standardizedNames[i]
          : this.simpleStandardizeProductName(normalizedProduct.name);
          
        const standardizedUnit = this.standardizeUnit(normalizedProduct.unit);

        // Find or create product with validation
        const product = await this.findOrCreateProduct({
          rawName: originalItem.name,
          name: normalizedProduct.name,
          standardizedName,
          category,
          unit: normalizedProduct.unit,
          standardizedUnit,
          description: normalizedProduct.description
        });

        // Skip if product creation failed validation
        if (!product) {
          console.warn(`⚠️ Skipping product due to validation failure: ${normalizedProduct.name}`);
          continue;
        }

        // Validate price data before creation
        const validator = createProductValidator(prisma);
        const priceValidation = validator.validatePriceData({
          amount: normalizedProduct.price,
          unit: normalizedProduct.unit,
          supplierId: supplierId,
          productId: product.id,
          uploadId: uploadId
        });

        if (!priceValidation.valid) {
          console.warn(`⚠️ Skipping invalid price for ${normalizedProduct.name}: ${priceValidation.errors.join(', ')}`);
          continue;
        }

        // Deactivate old prices for this product and supplier
        await prisma.price.updateMany({
          where: {
            productId: product.id,
            supplierId: supplierId,
            validTo: null
          },
          data: {
            validTo: new Date()
          }
        });

        // Create new price entry
        await prisma.price.create({
          data: {
            amount: normalizedProduct.price,
            unit: normalizedProduct.unit,
            productId: product.id,
            supplierId: supplierId,
            uploadId: uploadId,
            validFrom: new Date()
          }
        });

        productsCreated++;

        // Log progress every 10 products
        if ((productsCreated % 10) === 0) {
          console.log(`✅ Processed ${productsCreated}/${validProducts.length} products...`);
        }

      } catch (error) {
        const errorMsg = `Error processing product "${productsForAI[i].originalItem.name}": ${error}`;
        console.error(errorMsg);
        metrics.errors.push(errorMsg);
      }
    }

    console.log(`🎉 Successfully processed ${productsCreated} products`);
    return productsCreated;
  }

  /**
   * Update upload status and metrics
   */
  private async updateUploadStatus(
    uploadId: string,
    status: string,
    data: any
  ): Promise<void> {
    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        status,
        ...data,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Determine final processing status
   */
  private determineStatus(extractedData: any, errors: string[]): 'completed' | 'completed_with_errors' | 'failed' {
    if (errors.length > 0) {
      return extractedData.products.length > 0 ? 'completed_with_errors' : 'failed';
    }
    return 'completed';
  }

  /**
   * Get maximum file size from config
   */
  private getMaxFileSize(): number {
    return parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024;
  }

  /**
   * Find or create supplier
   */
  private async findOrCreateSupplier(supplierData: any) {
    if (!supplierData || !supplierData.name) {
      console.warn('⚠️ No supplier data or name provided');
      return null;
    }

    console.log(`🏢 Processing supplier: "${supplierData.name}"`);
    console.log(`   📞 Phone: ${supplierData.phone || 'Not provided'}`);
    console.log(`   📧 Email: ${supplierData.email || 'Not provided'}`);
    console.log(`   📍 Address: ${supplierData.address || 'Not provided'}`);

    // Try to find existing supplier
    const existing = await prisma.supplier.findFirst({
      where: {
        name: {
          contains: supplierData.name.trim(),
          mode: 'insensitive'
        }
      }
    });

    if (existing) {
      console.log(`✅ Found existing supplier: ${existing.id}`);
      
      // Update existing supplier with new contact info if provided
      const updateData: any = {};
      if (supplierData.phone && !existing.phone) {
        updateData.phone = supplierData.phone;
      }
      if (supplierData.email && !existing.email) {
        updateData.email = supplierData.email;
      }
      if (supplierData.address && !existing.address) {
        updateData.address = supplierData.address;
      }

      if (Object.keys(updateData).length > 0) {
        console.log(`🔄 Updating supplier with new contact info:`, updateData);
        return await prisma.supplier.update({
          where: { id: existing.id },
          data: updateData
        });
      }

      return existing;
    }

    // Create new supplier
    console.log(`🆕 Creating new supplier: "${supplierData.name}"`);
    return await prisma.supplier.create({
      data: {
        name: supplierData.name.trim(),
        email: supplierData.email || null,
        phone: supplierData.phone || null,
        address: supplierData.address || null
      }
    });
  }

  /**
   * Find or create product with validation
   */
  private async findOrCreateProduct(productData: any) {
    // Validate product data
    const validator = createProductValidator(prisma);
    const validation = validator.validateProductData(productData);
    
    if (!validation.valid) {
      console.warn(`⚠️ Skipping invalid product: ${validation.errors.join(', ')}`);
      return null;
    }

    // Try to find existing product
    const existing = await prisma.product.findFirst({
      where: {
        standardizedName: productData.standardizedName,
        standardizedUnit: productData.standardizedUnit
      }
    });

    if (existing) {
      return existing;
    }

    // Create new product with validation
    try {
      return await prisma.product.create({
        data: {
          name: productData.name.trim(),
          rawName: productData.rawName?.trim() || productData.name.trim(),
          standardizedName: productData.standardizedName.trim(),
          category: productData.category?.trim(),
          unit: productData.unit.trim(),
          standardizedUnit: productData.standardizedUnit?.trim() || productData.unit.trim(),
          description: productData.description?.trim()
        }
      });
    } catch (error) {
      console.error(`❌ Failed to create product: ${productData.name}`, error);
      return null;
    }
  }

  /**
   * Standardize product names using AI in batches
   */
  private async standardizeProductNamesWithAI(
    products: Array<{name: string, category: string}>,
    metrics: ProcessingMetrics
  ): Promise<string[]> {
    try {
      // For performance, limit AI standardization to first 20 products
      const maxProducts = parseInt(process.env.MAX_AI_STANDARDIZATION_PRODUCTS || '20');
      const limitedProducts = products.slice(0, maxProducts);
      
      if (limitedProducts.length === 0) {
        return [];
      }

      const startTime = Date.now();
      
      // Create batch prompt for multiple products
      const productList = limitedProducts.map((p, i) => 
        `${i + 1}. "${p.name}" (category: ${p.category})`
      ).join('\n');

      const response = await openai.chat.completions.create({
        model: process.env.LLM_MODEL || 'gpt-o3-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a product name standardizer. Convert product names to lowercase, standardized format suitable for matching. Remove brand names, keep essential descriptors. Return one standardized name per line, in the same order as input.'
          },
          {
            role: 'user',
            content: `Standardize these product names:\n${productList}\n\nReturn only the standardized names, one per line:`
          }
        ],
        max_tokens: limitedProducts.length * 20,
        temperature: 0
      });

      const content = response.choices[0]?.message?.content?.trim() || '';
      const standardizedNames = content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      // Track token usage
      if (response.usage) {
        const usage = tokenCostMonitor.trackUsage({
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
          model: process.env.LLM_MODEL || 'gpt-o3-mini'
        });
        
        metrics.totalTokensUsed += response.usage.prompt_tokens + response.usage.completion_tokens;
        metrics.totalCostUsd += usage.totalCost;
      }

      console.log(`🤖 AI Batch Standardization: ${limitedProducts.length} products in ${Date.now() - startTime}ms`);
      
      // Fill in any missing standardized names with fallback
      const result: string[] = [];
      for (let i = 0; i < limitedProducts.length; i++) {
        result.push(standardizedNames[i] || limitedProducts[i].name.toLowerCase().trim());
      }
      
      return result;

    } catch (error) {
      console.error(`❌ AI batch standardization failed:`, error);
      return products.map(p => p.name.toLowerCase().trim());
    }
  }

  /**
   * Fallback: Simple standardization without AI
   */
  private simpleStandardizeProductName(productName: string): string {
    return productName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Simple product categorization
   */
  private categorizeProduct(productName: string): string {
    const name = productName.toLowerCase();
    
    if (name.includes('beef') || name.includes('chicken') || name.includes('pork') || name.includes('meat')) {
      return 'Meat';
    }
    if (name.includes('fish') || name.includes('seafood') || name.includes('tuna') || name.includes('salmon')) {
      return 'Seafood';
    }
    if (name.includes('rice') || name.includes('bread') || name.includes('grain')) {
      return 'Grains';
    }
    if (name.includes('milk') || name.includes('cheese') || name.includes('dairy')) {
      return 'Dairy';
    }
    
    return 'Other';
  }

  /**
   * Standardize unit names
   */
  private standardizeUnit(unit: string): string {
    const normalized = unit.toLowerCase().trim();
    
    const unitMap: { [key: string]: string } = {
      'kilogram': 'kg',
      'kilograms': 'kg',
      'kilo': 'kg',
      'gram': 'g',
      'grams': 'g',
      'liter': 'l',
      'litre': 'l',
      'liters': 'l',
      'litres': 'l',
      'pieces': 'pcs',
      'piece': 'pcs',
      'box': 'box',
      'boxes': 'box'
    };

    return unitMap[normalized] || normalized;
  }
}

/**
 * Processing Logger for detailed logging
 */
class ProcessingLogger {
  private logFile: string;

  constructor() {
    this.logFile = path.join(process.cwd(), 'logs', 'processing.log');
    this.ensureLogDirectory();
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.logFile), { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  async logProcessing(uploadId: string, data: any): Promise<void> {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        uploadId,
        ...data
      };

      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.logFile, logLine);

      // Also log to console for development
      console.log(`📋 Processing Log: ${uploadId} - ${data.status} - ${data.completenessRatio.toFixed(3)} completeness`);

    } catch (error) {
      console.error('Failed to write processing log:', error);
    }
  }
}

// Export singleton instance
export const enhancedFileProcessor = EnhancedFileProcessor.getInstance();

// Export types
export type { ProcessingResult };