/**
 * Background Job Queue System
 * Handles asynchronous file processing without HTTP timeouts
 */

import { prisma } from '../../../lib/prisma';

export interface JobData {
  uploadId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  supplierId?: string;
  options?: {
    autoApprove?: boolean;
    batchSize?: number;
  };
}

export interface Job {
  id: string;
  type: 'file_processing';
  data: JobData;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: any;
}

export class JobQueue {
  private static instance: JobQueue;
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  public static getInstance(): JobQueue {
    if (!JobQueue.instance) {
      JobQueue.instance = new JobQueue();
    }
    return JobQueue.instance;
  }

  /**
   * Add a job to the queue
   */
  async addJob(data: JobData): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store job in database
    await prisma.upload.update({
      where: { id: data.uploadId },
      data: {
        status: 'processing',
        processingDetails: JSON.stringify({
          jobId,
          stage: 'queued',
          progress: 0,
          batchSize: data.options?.batchSize || 25
        })
      }
    });

    console.log(`📝 Job queued: ${jobId} for upload ${data.uploadId}`);
    
    // Start processing if not already running
    this.startProcessing();
    
    return jobId;
  }

  /**
   * Start the job processing loop
   */
  private startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    console.log('🚀 Starting job queue processor...');
    
    this.processingInterval = setInterval(async () => {
      await this.processNextJob();
    }, 2000); // Check for jobs every 2 seconds
  }

  /**
   * Stop the job processing loop
   */
  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isProcessing = false;
    console.log('⏹️ Job queue processor stopped');
  }

  /**
   * Process the next pending job
   */
  private async processNextJob() {
    try {
      // Find the oldest pending job
      const upload = await prisma.upload.findFirst({
        where: { 
          status: 'processing'
        },
        orderBy: { createdAt: 'asc' }
      });
      
      // Check if this job is actually queued
      if (upload && upload.processingDetails) {
        let details;
        if (typeof upload.processingDetails === 'string') {
          details = JSON.parse(upload.processingDetails);
        } else {
          details = upload.processingDetails as any;
        }
        
        if (details.stage !== 'queued') {
          return; // Skip if not queued
        }
      }

      if (!upload) return; // No pending jobs

      let processingDetails;
      if (typeof upload.processingDetails === 'string') {
        processingDetails = JSON.parse(upload.processingDetails);
      } else {
        processingDetails = upload.processingDetails as any;
      }
      const jobId = processingDetails?.jobId;

      console.log(`🔄 Processing job: ${jobId} for upload ${upload.id}`);

      // Mark as running
      await this.updateJobStatus(upload.id, 'running', 5, 'Starting extraction...');

      // Import the processor here to avoid circular dependencies
      const { AsyncFileProcessor } = await import('./AsyncFileProcessor');
      const processor = new AsyncFileProcessor();

      // Process the file
      await processor.processFile({
        uploadId: upload.id,
        fileUrl: upload.url!,
        fileName: upload.originalName!,
        fileType: upload.mimeType!,
        options: {
          autoApprove: processingDetails?.autoApprove || false,
          batchSize: processingDetails?.batchSize || 25
        }
      });

    } catch (error) {
      console.error('❌ Job processing error:', error);
    }
  }

  /**
   * Update job status and progress
   */
  async updateJobStatus(
    uploadId: string, 
    stage: string, 
    progress: number, 
    message?: string,
    error?: string
  ) {
    try {
      const currentUpload = await prisma.upload.findUnique({
        where: { id: uploadId }
      });

      if (!currentUpload) return;

      const currentDetails = (currentUpload.processingDetails as any) || {};
      
      const updatedDetails = {
        ...currentDetails,
        stage,
        progress,
        message,
        lastUpdated: new Date().toISOString(),
        ...(error && { error })
      };

      await prisma.upload.update({
        where: { id: uploadId },
        data: {
          processingDetails: updatedDetails,
          ...(stage === 'completed' && { status: 'completed' }),
          ...(stage === 'failed' && { status: 'failed', errorMessage: error })
        }
      });

      console.log(`📊 Job progress: ${uploadId} - ${stage} (${progress}%) ${message || ''}`);
      
    } catch (error) {
      console.error('❌ Failed to update job status:', error);
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(uploadId: string): Promise<{
    stage: string;
    progress: number;
    message?: string;
    error?: string;
  } | null> {
    try {
      const upload = await prisma.upload.findUnique({
        where: { id: uploadId }
      });

      if (!upload?.processingDetails) return null;

      let details;
      if (typeof upload.processingDetails === 'string') {
        details = JSON.parse(upload.processingDetails);
      } else {
        details = upload.processingDetails as any;
      }

      return {
        stage: details.stage || 'unknown',
        progress: details.progress || 0,
        message: details.message,
        error: details.error
      };
    } catch (error) {
      console.error('❌ Failed to get job status:', error);
      return null;
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(uploadId: string) {
    await this.updateJobStatus(uploadId, 'cancelled', 0, 'Job cancelled by user');
  }

  /**
   * Check for existing queued jobs and start processing if any exist
   */
  async checkAndStartProcessing() {
    try {
      console.log('🔍 Checking for existing queued jobs...');
      
      // Find any jobs in "queued" stage
      const queuedUploads = await prisma.upload.findMany({
        where: { 
          status: 'processing'
        }
      });

      const actuallyQueuedUploads = queuedUploads.filter(upload => {
        if (upload.processingDetails) {
          const details = upload.processingDetails as any;
          return details.stage === 'queued';
        }
        return false;
      });

      console.log(`📊 Found ${actuallyQueuedUploads.length} queued jobs`);

      if (actuallyQueuedUploads.length > 0) {
        console.log('🚀 Starting processing for queued jobs...');
        this.startProcessing();
      } else {
        console.log('✅ No queued jobs found');
      }

    } catch (error) {
      console.error('❌ Error checking for queued jobs:', error);
    }
  }
}

// Export singleton instance
export const jobQueue = JobQueue.getInstance();