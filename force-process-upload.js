const { PrismaClient } = require('@prisma/client');

async function forceProcessUpload() {
  // Import the job queue
  const { jobQueue } = require('./app/services/background/JobQueue.ts');
  
  const uploadId = 'cmcfv6g8d0002s2jzp2oab2zc';
  
  try {
    console.log('=== FORCE PROCESSING UPLOAD ===');
    console.log(`Upload ID: ${uploadId}`);
    
    // Get current status
    const status = await jobQueue.getJobStatus(uploadId);
    console.log('Current Status:', status);
    
    // Update status to trigger processing
    await jobQueue.updateJobStatus(uploadId, 'queued', 0, 'Manually triggering processing...');
    
    console.log('✅ Triggered processing');
    console.log('Background processor should pick this up within 2 seconds...');
    
    // Monitor for a few seconds
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const newStatus = await jobQueue.getJobStatus(uploadId);
      console.log(`Check ${i + 1}:`, newStatus);
      
      if (newStatus && newStatus.stage !== 'queued') {
        console.log('✅ Processing started!');
        break;
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

forceProcessUpload();