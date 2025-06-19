import { prisma } from 'lib/prisma';

// Скрипт для исправления застрявших uploads в статусе processing
const { PrismaClient } = require('@prisma/client');

async function fixStuckUploads() {
  
  
  try {
    console.log('🔄 Fixing stuck uploads in processing status...');
    
    // Найдем uploads в статусе processing более 5 минут назад
    const stuckUploads = await prisma.upload.findMany({
      where: {
        status: 'processing',
        createdAt: {
          lt: new Date(Date.now() - 5 * 60 * 1000) // 5 минут назад
        }
      }
    });
    
    console.log(`📋 Found ${stuckUploads.length} stuck uploads`);
    
    for (const upload of stuckUploads) {
      console.log(`\n🔧 Fixing upload: ${upload.originalName} (${upload.id})`);
      
      // Помечаем как failed
      await prisma.upload.update({
        where: { id: upload.id },
        data: {
          status: 'failed',
          approvalStatus: 'rejected',
          errorMessage: 'Processing timeout - please try uploading again'
        }
      });
      
      console.log(`✅ Marked as failed: ${upload.originalName}`);
    }
    
    // Проверяем текущие uploads в processing
    const currentProcessing = await prisma.upload.findMany({
      where: {
        status: 'processing'
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`\n📊 Current processing uploads: ${currentProcessing.length}`);
    currentProcessing.forEach((upload, index) => {
      const minutesAgo = Math.round((Date.now() - upload.createdAt.getTime()) / (1000 * 60));
      console.log(`${index + 1}. ${upload.originalName} - ${minutesAgo} minutes ago`);
    });
    
    console.log('\n🎉 Cleanup completed!');
    
  } catch (error) {
    console.error('❌ Fix error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixStuckUploads();