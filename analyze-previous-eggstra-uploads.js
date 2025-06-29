const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzePreviousEggstraUploads() {
  try {
    console.log('=== ANALYZING PREVIOUS EGGSTRA CAFE UPLOADS ===');
    
    // Find all EGGSTRA CAFE uploads
    const eggstraUploads = await prisma.upload.findMany({
      where: {
        originalName: {
          contains: 'EGGSTRA CAFE',
          mode: 'insensitive'
        }
      },
      include: {
        _count: { select: { prices: true } },
        supplier: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`Found ${eggstraUploads.length} EGGSTRA CAFE uploads:`);
    console.log('=====================================');
    
    eggstraUploads.forEach((upload, index) => {
      console.log(`\n${index + 1}. Upload ID: ${upload.id}`);
      console.log(`   Status: ${upload.status}`);
      console.log(`   Products: ${upload._count.prices}`);
      console.log(`   Supplier: ${upload.supplier?.name || 'N/A'}`);
      console.log(`   Created: ${upload.createdAt}`);
      console.log(`   File URL: ${upload.url}`);
      
      if (upload.extractedData) {
        try {
          const data = typeof upload.extractedData === 'string' 
            ? JSON.parse(upload.extractedData) 
            : upload.extractedData;
            
          console.log(`   Extraction Method: ${data.extractionMethods?.bestMethod || 'N/A'}`);
          console.log(`   Rows Detected: ${data.totalRowsDetected || 0}`);
          console.log(`   Rows Processed: ${data.totalRowsProcessed || 0}`);
          console.log(`   Completeness: ${(data.completenessRatio * 100).toFixed(1)}%`);
          console.log(`   Processing Time: ${data.processingTimeMs || 0}ms`);
          console.log(`   Tokens Used: ${data.tokensUsed || 0}`);
          console.log(`   Cost: $${data.costUsd || 0}`);
          
          if (data.errors && data.errors.length > 0) {
            console.log(`   Errors: ${data.errors.join(', ')}`);
          }
          
          if (data.products && data.products.length > 0) {
            console.log(`   Sample Products:`);
            data.products.slice(0, 3).forEach((product, i) => {
              console.log(`     ${i + 1}. ${product.cleanedName || product.name} - ${product.price} ${product.unit}`);
            });
            if (data.products.length > 3) {
              console.log(`     ... and ${data.products.length - 3} more`);
            }
          }
          
        } catch (e) {
          console.log(`   Raw Extraction Data: ${JSON.stringify(upload.extractedData).substring(0, 200)}...`);
        }
      } else {
        console.log(`   No extraction data available`);
      }
      
      if (upload.processingDetails) {
        try {
          const details = typeof upload.processingDetails === 'string' 
            ? JSON.parse(upload.processingDetails) 
            : upload.processingDetails;
          console.log(`   Processing Stage: ${details.stage}`);
          console.log(`   Progress: ${details.progress}%`);
        } catch (e) {
          // Ignore parsing errors
        }
      }
    });
    
    // Analyze successful vs failed uploads
    const successfulUploads = eggstraUploads.filter(u => u._count.prices > 0);
    const failedUploads = eggstraUploads.filter(u => u._count.prices === 0);
    
    console.log('\n=== ANALYSIS SUMMARY ===');
    console.log(`Total uploads: ${eggstraUploads.length}`);
    console.log(`Successful (with products): ${successfulUploads.length}`);
    console.log(`Failed (no products): ${failedUploads.length}`);
    
    if (successfulUploads.length > 0) {
      console.log('\n✅ SUCCESSFUL UPLOADS:');
      successfulUploads.forEach(upload => {
        const data = upload.extractedData;
        const method = data?.extractionMethods?.bestMethod || 'unknown';
        console.log(`   ${upload.id}: ${upload._count.prices} products via ${method}`);
      });
      
      // Find the most successful extraction method
      const methods = {};
      successfulUploads.forEach(upload => {
        const method = upload.extractedData?.extractionMethods?.bestMethod || 'unknown';
        methods[method] = (methods[method] || 0) + 1;
      });
      
      console.log('\n📊 SUCCESSFUL EXTRACTION METHODS:');
      Object.entries(methods).forEach(([method, count]) => {
        console.log(`   ${method}: ${count} times`);
      });
    }
    
    if (failedUploads.length > 0) {
      console.log('\n❌ FAILED UPLOADS:');
      failedUploads.forEach(upload => {
        const data = upload.extractedData;
        const method = data?.extractionMethods?.bestMethod || 'unknown';
        const errors = data?.errors || [];
        console.log(`   ${upload.id}: ${method} - ${errors.join(', ')}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzePreviousEggstraUploads();