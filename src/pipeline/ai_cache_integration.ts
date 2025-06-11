/**
 * AI Cache Integration for TypeScript
 * Integrates Python AI cache service with TypeScript pipeline
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

export interface CacheConfig {
  redisHost?: string;
  redisPort?: number;
  redisDb?: number;
  redisPassword?: string;
  defaultTtl?: number;
  compressionEnabled?: boolean;
  enabled?: boolean;
}

export interface CacheStats {
  enabled: boolean;
  redisConnected: boolean;
  hits: number;
  misses: number;
  hitRatePercent: number;
  totalKeys: number;
  memoryUsedHuman: string;
  keyCountsByType: Record<string, number>;
}

export interface CacheResult<T = any> {
  data: T | null;
  cached: boolean;
  stats?: {
    hit: boolean;
    keyGenerated: string;
    operationTimeMs: number;
  };
}

export class AICacheIntegration {
  private pythonScriptPath: string;
  private config: CacheConfig;
  private defaultConfig: CacheConfig;

  constructor(config?: CacheConfig) {
    this.pythonScriptPath = path.join(__dirname, 'ai_cache_service.py');
    this.defaultConfig = {
      redisHost: 'localhost',
      redisPort: 6379,
      redisDb: 0,
      defaultTtl: 86400, // 24 hours
      compressionEnabled: true,
      enabled: true
    };
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Generate deterministic cache key for consistent lookups
   */
  private generateCacheKey(inputData: any, additionalParams: Record<string, any> = {}): string {
    const dataStr = JSON.stringify(inputData, Object.keys(inputData).sort());
    const paramsStr = JSON.stringify(additionalParams, Object.keys(additionalParams).sort());
    const combined = `${dataStr}:${paramsStr}`;
    
    return crypto
      .createHash('sha256')
      .update(combined)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Get cached AI response if available
   */
  async getCachedAIResponse(
    inputData: any,
    model: string = 'gpt-o3',
    apiParams: Record<string, any> = {}
  ): Promise<CacheResult> {
    if (!this.config.enabled) {
      return { data: null, cached: false };
    }

    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(inputData, { model, ...apiParams });

    try {
      const result = await this.executePythonCommand('get_ai_response', {
        input_data: inputData,
        model,
        api_params: apiParams
      });

      const operationTime = Date.now() - startTime;

      if (result.success && result.data) {
        console.log(`🎯 Cache HIT: AI response (${operationTime}ms)`);
        return {
          data: result.data,
          cached: true,
          stats: {
            hit: true,
            keyGenerated: cacheKey,
            operationTimeMs: operationTime
          }
        };
      } else {
        console.log(`💨 Cache MISS: AI response (${operationTime}ms)`);
        return {
          data: null,
          cached: false,
          stats: {
            hit: false,
            keyGenerated: cacheKey,
            operationTimeMs: operationTime
          }
        };
      }
    } catch (error) {
      console.error(`❌ Cache get error:`, error);
      return { data: null, cached: false };
    }
  }

  /**
   * Cache AI response for future use
   */
  async cacheAIResponse(
    inputData: any,
    response: any,
    model: string = 'gpt-o3',
    ttl?: number,
    apiParams: Record<string, any> = {}
  ): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const result = await this.executePythonCommand('cache_ai_response', {
        input_data: inputData,
        response,
        model,
        ttl: ttl || this.config.defaultTtl,
        api_params: apiParams
      });

      if (result.success) {
        console.log(`💾 Cache SET: AI response cached`);
        return true;
      } else {
        console.error(`❌ Cache set failed:`, result.error);
        return false;
      }
    } catch (error) {
      console.error(`❌ Cache set error:`, error);
      return false;
    }
  }

  /**
   * Get cached embedding vector
   */
  async getCachedEmbedding(
    text: string,
    model: string = 'text-embedding-ada-002'
  ): Promise<CacheResult<number[]>> {
    if (!this.config.enabled) {
      return { data: null, cached: false };
    }

    try {
      const result = await this.executePythonCommand('get_embedding', {
        text,
        model
      });

      if (result.success && result.data) {
        console.log(`🎯 Cache HIT: Embedding for text (${text.length} chars)`);
        return { data: result.data, cached: true };
      } else {
        return { data: null, cached: false };
      }
    } catch (error) {
      console.error(`❌ Embedding cache get error:`, error);
      return { data: null, cached: false };
    }
  }

  /**
   * Cache embedding vector
   */
  async cacheEmbedding(
    text: string,
    embedding: number[],
    model: string = 'text-embedding-ada-002',
    ttl?: number
  ): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const result = await this.executePythonCommand('cache_embedding', {
        text,
        embedding,
        model,
        ttl: ttl || (this.config.defaultTtl! * 7) // Embeddings last longer
      });

      if (result.success) {
        console.log(`💾 Cache SET: Embedding cached (${embedding.length} dims)`);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error(`❌ Embedding cache set error:`, error);
      return false;
    }
  }

  /**
   * Get cached processed data (table extraction, etc.)
   */
  async getCachedProcessedData(
    fileHash: string,
    processingConfig: Record<string, any>
  ): Promise<CacheResult> {
    if (!this.config.enabled) {
      return { data: null, cached: false };
    }

    try {
      const result = await this.executePythonCommand('get_processed_data', {
        file_hash: fileHash,
        processing_config: processingConfig
      });

      if (result.success && result.data) {
        console.log(`🎯 Cache HIT: Processed data for ${fileHash.substring(0, 8)}...`);
        return { data: result.data, cached: true };
      } else {
        return { data: null, cached: false };
      }
    } catch (error) {
      console.error(`❌ Processed data cache get error:`, error);
      return { data: null, cached: false };
    }
  }

  /**
   * Cache processed data results
   */
  async cacheProcessedData(
    fileHash: string,
    processingConfig: Record<string, any>,
    processedData: any,
    ttl?: number
  ): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const result = await this.executePythonCommand('cache_processed_data', {
        file_hash: fileHash,
        processing_config: processingConfig,
        processed_data: processedData,
        ttl: ttl || (this.config.defaultTtl! * 3) // Processed data lasts longer
      });

      if (result.success) {
        console.log(`💾 Cache SET: Processed data cached for ${fileHash.substring(0, 8)}...`);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error(`❌ Processed data cache set error:`, error);
      return false;
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    try {
      const result = await this.executePythonCommand('get_cache_stats', {});

      if (result.success && result.data) {
        return {
          enabled: result.data.enabled || false,
          redisConnected: result.data.redis_connected || false,
          hits: result.data.hits || 0,
          misses: result.data.misses || 0,
          hitRatePercent: result.data.hit_rate_percent || 0,
          totalKeys: result.data.total_keys || 0,
          memoryUsedHuman: result.data.memory_used_human || '0B',
          keyCountsByType: result.data.key_counts_by_type || {}
        };
      } else {
        return {
          enabled: false,
          redisConnected: false,
          hits: 0,
          misses: 0,
          hitRatePercent: 0,
          totalKeys: 0,
          memoryUsedHuman: '0B',
          keyCountsByType: {}
        };
      }
    } catch (error) {
      console.error(`❌ Cache stats error:`, error);
      return {
        enabled: false,
        redisConnected: false,
        hits: 0,
        misses: 0,
        hitRatePercent: 0,
        totalKeys: 0,
        memoryUsedHuman: '0B',
        keyCountsByType: {}
      };
    }
  }

  /**
   * Invalidate cache entries by type or pattern
   */
  async invalidateCache(dataType?: string): Promise<number> {
    if (!this.config.enabled) {
      return 0;
    }

    try {
      const result = await this.executePythonCommand('invalidate_cache', {
        data_type: dataType
      });

      if (result.success) {
        const deleted = result.data?.deleted || 0;
        console.log(`🗑️ Cache invalidated: ${deleted} entries`);
        return deleted;
      } else {
        return 0;
      }
    } catch (error) {
      console.error(`❌ Cache invalidation error:`, error);
      return 0;
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupCache(): Promise<{ deleted: number; checked: number }> {
    if (!this.config.enabled) {
      return { deleted: 0, checked: 0 };
    }

    try {
      const result = await this.executePythonCommand('cleanup_expired', {});

      if (result.success) {
        const deleted = result.data?.deleted || 0;
        const checked = result.data?.checked || 0;
        console.log(`🧹 Cache cleanup: ${deleted} expired, ${checked} checked`);
        return { deleted, checked };
      } else {
        return { deleted: 0, checked: 0 };
      }
    } catch (error) {
      console.error(`❌ Cache cleanup error:`, error);
      return { deleted: 0, checked: 0 };
    }
  }

  /**
   * Execute Python cache command
   */
  private async executePythonCommand(command: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        REDIS_HOST: this.config.redisHost,
        REDIS_PORT: this.config.redisPort?.toString(),
        REDIS_DB: this.config.redisDb?.toString(),
        REDIS_PASSWORD: this.config.redisPassword,
        CACHE_TTL: this.config.defaultTtl?.toString(),
        CACHE_COMPRESSION: this.config.compressionEnabled ? 'true' : 'false'
      };

      // Create command data
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
            const jsonLine = lines.find(line => line.startsWith('CACHE_API_RESULT:'));
            
            if (jsonLine) {
              const jsonStr = jsonLine.replace('CACHE_API_RESULT:', '');
              const result = JSON.parse(jsonStr);
              resolve(result);
            } else {
              resolve({ success: false, error: 'No API result found' });
            }
          } catch (error) {
            reject(new Error(`Failed to parse cache API result: ${error}`));
          }
        } else {
          const errorMessage = stderr || 'Unknown error';
          reject(new Error(`Cache command failed (code ${code}): ${errorMessage}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python cache process: ${error.message}`));
      });

      // Set timeout
      const timeout = setTimeout(() => {
        pythonProcess.kill('SIGTERM');
        reject(new Error('Cache operation timeout after 10s'));
      }, 10000);

      pythonProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Test cache connectivity and basic operations
   */
  async testCache(): Promise<{
    connected: boolean;
    setTest: boolean;
    getTest: boolean;
    stats: CacheStats;
  }> {
    console.log('🧪 Testing cache operations...');

    const testData = { test: 'data', timestamp: Date.now() };
    const testResponse = { result: 'success', cached: true };

    try {
      // Test set operation
      const setResult = await this.cacheAIResponse(testData, testResponse, 'test-model');
      
      // Test get operation
      const getResult = await this.getCachedAIResponse(testData, 'test-model');
      
      // Get final stats
      const stats = await this.getCacheStats();

      const result = {
        connected: stats.redisConnected,
        setTest: setResult,
        getTest: getResult.cached,
        stats
      };

      console.log('✅ Cache test completed:', result);
      return result;

    } catch (error) {
      console.error('❌ Cache test failed:', error);
      return {
        connected: false,
        setTest: false,
        getTest: false,
        stats: await this.getCacheStats()
      };
    }
  }

  /**
   * Create cache integration middleware for AI requests
   */
  createCacheMiddleware() {
    return {
      /**
       * Wrap AI function with caching
       */
      wrapAIFunction: <T>(
        fn: (input: any, ...args: any[]) => Promise<T>,
        options: {
          cacheKey?: (input: any, ...args: any[]) => string;
          ttl?: number;
          model?: string;
        } = {}
      ) => {
        return async (input: any, ...args: any[]): Promise<T> => {
          const model = options.model || 'gpt-4o';
          const apiParams = args.length > 0 ? { args } : {};

          // Try to get from cache first
          const cached = await this.getCachedAIResponse(input, model, apiParams);
          if (cached.cached && cached.data) {
            return cached.data;
          }

          // Execute original function
          const result = await fn(input, ...args);

          // Cache the result
          await this.cacheAIResponse(input, result, model, options.ttl, apiParams);

          return result;
        };
      }
    };
  }
}

// Export singleton instance
export const aiCacheIntegration = new AICacheIntegration();