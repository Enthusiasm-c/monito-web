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

export const jobQueue = {
  isProcessing: false,
  processingInterval: null as NodeJS.Timeout | null,
  retryCount: 0,
  maxRetries: 5,
  baseDelay: 2000, // Start with 2 seconds
  maxDelay: 60000, // Max 60 seconds

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
    jobQueue.startProcessing();
    
    return jobId;
  },

  /**
   * Check database connection health
   */
  async checkDatabaseConnection(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('❌ Database connection check failed:', error);
      return false;
    }
  },

  /**
   * Calculate delay with exponential backoff
   */
  calculateBackoffDelay(): number {
    const delay = Math.min(
      jobQueue.baseDelay * Math.pow(2, jobQueue.retryCount),
      jobQueue.maxDelay
    );
    return delay;
  },

  /**
   * Start the job processing loop
   */
  async startProcessing() {
    if (jobQueue.isProcessing) return;
    
    jobQueue.isProcessing = true;
    console.log('🚀 Starting job queue processor...');
    
    // Check database connection before starting
    const isConnected = await jobQueue.checkDatabaseConnection();
    if (!isConnected) {
      console.error('❌ Cannot start job processor - database connection failed');
      jobQueue.isProcessing = false;
      
      // Retry with exponential backoff
      const delay = jobQueue.calculateBackoffDelay();
      jobQueue.retryCount++;
      
      if (jobQueue.retryCount <= jobQueue.maxRetries) {
        console.log(`⏳ Retrying in ${delay / 1000} seconds... (attempt ${jobQueue.retryCount}/${jobQueue.maxRetries})`);
        setTimeout(() => jobQueue.startProcessing(), delay);
      } else {
        console.error('❌ Max retries reached. Job processor stopped.');
      }
      return;
    }
    
    // Reset retry count on successful connection
    jobQueue.retryCount = 0;
    
    jobQueue.processingInterval = setInterval(async () => {
      await jobQueue.processNextJob();
    }, 2000); // Check for jobs every 2 seconds
  },

  /**
   * Stop the job processing loop
   */
  stopProcessing() {
    if (jobQueue.processingInterval) {
      clearInterval(jobQueue.processingInterval);
      jobQueue.processingInterval = null;
    }
    jobQueue.isProcessing = false;
    console.log('⏹️ Job queue processor stopped');
  },

  /**
   * Process the next pending job
   */
  async processNextJob() {
    console.log('🔍 Checking for pending jobs...');
    try {
      // Check database connection before each job
      const isConnected = await jobQueue.checkDatabaseConnection();
      if (!isConnected) {
        console.error('❌ Database connection lost during job processing');
        jobQueue.stopProcessing();
        
        // Try to restart with backoff
        setTimeout(() => jobQueue.startProcessing(), jobQueue.calculateBackoffDelay());
        return;
      }
      // Find all processing jobs
      const uploads = await prisma.upload.findMany({
        where: { 
          status: 'processing'
        },
        orderBy: { createdAt: 'asc' }
      });
      
      if (uploads.length === 0) {
        console.log('✅ No pending jobs found');
        return;
      }
      
      console.log(`📋 Found ${uploads.length} uploads with processing status`);
      
      // Find the first queued job
      let queuedUpload = null;
      for (const upload of uploads) {
        let details = {};
        if (upload.processingDetails) {
          try {
            if (typeof upload.processingDetails === 'string') {
              details = JSON.parse(upload.processingDetails);
            } else {
              details = upload.processingDetails as any;
            }
          } catch (e) {
            details = {};
          }
        }
        
        console.log(`📋 Upload ${upload.id}: stage=${details.stage || 'unknown'}, jobId=${details.jobId || 'none'}`);
        
        // If no stage is set, consider it failed/abandoned
        if (!details.stage && upload.status === 'processing') {
          // Mark as failed if it's been processing for too long without stage
          const uploadAge = Date.now() - upload.createdAt.getTime();
          if (uploadAge > 10 * 60 * 1000) { // 10 minutes
            console.log(`⚠️ Marking abandoned upload ${upload.id} as failed`);
            await prisma.upload.update({
              where: { id: upload.id },
              data: {
                status: 'failed',
                errorMessage: 'Processing abandoned - no stage information'
              }
            });
            continue;
          }
        }
        
        if (details.stage === 'queued') {
          queuedUpload = upload;
          break;
        }
      }
      
      if (!queuedUpload) {
        console.log('✅ No queued jobs found (all are running or completed)');
        return;
      }
      
      const upload = queuedUpload;
      console.log(`🎯 Processing queued job: ${upload.id}`)

      let processingDetails;
      if (typeof upload.processingDetails === 'string') {
        processingDetails = JSON.parse(upload.processingDetails);
      } else {
        processingDetails = upload.processingDetails as any;
      }
      const jobId = processingDetails?.jobId;

      console.log(`🔄 Processing job: ${jobId} for upload ${upload.id}`);

      // Mark as running
      await jobQueue.updateJobStatus(upload.id, 'running', 5, 'Starting extraction...');

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

    } catch (error: any) {
      console.error('❌ Job processing error:', error);
      
      // Check if it's a database connection error
      if (error.code === 'P1001' || error.code === 'P1017' || error.code === 'P2024') {
        console.error('❌ Database connection error detected');
        jobQueue.stopProcessing();
        
        // Try to restart with backoff
        jobQueue.retryCount++;
        const delay = jobQueue.calculateBackoffDelay();
        
        if (jobQueue.retryCount <= jobQueue.maxRetries) {
          console.log(`⏳ Retrying in ${delay / 1000} seconds... (attempt ${jobQueue.retryCount}/${jobQueue.maxRetries})`);
          setTimeout(() => jobQueue.startProcessing(), delay);
        } else {
          console.error('❌ Max retries reached. Job processor stopped.');
        }
      }
    }
  },

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

      let currentDetails;
      try {
        currentDetails = typeof currentUpload.processingDetails === 'string' 
          ? JSON.parse(currentUpload.processingDetails)
          : (currentUpload.processingDetails as any) || {};
      } catch (e) {
        currentDetails = {};
      }
      
      const updatedDetails = {
        ...currentDetails,
        stage,
        progress,
        message,
        lastUpdated: new Date().toISOString(),
        ...(error && { error })
      };

      // Ensure updatedDetails is not null
      if (!updatedDetails || typeof updatedDetails !== 'object') {
        console.error('❌ UpdatedDetails is null or not object, skipping update');
        return;
      }

      await prisma.upload.update({
        where: { id: uploadId },
        data: {
          processingDetails: JSON.stringify(updatedDetails),
          ...(stage === 'completed' && { status: 'completed' }),
          ...(stage === 'failed' && { status: 'failed', errorMessage: error })
        }
      });

      console.log(`📊 Job progress: ${uploadId} - ${stage} (${progress}%) ${message || ''}`);
      
    } catch (error) {
      console.error('❌ Failed to update job status:', error);
    }
  },

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
  },

  /**
   * Cancel a job
   */
  async cancelJob(uploadId: string) {
    await jobQueue.updateJobStatus(uploadId, 'cancelled', 0, 'Job cancelled by user');
  },

  /**
   * Reset stuck jobs from running to queued
   */
  async resetStuckJobs() {
    try {
      console.log('🔄 Resetting stuck jobs...');
      
      const stuckUploads = await prisma.upload.findMany({
        where: { 
          status: 'processing'
        }
      });
      
      let resetCount = 0;
      
      for (const upload of stuckUploads) {
        if (upload.processingDetails) {
          let details;
          if (typeof upload.processingDetails === 'string') {
            details = JSON.parse(upload.processingDetails);
          } else {
            details = upload.processingDetails as any;
          }
          
          if (details.stage === 'running') {
            console.log(`🔄 Resetting upload ${upload.id} from running to queued`);
            
            details.stage = 'queued';
            details.progress = 0;
            details.message = 'Reset to queued for reprocessing';
            
            await prisma.upload.update({
              where: { id: upload.id },
              data: {
                processingDetails: JSON.stringify(details)
              }
            });
            
            resetCount++;
          }
        }
      }
      
      console.log(`✅ Reset ${resetCount} stuck jobs`);
      
      // If we reset any jobs, start processing
      if (resetCount > 0 && !jobQueue.isProcessing) {
        console.log('🚀 Starting processor after reset...');
        jobQueue.startProcessing();
      }
      
      return resetCount;
      
    } catch (error) {
      console.error('❌ Error resetting stuck jobs:', error);
      return 0;
    }
  },

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
          try {
            const details = typeof upload.processingDetails === 'string'
              ? JSON.parse(upload.processingDetails)
              : upload.processingDetails as any;
            return details.stage === 'queued';
          } catch (e) {
            return false;
          }
        }
        return false;
      });

      console.log(`📊 Found ${actuallyQueuedUploads.length} queued jobs`);

      if (actuallyQueuedUploads.length > 0) {
        console.log('🚀 Starting processing for queued jobs...');
        jobQueue.startProcessing();
      } else {
        console.log('✅ No queued jobs found');
      }

    } catch (error) {
      console.error('❌ Error checking for queued jobs:', error);
    }
  }
};