/**
 * Batch Database Integration for TypeScript
 * Integrates Python batch database service with TypeScript application
 */

import { spawn } from 'child_process';
import path from 'path';

export interface BatchDatabaseConfig {
  databaseUrl?: string;
  defaultBatchSize?: number;
  maxConnections?: number;
  useAsync?: boolean;
}

export interface BatchOperationResult {
  success: boolean;
  inserted?: number;
  updated?: number;
  deleted?: number;
  errors?: number;
  skipped?: number;
  notFound?: number;
  batchesProcessed?: number;
  processingTimeMs: number;
  errorDetails?: string[];
  metadata?: {
    table?: string;
    batchSize?: number;
    conflictStrategy?: string;
    totalProducts?: number;
  };
}

export interface DatabaseStats {
  operations: number;
  recordsProcessed: number;
  batchesExecuted: number;
  errors: number;
  totalTimeMs: number;
  avgBatchTimeMs: number;
  databaseConnected: boolean;
  tableStatistics?: Array<{
    tablename: string;
    inserts: number;
    updates: number;
    deletes: number;
    liveRows: number;
    deadRows: number;
  }>;
  connectionPool?: {
    size: number;
    minSize: number;
    maxSize: number;
    idleConnections: number;
  };
}

export class BatchDatabaseIntegration {
  private pythonScriptPath: string;
  private config: BatchDatabaseConfig;

  constructor(config?: BatchDatabaseConfig) {
    this.pythonScriptPath = path.join(__dirname, 'batch_database_service.py');
    this.config = {
      defaultBatchSize: 1000,
      maxConnections: 20,
      useAsync: true,
      ...config
    };
  }

  /**
   * Bulk insert products into database
   */
  async bulkInsertProducts(
    products: any[],
    options: {
      tableName?: string;
      batchSize?: number;
      onConflict?: 'ignore' | 'update' | 'error';
      useAsync?: boolean;
    } = {}
  ): Promise<BatchOperationResult> {
    const {
      tableName = 'Product',
      batchSize = this.config.defaultBatchSize,
      onConflict = 'ignore',
      useAsync = this.config.useAsync
    } = options;

    console.log(`📦 Bulk inserting ${products.length} products...`);

    const command = useAsync ? 'bulk_insert_async' : 'bulk_insert_sync';
    const params = {
      products,
      table_name: tableName,
      batch_size: batchSize,
      on_conflict: onConflict
    };

    try {
      const result = await this.executePythonCommand(command, params);
      
      if (result.success) {
        console.log(`✅ Bulk insert completed: ${result.inserted} inserted, ${result.errors} errors`);
      } else {
        console.error(`❌ Bulk insert failed:`, result.errorDetails);
      }

      return result;
    } catch (error) {
      console.error(`❌ Bulk insert error:`, error);
      return {
        success: false,
        inserted: 0,
        errors: products.length,
        processingTimeMs: 0,
        errorDetails: [String(error)]
      };
    }
  }

  /**
   * Bulk update products in database
   */
  async bulkUpdateProducts(
    products: any[],
    options: {
      tableName?: string;
      updateFields?: string[];
      batchSize?: number;
    } = {}
  ): Promise<BatchOperationResult> {
    const {
      tableName = 'Product',
      updateFields = ['price', 'unit', 'category', 'confidence', 'updatedAt'],
      batchSize = this.config.defaultBatchSize
    } = options;

    console.log(`🔄 Bulk updating ${products.length} products...`);

    const params = {
      products,
      table_name: tableName,
      update_fields: updateFields,
      batch_size: batchSize
    };

    try {
      const result = await this.executePythonCommand('bulk_update', params);
      
      if (result.success) {
        console.log(`✅ Bulk update completed: ${result.updated} updated, ${result.errors} errors`);
      } else {
        console.error(`❌ Bulk update failed:`, result.errorDetails);
      }

      return result;
    } catch (error) {
      console.error(`❌ Bulk update error:`, error);
      return {
        success: false,
        updated: 0,
        errors: products.length,
        processingTimeMs: 0,
        errorDetails: [String(error)]
      };
    }
  }

  /**
   * Bulk delete products from database
   */
  async bulkDeleteProducts(
    identifiers: (number | { id?: number; name?: string; supplier?: string })[],
    options: {
      tableName?: string;
      batchSize?: number;
    } = {}
  ): Promise<BatchOperationResult> {
    const {
      tableName = 'Product',
      batchSize = this.config.defaultBatchSize
    } = options;

    console.log(`🗑️ Bulk deleting ${identifiers.length} products...`);

    const params = {
      identifiers,
      table_name: tableName,
      batch_size: batchSize
    };

    try {
      const result = await this.executePythonCommand('bulk_delete', params);
      
      if (result.success) {
        console.log(`✅ Bulk delete completed: ${result.deleted} deleted, ${result.errors} errors`);
      } else {
        console.error(`❌ Bulk delete failed:`, result.errorDetails);
      }

      return result;
    } catch (error) {
      console.error(`❌ Bulk delete error:`, error);
      return {
        success: false,
        deleted: 0,
        errors: identifiers.length,
        processingTimeMs: 0,
        errorDetails: [String(error)]
      };
    }
  }

  /**
   * Get database and service statistics
   */
  async getDatabaseStats(): Promise<DatabaseStats> {
    try {
      const result = await this.executePythonCommand('get_stats', {});
      
      if (result.success) {
        return result.data as DatabaseStats;
      } else {
        throw new Error(result.errorDetails?.[0] || 'Failed to get database stats');
      }
    } catch (error) {
      console.error(`❌ Database stats error:`, error);
      return {
        operations: 0,
        recordsProcessed: 0,
        batchesExecuted: 0,
        errors: 0,
        totalTimeMs: 0,
        avgBatchTimeMs: 0,
        databaseConnected: false
      };
    }
  }

  /**
   * Optimize database tables
   */
  async optimizeTables(tableNames?: string[]): Promise<{
    success: boolean;
    tablesOptimized: number;
    errors: number;
    optimizationDetails: Record<string, any>;
  }> {
    console.log(`🔧 Optimizing database tables...`);

    const params = tableNames ? { table_names: tableNames } : {};

    try {
      const result = await this.executePythonCommand('optimize_tables', params);
      
      if (result.success) {
        console.log(`✅ Database optimization completed: ${result.tablesOptimized} tables optimized`);
      } else {
        console.error(`❌ Database optimization failed:`, result.errorDetails);
      }

      return result;
    } catch (error) {
      console.error(`❌ Database optimization error:`, error);
      return {
        success: false,
        tablesOptimized: 0,
        errors: 1,
        optimizationDetails: {}
      };
    }
  }

  /**
   * Process products from extracted data with batching
   */
  async processExtractedProducts(
    extractedData: {
      products: any[];
      sourceFile?: string;
      uploadId?: string;
    },
    options: {
      batchSize?: number;
      onConflict?: 'ignore' | 'update' | 'error';
      validateProducts?: boolean;
      cleanupExisting?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    totalProducts: number;
    inserted: number;
    updated: number;
    errors: number;
    validationErrors: string[];
    processingTimeMs: number;
  }> {
    const {
      batchSize = this.config.defaultBatchSize,
      onConflict = 'update', // Default to update for extracted data
      validateProducts = true,
      cleanupExisting = false
    } = options;

    const startTime = Date.now();
    const result = {
      success: false,
      totalProducts: extractedData.products.length,
      inserted: 0,
      updated: 0,
      errors: 0,
      validationErrors: [] as string[],
      processingTimeMs: 0
    };

    try {
      console.log(`🔄 Processing ${result.totalProducts} extracted products...`);

      // Step 1: Validate products if requested
      let validProducts = extractedData.products;
      if (validateProducts) {
        const validation = this.validateProducts(extractedData.products);
        validProducts = validation.validProducts;
        result.validationErrors = validation.errors;
        
        if (validation.errors.length > 0) {
          console.log(`⚠️ Validation found ${validation.errors.length} issues`);
        }
      }

      // Step 2: Cleanup existing products if requested
      if (cleanupExisting && extractedData.sourceFile) {
        console.log(`🧹 Cleaning up existing products from ${extractedData.sourceFile}...`);
        
        const deleteResult = await this.bulkDeleteProducts([
          { sourceFile: extractedData.sourceFile }
        ]);
        
        if (deleteResult.success) {
          console.log(`✅ Cleaned up ${deleteResult.deleted} existing products`);
        }
      }

      // Step 3: Enhance products with metadata
      const enhancedProducts = validProducts.map(product => ({
        ...product,
        sourceFile: extractedData.sourceFile || '',
        uploadId: extractedData.uploadId || null,
        extractedAt: new Date().toISOString(),
        confidence: product.confidence || 0.8
      }));

      // Step 4: Bulk insert/update products
      const batchResult = await this.bulkInsertProducts(enhancedProducts, {
        batchSize,
        onConflict
      });

      result.inserted = batchResult.inserted || 0;
      result.updated = batchResult.updated || 0;
      result.errors = batchResult.errors || 0;
      result.success = batchResult.success;

      console.log(`✅ Product processing completed: ${result.inserted} inserted, ${result.updated} updated, ${result.errors} errors`);

    } catch (error) {
      console.error(`❌ Product processing failed:`, error);
      result.success = false;
      result.errors = result.totalProducts;
    } finally {
      result.processingTimeMs = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Validate products before database operations
   */
  private validateProducts(products: any[]): {
    validProducts: any[];
    errors: string[];
  } {
    const validProducts: any[] = [];
    const errors: string[] = [];

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const productErrors: string[] = [];

      // Required fields
      if (!product.name || typeof product.name !== 'string' || product.name.trim().length === 0) {
        productErrors.push('Missing or invalid product name');
      }

      // Price validation
      if (product.price !== undefined && product.price !== null) {
        const price = Number(product.price);
        if (isNaN(price) || price < 0) {
          productErrors.push('Invalid price value');
        }
      }

      // Unit validation
      if (product.unit && typeof product.unit !== 'string') {
        productErrors.push('Invalid unit type');
      }

      // Confidence validation
      if (product.confidence !== undefined) {
        const confidence = Number(product.confidence);
        if (isNaN(confidence) || confidence < 0 || confidence > 1) {
          productErrors.push('Invalid confidence value (must be 0-1)');
        }
      }

      if (productErrors.length > 0) {
        errors.push(`Product ${i + 1}: ${productErrors.join(', ')}`);
      } else {
        validProducts.push(product);
      }
    }

    return { validProducts, errors };
  }

  /**
   * Execute Python batch database command
   */
  private async executePythonCommand(command: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        DATABASE_URL: this.config.databaseUrl,
        BATCH_SIZE: this.config.defaultBatchSize?.toString(),
        MAX_DB_CONNECTIONS: this.config.maxConnections?.toString()
      };

      const commandData = {
        command,
        params
      };

      const pythonProcess = spawn('python3', [this.pythonScriptPath, 'api', JSON.stringify(commandData)], {
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
        if (code === 0) {
          try {
            // Look for JSON response in stdout
            const lines = stdout.split('\n');
            const jsonLine = lines.find(line => line.startsWith('BATCH_DB_RESULT:'));
            
            if (jsonLine) {
              const jsonStr = jsonLine.replace('BATCH_DB_RESULT:', '');
              const result = JSON.parse(jsonStr);
              resolve(result);
            } else {
              resolve({ success: false, error: 'No API result found' });
            }
          } catch (error) {
            reject(new Error(`Failed to parse batch DB result: ${error}`));
          }
        } else {
          const errorMessage = stderr || 'Unknown error';
          reject(new Error(`Batch DB command failed (code ${code}): ${errorMessage}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python batch DB process: ${error.message}`));
      });

      // Set timeout
      const timeout = setTimeout(() => {
        pythonProcess.kill('SIGTERM');
        reject(new Error('Batch DB operation timeout after 5 minutes'));
      }, 300000); // 5 minutes

      pythonProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Create batch processing middleware for database operations
   */
  createBatchMiddleware() {
    return {
      /**
       * Wrap database operations with batching
       */
      batchProcessor: <T>(
        operation: 'insert' | 'update' | 'delete',
        options: {
          batchSize?: number;
          tableName?: string;
          onConflict?: 'ignore' | 'update' | 'error';
        } = {}
      ) => {
        return async (data: T[]): Promise<BatchOperationResult> => {
          const {
            batchSize = this.config.defaultBatchSize,
            tableName = 'Product',
            onConflict = 'ignore'
          } = options;

          switch (operation) {
            case 'insert':
              return this.bulkInsertProducts(data as any[], {
                tableName,
                batchSize,
                onConflict
              });
            
            case 'update':
              return this.bulkUpdateProducts(data as any[], {
                tableName,
                batchSize
              });
            
            case 'delete':
              return this.bulkDeleteProducts(data as any[], {
                tableName,
                batchSize
              });
            
            default:
              throw new Error(`Unsupported batch operation: ${operation}`);
          }
        };
      }
    };
  }

  /**
   * Monitor database performance
   */
  async monitorPerformance(intervalMs: number = 30000): Promise<void> {
    console.log(`📊 Starting database performance monitoring (interval: ${intervalMs}ms)`);

    setInterval(async () => {
      try {
        const stats = await this.getDatabaseStats();
        
        console.log(`📊 DB Stats: ${stats.recordsProcessed} records, ${stats.batchesExecuted} batches, ${stats.avgBatchTimeMs.toFixed(2)}ms avg`);
        
        if (stats.connectionPool) {
          const { size, idleConnections } = stats.connectionPool;
          console.log(`🔗 Pool: ${size} total, ${idleConnections} idle`);
        }
        
      } catch (error) {
        console.error(`❌ Performance monitoring error:`, error);
      }
    }, intervalMs);
  }
}

// Export singleton instance
export const batchDatabaseIntegration = new BatchDatabaseIntegration();