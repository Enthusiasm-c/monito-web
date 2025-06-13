// Принудительное исправление всех processing uploads
const { PrismaClient } = require('@prisma/client');

async function forceFixProcessing() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔧 Force fixing all processing uploads...');
    
    // Найдем все uploads в статусе processing
    const processingUploads = await prisma.upload.findMany({
      where: {
        status: 'processing'
      }
    });
    
    console.log(`📋 Found ${processingUploads.length} processing uploads`);
    
    for (const upload of processingUploads) {
      console.log(`\n🔧 Force fixing: ${upload.originalName} (${upload.id})`);
      
      // Помечаем как failed с объяснением
      await prisma.upload.update({
        where: { id: upload.id },
        data: {
          status: 'failed',
          approvalStatus: 'rejected',
          errorMessage: 'AI processing timeout - this usually means the file format is not supported or the AI service is unavailable. Please try re-uploading.'
        }
      });
      
      console.log(`✅ Fixed: ${upload.originalName}`);
    }
    
    console.log('\n🎉 All processing uploads have been fixed!');
    
  } catch (error) {
    console.error('❌ Force fix error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

forceFixProcessing();