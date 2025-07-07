const { PrismaClient } = require('@prisma/client');

async function checkRecentUploads() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Checking all recent uploads (last 30 minutes)...');
    
    const recentUploads = await prisma.upload.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 60 * 1000) // Last 30 minutes
        }
      },
      include: {
        supplier: true,
        prices: {
          include: {
            product: true
          },
          take: 3
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });
    
    if (recentUploads.length === 0) {
      console.log('📭 No uploads found in the last 30 minutes');
      return;
    }
    
    console.log(`✅ Found ${recentUploads.length} recent uploads:`);
    
    recentUploads.forEach((upload, index) => {
      console.log(`\n${index + 1}. Upload ID: ${upload.id}`);
      console.log(`   File: ${upload.fileName}`);
      console.log(`   Status: ${upload.status}`);
      console.log(`   Created: ${upload.createdAt.toISOString()}`);
      console.log(`   Updated: ${upload.updatedAt.toISOString()}`);
      console.log(`   Supplier: ${upload.supplier?.name || 'Unknown'}`);
      console.log(`   🎯 PRODUCTS DETECTED: ${upload.prices?.length || 0}`);
      
      // Check processing time
      const processingTime = upload.updatedAt.getTime() - upload.createdAt.getTime();
      console.log(`   ⏱️ Processing time: ${Math.round(processingTime / 1000)} seconds`);
      
      if (upload.metadata) {
        try {
          const metadata = JSON.parse(upload.metadata);
          if (metadata.error) {
            console.log(`   ❌ Error: ${metadata.error}`);
          }
          if (metadata.processor) {
            console.log(`   🔧 Processor: ${metadata.processor}`);
          }
          if (metadata.fallbackUsed) {
            console.log(`   ⚡ Fallback was used`);
          }
        } catch (e) {
          // Ignore metadata parsing errors
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking uploads:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecentUploads();