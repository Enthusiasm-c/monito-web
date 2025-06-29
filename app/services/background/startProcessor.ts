/**
 * Background Job Processor Starter
 * Call this to start processing queued jobs
 */

import { jobQueue } from './JobQueue';

let processorStarted = false;

export function startBackgroundProcessor() {
  if (!processorStarted) {
    console.log('🚀 Starting background job processor...');
    
    // Actually start the job queue processing
    const queue = jobQueue;
    
    // Check for existing queued jobs and start processing
    queue.checkAndStartProcessing();
    
    processorStarted = true;
    console.log('✅ Background job processor started');
  }
}

// Auto-start on import (for server-side initialization)
if (typeof window === 'undefined') {
  startBackgroundProcessor();
}