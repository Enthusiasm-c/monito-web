/**
 * AI Structuring Service
 * TypeScript wrapper for Python AI structuring with GPT-o3 function calling
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export interface ProductData {
  name: string;
  unit?: string;
  price?: number;
  price_text?: string;
  currency?: string;
  category?: string;
  subcategory?: string;
  supplier?: string;
  brand?: string;
  description?: string;
  sku?: string;
  stock_quantity?: number;
  minimum_order?: string;
  discount?: string;
  validity?: string;
  notes?: string;
  confidence: number;
}

export interface AIStructuringResult {
  products: ProductData[];
  metadata: {
    input_data_type: string;
    total_input_rows: number;
    processed_rows: number;
    skipped_rows: number;
    ai_model: string;
    processing_time_ms: number;
    token_usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    api_calls: number;
    confidence_scores: number[];
  };
  processing_stats: {
    high_confidence_products: number;
    medium_confidence_products: number;
    low_confidence_products: number;
    products_with_prices: number;
    products_with_categories: number;
    validation_errors: string[];
  };
  success: boolean;
  error?: string;
}

export interface AIStructuringConfig {
  openaiApiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  batchSize?: number;
  maxRetries?: number;
  timeout?: number;
  minConfidence?: number;
  requirePrice?: boolean;
  requireName?: boolean;
}

export class AIStructuringService {
  private pythonScriptPath: string;
  private defaultConfig: AIStructuringConfig;

  constructor(config?: AIStructuringConfig) {
    this.pythonScriptPath = path.join(__dirname, 'ai_structuring_service.py');
    this.defaultConfig = {
      model: 'gpt-o3',
      maxTokens: 4000,
      temperature: 0.1,
      batchSize: 10,
      maxRetries: 3,
      timeout: 60,
      minConfidence: 0.7,
      requirePrice: true,
      requireName: true,
      ...config
    };
  }

  /**
   * Structure extracted data using AI function calling
   */
  async structureExtractedData(
    extractedData: any,
    config?: AIStructuringConfig
  ): Promise<AIStructuringResult> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    
    console.log(`🤖 Starting AI structuring of extracted data`);
    
    // Validate extracted data
    if (!extractedData || typeof extractedData !== 'object') {
      throw new Error('Invalid extracted data provided');
    }

    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        OPENAI_API_KEY: mergedConfig.openaiApiKey || process.env.OPENAI_API_KEY,
        AI_MODEL: mergedConfig.model,
        MAX_TOKENS: mergedConfig.maxTokens?.toString(),
        BATCH_SIZE: mergedConfig.batchSize?.toString(),
        MIN_CONFIDENCE: mergedConfig.minConfidence?.toString()
      };

      // Create temporary file for input data
      const tempInputFile = path.join(process.cwd(), 'temp', `ai_input_${Date.now()}.json`);
      
      fs.mkdir(path.dirname(tempInputFile), { recursive: true })
        .then(() => fs.writeFile(tempInputFile, JSON.stringify(extractedData, null, 2)))
        .then(() => {
          const pythonProcess = spawn('python3', [this.pythonScriptPath, tempInputFile], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env
          });

          let stdout = '';
          let stderr = '';

          pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
          });

          pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
          });

          pythonProcess.on('close', async (code) => {
            // Cleanup temp file
            try {
              await fs.unlink(tempInputFile);
            } catch (e) {
              // Ignore cleanup errors
            }

            // Log processing info
            if (stderr) {
              console.log('🤖 AI Structuring Log:', stderr.split('\n').filter(line => 
                line.includes('[INFO]') || line.includes('[SUMMARY]')
              ).join('\n'));
            }

            if (code === 0) {
              try {
                // Parse JSON output from Python script
                const lines = stdout.split('\n');
                const jsonLine = lines.find(line => line.startsWith('AI_STRUCTURING_RESULT:'));
                
                if (!jsonLine) {
                  reject(new Error('No AI structuring result found in output'));
                  return;
                }

                const jsonStr = jsonLine.replace('AI_STRUCTURING_RESULT:', '');
                const result = JSON.parse(jsonStr) as AIStructuringResult;
                
                console.log(`✅ AI structuring completed: ${result.products.length} products, ` +
                           `${result.processing_stats.high_confidence_products} high confidence, ` +
                           `${result.metadata.token_usage.total_tokens} tokens used`);
                
                resolve(result);
                
              } catch (error) {
                reject(new Error(`Failed to parse AI structuring result: ${error}`));
              }
            } else {
              const errorMessage = stderr || 'Unknown error';
              reject(new Error(`AI structuring failed (code ${code}): ${errorMessage}`));
            }
          });

          pythonProcess.on('error', (error) => {
            reject(new Error(`Failed to start Python process: ${error.message}`));
          });

          // Set timeout for the process
          const timeout = setTimeout(() => {
            pythonProcess.kill('SIGTERM');
            reject(new Error(`AI structuring timeout after ${mergedConfig.timeout}s`));
          }, (mergedConfig.timeout || 60) * 1000);

          pythonProcess.on('close', () => {
            clearTimeout(timeout);
          });
        })
        .catch(reject);
    });
  }

  /**
   * Structure data from table extraction results
   */
  async structureTableData(
    tableExtractionResult: any,
    config?: AIStructuringConfig
  ): Promise<AIStructuringResult> {
    console.log(`🤖 Structuring table extraction data`);
    
    if (!tableExtractionResult.success) {
      throw new Error(`Table extraction failed: ${tableExtractionResult.error}`);
    }

    const extractedData = {
      data_type: 'table_extraction',
      tables: tableExtractionResult.tables,
      metadata: tableExtractionResult.metadata
    };

    return this.structureExtractedData(extractedData, config);
  }

  /**
   * Structure data from Excel reading results
   */
  async structureExcelData(
    excelReadingResult: any,
    config?: AIStructuringConfig
  ): Promise<AIStructuringResult> {
    console.log(`🤖 Structuring Excel data`);
    
    if (!excelReadingResult.success) {
      throw new Error(`Excel reading failed: ${excelReadingResult.error}`);
    }

    const extractedData = {
      data_type: 'excel_extraction',
      sheets: excelReadingResult.sheets,
      metadata: excelReadingResult.metadata
    };

    return this.structureExtractedData(extractedData, config);
  }

  /**
   * Structure data from text extraction results
   */
  async structureTextData(
    textExtractionResult: any,
    config?: AIStructuringConfig
  ): Promise<AIStructuringResult> {
    console.log(`🤖 Structuring text extraction data`);
    
    if (!textExtractionResult.success) {
      throw new Error(`Text extraction failed: ${textExtractionResult.error}`);
    }

    const extractedData = {
      data_type: 'text_extraction',
      text_content: textExtractionResult.text_content,
      page_texts: textExtractionResult.page_texts,
      metadata: textExtractionResult.metadata
    };

    return this.structureExtractedData(extractedData, config);
  }

  /**
   * Get quality metrics for structured products
   */
  getQualityMetrics(result: AIStructuringResult): {
    overallQuality: number;
    dataCompleteness: number;
    confidenceDistribution: { high: number; medium: number; low: number };
    priceAvailability: number;
    categoryAvailability: number;
    recommendations: string[];
  } {
    const total = result.products.length;
    if (total === 0) {
      return {
        overallQuality: 0,
        dataCompleteness: 0,
        confidenceDistribution: { high: 0, medium: 0, low: 0 },
        priceAvailability: 0,
        categoryAvailability: 0,
        recommendations: ['No products found']
      };
    }

    const stats = result.processing_stats;
    const avgConfidence = result.metadata.confidence_scores.reduce((a, b) => a + b, 0) / total;
    
    const dataCompleteness = (
      (stats.products_with_prices / total) * 0.5 +
      (stats.products_with_categories / total) * 0.3 +
      (stats.high_confidence_products / total) * 0.2
    );

    const overallQuality = (avgConfidence + dataCompleteness) / 2;

    const recommendations: string[] = [];
    
    if (stats.high_confidence_products / total < 0.6) {
      recommendations.push('Consider improving data quality for better AI confidence');
    }
    
    if (stats.products_with_prices / total < 0.8) {
      recommendations.push('Many products missing price information');
    }
    
    if (stats.products_with_categories / total < 0.7) {
      recommendations.push('Consider adding category information to improve organization');
    }
    
    if (result.metadata.token_usage.total_tokens > 10000) {
      recommendations.push('High token usage - consider optimizing batch size');
    }

    return {
      overallQuality,
      dataCompleteness,
      confidenceDistribution: {
        high: stats.high_confidence_products / total,
        medium: stats.medium_confidence_products / total,
        low: stats.low_confidence_products / total
      },
      priceAvailability: stats.products_with_prices / total,
      categoryAvailability: stats.products_with_categories / total,
      recommendations
    };
  }

  /**
   * Filter products by confidence threshold
   */
  filterByConfidence(
    result: AIStructuringResult,
    minConfidence: number = 0.7
  ): ProductData[] {
    return result.products.filter(product => product.confidence >= minConfidence);
  }

  /**
   * Group products by category
   */
  groupByCategory(result: AIStructuringResult): Record<string, ProductData[]> {
    const grouped: Record<string, ProductData[]> = {};
    
    for (const product of result.products) {
      const category = product.category || 'Uncategorized';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(product);
    }
    
    return grouped;
  }

  /**
   * Get cost estimation for processing
   */
  estimateProcessingCost(
    extractedData: any,
    config?: AIStructuringConfig
  ): {
    estimatedTokens: number;
    estimatedCost: number;
    estimatedTime: number;
    recommendedBatchSize: number;
  } {
    // Rough estimation based on data size
    let estimatedRows = 0;
    
    if (extractedData.tables) {
      estimatedRows = extractedData.tables.reduce((sum: number, table: any) => 
        sum + (table.data?.length || 0), 0);
    } else if (extractedData.sheets) {
      estimatedRows = Object.values(extractedData.sheets).reduce((sum: number, sheet: any) => 
        sum + (sheet.row_count || 0), 0);
    } else if (extractedData.text_content) {
      estimatedRows = extractedData.text_content.split('\n').length;
    }

    const tokensPerRow = 150; // Average tokens per product row
    const estimatedTokens = estimatedRows * tokensPerRow;
    
    // GPT-o3 pricing (approximate)
    const costPerToken = 0.00006; // $0.06 per 1K tokens (estimated for GPT-o3)
    const estimatedCost = estimatedTokens * costPerToken;
    
    // Processing time estimation
    const estimatedTime = Math.max(10, estimatedRows * 0.5); // Minimum 10s, 0.5s per row
    
    // Recommended batch size based on data size
    const recommendedBatchSize = estimatedRows > 100 ? 5 : 10;

    return {
      estimatedTokens,
      estimatedCost,
      estimatedTime,
      recommendedBatchSize
    };
  }

  /**
   * Check if AI structuring is available
   */
  async checkAvailability(): Promise<{
    available: boolean;
    openaiConfigured: boolean;
    pythonAvailable: boolean;
    dependencies: Record<string, boolean>;
    error?: string;
  }> {
    const result = {
      available: false,
      openaiConfigured: !!process.env.OPENAI_API_KEY,
      pythonAvailable: false,
      dependencies: {
        openai: false,
        pydantic: false
      }
    };

    try {
      const testResult = await new Promise<string>((resolve, reject) => {
        const pythonProcess = spawn('python3', ['-c', `
try:
    import openai
    print("openai:true")
except ImportError:
    print("openai:false")

try:
    import pydantic
    print("pydantic:true")
except ImportError:
    print("pydantic:false")

print("python:available")
        `], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        pythonProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        pythonProcess.on('close', (code) => {
          if (code === 0) {
            resolve(output);
          } else {
            reject(new Error('Python availability check failed'));
          }
        });
      });

      // Parse results
      const lines = testResult.split('\n');
      
      result.pythonAvailable = lines.some(line => line.includes('python:available'));
      
      for (const line of lines) {
        const [pkg, available] = line.split(':');
        if (pkg && available && result.dependencies.hasOwnProperty(pkg)) {
          result.dependencies[pkg] = available === 'true';
        }
      }

      result.available = result.openaiConfigured && 
                        result.pythonAvailable && 
                        result.dependencies.openai;

    } catch (error) {
      result.error = `Availability check failed: ${error}`;
    }

    return result;
  }

  /**
   * Get optimal configuration for different document types
   */
  getOptimalConfig(documentType: 'price_list' | 'catalog' | 'invoice' | 'menu' | 'general'): AIStructuringConfig {
    const configs = {
      price_list: {
        model: 'gpt-o3',
        batchSize: 15,
        minConfidence: 0.8,
        requirePrice: true,
        requireName: true,
        temperature: 0.05 // Very deterministic for structured price lists
      },
      catalog: {
        model: 'gpt-o3',
        batchSize: 10,
        minConfidence: 0.7,
        requirePrice: false,
        requireName: true,
        temperature: 0.1 // Slightly more flexible for varied catalog formats
      },
      invoice: {
        model: 'gpt-o3',
        batchSize: 20,
        minConfidence: 0.9,
        requirePrice: true,
        requireName: true,
        temperature: 0.0 // Most deterministic for formal invoices
      },
      menu: {
        model: 'gpt-o3',
        batchSize: 8,
        minConfidence: 0.6,
        requirePrice: false, // Menus often have unclear pricing
        requireName: true,
        temperature: 0.2 // More creative for menu descriptions
      },
      general: {
        model: 'gpt-o3',
        batchSize: 10,
        minConfidence: 0.7,
        requirePrice: false,
        requireName: true,
        temperature: 0.1
      }
    };

    return configs[documentType];
  }
}

// Export singleton instance
export const aiStructuringService = new AIStructuringService();