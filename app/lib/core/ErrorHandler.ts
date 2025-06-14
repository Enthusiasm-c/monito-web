/**
 * Unified Error Handler
 * Replaces 180+ duplicate try-catch blocks across the project
 */

export enum ErrorType {
  VALIDATION = 'ValidationError',
  PROCESSING = 'ProcessingError',
  API = 'APIError',
  FILE = 'FileError',
  NETWORK = 'NetworkError',
  UNKNOWN = 'UnknownError'
}

export interface ErrorContext {
  component: string;
  operation: string;
  fileName?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface StandardError {
  type: ErrorType;
  message: string;
  code?: string;
  context: ErrorContext;
  timestamp: string;
  stack?: string;
}

export class ErrorHandler {
  /**
   * Handle processing errors with context
   */
  static handleProcessingError(
    error: any, 
    context: ErrorContext
  ): StandardError {
    console.error(`[${context.component}:${context.operation}] Error:`, error);
    
    return {
      type: this.determineErrorType(error),
      message: error.message || 'Unknown processing error',
      code: error.code,
      context,
      timestamp: new Date().toISOString(),
      stack: error.stack
    };
  }

  /**
   * Handle API errors
   */
  static handleAPIError(
    error: any,
    context: ErrorContext,
    statusCode?: number
  ): StandardError {
    const standardError = this.handleProcessingError(error, context);
    standardError.type = ErrorType.API;
    standardError.code = statusCode?.toString();
    return standardError;
  }

  /**
   * Handle file processing errors
   */
  static handleFileError(
    error: any,
    fileName: string,
    operation: string
  ): StandardError {
    return this.handleProcessingError(error, {
      component: 'FileProcessor',
      operation,
      fileName
    });
  }

  /**
   * Handle validation errors
   */
  static handleValidationError(
    message: string,
    context: ErrorContext,
    details?: Record<string, any>
  ): StandardError {
    return {
      type: ErrorType.VALIDATION,
      message,
      context: {
        ...context,
        metadata: details
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Async wrapper for error handling
   */
  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw this.handleProcessingError(error, context);
    }
  }

  /**
   * Sync wrapper for error handling
   */
  static withSyncErrorHandling<T>(
    operation: () => T,
    context: ErrorContext
  ): T {
    try {
      return operation();
    } catch (error) {
      throw this.handleProcessingError(error, context);
    }
  }

  /**
   * Determine error type from error object
   */
  private static determineErrorType(error: any): ErrorType {
    if (error.name === 'ValidationError') return ErrorType.VALIDATION;
    if (error.code === 'ENOENT' || error.code === 'EACCES') return ErrorType.FILE;
    if (error.message?.includes('fetch') || error.message?.includes('network')) return ErrorType.NETWORK;
    if (error.message?.includes('API') || error.status) return ErrorType.API;
    if (error.message?.includes('process') || error.message?.includes('extract')) return ErrorType.PROCESSING;
    return ErrorType.UNKNOWN;
  }

  /**
   * Format error for API response
   */
  static formatForResponse(error: StandardError) {
    return {
      error: {
        type: error.type,
        message: error.message,
        code: error.code,
        timestamp: error.timestamp
      },
      context: {
        component: error.context.component,
        operation: error.context.operation
      }
    };
  }

  /**
   * Log error with appropriate level
   */
  static logError(error: StandardError, level: 'error' | 'warn' | 'info' = 'error') {
    const logData = {
      ...error,
      level
    };

    switch (level) {
      case 'error':
        console.error('[ErrorHandler]', logData);
        break;
      case 'warn':
        console.warn('[ErrorHandler]', logData);
        break;
      case 'info':
        console.info('[ErrorHandler]', logData);
        break;
    }
  }
}

/**
 * Decorator for automatic error handling
 */
export function withErrorHandling(context: Partial<ErrorContext>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        const fullContext: ErrorContext = {
          component: target.constructor.name,
          operation: propertyKey,
          ...context
        };
        throw ErrorHandler.handleProcessingError(error, fullContext);
      }
    };

    return descriptor;
  };
}