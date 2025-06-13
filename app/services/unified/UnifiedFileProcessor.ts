import { FileProcessorStrategy, ProcessingOptions, ProcessingResult } from './FileProcessorStrategy';
import { ExcelProcessorStrategy } from './strategies/ExcelProcessorStrategy';
import { PdfProcessorStrategy } from './strategies/PdfProcessorStrategy';
import { ImageProcessorStrategy } from './strategies/ImageProcessorStrategy';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Unified file processor that uses strategy pattern to handle different file types
 */
export class UnifiedFileProcessor {
  private strategies: FileProcessorStrategy[] = [];
  private static instance: UnifiedFileProcessor;
  
  private constructor() {
    // Register default strategies
    this.registerStrategy(new ExcelProcessorStrategy());
    this.registerStrategy(new PdfProcessorStrategy());
    this.registerStrategy(new ImageProcessorStrategy());
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): UnifiedFileProcessor {
    if (!UnifiedFileProcessor.instance) {
      UnifiedFileProcessor.instance = new UnifiedFileProcessor();
    }
    return UnifiedFileProcessor.instance;
  }
  
  /**
   * Register a new processing strategy
   */
  registerStrategy(strategy: FileProcessorStrategy): void {
    this.strategies.push(strategy);
  }
  
  /**
   * Process a file using the appropriate strategy
   */
  async processFile(
    filePath: string,
    fileName: string,
    mimeType?: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    // Validate file exists
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Find appropriate strategy
    const strategy = this.findStrategy(fileName, mimeType);
    if (!strategy) {
      throw new Error(`No processor available for file type: ${fileName}`);
    }
    
    // Log processing start if debug mode
    if (options.debug) {
      console.log(`Processing ${fileName} with ${strategy.getName()}`);
    }
    
    try {
      // Process with timeout if specified
      if (options.timeout) {
        return await this.processWithTimeout(
          strategy.process(filePath, fileName, options),
          options.timeout
        );
      }
      
      return await strategy.process(filePath, fileName, options);
    } catch (error) {
      // If AI mode fails, try fallback to normal mode
      if (options.mode === 'ai' && error instanceof Error && error.message.includes('AI')) {
        if (options.debug) {
          console.log('AI processing failed, falling back to normal mode');
        }
        
        const fallbackOptions = { ...options, mode: 'normal' as const, useAI: false };
        return await strategy.process(filePath, fileName, fallbackOptions);
      }
      
      throw error;
    }
  }
  
  /**
   * Process file in background (returns immediately)
   */
  async processFileInBackground(
    filePath: string,
    fileName: string,
    mimeType?: string,
    options: ProcessingOptions = {},
    onComplete?: (result: ProcessingResult) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    // Start processing in background
    this.processFile(filePath, fileName, mimeType, options)
      .then(result => {
        if (onComplete) onComplete(result);
      })
      .catch(error => {
        if (onError) onError(error instanceof Error ? error : new Error(String(error)));
      });
  }
  
  /**
   * Get list of supported file extensions
   */
  getSupportedExtensions(): string[] {
    const extensions = new Set<string>();
    
    // Common extensions to check
    const testExtensions = [
      '.xlsx', '.xls', '.csv',
      '.pdf',
      '.jpg', '.jpeg', '.png', '.webp', '.tiff', '.bmp',
    ];
    
    for (const ext of testExtensions) {
      const testFile = `test${ext}`;
      if (this.findStrategy(testFile)) {
        extensions.add(ext);
      }
    }
    
    return Array.from(extensions);
  }
  
  /**
   * Find appropriate strategy for a file
   */
  private findStrategy(fileName: string, mimeType?: string): FileProcessorStrategy | null {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(fileName, mimeType)) {
        return strategy;
      }
    }
    return null;
  }
  
  /**
   * Process with timeout
   */
  private async processWithTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Processing timeout after ${timeout}ms`));
      }, timeout);
    });
    
    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }
  
  /**
   * Validate file before processing
   */
  async validateFile(
    filePath: string,
    maxSize: number = 50 * 1024 * 1024 // 50MB default
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const stats = await fs.stat(filePath);
      
      if (!stats.isFile()) {
        return { valid: false, error: 'Not a file' };
      }
      
      if (stats.size > maxSize) {
        return { valid: false, error: `File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB)` };
      }
      
      const fileName = path.basename(filePath);
      const strategy = this.findStrategy(fileName);
      
      if (!strategy) {
        return { valid: false, error: 'Unsupported file type' };
      }
      
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Validation failed' 
      };
    }
  }
}

// Export singleton instance
export const fileProcessor = UnifiedFileProcessor.getInstance();