/**
 * Custom error classes and error handling utilities
 */

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: any;
  
  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
    
    // Set prototype explicitly
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Validation error - 400
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, true, details);
  }
}

/**
 * Not found error - 404
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id 
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    super(message, 404, true);
  }
}

/**
 * Unauthorized error - 401
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, true);
  }
}

/**
 * Forbidden error - 403
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, true);
  }
}

/**
 * Conflict error - 409
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, true, details);
  }
}

/**
 * Too many requests error - 429
 */
export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests', retryAfter?: number) {
    super(message, 429, true, { retryAfter });
  }
}

/**
 * Service unavailable error - 503
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 503, true);
  }
}

/**
 * Database error wrapper
 */
export class DatabaseError extends AppError {
  constructor(message: string, originalError?: any) {
    super(message, 500, false, { originalError });
  }
}

/**
 * External service error
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, originalError?: any) {
    super(`${service} error: ${message}`, 502, false, { service, originalError });
  }
}

/**
 * File processing error
 */
export class FileProcessingError extends AppError {
  constructor(fileName: string, message: string, details?: any) {
    super(`Error processing file '${fileName}': ${message}`, 422, true, details);
  }
}

/**
 * Error response interface
 */
export interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    statusCode: number;
    details?: any;
    timestamp: string;
    path?: string;
  };
}

/**
 * Format error for API response
 */
export function formatErrorResponse(
  error: Error | AppError,
  path?: string
): ErrorResponse {
  const isAppError = error instanceof AppError;
  
  return {
    error: {
      message: error.message,
      code: error.name,
      statusCode: isAppError ? error.statusCode : 500,
      details: isAppError ? error.details : undefined,
      timestamp: new Date().toISOString(),
      path,
    },
  };
}

/**
 * Global error handler for Next.js API routes
 */
export function handleApiError(
  error: unknown,
  path?: string
): { status: number; body: ErrorResponse } {
  // Log error
  console.error('API Error:', error);
  
  // Handle known errors
  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      body: formatErrorResponse(error, path),
    };
  }
  
  // Handle Prisma errors
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as any;
    
    switch (prismaError.code) {
      case 'P2002':
        return {
          status: 409,
          body: formatErrorResponse(
            new ConflictError('Duplicate entry', prismaError.meta),
            path
          ),
        };
        
      case 'P2025':
        return {
          status: 404,
          body: formatErrorResponse(
            new NotFoundError('Record'),
            path
          ),
        };
        
      case 'P2003':
        return {
          status: 400,
          body: formatErrorResponse(
            new ValidationError('Foreign key constraint failed', prismaError.meta),
            path
          ),
        };
        
      default:
        return {
          status: 500,
          body: formatErrorResponse(
            new DatabaseError('Database operation failed', prismaError),
            path
          ),
        };
    }
  }
  
  // Handle standard errors
  if (error instanceof Error) {
    return {
      status: 500,
      body: formatErrorResponse(error, path),
    };
  }
  
  // Handle unknown errors
  return {
    status: 500,
    body: formatErrorResponse(
      new Error('An unexpected error occurred'),
      path
    ),
  };
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler<T extends (...args: any[]) => Promise<any>>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      const path = args[0]?.url ? new URL(args[0].url).pathname : undefined;
      const { status, body } = handleApiError(error, path);
      
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }) as T;
}

/**
 * Error boundary for React components (client-side)
 */
export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary {
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  
  static logErrorToService(error: Error, errorInfo: any) {
    // Log to external service
    console.error('Error boundary caught:', error, errorInfo);
    
    // You can send to error tracking service here
    // e.g., Sentry, LogRocket, etc.
  }
}