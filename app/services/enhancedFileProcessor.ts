/**
 * Enhanced File Processor
 * Main orchestrator for the improved extraction pipeline
 */

import { enhancedExcelExtractor, type ExcelExtractionResult } from './enhancedExcelExtractor';
import { enhancedPdfExtractor, type PdfExtractionResult } from './enhancedPdfExtractor';
import { tokenCostMonitor } from './tokenCostMonitor';
import { dataNormalizer } from './dataNormalizer';
import { embeddingService } from './embeddingService';
import { createProductValidator, defaultValidationRules } from '../../middleware/productValidation';
import { priceValidator } from './priceValidator';
import { optimizedImageProcessor } from './optimizedImageProcessor';
import { dataQualityMonitor } from './dataQualityMonitor';
import { UploadProgressTracker } from './UploadProgressTracker';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

import { prisma } from '../../lib/prisma';

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
  status: 'completed' | 'completed_with_errors' | 'failed' | 'too_large' | 'pending_review';
  errors: string[];
  extractionDetails?: any;
  needsApproval?: boolean;
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
  private standardizationCache: Map<string, string>;

  public static getInstance(): EnhancedFileProcessor {
    if (!EnhancedFileProcessor.instance) {
      EnhancedFileProcessor.instance = new EnhancedFileProcessor();
    }
    return EnhancedFileProcessor.instance;
  }

  constructor() {
    this.processingLogger = new ProcessingLogger();
    this.standardizationCache = new Map<string, string>();
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
      
      // Start progress tracking
      UploadProgressTracker.startTracking(uploadId);
      await UploadProgressTracker.updateProgress(uploadId, 'Starting file processing...', 5);
      
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
      
      // Start progress tracking
      UploadProgressTracker.startTracking(uploadId);
      await UploadProgressTracker.updateProgress(
        uploadId,
        'Starting file processing...',
        5,
        { totalProducts: 0 }
      );

      // Extract data based on file type - check both MIME type and file extension
      let extractedData: ExcelExtractionResult | PdfExtractionResult;
      const fileName = upload.originalName?.toLowerCase() || '';
      const mimeType = upload.mimeType?.toLowerCase() || '';
      
      if (mimeType.includes('pdf') || fileName.endsWith('.pdf')) {
        await UploadProgressTracker.updateProgress(uploadId, 'Processing PDF file...', 10);
        extractedData = await enhancedPdfExtractor.extractFromPdf(upload.url || '', upload.originalName || '', uploadId);
      } else if (mimeType.includes('excel') || mimeType.includes('sheet') || mimeType.includes('csv') ||
                 fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv') ||
                 (mimeType === 'application/octet-stream' && (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')))) {
        await UploadProgressTracker.updateProgress(uploadId, 'Processing Excel/CSV file...', 10);
        extractedData = await enhancedExcelExtractor.extractFromFile(upload.url || '', upload.originalName || '', uploadId);
      } else if (mimeType.includes('image') || fileName.match(/\.(jpg|jpeg|png|gif|bmp)$/i)) {
        await UploadProgressTracker.updateProgress(uploadId, 'Processing image with AI vision...', 10);
        // Process image with OpenAI Vision API
        // Use optimized image processor
        const imageResult = await optimizedImageProcessor.processImage(upload.url || '', upload.originalName || '', uploadId);
        
        // Convert to standard format
        extractedData = {
          supplier: imageResult.supplier,
          products: imageResult.products,
          totalRowsDetected: imageResult.totalRowsDetected,
          totalRowsProcessed: imageResult.totalRowsProcessed,
          completenessRatio: imageResult.totalRowsDetected > 0 
            ? imageResult.totalRowsProcessed / imageResult.totalRowsDetected 
            : 0,
          processingTimeMs: imageResult.processingTimeMs,
          tokensUsed: imageResult.tokensUsed,
          costUsd: imageResult.costUsd,
          errors: imageResult.errors,
          sheets: null,
          extractionMethods: {
            optimizedVisionApi: {
              productsExtracted: imageResult.products.length,
              originalSize: imageResult.optimizations.originalSize,
              optimizedSize: imageResult.optimizations.optimizedSize,
              compressionRatio: imageResult.optimizations.compressionRatio
            }
          }
        };
      } else {
        throw new Error(`Unsupported file type: ${upload.mimeType} (${fileName})`);
      }

      // Track token usage
      metrics.totalTokensUsed += extractedData.tokensUsed;
      metrics.totalCostUsd += extractedData.costUsd;

      // Validate extracted prices
      if (extractedData.products.length > 0) {
        console.log(`🔍 Validating ${extractedData.products.length} extracted products...`);
        const validationResult = priceValidator.validateBatch(extractedData.products);
        
        console.log(`📊 Price validation summary:`);
        console.log(`   Valid: ${validationResult.summary.validProducts}/${validationResult.summary.totalProducts}`);
        console.log(`   Warnings: ${validationResult.summary.productsWithWarnings}`);
        console.log(`   Errors: ${validationResult.summary.productsWithErrors}`);
        console.log(`   Average confidence: ${(validationResult.summary.averageConfidence * 100).toFixed(1)}%`);
        
        // Log price distribution
        const dist = validationResult.summary.priceDistribution;
        console.log(`   Price distribution:`);
        console.log(`     < 10k: ${dist.below10k}`);
        console.log(`     10k-100k: ${dist.between10kAnd100k}`);
        console.log(`     100k-1M: ${dist.between100kAnd1M}`);
        console.log(`     > 1M: ${dist.above1M}`);
        
        // Add validation warnings to metrics
        validationResult.results.forEach((result, index) => {
          if (result.warnings.length > 0) {
            const product = extractedData.products[index];
            result.warnings.forEach(warning => {
              metrics.errors.push(`⚠️ ${product.name}: ${warning}`);
            });
            
            // Try to correct suspicious prices
            const suggestedPrice = priceValidator.suggestPriceCorrection(product.price);
            if (suggestedPrice) {
              console.log(`💡 Suggesting price correction for ${product.name}: ${product.price} → ${suggestedPrice}`);
              // Optionally update the price
              // extractedData.products[index].price = suggestedPrice;
            }
          }
        });
      }

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

      // Check if auto-approval is enabled
      const autoApprovalEnabled = process.env.AUTO_APPROVAL_ENABLED === 'true';
      const needsApproval = !autoApprovalEnabled;
      
      let productsCreated = 0;
      let status: 'completed' | 'completed_with_errors' | 'failed' | 'pending_review';
      
      if (needsApproval) {
        // Save extracted data for review but don't create products/prices yet
        status = 'pending_review';
        console.log(`📋 Upload ${uploadId} requires approval. Extracted data saved for review.`);
      } else {
        // Auto-approval: create products and prices immediately  
        productsCreated = await this.storeExtractedProducts(
          extractedData.products,
          finalSupplierId,
          uploadId,
          metrics
        );
        status = this.determineStatus(extractedData, metrics.errors);
      }

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
        errorMessage: metrics.errors.length > 0 ? metrics.errors.join('; ') : null,
        approvalStatus: needsApproval ? 'pending_review' : 'approved',
        autoApproved: !needsApproval
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

      // Generate quality report
      const qualityReport = dataQualityMonitor.generateReport(extractedData.totalRowsProcessed);
      
      // Update approval status if quality issues found
      if (qualityReport.needsReview) {
        needsApproval = true;
        console.log(`🚨 Upload flagged for review due to data quality issues`);
      }

      console.log(`✅ Enhanced processing completed: ${uploadId}`);
      console.log(`   📊 Completeness: ${(completenessRatio * 100).toFixed(1)}%`);
      console.log(`   🛍️ Products: ${productsCreated}`);
      console.log(`   💰 Cost: $${metrics.totalCostUsd.toFixed(4)}`);
      
      if (qualityReport.nullPrices > 0 || qualityReport.invalidUnits > 0) {
        console.log(`   ⚠️ Quality issues: ${qualityReport.nullPrices} null prices, ${qualityReport.invalidUnits} invalid units`);
      }

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
        extractionDetails: extractedData,
        needsApproval
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
    
    // Reset quality monitor for this batch
    dataQualityMonitor.reset();

    // Prepare products for batch AI standardization
    const productsForAI = validProducts.map(item => {
      const normalizedProduct = dataNormalizer.normalizeProduct(item);
      const category = normalizedProduct.category || this.categorizeProduct(normalizedProduct.name);
      
      // Monitor data quality
      dataQualityMonitor.checkProductQuality({
        name: item.name,
        price: normalizedProduct.price,
        unit: normalizedProduct.unit,
        quantity: item.quantity
      });
      
      return {
        name: normalizedProduct.name,
        category: category,
        originalItem: item,
        normalizedProduct: normalizedProduct
      };
    });

    // AI standardization for ALL products
    let standardizedNames: string[] = [];
    const aiStandardizationEnabled = process.env.AI_STANDARDIZATION_ENABLED !== 'false'; // Default to enabled
    
    if (aiStandardizationEnabled && productsForAI.length > 0) {
      console.log(`🤖 AI Standardization for ALL products: ${productsForAI.length} products`);
      standardizedNames = await this.standardizeProductNamesWithAI(
        productsForAI, // Process ALL products, not limited
        metrics,
        uploadId
      );
    } else {
      console.log(`⚡ AI standardization disabled or no products to process`);
    }

    // Group products by standardized name + unit to prevent duplicates
    const productGroups = new Map<string, {
      standardizedName: string;
      standardizedUnit: string;
      products: Array<{
        originalItem: any;
        normalizedProduct: any;
        category: string;
        bestPrice: number;
      }>;
    }>();

    // First pass: standardize all products and group them
    for (let i = 0; i < productsForAI.length; i++) {
      const { originalItem, normalizedProduct, category } = productsForAI[i];
      
      // Use AI standardization for ALL products, fallback only if AI failed
      const standardizedName = i < standardizedNames.length && standardizedNames[i]
        ? standardizedNames[i]
        : this.simpleStandardizeProductName(normalizedProduct.name);
        
      const standardizedUnit = this.standardizeUnit(normalizedProduct.unit);
      const groupKey = `${standardizedName}|${standardizedUnit}`;

      if (!productGroups.has(groupKey)) {
        productGroups.set(groupKey, {
          standardizedName,
          standardizedUnit,
          products: []
        });
      }

      productGroups.get(groupKey)!.products.push({
        originalItem,
        normalizedProduct,
        category,
        bestPrice: normalizedProduct.price
      });
    }

    console.log(`📊 Grouped ${productsForAI.length} products into ${productGroups.size} unique products`);

    // Update progress for saving phase
    await UploadProgressTracker.updateProgress(uploadId, 'Saving products to database...', 70, {
      totalProducts: productGroups.size,
      savedProducts: 0
    });

    // Second pass: process each unique product group
    let processedCount = 0;
    for (const [groupKey, group] of productGroups) {
      try {
        // Find the product with the best price (lowest valid price)
        const validProducts = group.products.filter(p => p.bestPrice > 0);
        if (validProducts.length === 0) {
          console.warn(`⚠️ Skipping product group - no valid prices: ${group.standardizedName}`);
          continue;
        }

        // Use the first product as the base, with the best price
        const bestProduct = validProducts.reduce((best, current) => 
          current.bestPrice < best.bestPrice ? current : best
        );

        // Find or create product with validation
        const product = await this.findOrCreateProduct({
          rawName: bestProduct.originalItem.name,
          name: bestProduct.normalizedProduct.name,
          standardizedName: group.standardizedName,
          category: bestProduct.category,
          unit: bestProduct.normalizedProduct.unit,
          standardizedUnit: group.standardizedUnit,
          description: bestProduct.normalizedProduct.description
        });

        // Skip if product creation failed validation
        if (!product) {
          console.warn(`⚠️ Skipping product due to validation failure: ${group.standardizedName}`);
          continue;
        }

        // Validate price data before creation
        const validator = createProductValidator(prisma);
        const priceValidation = validator.validatePriceData({
          amount: bestProduct.bestPrice,
          unit: bestProduct.normalizedProduct.unit,
          supplierId: supplierId,
          productId: product.id,
          uploadId: uploadId
        });

        if (!priceValidation.valid) {
          console.warn(`⚠️ Skipping invalid price for ${group.standardizedName}: ${priceValidation.errors.join(', ')}`);
          continue;
        }

        // Check for existing active prices for this product and supplier
        const existingPrices = await prisma.price.findMany({
          where: {
            productId: product.id,
            supplierId: supplierId,
            validTo: null
          },
          orderBy: {
            validFrom: 'desc'
          }
        });

        // Check if this exact price already exists
        const exactPriceExists = existingPrices.some(price => 
          price.amount === bestProduct.bestPrice && 
          price.unit === bestProduct.normalizedProduct.unit
        );

        if (exactPriceExists) {
          console.log(`🔄 Price already exists for ${group.standardizedName}, skipping duplicate`);
          continue;
        }

        // If there are existing prices, move them to price history
        if (existingPrices.length > 0) {
          for (const oldPrice of existingPrices) {
            // Calculate change percentage
            const changePercentage = oldPrice.amount > 0 
              ? ((bestProduct.bestPrice - oldPrice.amount) / oldPrice.amount) * 100
              : 0;

            // Create price history entry
            await prisma.priceHistory.create({
              data: {
                id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                price: bestProduct.bestPrice,
                unit: bestProduct.normalizedProduct.unit,
                changedFrom: oldPrice.amount,
                changePercentage: changePercentage,
                changeReason: 'api',
                productId: product.id,
                supplierId: supplierId,
                uploadId: uploadId,
                createdAt: new Date()
              }
            });

            console.log(`📈 Price history created: ${group.standardizedName} - $${oldPrice.amount} → $${bestProduct.bestPrice} (${changePercentage.toFixed(1)}%)`);
          }

          // Deactivate old prices
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
        } else {
          // No existing prices, create initial price history entry
          await prisma.priceHistory.create({
            data: {
              id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              price: bestProduct.bestPrice,
              unit: bestProduct.normalizedProduct.unit,
              changedFrom: null,
              changePercentage: null,
              changeReason: 'initial',
              productId: product.id,
              supplierId: supplierId,
              uploadId: uploadId,
              createdAt: new Date()
            }
          });
        }

        // Create new price entry
        await prisma.price.create({
          data: {
            id: `price_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            amount: bestProduct.bestPrice,
            unit: bestProduct.normalizedProduct.unit,
            productId: product.id,
            supplierId: supplierId,
            uploadId: uploadId,
            validFrom: new Date()
          }
        });

        productsCreated++;
        processedCount++;

        // Update progress after each product
        await UploadProgressTracker.trackSaving(uploadId, processedCount, productGroups.size);
        
        // Force immediate progress update every 5 products
        if (processedCount % 5 === 0) {
          await UploadProgressTracker.updateProgress(uploadId, `Saving products to database...`, 70 + (processedCount / productGroups.size) * 20, {
            totalProducts: productGroups.size,
            savedProducts: processedCount
          });
        }

        // Log if multiple products were consolidated
        if (group.products.length > 1) {
          console.log(`🔗 Consolidated ${group.products.length} duplicate products into "${group.standardizedName}" (best price: ${bestProduct.bestPrice})`);
        }

        // Log progress every 10 products
        if ((productsCreated % 10) === 0) {
          console.log(`✅ Processed ${productsCreated}/${productGroups.size} unique products...`);
        }

      } catch (error) {
        const errorMsg = `Error processing product group "${groupKey}": ${error}`;
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
        id: `supplier_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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

    // Use upsert to prevent race conditions and duplicates
    try {
      return await prisma.product.upsert({
        where: {
          // Use the existing composite unique constraint
          standardizedName_standardizedUnit: {
            standardizedName: productData.standardizedName.trim(),
            standardizedUnit: productData.standardizedUnit?.trim() || productData.unit.trim()
          }
        },
        update: {
          // Update existing product with latest data
          name: productData.name.trim(),
          rawName: productData.rawName?.trim() || productData.name.trim(),
          category: productData.category?.trim(),
          unit: productData.unit.trim(),
          description: productData.description?.trim(),
          updatedAt: new Date()
        },
        create: {
          id: `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: productData.name.trim(),
          rawName: productData.rawName?.trim() || productData.name.trim(),
          standardizedName: productData.standardizedName.trim(),
          category: productData.category?.trim(),
          unit: productData.unit.trim(),
          standardizedUnit: productData.standardizedUnit?.trim() || productData.unit.trim(),
          description: productData.description?.trim(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    } catch (error) {
      // Fallback to find-first if unique constraint doesn't exist yet
      console.warn(`⚠️ Upsert failed, falling back to find-first for: ${productData.name}`, error);
      
      const existing = await prisma.product.findFirst({
        where: {
          standardizedName: productData.standardizedName,
          standardizedUnit: productData.standardizedUnit
        }
      });

      if (existing) {
        return existing;
      }

      // Last resort - try to create
      try {
        return await prisma.product.create({
          data: {
            id: `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: productData.name.trim(),
            rawName: productData.rawName?.trim() || productData.name.trim(),
            standardizedName: productData.standardizedName.trim(),
            category: productData.category?.trim(),
            unit: productData.unit.trim(),
            standardizedUnit: productData.standardizedUnit?.trim() || productData.unit.trim(),
            description: productData.description?.trim(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      } catch (createError) {
        console.error(`❌ Failed to create product: ${productData.name}`, createError);
        return null;
      }
    }
  }

  /**
   * Standardize product names using AI in batches with caching
   */
  private async standardizeProductNamesWithAI(
    products: Array<{name: string, category: string}>,
    metrics: ProcessingMetrics,
    uploadId?: string
  ): Promise<string[]> {
    try {
      if (products.length === 0) {
        return [];
      }

      const results: string[] = [];
      const productsNeedingAI: Array<{index: number, product: {name: string, category: string}}> = [];
      
      // Check cache first
      let cacheHits = 0;
      for (let i = 0; i < products.length; i++) {
        const cacheKey = `${products[i].name.toLowerCase()}|${products[i].category}`;
        const cached = this.standardizationCache.get(cacheKey);
        
        if (cached) {
          results[i] = cached;
          cacheHits++;
        } else {
          productsNeedingAI.push({ index: i, product: products[i] });
        }
      }
      
      if (cacheHits > 0) {
        console.log(`💾 Cache hits: ${cacheHits}/${products.length} products`);
      }
      
      // Process uncached products through AI in batches
      if (productsNeedingAI.length > 0) {
        const batchSize = 50;
        
        for (let i = 0; i < productsNeedingAI.length; i += batchSize) {
          const batch = productsNeedingAI.slice(i, i + batchSize);
          console.log(`🤖 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(productsNeedingAI.length / batchSize)} (${batch.length} products)`);
          
          const batchProducts = batch.map(item => item.product);
          const batchIndex = Math.floor(i / batchSize);
          const totalBatches = Math.ceil(productsNeedingAI.length / batchSize);
          const batchResults = await this.processBatchWithAI(
            batchProducts, 
            metrics,
            uploadId,
            batchIndex,
            totalBatches
          );
          
          // Store results and update cache
          for (let j = 0; j < batch.length; j++) {
            const originalIndex = batch[j].index;
            const standardizedName = batchResults[j];
            const cacheKey = `${batch[j].product.name.toLowerCase()}|${batch[j].product.category}`;
            
            results[originalIndex] = standardizedName;
            this.standardizationCache.set(cacheKey, standardizedName);
          }
        }
        
        console.log(`📊 Total LLM calls saved by cache: ${cacheHits} (${(cacheHits / products.length * 100).toFixed(1)}%)`);
      }
      
      return results;

    } catch (error) {
      console.error(`❌ AI batch standardization failed:`, error);
      return products.map(p => p.name.toLowerCase().trim());
    }
  }

  /**
   * Process a single batch of products with o3-mini AI using ID-based mapping
   */
  private async processBatchWithAI(
    products: Array<{name: string, category: string}>,
    metrics: ProcessingMetrics,
    uploadId?: string,
    batchIndex?: number,
    totalBatches?: number
  ): Promise<string[]> {
    const startTime = Date.now();
    
    try {
      // Update progress if uploadId provided
      if (uploadId && batchIndex !== undefined && totalBatches !== undefined) {
        const progress = 30 + (batchIndex / totalBatches) * 40; // AI processing from 30% to 70%
        await UploadProgressTracker.updateProgress(
          uploadId,
          `Processing batch ${batchIndex + 1}/${totalBatches} with AI...`,
          progress,
          { 
            totalProducts: products.length * totalBatches,
            processedProducts: products.length * batchIndex
          }
        );
      }
      // Create batch with IDs for accurate mapping
      const productData = products.map((p, i) => ({
        id: i,
        name: p.name,
        category: p.category
      }));

      const response = await openai.chat.completions.create({
        model: 'o3-mini', // Use o3-mini specifically for standardization
        messages: [
          {
            role: 'system',
            content: `You are an expert product name standardizer for Indonesian wholesale markets. 

Your task is to standardize product names by:
1. Translating Indonesian names to English (apel -> Apple, wortel -> Carrot, tomat -> Tomato)
2. Proper capitalization (Apple Fuji, not apple fuji)
3. Removing unnecessary modifiers but keeping important descriptors
4. Standardizing units and sizes
5. Removing brand names unless essential for identification

Common Indonesian translations:
- apel = Apple
- wortel = Carrot  
- tomat = Tomato
- bawang = Onion
- kentang = Potato
- ayam = Chicken
- sapi = Beef
- ikan = Fish
- sayur = Vegetable
- buah = Fruit
- daging = Meat
- gula = Sugar
- garam = Salt
- minyak = Oil
- tepung = Flour
- telur = Egg
- susu = Milk
- beras = Rice

Return a JSON array with objects containing "id" and "nameStd" fields.
IMPORTANT: Include ALL products in your response, even if the name doesn't change.`
          },
          {
            role: 'user',
            content: `Standardize these product names:\n${JSON.stringify(productData, null, 2)}\n\nReturn JSON array with format: [{"id": 0, "nameStd": "Standardized Name"}, ...]`
          }
        ],
        max_completion_tokens: products.length * 50,
        temperature: 0
      });

      const content = response.choices[0]?.message?.content?.trim() || '';
      
      // Parse JSON response
      let standardizedData: Array<{id: number, nameStd: string}> = [];
      try {
        // Clean JSON if wrapped in markdown
        let cleanContent = content;
        if (cleanContent.includes('```json')) {
          cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```/g, '');
        } else if (cleanContent.includes('```')) {
          cleanContent = cleanContent.replace(/```\s*/g, '');
        }
        
        standardizedData = JSON.parse(cleanContent);
      } catch (parseError) {
        console.error('❌ Failed to parse AI response as JSON:', parseError);
        console.error('Raw response:', content);
        // Fallback to line-based parsing if JSON fails
        return products.map(p => p.name);
      }
      
      // Create ID map for proper alignment
      const idToNameMap = new Map<number, string>();
      standardizedData.forEach(item => {
        if (typeof item.id === 'number' && item.nameStd) {
          idToNameMap.set(item.id, item.nameStd);
        }
      });
      
      // Track token usage
      if (response.usage) {
        const usage = tokenCostMonitor.trackUsage({
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
          model: 'o3-mini'
        });
        
        metrics.totalTokensUsed += response.usage.prompt_tokens + response.usage.completion_tokens;
        metrics.totalCostUsd += usage.totalCost;
      }

      console.log(`🤖 AI Batch processed: ${products.length} products in ${Date.now() - startTime}ms`);
      
      // Map results by ID to maintain correct order
      const result: string[] = [];
      for (let i = 0; i < products.length; i++) {
        const standardizedName = idToNameMap.get(i);
        if (standardizedName) {
          result.push(standardizedName);
        } else {
          console.warn(`⚠️ Missing standardization for product ID ${i}: "${products[i].name}"`);
          result.push(products[i].name); // Fallback to original
        }
      }
      
      return result;

    } catch (error) {
      console.error(`❌ Batch AI processing failed:`, error);
      return products.map(p => p.name); // Return original names on error
    }
  }

  /**
   * Fallback: Basic standardization (should use AI for all products)
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
    
    // Vegetables
    if (name.includes('asparagus') || name.includes('tomato') || name.includes('onion') || 
        name.includes('carrot') || name.includes('potato') || name.includes('cabbage') ||
        name.includes('lettuce') || name.includes('spinach') || name.includes('broccoli') ||
        name.includes('cauliflower') || name.includes('pepper') || name.includes('cucumber') ||
        name.includes('celery') || name.includes('zucchini') || name.includes('eggplant') ||
        name.includes('bean') || name.includes('pea') || name.includes('corn') ||
        name.includes('mushroom') || name.includes('vegetable')) {
      return 'Vegetables';
    }
    
    // Meat
    if (name.includes('beef') || name.includes('chicken') || name.includes('pork') || 
        name.includes('meat') || name.includes('lamb') || name.includes('duck') ||
        name.includes('turkey') || name.includes('sausage') || name.includes('bacon')) {
      return 'Meat';
    }
    
    // Seafood
    if (name.includes('fish') || name.includes('seafood') || name.includes('tuna') || 
        name.includes('salmon') || name.includes('shrimp') || name.includes('crab') ||
        name.includes('lobster') || name.includes('squid') || name.includes('prawn')) {
      return 'Seafood';
    }
    
    // Grains
    if (name.includes('rice') || name.includes('bread') || name.includes('grain') ||
        name.includes('flour') || name.includes('pasta') || name.includes('noodle') ||
        name.includes('wheat') || name.includes('oat') || name.includes('barley')) {
      return 'Grains';
    }
    
    // Dairy
    if (name.includes('milk') || name.includes('cheese') || name.includes('dairy') ||
        name.includes('yogurt') || name.includes('butter') || name.includes('cream')) {
      return 'Dairy';
    }
    
    return 'Other';
  }

  /**
   * Approve upload and create products/prices from extracted data
   */
  async approveUpload(uploadId: string, approvedBy: string, reviewNotes?: string): Promise<{ success: boolean; productsCreated: number; error?: string }> {
    try {
      const upload = await prisma.upload.findUnique({
        where: { id: uploadId },
        include: { supplier: true }
      });

      if (!upload) {
        return { success: false, productsCreated: 0, error: 'Upload not found' };
      }

      if (upload.approvalStatus !== 'pending_review') {
        return { success: false, productsCreated: 0, error: 'Upload is not pending review' };
      }

      if (!upload.extractedData) {
        return { success: false, productsCreated: 0, error: 'No extracted data found' };
      }

      const extractedData = upload.extractedData as any;
      const metrics: ProcessingMetrics = {
        startTime: Date.now(),
        totalTokensUsed: 0,
        totalCostUsd: 0,
        errors: []
      };

      // Create products and prices from extracted data
      const productsCreated = await this.storeExtractedProducts(
        extractedData.products || [],
        upload.supplierId,
        uploadId,
        metrics
      );

      // Update upload status to approved
      await prisma.upload.update({
        where: { id: uploadId },
        data: {
          approvalStatus: 'approved',
          approvedBy,
          approvedAt: new Date(),
          reviewNotes,
          status: 'completed'
        }
      });

      console.log(`✅ Upload ${uploadId} approved by ${approvedBy}. Created ${productsCreated} products.`);

      return { success: true, productsCreated };
    } catch (error) {
      console.error(`❌ Failed to approve upload ${uploadId}:`, error);
      return { success: false, productsCreated: 0, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Reject upload and mark as rejected
   */
  async rejectUpload(uploadId: string, rejectedBy: string, reason: string): Promise<{ success: boolean; error?: string }> {
    try {
      const upload = await prisma.upload.findUnique({
        where: { id: uploadId }
      });

      if (!upload) {
        return { success: false, error: 'Upload not found' };
      }

      if (upload.approvalStatus !== 'pending_review') {
        return { success: false, error: 'Upload is not pending review' };
      }

      // Update upload status to rejected
      await prisma.upload.update({
        where: { id: uploadId },
        data: {
          approvalStatus: 'rejected',
          approvedBy: rejectedBy,
          approvedAt: new Date(),
          rejectionReason: reason,
          status: 'failed'
        }
      });

      console.log(`❌ Upload ${uploadId} rejected by ${rejectedBy}. Reason: ${reason}`);

      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to reject upload ${uploadId}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Standardize unit names
   */
  private standardizeUnit(unit: string): string {
    const normalized = unit.toLowerCase().trim();
    
    const unitMap: { [key: string]: string } = {
      // Weight units
      'kg': 'kg',
      'kilogram': 'kg',
      'kilograms': 'kg',
      'kilo': 'kg',
      'g': 'g',
      'gram': 'g',
      'grams': 'g',
      'gr': 'g',
      'lb': 'lb',
      'pound': 'lb',
      'pounds': 'lb',
      'lbs': 'lb',
      'oz': 'oz',
      'ounce': 'oz',
      'ounces': 'oz',
      
      // Volume units
      'l': 'l',
      'liter': 'l',
      'litre': 'l',
      'liters': 'l',
      'litres': 'l',
      'ltr': 'l',
      'ml': 'ml',
      'milliliter': 'ml',
      'milliliters': 'ml',
      
      // Count units
      'pcs': 'pcs',
      'piece': 'pcs',
      'pieces': 'pcs',
      'pc': 'pcs',
      'each': 'pcs',
      'item': 'pcs',
      'unit': 'pcs',
      
      // Container units
      'box': 'box',
      'boxes': 'box',
      'pack': 'pack',
      'package': 'pack',
      'packet': 'pack',
      'bottle': 'bottle',
      'bottles': 'bottle',
      'btl': 'bottle',
      'can': 'can',
      'cans': 'can',
      
      // Indonesian units
      'sisir': 'bunch',
      'ikat': 'bunch',
      'bunch': 'bunch',
      'bundle': 'bunch'
    };

    return unitMap[normalized] || normalized;
  }

  /**
   * Process image file using OpenAI Vision API
   */
  private async processImageWithVision(fileUrl: string, fileName: string): Promise<ExcelExtractionResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    
    try {
      console.log('🖼️ Processing image with Vision API:', fileName);
      
      // Use OpenAI Vision API to extract data from image
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this price list image and extract supplier and product information. Return a JSON object with:
                {
                  "supplier": {
                    "name": "company name",
                    "email": "email if found",
                    "phone": "phone if found",
                    "address": "address if found"
                  },
                  "products": [
                    {
                      "name": "product name",
                      "price": numeric_price,
                      "unit": "unit (kg, lb, each, etc.)",
                      "category": "category if obvious",
                      "description": "additional details"
                    }
                  ]
                }
                
                Important:
                - Extract supplier info from headers, logos, or contact sections
                - Only include products with clear prices
                - Standardize units (kg not kilograms)
                - Clean product names
                - Infer categories when possible
                - Return valid JSON only`
              },
              {
                type: "image_url",
                image_url: {
                  url: fileUrl
                }
              }
            ]
          }
        ],
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from Vision API');
      }

      // Clean and parse response
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const extractedData = JSON.parse(cleanContent);
      
      // Track token usage
      const tokensUsed = response.usage?.total_tokens || 0;
      const costUsd = tokenCostMonitor.calculateCost(tokensUsed, 'gpt-4o-mini');
      
      console.log(`✅ Vision API extracted ${extractedData.products?.length || 0} products`);

      // Convert to standard format
      return {
        supplier: extractedData.supplier,
        products: extractedData.products || [],
        totalRowsDetected: extractedData.products?.length || 0,
        totalRowsProcessed: extractedData.products?.length || 0,
        completenessRatio: 1.0, // Assume complete extraction from image
        processingTimeMs: Date.now() - startTime,
        tokensUsed,
        costUsd,
        errors,
        sheets: null,
        extractionMethods: {
          visionApi: {
            productsExtracted: extractedData.products?.length || 0
          }
        }
      };

    } catch (error) {
      console.error('❌ Vision API processing failed:', error);
      errors.push(error instanceof Error ? error.message : String(error));
      
      return {
        supplier: null,
        products: [],
        totalRowsDetected: 0,
        totalRowsProcessed: 0,
        completenessRatio: 0,
        processingTimeMs: Date.now() - startTime,
        tokensUsed: 0,
        costUsd: 0,
        errors,
        sheets: null
      };
    }
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