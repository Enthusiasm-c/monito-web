import { prisma } from 'lib/prisma';

const { PrismaClient } = require('@prisma/client');


async function checkUpload() {
  try {
    const upload = await prisma.upload.findFirst({
      where: { id: 'upload_1749728116237_70ryc6g8k' },
      include: { supplier: true }
    });
    
    if (upload) {
      console.log('📁 Upload details:');
      console.log('   Status:', upload.status);
      console.log('   Error:', upload.errorMessage);
      console.log('   Processing details:', upload.processingDetails);
      console.log('   File URL:', upload.url);
      console.log('   Supplier:', upload.supplier.name);
    } else {
      console.log('Upload not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUpload();