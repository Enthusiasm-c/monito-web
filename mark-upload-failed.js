const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function markUploadFailed() {
  try {
    const result = await prisma.upload.update({
      where: { id: 'upload_1749778817851_q9us4cjf7' },
      data: { 
        status: 'failed',
        errorMessage: 'PDF processing stuck - parsing error'
      }
    });
    
    console.log('Upload marked as failed:', result.id);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

markUploadFailed();
