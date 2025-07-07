const { PrismaClient } = require('@prisma/client');

async function debugWidiProcessing() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Debugging recent Widi Wiguna upload processing...');
    
    // Get the most recent Widi upload
    const recentUpload = await prisma.upload.findFirst({
      where: {
        fileName: {
          contains: 'Widi Wiguna 03_07',
          mode: 'insensitive'
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (!recentUpload) {
      console.log('❌ No Widi Wiguna 03_07 upload found');
      return;
    }
    
    console.log(`📄 Upload Details:`);
    console.log(`   ID: ${recentUpload.id}`);
    console.log(`   File: ${recentUpload.fileName}`);
    console.log(`   Status: ${recentUpload.status}`);
    console.log(`   Size: ${recentUpload.fileSize} bytes`);
    console.log(`   Created: ${recentUpload.createdAt.toISOString()}`);
    console.log(`   Updated: ${recentUpload.updatedAt.toISOString()}`);
    
    // Check metadata for processing details
    if (recentUpload.metadata) {
      try {
        const metadata = JSON.parse(recentUpload.metadata);
        console.log(`\n📊 Processing Metadata:`);
        
        if (metadata.error) {
          console.log(`   ❌ Error: ${metadata.error}`);
        }
        
        if (metadata.processor) {
          console.log(`   🔧 Processor: ${metadata.processor}`);
        }
        
        if (metadata.extractionQuality !== undefined) {
          console.log(`   📈 Extraction Quality: ${metadata.extractionQuality}`);
        }
        
        if (metadata.totalProducts !== undefined) {
          console.log(`   📦 Total Products: ${metadata.totalProducts}`);
        }
        
        if (metadata.processingTime) {
          console.log(`   ⏱️ Processing Time: ${metadata.processingTime}ms`);
        }
        
        if (metadata.fallbackUsed) {
          console.log(`   ⚡ Fallback mechanism was used`);
        }
        
        // Log full metadata for debugging
        console.log(`\n🔍 Full Metadata:`);
        console.log(JSON.stringify(metadata, null, 2));
        
      } catch (e) {
        console.log(`   ⚠️ Could not parse metadata: ${recentUpload.metadata}`);
      }
    } else {
      console.log(`   ⚠️ No metadata available`);
    }
    
    // Check if there were any processing attempts
    console.log(`\n🔍 Checking database for processing traces...`);
    
    // Look for any products that might have been created but not linked
    const orphanedProducts = await prisma.product.findMany({
      where: {
        createdAt: {
          gte: new Date(recentUpload.createdAt.getTime() - 5 * 60 * 1000), // 5 minutes before upload
          lte: new Date(recentUpload.createdAt.getTime() + 30 * 60 * 1000)  // 30 minutes after upload
        }
      },
      include: {
        prices: {
          where: {
            uploadId: recentUpload.id
          }
        }
      },
      take: 10
    });
    
    if (orphanedProducts.length > 0) {
      console.log(`📦 Found ${orphanedProducts.length} products created around upload time:`);
      orphanedProducts.forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.name} - Linked prices: ${product.prices.length}`);
      });
    } else {
      console.log(`📭 No products found created around upload time`);
    }
    
    // Check for any error logs in recent uploads with similar timestamps
    const recentFailures = await prisma.upload.findMany({
      where: {
        status: {
          in: ['failed', 'error']
        },
        createdAt: {
          gte: new Date(Date.now() - 2 * 60 * 60 * 1000) // Last 2 hours
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });
    
    if (recentFailures.length > 0) {
      console.log(`\n⚠️ Recent failed uploads (last 2 hours):`);
      recentFailures.forEach((upload, index) => {
        console.log(`   ${index + 1}. ${upload.fileName} - ${upload.status}`);
        if (upload.metadata) {
          try {
            const metadata = JSON.parse(upload.metadata);
            if (metadata.error) {
              console.log(`      Error: ${metadata.error}`);
            }
          } catch (e) {
            // Ignore
          }
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error debugging processing:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugWidiProcessing();