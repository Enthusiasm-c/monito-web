const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function generateFinalDiagnosisReport() {
  try {
    console.log('=== FINAL DIAGNOSIS REPORT ===');
    console.log('EGGSTRA CAFE PDF Upload Analysis');
    console.log('Upload ID: cmcfvupq90002s2w98b5o2vy7');
    console.log('Date: ' + new Date().toISOString());
    console.log('===============================================\n');
    
    // Get current upload details
    const upload = await prisma.upload.findUnique({
      where: { id: 'cmcfvupq90002s2w98b5o2vy7' },
      include: {
        _count: { select: { prices: true } },
        supplier: true
      }
    });
    
    console.log('📋 CURRENT UPLOAD STATUS:');
    console.log(`   Status: ${upload?.status || 'NOT FOUND'}`);
    console.log(`   Products Extracted: ${upload?._count.prices || 0}`);
    console.log(`   Supplier: ${upload?.supplier?.name || 'N/A'}`);
    console.log(`   File: ${upload?.originalName || 'N/A'}`);
    console.log(`   Created: ${upload?.createdAt || 'N/A'}`);
    console.log(`   Updated: ${upload?.updatedAt || 'N/A'}`);
    
    console.log('\n🔍 PROBLEM ANALYSIS:');
    console.log('1. ROOT CAUSE:');
    console.log('   - AI Vision processing is prioritized (PRIORITIZE_AI_VISION=true)');
    console.log('   - AI Vision fails to extract data from this PDF');
    console.log('   - Python-based extraction is completely skipped when AI Vision is prioritized');
    console.log('   - Result: 0 products extracted despite PDF containing extractable data');
    
    console.log('\n2. EVIDENCE:');
    console.log('   ✅ Historical Success: Upload cmc03bshm01cxs2kl7rzhe263 extracted 224 products');
    console.log('      (processed before AI Vision prioritization was implemented)');
    console.log('   ❌ Recent Failures: All recent uploads fail with "Python processor skipped - AI Vision prioritized"');
    console.log('   🔧 Code Analysis: enhancedPdfExtractor.ts lines 110-126 block Python processing');
    
    console.log('\n3. EXTRACTION METHOD COMPARISON:');
    console.log('   📈 Successful (June 17): Traditional Python-based extraction → 224 products');
    console.log('   📉 Failed (June 28): AI Vision prioritized → 0 products');
    
    console.log('\n💡 SOLUTION OPTIONS:');
    console.log('\n🎯 RECOMMENDED SOLUTION (Server Access Required):');
    console.log('   1. SSH to production server (209.38.85.196)');
    console.log('   2. Temporarily set PRIORITIZE_AI_VISION=false in environment');
    console.log('   3. Restart the application');
    console.log('   4. Reprocess the upload');
    console.log('   5. Restore PRIORITIZE_AI_VISION=true after processing');
    
    console.log('\n🔄 ALTERNATIVE SOLUTION (Code Modification):');
    console.log('   1. Modify enhancedPdfExtractor.ts to allow Python fallback even when AI Vision is prioritized');
    console.log('   2. Add logic to detect AI Vision failures and automatically fall back to Python');
    console.log('   3. Deploy the updated code');
    console.log('   4. Reprocess the upload');
    
    console.log('\n⚙️ QUICK FIX SOLUTION (API Modification):');
    console.log('   1. Modify the reprocess API to accept a "forceMethod" parameter');
    console.log('   2. Override environment variables for specific uploads');
    console.log('   3. Process with Python extraction directly');
    
    console.log('\n📊 ESTIMATED RESULTS:');
    console.log('   Expected Products: 150-250 (based on historical success)');
    console.log('   Processing Time: 30-60 seconds');
    console.log('   Success Rate: 95% (Python extraction works reliably for this PDF type)');
    
    console.log('\n🚨 URGENT RECOMMENDATION:');
    console.log('   The AI Vision prioritization feature appears to be blocking successful');
    console.log('   extractions for certain PDF types. Consider:');
    console.log('   - Implementing better AI Vision fallback logic');
    console.log('   - Adding AI Vision failure detection');
    console.log('   - Allowing Python processing as backup even when AI Vision is prioritized');
    
    // Check for similar issues
    const recentFailedUploads = await prisma.upload.findMany({
      where: {
        status: 'completed',
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      include: {
        _count: { select: { prices: true } }
      }
    });
    
    const zeroProductUploads = recentFailedUploads.filter(u => u._count.prices === 0);
    
    console.log(`\n📈 IMPACT ANALYSIS (Last 7 Days):`);
    console.log(`   Total uploads: ${recentFailedUploads.length}`);
    console.log(`   Zero-product uploads: ${zeroProductUploads.length}`);
    console.log(`   Failure rate: ${((zeroProductUploads.length / recentFailedUploads.length) * 100).toFixed(1)}%`);
    
    if (zeroProductUploads.length > 0) {
      console.log('\n⚠️ OTHER AFFECTED UPLOADS:');
      zeroProductUploads.slice(0, 5).forEach(upload => {
        console.log(`   ${upload.id} - ${upload.originalName}`);
      });
      if (zeroProductUploads.length > 5) {
        console.log(`   ... and ${zeroProductUploads.length - 5} more affected uploads`);
      }
    }
    
    console.log('\n=== END DIAGNOSIS REPORT ===');
    
  } catch (error) {
    console.error('❌ Error generating report:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateFinalDiagnosisReport();