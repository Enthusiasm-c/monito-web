/**
 * Enhanced Product Processor with Batch Database Operations
 * Integrates AI structuring, product normalization, price parsing, and batch database operations
 */

import { batchDatabaseIntegration } from '../pipeline/batch_database_integration';
import { priceParsingService } from '../pipeline/price_parsing_service';
import { aiCacheIntegration } from '../pipeline/ai_cache_integration';
import { loggingIntegration } from '../pipeline/logging_integration';

export interface ProcessingConfig {
  batchSize?: number;
  useCache?: boolean;
  validateProducts?: boolean;
  cleanupExisting?: boolean;
  onConflict?: 'ignore' | 'update' | 'error';
  aiStructuring?: boolean;
  priceNormalization?: boolean;
  productNormalization?: boolean;
}

export interface ProcessingResult {
  success: boolean;
  totalProducts: number;
  inserted: number;
  updated: number;
  errors: number;
  validationErrors: string[];
  processingTimeMs: number;
  extractionStats: {
    aiStructured: number;
    pricesNormalized: number;
    productsNormalized: number;
    cached: number;
  };
  performanceStats: {
    extractionTimeMs: number;
    structuringTimeMs: number;
    normalizationTimeMs: number;
    databaseTimeMs: number;
  };
}

export class EnhancedProductProcessor {
  private config: ProcessingConfig;

  constructor(config: ProcessingConfig = {}) {
    this.config = {
      batchSize: 1000,
      useCache: true,
      validateProducts: true,
      cleanupExisting: true,
      onConflict: 'update',
      aiStructuring: true,
      priceNormalization: true,
      productNormalization: true,
      ...config
    };
  }

  /**
   * Process extracted data from files into database
   */
  @loggingIntegration.timing('file_processing')
  async processExtractedData(
    extractedData: {
      tables?: any[];
      sheets?: Record<string, any>;
      text_content?: string;
      metadata?: any;
    },
    fileInfo: {
      filename: string;
      uploadId: string;
      fileHash: string;
      userId: string;
    }
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    // Create request context for logging
    const cleanup = loggingIntegration.createRequestContext({
      requestId: `proc_${fileInfo.fileHash.substring(0, 8)}`,
      userId: fileInfo.userId,
      operation: 'process_extracted_data',
      filename: fileInfo.filename,
      uploadId: fileInfo.uploadId
    });
    
    const result: ProcessingResult = {
      success: false,
      totalProducts: 0,
      inserted: 0,
      updated: 0,
      errors: 0,
      validationErrors: [],
      processingTimeMs: 0,
      extractionStats: {
        aiStructured: 0,
        pricesNormalized: 0,
        productsNormalized: 0,
        cached: 0
      },
      performanceStats: {
        extractionTimeMs: 0,
        structuringTimeMs: 0,
        normalizationTimeMs: 0,
        databaseTimeMs: 0
      }
    };

    try {
      await loggingIntegration.info('Starting product processing', {
        filename: fileInfo.filename,
        fileHash: fileInfo.fileHash,
        uploadId: fileInfo.uploadId,
        extractedDataKeys: Object.keys(extractedData)
      });

      // Step 1: Extract raw products from data
      const extractionStart = Date.now();
      const rawProducts = await this.extractRawProducts(extractedData);
      result.extractionStats.aiStructured = rawProducts.length;
      result.performanceStats.extractionTimeMs = Date.now() - extractionStart;

      if (rawProducts.length === 0) {
        await loggingIntegration.warning('No products found in extracted data', {
          filename: fileInfo.filename,
          extractedDataSize: JSON.stringify(extractedData).length
        });
        return { ...result, success: true };
      }

      await loggingIntegration.info('Raw products extracted', {
        rawProductsCount: rawProducts.length,
        extractionTimeMs: result.performanceStats.extractionTimeMs
      });

      // Step 2: AI structuring (if enabled)
      const structuringStart = Date.now();
      let structuredProducts = rawProducts;
      
      if (this.config.aiStructuring) {
        structuredProducts = await this.applyAIStructuring(extractedData, fileInfo.fileHash);
        result.extractionStats.cached = structuredProducts.filter(p => p._cached).length;
      }
      
      result.performanceStats.structuringTimeMs = Date.now() - structuringStart;

      // Step 3: Normalize products (if enabled)
      const normalizationStart = Date.now();
      let normalizedProducts = structuredProducts;
      
      if (this.config.productNormalization || this.config.priceNormalization) {
        normalizedProducts = await this.normalizeProducts(structuredProducts);
        result.extractionStats.productsNormalized = normalizedProducts.length;
        result.extractionStats.pricesNormalized = normalizedProducts.filter(p => p._priceNormalized).length;
      }
      
      result.performanceStats.normalizationTimeMs = Date.now() - normalizationStart;

      // Step 4: Enhance with metadata
      const enhancedProducts = normalizedProducts.map(product => ({
        ...product,
        sourceFile: fileInfo.filename,
        uploadId: fileInfo.uploadId,
        fileHash: fileInfo.fileHash,
        userId: fileInfo.userId,
        extractedAt: new Date().toISOString(),
        confidence: product.confidence || 0.8
      }));

      result.totalProducts = enhancedProducts.length;

      // Step 5: Batch database operations
      const databaseStart = Date.now();
      const dbResult = await batchDatabaseIntegration.processExtractedProducts(
        {
          products: enhancedProducts,
          sourceFile: fileInfo.filename,
          uploadId: fileInfo.uploadId
        },
        {
          batchSize: this.config.batchSize,
          onConflict: this.config.onConflict,
          validateProducts: this.config.validateProducts,
          cleanupExisting: this.config.cleanupExisting
        }
      );

      result.inserted = dbResult.inserted;
      result.updated = dbResult.updated;
      result.errors = dbResult.errors;
      result.validationErrors = dbResult.validationErrors;
      result.performanceStats.databaseTimeMs = Date.now() - databaseStart;

      result.success = dbResult.success;

      // Log final processing results
      await loggingIntegration.logFileProcessing(
        fileInfo.filename,
        JSON.stringify(extractedData).length,
        result.processingTimeMs,
        result.inserted,
        result.success,
        {
          updated: result.updated,
          errors: result.errors,
          totalProducts: result.totalProducts,
          aiStructured: result.extractionStats.aiStructured,
          cached: result.extractionStats.cached,
          structuringTimeMs: result.performanceStats.structuringTimeMs,
          normalizationTimeMs: result.performanceStats.normalizationTimeMs,
          databaseTimeMs: result.performanceStats.databaseTimeMs
        }
      );

    } catch (error) {
      await loggingIntegration.error('Product processing failed', error as Error, {
        filename: fileInfo.filename,
        processingTimeMs: Date.now() - startTime
      });
      
      result.success = false;
      result.errors = result.totalProducts;
      result.validationErrors.push(String(error));
    } finally {
      result.processingTimeMs = Date.now() - startTime;
      cleanup();
    }

    return result;
  }

  /**
   * Extract raw products from different data formats
   */
  private async extractRawProducts(extractedData: any): Promise<any[]> {
    const products: any[] = [];

    // Extract from tables
    if (extractedData.tables) {
      for (const table of extractedData.tables) {
        const tableProducts = this.extractFromTable(table);
        products.push(...tableProducts);
      }
    }

    // Extract from Excel sheets
    if (extractedData.sheets) {
      for (const [sheetName, sheetData] of Object.entries(extractedData.sheets)) {
        if (Array.isArray(sheetData.data)) {
          products.push(...sheetData.data.map((row: any) => ({
            ...row,
            _sourceSheet: sheetName
          })));
        }
      }
    }

    // Extract from text content
    if (extractedData.text_content) {
      const textProducts = this.extractFromText(extractedData.text_content);
      products.push(...textProducts);
    }

    return products;
  }

  /**
   * Extract products from table data
   */
  private extractFromTable(table: any): any[] {
    const products: any[] = [];
    const data = table.data || [];
    const headers = table.headers || [];

    for (const row of data) {
      if (!Array.isArray(row) || row.length === 0) continue;

      const product: any = {};
      
      // Map row data to headers
      for (let i = 0; i < row.length; i++) {
        const value = row[i];
        if (value && typeof value === 'string' && value.trim()) {
          const header = headers[i] || `column_${i + 1}`;
          product[header] = value.trim();
        }
      }

      // Basic validation
      if (Object.keys(product).length >= 2) {
        product._sourceTable = table.table_id || 'unknown';
        product._sourcePage = table.page || 1;
        products.push(product);
      }
    }

    return products;
  }

  /**
   * Extract products from text content
   */
  private extractFromText(textContent: string): any[] {
    const products: any[] = [];
    const lines = textContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.length < 10) continue; // Skip short lines
      
      // Look for product-like patterns
      if (this.looksLikeProductLine(line)) {
        products.push({
          raw_text: line,
          _sourceLine: i + 1
        });
      }
    }

    return products;
  }

  /**
   * Check if a text line looks like a product entry
   */
  private looksLikeProductLine(line: string): boolean {
    // Skip headers and metadata
    const skipPatterns = [
      /^(page|table|sheet|document|file)/i,
      /^(total|subtotal|grand total)/i,
      /^(date|time|generated|created)/i,
      /^\d+\s*$/,  // Just numbers
      /^[A-Z\s]+$/  // All caps (likely headers)
    ];

    for (const pattern of skipPatterns) {
      if (pattern.test(line)) return false;
    }

    // Look for product indicators
    const productIndicators = [
      /\d+[.,]\d+/,  // Numbers (prices)
      /(kg|liter|piece|pcs|unit|box|pack)/i,  // Units
      /(rp|idr|\$|€)/i,  // Currency
      /\d+k\b/i  // Indonesian number format
    ];

    return productIndicators.some(pattern => pattern.test(line));
  }

  /**
   * Apply AI structuring to raw data
   */
  private async applyAIStructuring(extractedData: any, fileHash: string): Promise<any[]> {
    // Check cache first if enabled
    if (this.config.useCache) {
      const cached = await aiCacheIntegration.getCachedProcessedData(
        fileHash,
        { structuring: true, model: 'gpt-o3' }
      );
      
      if (cached.cached && cached.data) {
        console.log(`🎯 Using cached AI structuring for ${fileHash.substring(0, 8)}...`);
        return cached.data.products.map((p: any) => ({ ...p, _cached: true }));
      }
    }

    // Apply AI structuring (implement based on existing AI service)
    // This would call the AI structuring service
    console.log(`🤖 Applying AI structuring...`);
    
    // For now, return the raw products (would be replaced with actual AI structuring)
    const rawProducts = await this.extractRawProducts(extractedData);
    
    // Cache the result if enabled
    if (this.config.useCache) {
      await aiCacheIntegration.cacheProcessedData(
        fileHash,
        { structuring: true, model: 'gpt-o3' },
        { products: rawProducts }
      );
    }
    
    return rawProducts;
  }

  /**
   * Normalize products using price parsing and product normalization
   */
  private async normalizeProducts(products: any[]): Promise<any[]> {
    const normalizedProducts: any[] = [];

    for (const product of products) {
      const normalized = { ...product };

      // Normalize price if enabled and price text is available
      if (this.config.priceNormalization && (product.price_text || product.price)) {
        try {
          const priceText = product.price_text || String(product.price);
          const parseResult = await priceParsingService.parsePrice(priceText);
          
          if (parseResult.success && parseResult.parsed_price) {
            normalized.price = parseResult.parsed_price.primary_price;
            normalized.currency = parseResult.parsed_price.currency;
            normalized.unit = parseResult.parsed_price.unit || normalized.unit;
            normalized.priceType = parseResult.parsed_price.price_type;
            normalized.priceConfidence = parseResult.parsed_price.confidence;
            normalized._priceNormalized = true;
          }
        } catch (error) {
          console.warn(`⚠️ Price normalization failed:`, error);
        }
      }

      // Basic product normalization
      if (this.config.productNormalization) {
        // Normalize product name
        if (normalized.name) {
          normalized.name = this.normalizeProductName(normalized.name);
        }

        // Normalize unit
        if (normalized.unit) {
          normalized.unit = this.normalizeUnit(normalized.unit);
        }

        // Infer category if missing
        if (!normalized.category && normalized.name) {
          normalized.category = this.inferCategory(normalized.name);
        }

        normalized._productNormalized = true;
      }

      normalizedProducts.push(normalized);
    }

    return normalizedProducts;
  }

  /**
   * Normalize product name
   */
  private normalizeProductName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^(item|product|barang)[\s:]+/i, '')
      .replace(/^no[\.\s]*\d+[\.\s]*/i, '')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Normalize unit
   */
  private normalizeUnit(unit: string): string {
    const unitMappings: Record<string, string> = {
      'kilogram': 'kg',
      'kilo': 'kg',
      'gram': 'g',
      'liter': 'liter',
      'litre': 'liter',
      'piece': 'piece',
      'pieces': 'piece',
      'pcs': 'piece',
      'pc': 'piece'
    };

    const normalized = unit.toLowerCase().trim();
    return unitMappings[normalized] || normalized;
  }

  /**
   * Infer product category from name
   */
  private inferCategory(name: string): string {
    const categoryKeywords: Record<string, string[]> = {
      'Vegetables': ['tomato', 'carrot', 'onion', 'potato', 'cabbage', 'lettuce'],
      'Fruits': ['apple', 'banana', 'orange', 'mango', 'grape', 'strawberry'],
      'Meat & Seafood': ['chicken', 'beef', 'pork', 'fish', 'shrimp', 'crab'],
      'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream'],
      'Bakery': ['bread', 'cake', 'pastry', 'cookie', 'biscuit'],
      'Beverages': ['juice', 'water', 'soda', 'coffee', 'tea'],
      'Cleaning': ['detergent', 'soap', 'shampoo', 'cleaner', 'disinfectant']
    };

    const nameLower = name.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      for (const keyword of keywords) {
        if (nameLower.includes(keyword)) {
          return category;
        }
      }
    }

    return 'General';
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<{
    databaseStats: any;
    cacheStats: any;
  }> {
    const [databaseStats, cacheStats] = await Promise.all([
      batchDatabaseIntegration.getDatabaseStats(),
      aiCacheIntegration.getCacheStats()
    ]);

    return { databaseStats, cacheStats };
  }

  /**
   * Optimize system performance
   */
  async optimizePerformance(): Promise<{
    databaseOptimization: any;
    cacheCleanup: any;
  }> {
    console.log(`🔧 Optimizing system performance...`);

    const [databaseOptimization, cacheCleanup] = await Promise.all([
      batchDatabaseIntegration.optimizeTables(),
      aiCacheIntegration.cleanupCache()
    ]);

    console.log(`✅ Performance optimization completed`);

    return { databaseOptimization, cacheCleanup };
  }

  /**
   * Process multiple files in batch
   */
  async processBatchFiles(
    files: Array<{
      extractedData: any;
      fileInfo: {
        filename: string;
        uploadId: string;
        fileHash: string;
        userId: string;
      };
    }>
  ): Promise<{
    results: ProcessingResult[];
    summary: {
      totalFiles: number;
      successfulFiles: number;
      totalProducts: number;
      totalInserted: number;
      totalUpdated: number;
      totalErrors: number;
      totalProcessingTimeMs: number;
    };
  }> {
    console.log(`📦 Processing batch of ${files.length} files...`);

    const results: ProcessingResult[] = [];
    const summary = {
      totalFiles: files.length,
      successfulFiles: 0,
      totalProducts: 0,
      totalInserted: 0,
      totalUpdated: 0,
      totalErrors: 0,
      totalProcessingTimeMs: 0
    };

    // Process files concurrently with limit
    const concurrencyLimit = 3;
    const chunks = [];
    
    for (let i = 0; i < files.length; i += concurrencyLimit) {
      chunks.push(files.slice(i, i + concurrencyLimit));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(file => this.processExtractedData(file.extractedData, file.fileInfo))
      );
      
      results.push(...chunkResults);

      // Update summary
      for (const result of chunkResults) {
        if (result.success) summary.successfulFiles++;
        summary.totalProducts += result.totalProducts;
        summary.totalInserted += result.inserted;
        summary.totalUpdated += result.updated;
        summary.totalErrors += result.errors;
        summary.totalProcessingTimeMs += result.processingTimeMs;
      }
    }

    console.log(`✅ Batch processing completed: ${summary.successfulFiles}/${summary.totalFiles} files, ${summary.totalInserted} inserted, ${summary.totalUpdated} updated`);

    return { results, summary };
  }
}

// Export singleton instance
export const enhancedProductProcessor = new EnhancedProductProcessor();