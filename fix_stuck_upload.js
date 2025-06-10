const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixStuckUpload() {
  try {
    const uploadId = 'cmbp2b4jr0002ou8mc90ouuej';
    console.log(`🔧 Fixing stuck upload: ${uploadId}`);
    
    // Update the upload status to failed with an informative message
    const updatedUpload = await prisma.upload.update({
      where: {
        id: uploadId
      },
      data: {
        status: 'failed',
        errorMessage: 'Processing timed out during AI Vision extraction. Server hung and was restarted. PDF contains 138 rows but traditional extraction found 0 products. Camelot extraction found 3 products. Manual reprocessing required.',
        processingDetails: 'Traditional extraction: 138 rows, 0 products. Camelot extraction: 3 products (Plain Yogurt, Raw Milk Cow Glass, etc.). AI Vision processing hung during page-by-page conversion.',
        totalRowsDetected: 138,
        totalRowsProcessed: 0,
        completenessRatio: 0.0,
        updatedAt: new Date()
      }
    });
    
    console.log('✅ Upload status updated to failed');
    console.log('📋 New status:', updatedUpload.status);
    console.log('📋 Error message:', updatedUpload.errorMessage);
    
    // Now let's check for any other stuck uploads
    console.log('\n🔍 Checking for other stuck uploads...');
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