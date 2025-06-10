/**
 * Enhanced PDF Extractor  
 * Uses dual approach (lattice + stream) and pdfplumber for maximum coverage
 */

import { spawn } from 'child_process';
import path from 'path';
import { tokenCostMonitor } from './tokenCostMonitor';

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
    camelotLattice?: { tables: number; rows: number };
    camelotStream?: { tables: number; rows: number };
    pdfPlumber?: { pages: number; rows: number };
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

class EnhancedPdfExtractor {
  private static instance: EnhancedPdfExtractor;
  
  private readonly config = {
    completenessThreshold: parseFloat(process.env.COMPLETENESS_THRESHOLD_PDF || '0.85'),
    minProductsForSuccess: parseInt(process.env.MIN_PRODUCTS_FOR_SUCCESS || '50'), // Minimum products to consider success
    maxProductsForFallback: parseInt(process.env.MAX_PRODUCTS_FOR_FALLBACK || '200'), // Don't use AI if we already have many products
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024,
    llmFallbackEnabled: process.env.LLM_FALLBACK_ENABLED === 'true',
    pythonScriptPath: path.join(process.cwd(), 'scripts', 'enhanced_pdf_processor.py'),
    aiExtractorPath: path.join(process.cwd(), 'scripts', 'async_pdf_image_extractor.py'), // Use async version
    useAsyncAiExtraction: process.env.USE_ASYNC_AI_EXTRACTION !== 'false' // Default to true
  };

  public static getInstance(): EnhancedPdfExtractor {
    if (!EnhancedPdfExtractor.instance) {
      EnhancedPdfExtractor.instance = new EnhancedPdfExtractor();
    }
    return EnhancedPdfExtractor.instance;
  }

  /**
   * Main extraction method for PDF files
   */
  async extractFromPdf(fileUrl: string, fileName: string): Promise<PdfExtractionResult> {
    const startTime = Date.now();
    console.log(`🔍 Enhanced PDF extraction starting: ${fileName}`);

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

      // Run enhanced Python processor
      let result = await this.runEnhancedPythonProcessor(fileUrl);
      
      // Check if AI fallback is needed with smart logic
      const currentCompleteness = result.totalRowsDetected > 0 
        ? result.totalRowsProcessed / result.totalRowsDetected 
        : 0;
      
      const aiVisionEnabled = process.env.AI_VISION_ENABLED === 'true';
      const needsAiFallback = this.shouldUseAiFallback(
        result.products.length,
        currentCompleteness,
        result.totalRowsDetected,
        aiVisionEnabled
      );
      
      if (needsAiFallback.needed) {
        console.log(`🤖 Traditional extraction insufficient (${needsAiFallback.reason}), trying AI Vision fallback...`);
        try {
          const aiResult = await this.runAiImageExtractor(fileUrl);
          if (aiResult.products.length > 0) {
            console.log(`✅ AI Vision extracted ${aiResult.products.length} products`);
            
            // Decide whether to replace or merge based on smart logic
            if (needsAiFallback.shouldReplace) {
              console.log(`🔄 Replacing low-quality traditional results with AI results`);
              result = this.replaceWithAiResults(result, aiResult);
            } else {
              console.log(`🔄 Merging AI results with traditional results`);
              result = this.mergeExtractionResults(result, aiResult);
            }
          }
        } catch (aiError) {
          console.error(`❌ AI Vision fallback failed:`, aiError);
          result.errors.push(`AI fallback failed: ${aiError instanceof Error ? aiError.message : String(aiError)}`);
        }
      }
      
      // Calculate final metrics
      result.processingTimeMs = Date.now() - startTime;
      result.completenessRatio = result.totalRowsDetected > 0 
        ? result.totalRowsProcessed / result.totalRowsDetected 
        : (result.products.length > 0 ? 1.0 : 0); // If AI found products, consider it 100% complete

      // Log results
      console.log(`✅ Enhanced PDF extraction completed: ${fileName}`);
      console.log(`   📊 Rows: ${result.totalRowsProcessed}/${result.totalRowsDetected} (${(result.completenessRatio * 100).toFixed(1)}%)`);
      console.log(`   🛍️ Products: ${result.products.length}`);
      console.log(`   🔧 Best method: ${result.extractionMethods.bestMethod}`);
      console.log(`   ⏱️ Time: ${result.processingTimeMs}ms`);
      console.log(`   💰 Cost: $${result.costUsd.toFixed(4)}`);

      return result;

    } catch (error) {
      console.error(`❌ Enhanced PDF extraction failed: ${fileName}`, error);
      
      return {
        products: [],
        totalRowsDetected: 0,
        totalRowsProcessed: 0,
        completenessRatio: 0,
        processingTimeMs: Date.now() - startTime,
        tokensUsed: 0,
        costUsd: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        extractionMethods: { bestMethod: 'none' }
      };
    }
  }

  /**
   * Run enhanced Python processor with multiple extraction methods
   */
  private async runEnhancedPythonProcessor(pdfUrl: string): Promise<PdfExtractionResult> {
    return new Promise((resolve, reject) => {
      console.log(`🐍 Starting enhanced Python PDF processor...`);
      
      const pythonProcess = spawn('python3', [this.config.pythonScriptPath, pdfUrl, '--enhanced']);
      
      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        console.log(`📤 Python output: ${chunk.trim()}`);
      });

      pythonProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        console.error(`📤 Python error: ${chunk.trim()}`);
      });

      pythonProcess.on('close', (code) => {
        console.log(`🔚 Python process finished with code: ${code}`);
        console.log(`📊 Total stdout length: ${stdout.length} characters`);
        console.log(`📊 Total stderr length: ${stderr.length} characters`);

        if (code !== 0) {
          reject(new Error(`Python process failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          // Parse JSON output from Python script
          const result = this.parseEnhancedPythonOutput(stdout);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse Python output: ${error}`));
        }
      });

      pythonProcess.on('error', (error) => {
        console.error(`🚨 Python process error:`, error);
        reject(error);
      });
    });
  }

  /**
   * Parse enhanced Python output with multiple extraction methods
   */
  private parseEnhancedPythonOutput(stdout: string): PdfExtractionResult {
    try {
      // Look for JSON output marker
      const jsonMatch = stdout.match(/=== ENHANCED_JSON_START ===\n(.*)\n=== ENHANCED_JSON_END ===/s);
      
      if (jsonMatch && jsonMatch[1]) {
        const jsonData = JSON.parse(jsonMatch[1]);
        
        return {
          supplier: jsonData.supplier,
          products: jsonData.products || [],
          totalRowsDetected: jsonData.metrics?.totalRowsDetected || 0,
          totalRowsProcessed: jsonData.metrics?.totalRowsProcessed || 0,
          completenessRatio: 0, // Will be calculated by caller
          processingTimeMs: 0, // Will be set by caller
          tokensUsed: jsonData.metrics?.tokensUsed || 0,
          costUsd: jsonData.metrics?.costUsd || 0,
          errors: jsonData.errors || [],
          extractionMethods: jsonData.extractionMethods || { bestMethod: 'unknown' }
        };
      }

      // Fallback: try to parse as simple JSON
      console.log(`⚠️ No enhanced JSON marker found, trying simple parse...`);
      const simpleJson = JSON.parse(stdout);
      
      return {
        supplier: simpleJson.supplier,
        products: simpleJson.products || [],
        totalRowsDetected: (simpleJson.products || []).length,
        totalRowsProcessed: (simpleJson.products || []).length,
        completenessRatio: 0,
        processingTimeMs: 0,
        tokensUsed: 0,
        costUsd: 0,
        errors: [],
        extractionMethods: { bestMethod: 'legacy' }
      };

    } catch (error) {
      console.error(`❌ Failed to parse Python output:`, error);
      console.log(`📝 Raw stdout:`, stdout.substring(0, 500) + '...');
      
      throw new Error(`Python output parsing failed: ${error}`);
    }
  }

  /**
   * Run AI Vision-based extraction as fallback
   */
  private async runAiImageExtractor(pdfUrl: string): Promise<PdfExtractionResult> {
    return new Promise((resolve, reject) => {
      const extractorType = this.config.useAsyncAiExtraction ? 'ASYNC' : 'SYNC';
      console.log(`🤖 Starting ${extractorType} AI Vision PDF extraction...`);
      
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        reject(new Error('OPENAI_API_KEY not found in environment variables'));
        return;
      }
      
      // Set timeout for AI processing (5 minutes for complex documents)
      const timeoutMs = 5 * 60 * 1000;
      const timeout = setTimeout(() => {
        console.error(`🚨 AI Vision extraction timeout after ${timeoutMs}ms`);
        pythonProcess.kill('SIGKILL');
        reject(new Error(`AI Vision extraction timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      
      const pythonProcess = spawn('python3', [this.config.aiExtractorPath, pdfUrl, openaiApiKey], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: timeoutMs,
        env: {
          ...process.env,
          OPENAI_API_KEY: openaiApiKey
        }
      });
      
      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        console.log(`🤖 AI output: ${chunk.trim()}`);
      });

      pythonProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        console.error(`🤖 AI error: ${chunk.trim()}`);
      });

      pythonProcess.on('close', (code, signal) => {
        clearTimeout(timeout);
        console.log(`🤖 AI process finished with code: ${code}, signal: ${signal}`);

        if (signal === 'SIGKILL') {
          reject(new Error('AI extraction process was killed due to timeout'));
          return;
        }

        if (code !== 0) {
          reject(new Error(`AI extraction process failed with code ${code}: ${stderr.slice(-500)}`));
          return;
        }

        try {
          const result = this.parseAiExtractionOutput(stdout);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse AI extraction output: ${error}`));
        }
      });

      pythonProcess.on('error', (error) => {
        clearTimeout(timeout);
        console.error(`🚨 AI extraction process error:`, error);
        reject(error);
      });
    });
  }

  /**
   * Parse AI extraction output
   */
  private parseAiExtractionOutput(stdout: string): PdfExtractionResult {
    try {
      // Look for JSON output marker
      const jsonMatch = stdout.match(/=== AI_EXTRACTION_JSON_START ===\n(.*)\n=== AI_EXTRACTION_JSON_END ===/s);
      
      if (jsonMatch && jsonMatch[1]) {
        const jsonData = JSON.parse(jsonMatch[1]);
        
        // Transform AI output to our format
        const products: ExtractedProduct[] = (jsonData.products || []).map((product: any) => ({
          name: product.name,
          price: product.price,
          unit: product.unit || 'pcs',
          category: product.category,
          description: product.description,
          sourcePage: product.source_page,
          sourceMethod: 'ai_vision'
        }));

        // Track token usage
        const metrics = jsonData.metrics || {};
        const tokensUsed = metrics.tokens_used || 0;
        const costUsd = metrics.cost_usd || 0;

        // Record cost
        if (tokensUsed > 0) {
          try {
            if (jsonData.page_results && jsonData.page_results.length > 0) {
              // Calculate total input/output tokens from all pages
              let totalInputTokens = 0;
              let totalOutputTokens = 0;
              
              for (const pageResult of jsonData.page_results) {
                if (pageResult._metadata) {
                  // Estimate input/output split (roughly 85% input, 15% output for vision tasks)
                  const pageTokens = pageResult._metadata.tokens_used || 0;
                  totalInputTokens += Math.round(pageTokens * 0.85);
                  totalOutputTokens += Math.round(pageTokens * 0.15);
                }
              }
              
              if (totalInputTokens > 0 || totalOutputTokens > 0) {
                tokenCostMonitor.recordTokenUsage({
                  inputTokens: totalInputTokens,
                  outputTokens: totalOutputTokens,
                  model: 'gpt-4o'
                });
              }
            }
          } catch (tokenError) {
            console.warn(`⚠️ Token monitoring failed:`, tokenError);
            // Don't let token monitoring errors break AI extraction
          }
        }

        return {
          supplier: jsonData.supplier,
          products: products,
          totalRowsDetected: metrics.pages_processed || 0,
          totalRowsProcessed: products.length,
          completenessRatio: products.length > 0 ? 1.0 : 0,
          processingTimeMs: 0, // Will be set by caller
          tokensUsed: tokensUsed,
          costUsd: costUsd,
          errors: [],
          extractionMethods: {
            aiVision: {
              pages: metrics.pages_processed || 0,
              products: products.length
            },
            bestMethod: 'ai_vision'
          }
        };
      } else {
        throw new Error('No AI extraction JSON found in output');
      }

    } catch (error) {
      console.error(`❌ Failed to parse AI extraction output:`, error);
      console.log(`📝 Raw AI stdout:`, stdout.substring(0, 500) + '...');
      
      throw new Error(`AI extraction output parsing failed: ${error}`);
    }
  }

  /**
   * Merge traditional extraction results with AI results
   */
  private mergeExtractionResults(traditionalResult: PdfExtractionResult, aiResult: PdfExtractionResult): PdfExtractionResult {
    // Use AI supplier info if traditional didn't find any
    const supplier = traditionalResult.supplier || aiResult.supplier;
    
    // Combine products (AI products take priority since traditional failed)
    const allProducts = [...traditionalResult.products, ...aiResult.products];
    
    // Deduplicate by name
    const uniqueProducts = [];
    const seenNames = new Set();
    
    for (const product of allProducts) {
      const productKey = product.name.toLowerCase().trim();
      if (!seenNames.has(productKey)) {
        seenNames.add(productKey);
        uniqueProducts.push(product);
      }
    }

    // Combine metrics
    const totalTokens = traditionalResult.tokensUsed + aiResult.tokensUsed;
    const totalCost = traditionalResult.costUsd + aiResult.costUsd;
    
    // Merge extraction methods
    const extractionMethods = {
      ...traditionalResult.extractionMethods,
      ...aiResult.extractionMethods,
      bestMethod: uniqueProducts.length > traditionalResult.products.length ? 'ai_vision' : traditionalResult.extractionMethods.bestMethod
    };

    return {
      supplier,
      products: uniqueProducts,
      totalRowsDetected: Math.max(traditionalResult.totalRowsDetected, aiResult.totalRowsDetected),
      totalRowsProcessed: uniqueProducts.length,
      completenessRatio: uniqueProducts.length > 0 ? 1.0 : 0,
      processingTimeMs: traditionalResult.processingTimeMs,
      tokensUsed: totalTokens,
      costUsd: totalCost,
      errors: [...traditionalResult.errors, ...aiResult.errors],
      extractionMethods
    };
  }

  /**
   * Smart logic to determine if AI fallback is needed
   */
  private shouldUseAiFallback(
    productCount: number,
    completenessRatio: number,
    totalRows: number,
    aiVisionEnabled: boolean
  ): { needed: boolean; reason: string; shouldReplace: boolean } {
    if (!this.config.llmFallbackEnabled || !aiVisionEnabled) {
      return { needed: false, reason: 'AI fallback disabled', shouldReplace: false };
    }

    // Case 1: No products found at all
    if (productCount === 0) {
      return {
        needed: true,
        reason: 'no products found',
        shouldReplace: false // merge since we have nothing to replace
      };
    }

    // Case 2: Very few products (likely extraction failed)
    if (productCount < this.config.minProductsForSuccess) {
      return {
        needed: true,
        reason: `too few products (${productCount} < ${this.config.minProductsForSuccess})`,
        shouldReplace: true
      };
    }

    // Case 3: Already have many products - don't risk breaking with AI
    if (productCount >= this.config.maxProductsForFallback) {
      return {
        needed: false,
        reason: `sufficient products found (${productCount} >= ${this.config.maxProductsForFallback})`,
        shouldReplace: false
      };
    }

    // Case 4: Medium product count but very low completeness (likely table structure issues)
    if (completenessRatio < 0.3 && totalRows > 100) {
      return {
        needed: true,
        reason: `very low completeness (${(completenessRatio * 100).toFixed(1)}% < 30%) with many rows (${totalRows})`,
        shouldReplace: true
      };
    }

    // Case 5: Low completeness but not critical
    if (completenessRatio < this.config.completenessThreshold && productCount < 100) {
      return {
        needed: true,
        reason: `low completeness (${(completenessRatio * 100).toFixed(1)}% < ${(this.config.completenessThreshold * 100)}%) with moderate product count (${productCount})`,
        shouldReplace: false // merge to add more products
      };
    }

    // Case 6: Everything looks good
    return {
      needed: false,
      reason: `extraction successful (${productCount} products, ${(completenessRatio * 100).toFixed(1)}% completeness)`,
      shouldReplace: false
    };
  }

  /**
   * Replace traditional results with AI results when quality is low
   */
  private replaceWithAiResults(traditionalResult: PdfExtractionResult, aiResult: PdfExtractionResult): PdfExtractionResult {
    // Use AI supplier info if better than traditional
    const supplier = aiResult.supplier || traditionalResult.supplier;
    
    // Use AI products entirely (replace, don't merge)
    const products = aiResult.products;
    
    // Combine costs but use AI metrics
    const totalTokens = traditionalResult.tokensUsed + aiResult.tokensUsed;
    const totalCost = traditionalResult.costUsd + aiResult.costUsd;
    
    // Combine extraction methods, prioritizing AI
    const extractionMethods = {
      ...traditionalResult.extractionMethods,
      ...aiResult.extractionMethods,
      bestMethod: 'ai_vision_replacement'
    };

    return {
      supplier,
      products: products,
      totalRowsDetected: aiResult.totalRowsDetected || traditionalResult.totalRowsDetected,
      totalRowsProcessed: products.length,
      completenessRatio: products.length > 0 ? 1.0 : 0, // AI extracted successfully
      processingTimeMs: traditionalResult.processingTimeMs,
      tokensUsed: totalTokens,
      costUsd: totalCost,
      errors: [...traditionalResult.errors, ...aiResult.errors],
      extractionMethods
    };
  }
}

// Export singleton instance
export const enhancedPdfExtractor = EnhancedPdfExtractor.getInstance();

// Export types
export type { PdfExtractionResult, ExtractedProduct };