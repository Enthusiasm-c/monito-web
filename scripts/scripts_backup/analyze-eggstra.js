const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeEggstra() {
  console.log('🔍 Analyzing Eggstra PDF upload...');
  
  try {
    const upload = await prisma.upload.findFirst({
      where: {
        originalName: {
          contains: 'EGGSTRA',
          mode: 'insensitive'
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!upload) {
      console.log('❌ No Eggstra upload found');
      return;
    }
    
    console.log('📊 Upload Details:');
    console.log('   File:', upload.originalName);
    console.log('   Blob URL:', upload.filename || upload.url || 'Not available');
    console.log('   Total rows detected:', upload.totalRowsDetected);
    console.log('   Total rows processed:', upload.totalRowsProcessed);
    console.log('   Completeness:', (upload.completenessRatio * 100).toFixed(1) + '%');
    console.log('   Status:', upload.status);
    console.log('   Error message:', upload.errorMessage || 'None');
    console.log('   Processing time:', upload.processingTimeMs + 'ms');
    console.log('   Tokens used:', upload.tokensUsed || 0);
    console.log('   Cost USD:', upload.processingCostUsd || 0);
    
    // Get products for this upload
    const prices = await prisma.price.findMany({
      where: { uploadId: upload.id },
      include: { product: true },
      take: 15
    });
    
    console.log('');
    console.log('🛍️ Found', prices.length, 'products in database:');
    prices.forEach((price, i) => {
      console.log(`   ${i+1}. "${price.product.name}" - ${price.amount} ${price.unit}`);
    });
    
    // Analyze extraction details if available
    if (upload.extractionDetails) {
      console.log('');
      console.log('🔧 Extraction details available - analyzing...');
      
      const details = typeof upload.extractionDetails === 'string' 
        ? JSON.parse(upload.extractionDetails) 
        : upload.extractionDetails;
      
      if (details.extractionMethods) {
        console.log('📋 Extraction methods used:');
        Object.entries(details.extractionMethods).forEach(([method, data]) => {
          if (data && typeof data === 'object') {
            console.log(`   ${method}:`, data);
          } else {
            console.log(`   ${method}:`, data);
          }
        });
        console.log('   Best method:', details.extractionMethods.bestMethod);
      }
      
      if (details.products) {
        console.log('');
        console.log('📦 Products in extraction details:', details.products.length);
        if (details.products.length !== prices.length) {
          console.log(`⚠️ MISMATCH: Extraction found ${details.products.length} products but database has ${prices.length}`);
        }
      }
    }
    
    // Get processing logs (if table exists)
    let logs = [];
    try {
      logs = await prisma.processingLog?.findMany({
        where: { uploadId: upload.id },
        orderBy: { timestamp: 'desc' },
        take: 5
      }) || [];
    } catch (e) {
      console.log('   Processing logs table not found');
    }
    
    if (logs.length > 0) {
      console.log('');
      console.log('📋 Recent processing logs:');
      logs.forEach((log, i) => {
        console.log(`   ${i+1}. ${log.level}: ${log.message}`);
        if (log.details) {
          const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
          console.log('      Details:', Object.keys(details).join(', '));
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error analyzing upload:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeEggstra();