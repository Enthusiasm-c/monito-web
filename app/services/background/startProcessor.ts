/**
 * Background Job Processor Starter
 * Call this to start processing queued jobs
 */

import { jobQueue } from './JobQueue';

let processorStarted = false;

export function startBackgroundProcessor() {
  if (!processorStarted) {
    console.log('🚀 Starting background job processor...');
    // The job queue singleton is already started when imported
    // Just mark as started
    processorStarted = true;
    console.log('✅ Background job processor started');
  }
}

// Auto-start on import (for server-side initialization)
if (typeof window === 'undefined') {
  startBackgroundProcessor();
}