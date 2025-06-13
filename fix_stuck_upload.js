const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixStuckUpload() {
  try {
    // Check for stuck uploads
    console.log('🔍 Checking for stuck uploads...');
    const stuckUploads = await prisma.upload.findMany({
      where: {
        status: 'processing',
        createdAt: {
          lt: new Date(Date.now() - 5 * 60 * 1000) // Older than 5 minutes
        }
      },
      select: {
        id: true,
        originalName: true,
        status: true,
        createdAt: true,
        supplier: {
          select: {
            name: true
          }
        }
      }
    });
    
    if (stuckUploads.length > 0) {
      console.log(`⚠️ Found ${stuckUploads.length} other stuck uploads:`);
      stuckUploads.forEach(upload => {
        console.log(`  - ${upload.originalName} (${upload.id}) - ${upload.supplier.name} - ${upload.createdAt}`);
      });
      
      console.log('\n🔧 Updating stuck uploads...');
      const updateResult = await prisma.upload.updateMany({
        where: {
          status: 'processing',
          createdAt: {
            lt: new Date(Date.now() - 5 * 60 * 1000)
          }
        },
        data: {
          status: 'failed',
          errorMessage: 'Processing timed out - likely due to server restart during AI processing',
          updatedAt: new Date()
        }
      });
      
      console.log(`✅ Updated ${updateResult.count} stuck uploads`);
    } else {
      console.log('✅ No other stuck uploads found');
    }
    
  } catch (error) {
    console.error('❌ Error fixing stuck upload:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixStuckUpload();