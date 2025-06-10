/**
 * Upload Processor with Document Classification
 * Integrates document classification into the existing upload system
 */

import { PrismaClient } from '@prisma/client';
import { DocumentClassifier, DocumentType } from './document_classifier';
import path from 'path';
import fs from 'fs/promises';
import { tmpdir } from 'os';

const prisma = new PrismaClient();

export interface UploadProcessingResult {
  success: boolean;
  uploadId: string;
  classification?: any;
  status: string;
  message: string;
  shouldProcess: boolean;
  processingPriority: 'high' | 'medium' | 'low';
}

export class UploadProcessor {
  private classifier: DocumentClassifier;

  constructor() {
    this.classifier = new DocumentClassifier();
  }

  /**
   * Process upload with document classification
   */
  async processUpload(
    fileBuffer: Buffer,
    originalName: string,
    supplierId: string,
    fileUrl?: string
  ): Promise<UploadProcessingResult> {
    console.log(`📁 Processing upload: ${originalName}`);
    
    try {
      // Create temporary file for classification
      const tempFilePath = await this.createTempFile(fileBuffer, originalName);
      
      // Classify document
      const classification = await this.classifier.classify_document(tempFilePath);
      
      // Check for duplicates using file hash
      const existingUpload = await this.checkForDuplicate(classification.file_hash);
      if (existingUpload) {
        await fs.unlink(tempFilePath); // Cleanup
        return {
          success: false,
          uploadId: existingUpload.id,
          status: 'duplicate',
          message: `File already exists (uploaded: ${existingUpload.createdAt.toISOString()})`,
          shouldProcess: false,
          processingPriority: 'low'
        };
      }

      // Determine processing status and priority
      const { status, priority, shouldProcess } = this.determineProcessingStrategy(classification);

      // Create upload record with classification
      const upload = await prisma.upload.create({
        data: {
          originalName,
          fileName: originalName,
          fileSize: fileBuffer.length,
          mimeType: classification.mime_type,
          url: fileUrl || tempFilePath,
          status,
          supplierId,
          fileHash: classification.file_hash,
          documentType: classification.document_type.value,
          classificationResult: classification,
        }
      });

      // Cleanup temp file if we have a permanent URL
      if (fileUrl) {
        await fs.unlink(tempFilePath);
      }

      console.log(`✅ Upload processed: ${upload.id} (${status}, priority: ${priority})`);

      return {
        success: true,
        uploadId: upload.id,
        classification,
        status,
        message: `File classified as ${classification.document_type.value}`,
        shouldProcess,
        processingPriority: priority
      };

    } catch (error) {
      console.error('❌ Upload processing failed:', error);
      
      return {
        success: false,
        uploadId: '',
        status: 'failed',
        message: `Processing failed: ${error instanceof Error ? error.message : String(error)}`,
        shouldProcess: false,
        processingPriority: 'low'
      };
    }
  }

  /**
   * Create temporary file for classification
   */
  private async createTempFile(buffer: Buffer, originalName: string): Promise<string> {
    const tempDir = tmpdir();
    const ext = path.extname(originalName);
    const tempFileName = `upload_${Date.now()}_${Math.random().toString(36).substring(2)}${ext}`;
    const tempFilePath = path.join(tempDir, tempFileName);
    
    await fs.writeFile(tempFilePath, buffer);
    return tempFilePath;
  }

  /**
   * Check for duplicate files using hash
   */
  private async checkForDuplicate(fileHash: string) {
    return await prisma.upload.findFirst({
      where: { fileHash },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Determine processing strategy based on classification
   */
  private determineProcessingStrategy(classification: any): {
    status: string;
    priority: 'high' | 'medium' | 'low';
    shouldProcess: boolean;
  } {
    const docType = classification.document_type;
    const fileSize = classification.metadata.file_size;
    
    // Large files need special handling
    if (fileSize > 50 * 1024 * 1024) { // 50MB
      return {
        status: 'pending_large',
        priority: 'low',
        shouldProcess: false // Manual approval required
      };
    }

    // OCR-required documents
    if (docType === DocumentType.PDF_SCANNED || 
        docType === DocumentType.IMAGE_MENU || 
        docType === DocumentType.IMAGE_CATALOG) {
      return {
        status: 'pending_ocr',
        priority: 'medium',
        shouldProcess: true
      };
    }

    // Complex documents
    if (docType === DocumentType.PDF_IMAGE || 
        docType === DocumentType.EXCEL_MULTI ||
        docType === DocumentType.CSV_COMPLEX) {
      return {
        status: 'pending',
        priority: 'medium',
        shouldProcess: true
      };
    }

    // Simple documents - high priority
    if (docType === DocumentType.PDF_STRUCTURED ||
        docType === DocumentType.EXCEL_SINGLE ||
        docType === DocumentType.CSV_SIMPLE) {
      return {
        status: 'pending',
        priority: 'high',
        shouldProcess: true
      };
    }

    // Unknown or unsupported
    return {
      status: 'pending',
      priority: 'low',
      shouldProcess: false
    };
  }

  /**
   * Get processing queue with priority ordering
   */
  async getProcessingQueue(limit: number = 10): Promise<any[]> {
    // Priority order: high -> medium -> low
    const highPriority = await prisma.upload.findMany({
      where: { 
        status: { in: ['pending', 'pending_ocr'] },
        classificationResult: {
          path: ['priority'],
          equals: 'high'
        }
      },
      include: { supplier: true },
      orderBy: { createdAt: 'asc' },
      take: Math.ceil(limit * 0.6) // 60% high priority
    });

    const mediumPriority = await prisma.upload.findMany({
      where: { 
        status: { in: ['pending', 'pending_ocr'] },
        classificationResult: {
          path: ['priority'],
          equals: 'medium'
        }
      },
      include: { supplier: true },
      orderBy: { createdAt: 'asc' },
      take: Math.ceil(limit * 0.3) // 30% medium priority
    });

    const lowPriority = await prisma.upload.findMany({
      where: { 
        status: { in: ['pending', 'pending_ocr'] },
        classificationResult: {
          path: ['priority'],
          equals: 'low'
        }
      },
      include: { supplier: true },
      orderBy: { createdAt: 'asc' },
      take: Math.ceil(limit * 0.1) // 10% low priority
    });

    return [...highPriority, ...mediumPriority, ...lowPriority];
  }

  /**
   * Update upload status after processing
   */
  async updateUploadStatus(
    uploadId: string, 
    status: string, 
    processingResult?: any
  ): Promise<void> {
    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        status,
        ...(processingResult && {
          totalRowsDetected: processingResult.totalRowsDetected,
          totalRowsProcessed: processingResult.totalRowsProcessed,
          completenessRatio: processingResult.completenessRatio,
          processingTimeMs: processingResult.processingTimeMs,
          tokensUsed: processingResult.tokensUsed,
          processingCostUsd: processingResult.processingCostUsd,
          errorMessage: processingResult.errorMessage
        }),
        updatedAt: new Date()
      }
    });
  }

  /**
   * Get upload statistics by document type
   */
  async getUploadStatistics(): Promise<any> {
    const stats = await prisma.upload.groupBy({
      by: ['documentType', 'status'],
      _count: {
        id: true
      },
      _avg: {
        processingTimeMs: true,
        completenessRatio: true,
        processingCostUsd: true
      }
    });

    return {
      byDocumentType: stats.reduce((acc, stat) => {
        const type = stat.documentType || 'unknown';
        if (!acc[type]) {
          acc[type] = {
            total: 0,
            by_status: {},
            avg_processing_time_ms: 0,
            avg_completeness: 0,
            avg_cost_usd: 0
          };
        }
        
        acc[type].total += stat._count.id;
        acc[type].by_status[stat.status] = stat._count.id;
        acc[type].avg_processing_time_ms = stat._avg.processingTimeMs || 0;
        acc[type].avg_completeness = stat._avg.completenessRatio || 0;
        acc[type].avg_cost_usd = stat._avg.processingCostUsd || 0;
        
        return acc;
      }, {} as any)
    };
  }

  /**
   * Cleanup old temporary files and failed uploads
   */
  async cleanup(olderThanHours: number = 24): Promise<void> {
    const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    // Find old failed uploads
    const oldUploads = await prisma.upload.findMany({
      where: {
        status: { in: ['failed', 'too_large'] },
        createdAt: { lt: cutoffDate }
      }
    });

    console.log(`🧹 Cleaning up ${oldUploads.length} old uploads`);

    // Delete upload records
    await prisma.upload.deleteMany({
      where: {
        id: { in: oldUploads.map(u => u.id) }
      }
    });

    // Clean up temp files
    const tempDir = tmpdir();
    const tempFiles = await fs.readdir(tempDir);
    
    for (const file of tempFiles) {
      if (file.startsWith('upload_')) {
        const filePath = path.join(tempDir, file);
        try {
          const stats = await fs.stat(filePath);
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
          }
        } catch (error) {
          // File might have been deleted already
        }
      }
    }
  }
}

// Export singleton instance
export const uploadProcessor = new UploadProcessor();