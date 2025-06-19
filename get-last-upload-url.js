import { prisma } from 'lib/prisma';

const { PrismaClient } = require('@prisma/client');


async function getLastUploadUrl() {
  try {
    const lastUpload = await prisma.upload.findFirst({
      orderBy: { createdAt: 'desc' }
    });
    
    if (lastUpload) {
      console.log('Last upload:');
      console.log('ID:', lastUpload.id);
      console.log('File:', lastUpload.originalName);
      console.log('URL:', lastUpload.url);
      console.log('Status:', lastUpload.status);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getLastUploadUrl();
