const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function retryStuckUpload() {
  try {
    // Find the stuck upload
    const stuckUpload = await prisma.upload.findFirst({
      where: {
        status: 'processing',
        id: 'upload_1749778817851_q9us4cjf7'
      }
    });
    
    if (stuckUpload) {
      console.log('Found stuck upload:', stuckUpload.id);
      
      // Reset to pending
      await prisma.upload.update({
        where: { id: stuckUpload.id },
        data: { status: 'pending' }
      });
      
      console.log('Reset to pending status');
      
      // Trigger reprocessing
      const { enhancedFileProcessor } = require('./app/services/enhancedFileProcessor');
      console.log('Starting reprocessing...');
      
      const result = await enhancedFileProcessor.processFile(stuckUpload.id);
      console.log('Processing result:', result);
    } else {
      console.log('No stuck upload found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

retryStuckUpload();
