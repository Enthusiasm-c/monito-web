/**
 * Async File Processor for Background Jobs
 * Wrapper around EnhancedFileProcessor for background processing
 */

import { enhancedFileProcessor } from '../enhancedFileProcessor';

export class AsyncFileProcessor {
  async processFile(request: any): Promise<any> {
    try {
      console.log('AsyncFileProcessor: Starting processing for upload:', request.uploadId);
      
      // Use the existing enhanced file processor
      const result = await enhancedFileProcessor.processFile(request.uploadId);
      
      console.log('AsyncFileProcessor: Processing completed with result:', {
        success: result.success,
        productsCreated: result.productsCreated || 0,
        error: result.error
      });
      
      return {
        success: result.success,
        productsCreated: result.productsCreated || 0,
        error: result.error,
        ...result
      };
      
    } catch (error) {
      console.error('AsyncFileProcessor: Processing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed',
        productsCreated: 0
      };
    }
  }
}