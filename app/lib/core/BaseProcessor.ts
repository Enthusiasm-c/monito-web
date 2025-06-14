/**
 * Base Processor Class
 * Replaces 13 duplicate getInstance() patterns and common processor functionality
 */

import { ErrorHandler, ErrorContext } from './ErrorHandler';
import { ProcessOptions, FileContent, ProcessingResult } from './Interfaces';

export abstract class BaseProcessor {
  protected static instances: Map<string, BaseProcessor> = new Map();
  protected readonly processorName: string;

  constructor(processorName: string) {
    this.processorName = processorName;
  }

  /**
   * Singleton pattern implementation
   */
  static getInstance<T extends BaseProcessor>(this: new (...args: any[]) => T, ...args: any[]): T {
    const className = this.name;
    
    if (!BaseProcessor.instances.has(className)) {
      BaseProcessor.instances.set(className, new this(...args));
    }
    
    return BaseProcessor.instances.get(className) as T;
  }

  /**
   * Abstract method - must be implemented by subclasses
   */
  abstract processDocument(
    fileContent: Buffer | string,
    fileName: string,
    options?: ProcessOptions
  ): Promise<ProcessingResult>;

  /**
   * Common file type detection
   */
  protected detectFileType(fileName: string, mimeType?: string): string {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    
    if (mimeType) {
      if (mimeType.includes('pdf')) return 'pdf';
      if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'excel';
      if (mimeType.includes('csv')) return 'csv';
      if (mimeType.includes('image')) return 'image';
    }
    
    switch (ext) {
      case 'pdf': return 'pdf';
      case 'xlsx':
      case 'xls': return 'excel';
      case 'csv': return 'csv';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp': return 'image';
      case 'txt':
      case 'text': return 'text';
      default: return 'unknown';
    }
  }

  /**
   * Common validation for file processing
   */
  protected validateFile(fileName: string, fileSize?: number, fileContent?: Buffer | string): void {
    const context: ErrorContext = {
      component: this.processorName,
      operation: 'validateFile',
      fileName
    };

    if (!fileName || fileName.trim().length === 0) {
      throw ErrorHandler.handleValidationError(
        'File name is required',
        context
      );
    }

    if (fileSize && fileSize > 10 * 1024 * 1024) { // 10MB limit
      throw ErrorHandler.handleValidationError(
        'File size exceeds 10MB limit',
        context,
        { fileSize }
      );
    }

    if (fileContent !== undefined && (!fileContent || (typeof fileContent === 'string' && fileContent.length === 0))) {
      throw ErrorHandler.handleValidationError(
        'File content is empty',
        context
      );
    }
  }

  /**
   * Common error handling wrapper
   */
  protected async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    fileName?: string
  ): Promise<T> {
    const context: ErrorContext = {
      component: this.processorName,
      operation: operationName,
      fileName
    };

    return ErrorHandler.withErrorHandling(operation, context);
  }

  /**
   * Common logging
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${this.processorName}] ${message}`;
    
    switch (level) {
      case 'info':
        console.log(logMessage, data || '');
        break;
      case 'warn':
        console.warn(logMessage, data || '');
        break;
      case 'error':
        console.error(logMessage, data || '');
        break;
    }
  }

  /**
   * Common processing time measurement
   */
  protected measureProcessingTime<T>(operation: () => T | Promise<T>): Promise<{ result: T; timeMs: number }> {
    const startTime = Date.now();
    
    const handleResult = (result: T) => ({
      result,
      timeMs: Date.now() - startTime
    });

    try {
      const result = operation();
      
      if (result instanceof Promise) {
        return result.then(handleResult);
      } else {
        return Promise.resolve(handleResult(result));
      }
    } catch (error) {
      const timeMs = Date.now() - startTime;
      this.log('error', `Operation failed after ${timeMs}ms`, error);
      throw error;
    }
  }

  /**
   * Common progress tracking
   */
  protected createProgressTracker(total: number, label: string = 'Processing') {
    let current = 0;
    let lastReported = 0;
    
    return {
      increment: (amount: number = 1) => {
        current += amount;
        const percentage = Math.floor((current / total) * 100);
        
        // Report every 10% or at completion
        if (percentage >= lastReported + 10 || current >= total) {
          this.log('info', `${label}: ${percentage}% (${current}/${total})`);
          lastReported = percentage;
        }
      },
      
      complete: () => {
        this.log('info', `${label}: Complete (${current}/${total})`);
      }
    };
  }

  /**
   * Common configuration validation
   */
  protected validateProcessOptions(options: ProcessOptions = {}): ProcessOptions {
    const defaults: ProcessOptions = {
      maxProducts: 1000,
      model: 'gemini-2.0-flash-exp',
      strategy: 'auto',
      batchSize: 200,
      enableBatching: true,
      includeMetadata: true,
      timeout: 120000, // 2 minutes
      retries: 3
    };

    const validated = { ...defaults, ...options };

    // Validate specific options
    if (validated.batchSize && (validated.batchSize < 50 || validated.batchSize > 500)) {
      validated.batchSize = 200;
      this.log('warn', 'Invalid batchSize, using default: 200');
    }

    if (validated.maxProducts && validated.maxProducts < 1) {
      validated.maxProducts = 1000;
      this.log('warn', 'Invalid maxProducts, using default: 1000');
    }

    return validated;
  }

  /**
   * Common cleanup method
   */
  protected cleanup(): void {
    this.log('info', 'Processor cleanup completed');
  }

  /**
   * Get processor info
   */
  getProcessorInfo() {
    return {
      name: this.processorName,
      instance: this.constructor.name,
      created: new Date().toISOString()
    };
  }
}