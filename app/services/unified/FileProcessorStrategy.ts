/**
 * Strategy pattern for different file processing approaches
 */

export interface ProcessingResult {
  products: Array<{
    name: string;
    unit: string;
    price: number;
    category?: string;
    brand?: string;
    barcode?: string;
    description?: string;
  }>;
  metadata: {
    totalProducts: number;
    successCount: number;
    errorCount: number;
    processingTime: number;
    errors?: string[];
  };
}

export interface FileProcessorStrategy {
  /**
   * Process a file and extract product data
   */
  process(
    filePath: string,
    fileName: string,
    options?: ProcessingOptions
  ): Promise<ProcessingResult>;
  
  /**
   * Check if this strategy can handle the given file
   */
  canHandle(fileName: string, mimeType?: string): boolean;
  
  /**
   * Get the name of this strategy
   */
  getName(): string;
}

export interface ProcessingOptions {
  mode?: 'normal' | 'smart' | 'ai' | 'debug';
  validationLevel?: 'strict' | 'normal' | 'lenient';
  forceOCR?: boolean;
  useAI?: boolean;
  maxProducts?: number;
  timeout?: number;
  debug?: boolean;
}

/**
 * Base class for file processor strategies
 */
export abstract class BaseFileProcessorStrategy implements FileProcessorStrategy {
  protected name: string;
  
  constructor(name: string) {
    this.name = name;
  }
  
  abstract process(
    filePath: string,
    fileName: string,
    options?: ProcessingOptions
  ): Promise<ProcessingResult>;
  
  abstract canHandle(fileName: string, mimeType?: string): boolean;
  
  getName(): string {
    return this.name;
  }
  
  /**
   * Helper method to create a processing result
   */
  protected createResult(
    products: ProcessingResult['products'],
    errors: string[] = [],
    startTime: number
  ): ProcessingResult {
    return {
      products,
      metadata: {
        totalProducts: products.length,
        successCount: products.length,
        errorCount: errors.length,
        processingTime: Date.now() - startTime,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  }
  
  /**
   * Helper to validate a product
   */
  protected validateProduct(product: any): boolean {
    return !!(
      product.name &&
      product.unit &&
      product.price !== null &&
      product.price !== undefined &&
      product.price >= 0
    );
  }
}