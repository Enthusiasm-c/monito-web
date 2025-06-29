const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeSuccessfulExtraction() {
  try {
    console.log('=== ANALYZING SUCCESSFUL EGGSTRA EXTRACTION ===');
    
    // Get the successful upload details
    const successfulUpload = await prisma.upload.findUnique({
      where: { id: 'cmc03bshm01cxs2kl7rzhe263' },
      include: {
        prices: {
          include: {
            product: true
          },
          take: 10 // Get first 10 products as sample
        },
        supplier: true,
        _count: { select: { prices: true } }
      }
    });
    
    if (!successfulUpload) {
      console.log('❌ Successful upload not found');
      return;
    }
    
    console.log('📊 SUCCESSFUL UPLOAD ANALYSIS:');
    console.log(`   Upload ID: ${successfulUpload.id}`);
    console.log(`   File: ${successfulUpload.originalName}`);
    console.log(`   Status: ${successfulUpload.status}`);
    console.log(`   Total Products: ${successfulUpload._count.prices}`);
    console.log(`   Supplier: ${successfulUpload.supplier?.name}`);
    console.log(`   Created: ${successfulUpload.createdAt}`);
    console.log(`   File URL: ${successfulUpload.url || 'NULL (likely local processing)'}`);
    
    console.log('\n📦 SAMPLE PRODUCTS FROM SUCCESSFUL EXTRACTION:');
    successfulUpload.prices.forEach((price, index) => {
      console.log(`   ${index + 1}. ${price.product?.name || 'UNKNOWN'}`);
      console.log(`      Price: ${price.price} ${price.unit || ''}`);
      console.log(`      Raw Name: ${price.rawProductName || 'N/A'}`);
      console.log(`      Category: ${price.product?.category || 'N/A'}`);
      console.log('      ---');
    });
    
    // Analyze the distribution of products
    console.log('\n📈 PRODUCT STATISTICS:');
    
    // Get all products to analyze patterns
    const allPrices = await prisma.price.findMany({
      where: { uploadId: successfulUpload.id },
      include: { product: true }
    });
    
    // Category distribution
    const categories = {};
    const units = {};
    const priceRanges = { low: 0, medium: 0, high: 0, veryHigh: 0 };
    
    allPrices.forEach(price => {
      // Category analysis
      const category = price.product?.category || 'Unknown';
      categories[category] = (categories[category] || 0) + 1;
      
      // Unit analysis
      const unit = price.unit || 'Unknown';
      units[unit] = (units[unit] || 0) + 1;
      
      // Price range analysis
      const priceAmount = price.price || 0;
      if (priceAmount < 50000) priceRanges.low++;
      else if (priceAmount < 200000) priceRanges.medium++;
      else if (priceAmount < 500000) priceRanges.high++;
      else priceRanges.veryHigh++;
    });
    
    console.log('\n📊 CATEGORY DISTRIBUTION:');
    Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count} products`);
      });
    
    console.log('\n📏 UNIT DISTRIBUTION:');
    Object.entries(units)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([unit, count]) => {
        console.log(`   ${unit}: ${count} products`);
      });
    
    console.log('\n💰 PRICE DISTRIBUTION:');
    console.log(`   Low (< 50k): ${priceRanges.low} products`);
    console.log(`   Medium (50k-200k): ${priceRanges.medium} products`);
    console.log(`   High (200k-500k): ${priceRanges.high} products`);
    console.log(`   Very High (> 500k): ${priceRanges.veryHigh} products`);
    
    // Check if this file is the same as our failed upload
    console.log('\n🔍 FILE COMPARISON:');
    console.log(`   Successful upload file URL: ${successfulUpload.url || 'NULL'}`);
    console.log(`   Failed upload file URL: https://cdc1w79ssc4kg6xh.public.blob.vercel-storage.com/PRICE%20QUOTATATION%20FOR%20EGGSTRA%20CAFE-mcdX8JH1WksMFP4idzTPGdsDloV5Xv.pdf`);
    
    const successfulDate = new Date(successfulUpload.createdAt);
    const failedDate = new Date('2025-06-28T06:51:31.905Z');
    const daysDifference = Math.abs(failedDate - successfulDate) / (1000 * 60 * 60 * 24);
    
    console.log(`   Time difference: ${daysDifference.toFixed(1)} days`);
    console.log(`   This suggests these might be the same PDF file processed at different times`);
    
    // Check extraction data if available
    if (successfulUpload.extractedData) {
      try {
        const data = typeof successfulUpload.extractedData === 'string' 
          ? JSON.parse(successfulUpload.extractedData) 
          : successfulUpload.extractedData;
          
        console.log('\n⚙️ EXTRACTION METHOD DETAILS:');
        console.log(`   Method: ${data.extractionMethods?.bestMethod || 'Not specified'}`);
        console.log(`   Processing time: ${data.processingTimeMs || 'Not available'}ms`);
        console.log(`   Tokens used: ${data.tokensUsed || 0}`);
        console.log(`   Cost: $${data.costUsd || 0}`);
        
      } catch (e) {
        console.log('\n⚙️ EXTRACTION METHOD: Data not parseable or not available');
      }
    } else {
      console.log('\n⚙️ EXTRACTION METHOD: No extraction data stored (likely older processing)');
      console.log('   This suggests it was processed before the current AI Vision system was implemented');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeSuccessfulExtraction();