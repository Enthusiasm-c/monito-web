/**
 * Logging Integration for TypeScript
 * Integrates Python logging service with TypeScript application
 */

import { spawn } from 'child_process';
import path from 'path';

export interface LoggingConfig {
  logLevel?: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  environment?: 'development' | 'staging' | 'production';
  serviceName?: string;
  enableJsonLogs?: boolean;
  logDir?: string;
  enableMetrics?: boolean;
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  operation?: string;
  [key: string]: any;
}

export interface MetricsSummary {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  errors: Record<string, number>;
  timers: Record<string, {
    count: number;
    minMs: number;
    maxMs: number;
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  }>;
  system: {
    cpuPercent?: number;
    memoryPercent?: number;
    diskPercent?: number;
    loadAvg?: number[];
  };
  timestamp: string;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'warning';
  checks: Record<string, string | object>;
  timestamp: string;
}

export class LoggingIntegration {
  private pythonScriptPath: string;
  private config: LoggingConfig;
  private requestContextStack: LogContext[] = [];

  constructor(config?: LoggingConfig) {
    this.pythonScriptPath = path.join(__dirname, 'logging_service.py');
    this.config = {
      logLevel: 'INFO',
      environment: 'development',
      serviceName: 'monito-web',
      enableJsonLogs: false,
      logDir: 'logs',
      enableMetrics: true,
      ...config
    };
  }

  /**
   * Initialize logging service
   */
  async initialize(): Promise<void> {
    console.log(`🔧 Initializing logging service...`);
    
    try {
      const health = await this.getHealthCheck();
      if (health.status === 'healthy') {
        console.log(`✅ Logging service initialized successfully`);
      } else {
        console.warn(`⚠️ Logging service initialized with warnings:`, health.checks);
      }
    } catch (error) {
      console.error(`❌ Failed to initialize logging service:`, error);
      throw error;
    }
  }

  /**
   * Create request context for logging
   */
  createRequestContext(context: LogContext): () => void {
    this.requestContextStack.push(context);
    
    return () => {
      const index = this.requestContextStack.indexOf(context);
      if (index > -1) {
        this.requestContextStack.splice(index, 1);
      }
    };
  }

  /**
   * Log structured message
   */
  async log(level: 'debug' | 'info' | 'warning' | 'error', message: string, data?: Record<string, any>): Promise<void> {
    const logData = {
      level: level.toUpperCase(),
      message,
      timestamp: new Date().toISOString(),
      service: this.config.serviceName,
      ...this.getCurrentContext(),
      ...data
    };

    if (this.config.enableJsonLogs) {
      console.log(JSON.stringify(logData));
    } else {
      const contextStr = Object.keys(logData).length > 4 
        ? ` ${JSON.stringify(logData)}`
        : '';
      console.log(`[${logData.level}] ${logData.service}: ${message}${contextStr}`);
    }

    // Also send to Python logging service if needed for centralized logging
    if (level === 'error' || this.config.logLevel === 'DEBUG') {
      try {
        await this.sendToPythonLogger(level, message, logData);
      } catch (error) {
        // Don't fail on logging errors
        console.warn('Failed to send to Python logger:', error);
      }
    }
  }

  /**
   * Log debug message
   */
  async debug(message: string, data?: Record<string, any>): Promise<void> {
    await this.log('debug', message, data);
  }

  /**
   * Log info message
   */
  async info(message: string, data?: Record<string, any>): Promise<void> {
    await this.log('info', message, data);
  }

  /**
   * Log warning message
   */
  async warning(message: string, data?: Record<string, any>): Promise<void> {
    await this.log('warning', message, data);
  }

  /**
   * Log error message
   */
  async error(message: string, error?: Error, data?: Record<string, any>): Promise<void> {
    const errorData = {
      ...data,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };

    await this.log('error', message, errorData);
  }

  /**
   * Log file processing event
   */
  async logFileProcessing(
    filename: string,
    fileSize: number,
    processingTimeMs: number,
    productsExtracted: number,
    success: boolean,
    additionalData?: Record<string, any>
  ): Promise<void> {
    const data = {
      filename,
      fileSizeBytes: fileSize,
      processingTimeMs,
      productsExtracted,
      success,
      extractionRateProductsPerSec: success ? productsExtracted / (processingTimeMs / 1000) : 0,
      ...additionalData
    };

    if (success) {
      await this.info('File processing completed', data);
    } else {
      await this.error('File processing failed', undefined, data);
    }

    // Record metrics
    await this.incrementCounter('files_processed', { success: success.toString() });
    await this.recordTimer('file_processing_duration', processingTimeMs);
    await this.setGauge('last_file_products_extracted', productsExtracted);
    await this.setGauge('last_file_size_bytes', fileSize);
  }

  /**
   * Log pipeline event
   */
  async logPipelineEvent(eventType: string, data?: Record<string, any>): Promise<void> {
    await this.info('Pipeline event', { eventType, ...data });
    await this.incrementCounter('pipeline_events', { eventType });
  }

  /**
   * Create timing decorator for functions
   */
  timing(operation: string) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const startTime = Date.now();
        const context = {
          operation,
          function: propertyKey,
          argsCount: args.length
        };

        try {
          await this.debug?.('Function started', context) || 
                console.debug('Function started:', context);

          const result = await originalMethod.apply(this, args);
          
          const durationMs = Date.now() - startTime;
          await this.debug?.('Function completed', { ...context, durationMs }) ||
                console.debug('Function completed:', { ...context, durationMs });

          // Record timing metric
          if (this.recordTimer) {
            await this.recordTimer('function_duration', durationMs, {
              function: propertyKey,
              operation
            });
          }

          return result;
        } catch (error) {
          const durationMs = Date.now() - startTime;
          await this.error?.('Function failed', error as Error, { ...context, durationMs }) ||
                console.error('Function failed:', error, { ...context, durationMs });

          // Record error metric
          if (this.incrementCounter) {
            await this.incrementCounter('function_errors', {
              function: propertyKey,
              operation,
              errorType: (error as Error).name
            });
          }

          throw error;
        }
      };
    };
  }

  /**
   * Increment counter metric
   */
  async incrementCounter(name: string, tags?: Record<string, string>, value: number = 1): Promise<void> {
    if (!this.config.enableMetrics) return;

    try {
      await this.executePythonCommand('increment_counter', {
        name,
        value,
        tags
      });
    } catch (error) {
      console.warn('Failed to increment counter:', error);
    }
  }

  /**
   * Set gauge metric
   */
  async setGauge(name: string, value: number, tags?: Record<string, string>): Promise<void> {
    if (!this.config.enableMetrics) return;

    try {
      await this.executePythonCommand('set_gauge', {
        name,
        value,
        tags
      });
    } catch (error) {
      console.warn('Failed to set gauge:', error);
    }
  }

  /**
   * Record timer metric
   */
  async recordTimer(name: string, durationMs: number, tags?: Record<string, string>): Promise<void> {
    if (!this.config.enableMetrics) return;

    try {
      await this.executePythonCommand('record_timer', {
        name,
        duration_ms: durationMs,
        tags
      });
    } catch (error) {
      console.warn('Failed to record timer:', error);
    }
  }

  /**
   * Record error metric
   */
  async recordError(name: string, errorType: string = 'unknown', tags?: Record<string, string>): Promise<void> {
    if (!this.config.enableMetrics) return;

    try {
      await this.executePythonCommand('record_error', {
        name,
        error_type: errorType,
        tags
      });
    } catch (error) {
      console.warn('Failed to record error:', error);
    }
  }

  /**
   * Get metrics summary
   */
  async getMetricsSummary(): Promise<MetricsSummary> {
    try {
      const result = await this.executePythonCommand('metrics', {});
      return result as MetricsSummary;
    } catch (error) {
      console.error('Failed to get metrics summary:', error);
      return {
        counters: {},
        gauges: {},
        errors: {},
        timers: {},
        system: {},
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get health check status
   */
  async getHealthCheck(): Promise<HealthCheck> {
    try {
      const result = await this.executePythonCommand('health', {});
      return result as HealthCheck;
    } catch (error) {
      console.error('Failed to get health check:', error);
      return {
        status: 'degraded',
        checks: {
          logging_service: `error: ${error}`
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Export metrics to JSON
   */
  async exportMetrics(outputPath?: string): Promise<string> {
    try {
      const params = outputPath ? { output_path: outputPath } : {};
      const result = await this.executePythonCommand('export', params);
      return result.data || JSON.stringify(result);
    } catch (error) {
      console.error('Failed to export metrics:', error);
      throw error;
    }
  }

  /**
   * Create performance monitoring middleware
   */
  createPerformanceMiddleware() {
    return {
      /**
       * Express.js middleware for request logging
       */
      express: () => {
        return async (req: any, res: any, next: any) => {
          const startTime = Date.now();
          const requestId = req.headers['x-request-id'] || this.generateRequestId();
          
          const cleanup = this.createRequestContext({
            requestId,
            userId: req.user?.id,
            operation: `${req.method} ${req.path}`,
            userAgent: req.headers['user-agent'],
            ip: req.ip
          });

          await this.info('Request started', {
            method: req.method,
            path: req.path,
            query: req.query
          });

          const originalSend = res.send;
          res.send = function(data: any) {
            const durationMs = Date.now() - startTime;
            
            // Log request completion
            loggingIntegration.info('Request completed', {
              statusCode: res.statusCode,
              durationMs
            });

            // Record metrics
            loggingIntegration.incrementCounter('http_requests_total', {
              method: req.method,
              status: res.statusCode.toString()
            });
            loggingIntegration.recordTimer('http_request_duration', durationMs, {
              method: req.method,
              status: res.statusCode.toString()
            });

            cleanup();
            return originalSend.call(this, data);
          };

          next();
        };
      },

      /**
       * Next.js middleware for request logging
       */
      nextjs: () => {
        return async (req: any, res: any) => {
          const startTime = Date.now();
          const requestId = req.headers['x-request-id'] || this.generateRequestId();
          
          const cleanup = this.createRequestContext({
            requestId,
            operation: `${req.method} ${req.url}`,
            userAgent: req.headers['user-agent']
          });

          await this.info('API request started', {
            method: req.method,
            url: req.url
          });

          try {
            return await next();
          } finally {
            const durationMs = Date.now() - startTime;
            
            await this.info('API request completed', {
              statusCode: res.statusCode,
              durationMs
            });

            await this.incrementCounter('api_requests_total', {
              method: req.method,
              status: res.statusCode?.toString() || 'unknown'
            });
            await this.recordTimer('api_request_duration', durationMs);

            cleanup();
          }
        };
      }
    };
  }

  /**
   * Monitor system performance
   */
  async startPerformanceMonitoring(intervalMs: number = 30000): Promise<() => void> {
    console.log(`📊 Starting performance monitoring (interval: ${intervalMs}ms)`);

    const interval = setInterval(async () => {
      try {
        const metrics = await this.getMetricsSummary();
        
        console.log(`📊 Metrics: ${Object.keys(metrics.counters).length} counters, ${Object.keys(metrics.timers).length} timers`);
        
        if (metrics.system.memoryPercent && metrics.system.memoryPercent > 90) {
          await this.warning('High memory usage detected', {
            memoryPercent: metrics.system.memoryPercent
          });
        }

        if (metrics.system.diskPercent && metrics.system.diskPercent > 90) {
          await this.warning('High disk usage detected', {
            diskPercent: metrics.system.diskPercent
          });
        }

      } catch (error) {
        console.error('Performance monitoring error:', error);
      }
    }, intervalMs);

    return () => {
      clearInterval(interval);
      console.log('📊 Performance monitoring stopped');
    };
  }

  /**
   * Get current context from stack
   */
  private getCurrentContext(): Record<string, any> {
    const context: Record<string, any> = {};
    
    for (const ctx of this.requestContextStack) {
      Object.assign(context, ctx);
    }

    return context;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send log to Python logging service
   */
  private async sendToPythonLogger(level: string, message: string, data: Record<string, any>): Promise<void> {
    // For now, just use the metrics system to track errors
    if (level === 'error') {
      await this.incrementCounter('log_errors_total');
    }
  }

  /**
   * Execute Python logging command
   */
  private async executePythonCommand(command: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        LOG_LEVEL: this.config.logLevel,
        ENVIRONMENT: this.config.environment,
        SERVICE_NAME: this.config.serviceName,
        JSON_LOGS: this.config.enableJsonLogs?.toString(),
        LOG_DIR: this.config.logDir
      };

      const pythonProcess = spawn('python3', [this.pythonScriptPath, command, JSON.stringify(params)], {
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
            // Try to parse JSON response
            const result = JSON.parse(stdout.trim());
            resolve(result);
          } catch (error) {
            // If not JSON, return as text
            resolve(stdout.trim());
          }
        } else {
          reject(new Error(`Logging command failed (code ${code}): ${stderr}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python logging process: ${error.message}`));
      });

      // Set timeout
      const timeout = setTimeout(() => {
        pythonProcess.kill('SIGTERM');
        reject(new Error('Logging command timeout'));
      }, 10000); // 10 seconds

      pythonProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }
}

// Export singleton instance
export const loggingIntegration = new LoggingIntegration();