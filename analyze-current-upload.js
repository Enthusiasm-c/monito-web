const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeCurrentUpload() {
  try {
    // Get the most recent upload that's currently processing
    const currentUpload = await prisma.upload.findFirst({
      where: {
        status: 'processing'
      },
      orderBy: { createdAt: 'desc' },
      include: {
        prices: {
          take: 5,
          orderBy: { createdAt: 'desc' }
        },
        supplier: true,
        _count: {
          select: { 
            prices: true,
            unmatchedQueue: true
          }
        }
      }
    });

    if (!currentUpload) {
      console.log('No uploads currently processing');
      
      // Get the most recent upload regardless of status
      const recentUpload = await prisma.upload.findFirst({
        orderBy: { createdAt: 'desc' },
        include: {
          prices: {
            take: 5,
            orderBy: { createdAt: 'desc' }
          },
          supplier: true,
          _count: {
            select: { 
              prices: true,
              unmatchedQueue: true
            }
          }
        }
      });

      if (recentUpload) {
        console.log('\n=== MOST RECENT UPLOAD ===');
        console.log(`ID: ${recentUpload.id}`);
        console.log(`File: ${recentUpload.fileName}`);
        console.log(`Status: ${recentUpload.status}`);
        console.log(`Supplier: ${recentUpload.supplier?.name || 'Unknown'}`);
        console.log(`Created: ${recentUpload.createdAt}`);
        console.log(`Updated: ${recentUpload.updatedAt}`);
        console.log(`Processing Time: ${recentUpload.processingTimeMs || 0}ms`);
        console.log(`Prices Created: ${recentUpload._count.prices}`);
        console.log(`Unmatched Items: ${recentUpload._count.unmatchedQueue}`);
        console.log(`File Type: ${recentUpload.fileType}`);
        console.log(`File Size: ${recentUpload.fileSize} bytes`);
        
        if (recentUpload.errorMessage) {
          console.log(`\nError Message: ${recentUpload.errorMessage}`);
        }

        if (recentUpload.prices.length > 0) {
          console.log('\n--- Recent Prices Created ---');
          recentUpload.prices.forEach((price, index) => {
            console.log(`${index + 1}. ${price.productName} - ${price.price} (${price.unit})`);
          });
        }
      }
      return;
    }

    console.log('=== CURRENTLY PROCESSING UPLOAD ===');
    console.log(`ID: ${currentUpload.id}`);
    console.log(`File: ${currentUpload.fileName}`);
    console.log(`Status: ${currentUpload.status}`);
    console.log(`Supplier: ${currentUpload.supplier?.name || 'Unknown'}`);
    console.log(`Created: ${currentUpload.createdAt}`);
    console.log(`Updated: ${currentUpload.updatedAt}`);
    console.log(`Processing Time: ${Date.now() - new Date(currentUpload.createdAt).getTime()}ms (elapsed)`);
    console.log(`Prices Created: ${currentUpload._count.prices}`);
    console.log(`Unmatched Items: ${currentUpload._count.unmatchedQueue}`);
    console.log(`File Type: ${currentUpload.fileType}`);
    console.log(`File Size: ${currentUpload.fileSize} bytes`);

    // Check if this upload might be stuck
    const processingTime = Date.now() - new Date(currentUpload.createdAt).getTime();
    const maxProcessingTime = 10 * 60 * 1000; // 10 minutes

    if (processingTime > maxProcessingTime) {
      console.log('\n⚠️  WARNING: Upload has been processing for more than 10 minutes - might be stuck!');
    }

    if (currentUpload.errorMessage) {
      console.log(`\nError Message: ${currentUpload.errorMessage}`);
    }

    if (currentUpload.prices.length > 0) {
      console.log('\n--- Recent Prices Created ---');
      currentUpload.prices.forEach((price, index) => {
        console.log(`${index + 1}. ${price.productName} - ${price.price} (${price.unit})`);
      });
    }

    // Check for any recent failed uploads for context
    const recentFailures = await prisma.upload.findMany({
      where: {
        status: 'failed',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        fileName: true,
        errorMessage: true,
        createdAt: true
      }
    });

    if (recentFailures.length > 0) {
      console.log('\n=== RECENT FAILURES (Last 24h) ===');
      recentFailures.forEach((failure, index) => {
        console.log(`${index + 1}. ${failure.fileName} (${failure.createdAt})`);
        if (failure.errorMessage) {
          console.log(`   Error: ${failure.errorMessage}`);
        }
        console.log('');
      });
    }

  } catch (error) {
    console.error('Error analyzing upload:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeCurrentUpload();