/**
 * Price Parsing Service
 * TypeScript wrapper for Python composite price parser
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export enum PriceType {
  SINGLE = 'single',
  RANGE = 'range',
  BULK = 'bulk',
  TIERED = 'tiered',
  CONDITIONAL = 'conditional',
  FRACTION = 'fraction',
  UNIT_PRICE = 'unit_price',
  DISCOUNT = 'discount',
  UNKNOWN = 'unknown'
}

export interface ParsedPrice {
  price_type: PriceType;
  primary_price?: number;
  secondary_price?: number;
  min_price?: number;
  max_price?: number;
  currency: string;
  unit?: string;
  quantity?: number;
  quantity_unit?: string;
  discount_percent?: number;
  validity_period?: string;
  conditions: string[];
  confidence: number;
  original_text: string;
}

export interface PriceParsingResult {
  parsed_price: ParsedPrice | null;
  metadata: {
    original_text: string;
    parsing_time_ms: number;
    patterns_tried: string[];
    confidence_factors: Record<string, any>;
    currency_detected: string;
  };
  success: boolean;
  error?: string;
}

export interface PriceBatchResult {
  results: PriceParsingResult[];
  metadata: {
    total_prices: number;
    successful_parses: number;
    success_rate: number;
    processing_time_ms: number;
  };
  success: boolean;
}

export interface PriceParsingConfig {
  defaultCurrency?: string;
  validatePrices?: boolean;
  minPrice?: number;
  maxPrice?: number;
  decimalPlaces?: number;
  useFuzzyMatching?: boolean;
  strictValidation?: boolean;
}

export class PriceParsingService {
  private pythonScriptPath: string;
  private defaultConfig: PriceParsingConfig;

  constructor(config?: PriceParsingConfig) {
    this.pythonScriptPath = path.join(__dirname, 'price_parser.py');
    this.defaultConfig = {
      defaultCurrency: 'IDR',
      validatePrices: true,
      minPrice: 1.0,
      maxPrice: 1000000000.0,
      decimalPlaces: 2,
      useFuzzyMatching: true,
      strictValidation: false,
      ...config
    };
  }

  /**
   * Parse a single price text
   */
  async parsePrice(
    priceText: string,
    config?: PriceParsingConfig
  ): Promise<PriceParsingResult> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    
    console.log(`💰 Parsing price: "${priceText}"`);
    
    if (!priceText || typeof priceText !== 'string') {
      throw new Error('Invalid price text provided');
    }

    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        DEFAULT_CURRENCY: mergedConfig.defaultCurrency,
        VALIDATE_PRICES: mergedConfig.validatePrices ? 'true' : 'false',
        MIN_PRICE: mergedConfig.minPrice?.toString(),
        MAX_PRICE: mergedConfig.maxPrice?.toString()
      };

      const pythonProcess = spawn('python3', [this.pythonScriptPath, priceText], {
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

      pythonProcess.on('close', (code) => {
        // Log processing info
        if (stderr) {
          console.log('💰 Price Parsing Log:', stderr.split('\n').filter(line => 
            line.includes('[INFO]') || line.includes('[SUMMARY]')
          ).join('\n'));
        }

        if (code === 0) {
          try {
            // Parse JSON output from Python script
            const lines = stdout.split('\n');
            const jsonLine = lines.find(line => line.startsWith('PRICE_PARSING_RESULT:'));
            
            if (!jsonLine) {
              reject(new Error('No price parsing result found in output'));
              return;
            }

            const jsonStr = jsonLine.replace('PRICE_PARSING_RESULT:', '');
            const result = JSON.parse(jsonStr) as PriceParsingResult;
            
            if (result.success && result.parsed_price) {
              console.log(`✅ Price parsed: ${result.parsed_price.price_type}, ` +
                         `${result.parsed_price.primary_price} ${result.parsed_price.currency}, ` +
                         `confidence: ${result.parsed_price.confidence.toFixed(2)}`);
            } else {
              console.log(`❌ Price parsing failed: ${result.error}`);
            }
            
            resolve(result);
            
          } catch (error) {
            reject(new Error(`Failed to parse price parsing result: ${error}`));
          }
        } else {
          const errorMessage = stderr || 'Unknown error';
          reject(new Error(`Price parsing failed (code ${code}): ${errorMessage}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });

      // Set timeout for the process
      const timeout = setTimeout(() => {
        pythonProcess.kill('SIGTERM');
        reject(new Error('Price parsing timeout after 30s'));
      }, 30000);

      pythonProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Parse multiple prices in batch
   */
  async parsePriceBatch(
    priceTexts: string[],
    config?: PriceParsingConfig
  ): Promise<PriceBatchResult> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    
    console.log(`💰 Batch parsing ${priceTexts.length} prices`);
    
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        DEFAULT_CURRENCY: mergedConfig.defaultCurrency,
        VALIDATE_PRICES: mergedConfig.validatePrices ? 'true' : 'false',
        MIN_PRICE: mergedConfig.minPrice?.toString(),
        MAX_PRICE: mergedConfig.maxPrice?.toString()
      };

      // Create temporary file for batch input
      const tempInputFile = path.join(process.cwd(), 'temp', `price_batch_${Date.now()}.json`);
      
      fs.mkdir(path.dirname(tempInputFile), { recursive: true })
        .then(() => fs.writeFile(tempInputFile, JSON.stringify(priceTexts)))
        .then(() => {
          const pythonProcess = spawn('python3', [this.pythonScriptPath, '--batch', tempInputFile], {
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

            if (code === 0) {
              try {
                const lines = stdout.split('\n');
                const jsonLine = lines.find(line => line.startsWith('PRICE_PARSING_RESULT:'));
                
                if (!jsonLine) {
                  reject(new Error('No batch parsing result found'));
                  return;
                }

                const jsonStr = jsonLine.replace('PRICE_PARSING_RESULT:', '');
                const result = JSON.parse(jsonStr) as PriceBatchResult;
                
                console.log(`✅ Batch parsing completed: ${result.metadata.successful_parses}/${result.metadata.total_prices} successful, ` +
                           `${(result.metadata.success_rate * 100).toFixed(1)}% success rate`);
                
                resolve(result);
                
              } catch (error) {
                reject(new Error(`Failed to parse batch result: ${error}`));
              }
            } else {
              reject(new Error(`Batch parsing failed: ${stderr}`));
            }
          });
        })
        .catch(reject);
    });
  }

  /**
   * Parse prices from structured products
   */
  async parsePricesFromProducts(
    products: Array<{ price_text?: string; price?: any; [key: string]: any }>,
    config?: PriceParsingConfig
  ): Promise<Array<{ product: any; parsed_price: PriceParsingResult }>> {
    console.log(`💰 Parsing prices from ${products.length} products`);
    
    const results: Array<{ product: any; parsed_price: PriceParsingResult }> = [];
    
    for (const product of products) {
      try {
        let priceText = product.price_text;
        
        // Fallback to price field if price_text is not available
        if (!priceText && product.price) {
          priceText = String(product.price);
        }
        
        if (priceText) {
          const parseResult = await this.parsePrice(priceText, config);
          results.push({
            product,
            parsed_price: parseResult
          });
        } else {
          // Create empty result for products without price information
          results.push({
            product,
            parsed_price: {
              parsed_price: null,
              metadata: {
                original_text: '',
                parsing_time_ms: 0,
                patterns_tried: [],
                confidence_factors: {},
                currency_detected: config?.defaultCurrency || 'IDR'
              },
              success: false,
              error: 'No price text available'
            }
          });
        }
      } catch (error) {
        console.error(`❌ Failed to parse price for product: ${error}`);
        results.push({
          product,
          parsed_price: {
            parsed_price: null,
            metadata: {
              original_text: product.price_text || '',
              parsing_time_ms: 0,
              patterns_tried: [],
              confidence_factors: {},
              currency_detected: config?.defaultCurrency || 'IDR'
            },
            success: false,
            error: `Parsing error: ${error}`
          }
        });
      }
    }
    
    return results;
  }

  /**
   * Get price statistics from parsing results
   */
  getPriceStatistics(results: PriceParsingResult[]): {
    totalPrices: number;
    successfulParses: number;
    successRate: number;
    priceTypeDistribution: Record<string, number>;
    currencyDistribution: Record<string, number>;
    averageConfidence: number;
    priceRanges: {
      min: number;
      max: number;
      average: number;
      median: number;
    };
  } {
    const successful = results.filter(r => r.success && r.parsed_price);
    const priceTypes: Record<string, number> = {};
    const currencies: Record<string, number> = {};
    const prices: number[] = [];
    let totalConfidence = 0;

    for (const result of successful) {
      if (result.parsed_price) {
        const price = result.parsed_price;
        
        // Count price types
        priceTypes[price.price_type] = (priceTypes[price.price_type] || 0) + 1;
        
        // Count currencies
        currencies[price.currency] = (currencies[price.currency] || 0) + 1;
        
        // Collect prices for statistics
        if (price.primary_price) {
          prices.push(price.primary_price);
        }
        
        totalConfidence += price.confidence;
      }
    }

    // Calculate price statistics
    const sortedPrices = prices.sort((a, b) => a - b);
    const priceRanges = {
      min: sortedPrices[0] || 0,
      max: sortedPrices[sortedPrices.length - 1] || 0,
      average: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
      median: sortedPrices.length > 0 ? 
        sortedPrices.length % 2 === 0 ? 
          (sortedPrices[sortedPrices.length / 2 - 1] + sortedPrices[sortedPrices.length / 2]) / 2 :
          sortedPrices[Math.floor(sortedPrices.length / 2)] : 0
    };

    return {
      totalPrices: results.length,
      successfulParses: successful.length,
      successRate: results.length > 0 ? successful.length / results.length : 0,
      priceTypeDistribution: priceTypes,
      currencyDistribution: currencies,
      averageConfidence: successful.length > 0 ? totalConfidence / successful.length : 0,
      priceRanges
    };
  }

  /**
   * Validate price range
   */
  validatePriceRange(
    parsedPrice: ParsedPrice,
    expectedMin?: number,
    expectedMax?: number
  ): {
    valid: boolean;
    warnings: string[];
    adjustedPrice?: ParsedPrice;
  } {
    const warnings: string[] = [];
    let valid = true;

    // Check price values
    const prices = [
      parsedPrice.primary_price,
      parsedPrice.secondary_price,
      parsedPrice.min_price,
      parsedPrice.max_price
    ].filter(p => p !== undefined && p !== null) as number[];

    if (expectedMin !== undefined) {
      const belowMin = prices.filter(p => p < expectedMin);
      if (belowMin.length > 0) {
        warnings.push(`${belowMin.length} price(s) below expected minimum ${expectedMin}`);
        if (belowMin.length === prices.length) {
          valid = false;
        }
      }
    }

    if (expectedMax !== undefined) {
      const aboveMax = prices.filter(p => p > expectedMax);
      if (aboveMax.length > 0) {
        warnings.push(`${aboveMax.length} price(s) above expected maximum ${expectedMax}`);
        if (aboveMax.length === prices.length) {
          valid = false;
        }
      }
    }

    // Check internal consistency
    if (parsedPrice.min_price && parsedPrice.max_price) {
      if (parsedPrice.min_price > parsedPrice.max_price) {
        warnings.push('Min price is greater than max price');
        valid = false;
      }
    }

    return {
      valid,
      warnings,
      adjustedPrice: valid ? undefined : parsedPrice // Could implement price adjustment logic
    };
  }

  /**
   * Convert parsed price to standard format
   */
  toStandardPrice(parsedPrice: ParsedPrice): {
    price: number;
    currency: string;
    unit?: string;
    priceType: string;
    confidence: number;
    metadata: Record<string, any>;
  } {
    // Determine the main price to use
    let price = parsedPrice.primary_price || 0;
    
    // For ranges, use average
    if (parsedPrice.price_type === PriceType.RANGE && parsedPrice.min_price && parsedPrice.max_price) {
      price = (parsedPrice.min_price + parsedPrice.max_price) / 2;
    }

    return {
      price,
      currency: parsedPrice.currency,
      unit: parsedPrice.unit,
      priceType: parsedPrice.price_type,
      confidence: parsedPrice.confidence,
      metadata: {
        original_text: parsedPrice.original_text,
        secondary_price: parsedPrice.secondary_price,
        min_price: parsedPrice.min_price,
        max_price: parsedPrice.max_price,
        quantity: parsedPrice.quantity,
        quantity_unit: parsedPrice.quantity_unit,
        discount_percent: parsedPrice.discount_percent,
        conditions: parsedPrice.conditions
      }
    };
  }

  /**
   * Get optimal configuration for different document types
   */
  getOptimalConfig(documentType: 'price_list' | 'catalog' | 'invoice' | 'menu' | 'wholesale'): PriceParsingConfig {
    const configs = {
      price_list: {
        defaultCurrency: 'IDR',
        validatePrices: true,
        minPrice: 100,
        maxPrice: 100000000,
        strictValidation: true
      },
      catalog: {
        defaultCurrency: 'IDR',
        validatePrices: true,
        minPrice: 500,
        maxPrice: 50000000,
        strictValidation: false
      },
      invoice: {
        defaultCurrency: 'IDR',
        validatePrices: true,
        minPrice: 1,
        maxPrice: 1000000000,
        strictValidation: true
      },
      menu: {
        defaultCurrency: 'IDR',
        validatePrices: false, // Menu prices can be very varied
        minPrice: 1000,
        maxPrice: 1000000,
        strictValidation: false
      },
      wholesale: {
        defaultCurrency: 'IDR',
        validatePrices: true,
        minPrice: 1000,
        maxPrice: 500000000,
        strictValidation: false,
        useFuzzyMatching: true
      }
    };

    return configs[documentType];
  }
}

// Export singleton instance
export const priceParsingService = new PriceParsingService();