/**
 * Upload Progress Tracker
 * Manages detailed progress tracking for file uploads
 */

import { prisma } from '../../lib/prisma';

export interface UploadProgress {
  uploadId: string;
  currentStep: string;
  progress: number;
  status: 'processing' | 'completed' | 'failed';
  details: {
    totalRows?: number;
    processedRows?: number;
    totalProducts?: number;
    processedProducts?: number;
    extractedProducts?: number;
    standardizedProducts?: number;
    savedProducts?: number;
    errors?: string[];
    warnings?: string[];
    currentProduct?: string;
    aiTokensUsed?: number;
    estimatedTimeRemaining?: number;
  };
}

export class UploadProgressTracker {
  private static progressMap = new Map<string, UploadProgress>();
  
  static async updateProgress(
    uploadId: string, 
    step: string, 
    progress: number,
    details?: Partial<UploadProgress['details']>
  ) {
    const currentProgress = this.progressMap.get(uploadId) || {
      uploadId,
      currentStep: step,
      progress,
      status: 'processing' as const,
      details: {}
    };
    
    // Update progress
    currentProgress.currentStep = step;
    currentProgress.progress = progress;
    if (details) {
      currentProgress.details = { ...currentProgress.details, ...details };
    }
    
    // Determine status
    if (progress >= 100) {
      currentProgress.status = 'completed';
    } else if (details?.errors && details.errors.length > 0) {
      currentProgress.status = 'failed';
    }
    
    // Store in memory
    this.progressMap.set(uploadId, currentProgress);
    
    // Update database
    try {
      await prisma.upload.update({
        where: { id: uploadId },
        data: {
          processingDetails: currentProgress.details,
          status: currentProgress.status === 'completed' ? 'completed' : 
                 currentProgress.status === 'failed' ? 'failed' : 'processing'
        }
      });
    } catch (error) {
      console.error('Failed to update upload progress in DB:', error);
    }
    
    return currentProgress;
  }
  
  static getProgress(uploadId: string): UploadProgress | null {
    return this.progressMap.get(uploadId) || null;
  }
  
  static startTracking(uploadId: string) {
    this.progressMap.set(uploadId, {
      uploadId,
      currentStep: 'Initializing upload...',
      progress: 0,
      status: 'processing',
      details: {}
    });
  }
  
  static completeTracking(uploadId: string, success: boolean = true) {
    const progress = this.progressMap.get(uploadId);
    if (progress) {
      progress.status = success ? 'completed' : 'failed';
      progress.progress = 100;
      
      // Clean up after 5 minutes
      setTimeout(() => {
        this.progressMap.delete(uploadId);
      }, 5 * 60 * 1000);
    }
  }
  
  static async trackExtraction(
    uploadId: string,
    currentRow: number,
    totalRows: number,
    productName?: string
  ) {
    const baseProgress = 30; // Extraction starts at 30%
    const extractionRange = 40; // Extraction goes from 30% to 70%
    const progress = baseProgress + (currentRow / totalRows) * extractionRange;
    
    await this.updateProgress(uploadId, `Extracting row ${currentRow}/${totalRows}`, progress, {
      totalRows,
      processedRows: currentRow,
      currentProduct: productName
    });
  }
  
  static async trackStandardization(
    uploadId: string,
    currentProduct: number,
    totalProducts: number,
    productName?: string
  ) {
    const baseProgress = 70; // Standardization starts at 70%
    const standardizationRange = 20; // Goes from 70% to 90%
    const progress = baseProgress + (currentProduct / totalProducts) * standardizationRange;
    
    await this.updateProgress(uploadId, `Standardizing product ${currentProduct}/${totalProducts}`, progress, {
      totalProducts,
      standardizedProducts: currentProduct,
      currentProduct: productName
    });
  }
  
  static async trackSaving(
    uploadId: string,
    savedProducts: number,
    totalProducts: number
  ) {
    const baseProgress = 90; // Saving starts at 90%
    const savingRange = 10; // Goes from 90% to 100%
    const progress = baseProgress + (savedProducts / totalProducts) * savingRange;
    
    await this.updateProgress(uploadId, `Saving to database ${savedProducts}/${totalProducts}`, progress, {
      savedProducts,
      totalProducts
    });
  }
  
  static estimateTimeRemaining(
    startTime: number,
    currentProgress: number,
    totalItems: number,
    processedItems: number
  ): number {
    if (processedItems === 0) return 0;
    
    const elapsedTime = Date.now() - startTime;
    const avgTimePerItem = elapsedTime / processedItems;
    const remainingItems = totalItems - processedItems;
    
    return Math.ceil((avgTimePerItem * remainingItems) / 1000); // Return in seconds
  }
}