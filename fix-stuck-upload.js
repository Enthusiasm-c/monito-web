const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixStuckUpload() {
  try {
    const uploadId = 'cmcfv6g8d0002s2jzp2oab2zc';
    
    console.log('=== FIXING STUCK UPLOAD ===');
    console.log(`Upload ID: ${uploadId}`);
    
    // Get current state
    const upload = await prisma.upload.findUnique({
      where: { id: uploadId }
    });
    
    if (!upload) {
      console.log('Upload not found');
      return;
    }
    
    console.log(`Current status: ${upload.status}`);
    const processingTime = Date.now() - new Date(upload.createdAt).getTime();
    console.log(`Processing time: ${Math.round(processingTime / 1000)} seconds`);
    
    // Mark as failed with detailed error message
    const errorMessage = `Background processor timeout: Upload was stuck in 'queued' stage for ${Math.round(processingTime / 1000)} seconds. This indicates the background job processor is not running or is unable to pick up queued jobs. The file is stored at: ${upload.url}`;
    
    const result = await prisma.upload.update({
      where: { id: uploadId },
      data: {
        status: 'failed',
        errorMessage: errorMessage,
        processingDetails: JSON.stringify({
          ...JSON.parse(upload.processingDetails || '{}'),
          stage: 'failed',
          progress: 0,
          error: 'Background processor timeout',
          failedAt: new Date().toISOString(),
          reason: 'Background processor not responding'
        })
      }
    });
    
    console.log('✅ Upload marked as failed');
    console.log('Error message:', errorMessage);
    
    // Also check for other stuck uploads
    const otherStuckUploads = await prisma.upload.findMany({
      where: {
        status: 'processing',
        createdAt: {
          lte: new Date(Date.now() - 10 * 60 * 1000) // Older than 10 minutes
        }
      }
    });
    
    if (otherStuckUploads.length > 0) {
      console.log(`\n⚠️ Found ${otherStuckUploads.length} other stuck uploads`);
      console.log('These should also be investigated:');
      otherStuckUploads.forEach(u => {
        const time = Math.round((Date.now() - new Date(u.createdAt).getTime()) / 60000);
        console.log(`  ${u.id} - ${u.originalName} (${time} minutes)`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixStuckUpload();