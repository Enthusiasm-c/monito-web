const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

const prisma = new PrismaClient();

async function forcePythonExtraction() {
  const uploadId = 'cmcfvupq90002s2w98b5o2vy7';
  const apiUrl = 'http://209.38.85.196:3000';
  
  try {
    console.log('=== FORCING PYTHON-BASED EXTRACTION ===');
    console.log(`Upload ID: ${uploadId}`);
    
    // First, reset the upload to pending and clear the failed AI Vision data
    console.log('\n1. Resetting upload status...');
    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        status: 'pending',
        approvalStatus: 'processing',
        extractedData: null,
        errorMessage: null,
        processingDetails: JSON.stringify({
          stage: 'queued',
          progress: 0,
          batchSize: 25,
          forceMethod: 'python_extraction', // Force Python extraction
          disableAiVision: true // Disable AI Vision for this processing
        })
      }
    });
    console.log('✅ Upload status reset to pending');
    
    // Check current environment variables that might affect processing
    console.log('\n2. Checking processing configuration...');
    console.log('   PRIORITIZE_AI_VISION should be temporarily disabled for this upload');
    console.log('   The processing will use Python-based PDF extraction instead');
    
    // Create a custom reprocess request that forces Python extraction
    console.log('\n3. Triggering Python-based reprocessing...');
    const reprocessResponse = await fetch(`${apiUrl}/api/admin/uploads/reprocess`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        uploadId,
        forceMethod: 'python_extraction',
        disableAiVision: true
      })
    });
    
    console.log(`   Response status: ${reprocessResponse.status}`);
    const result = await reprocessResponse.json();
    console.log('   Response:', JSON.stringify(result, null, 2));
    
    if (!reprocessResponse.ok) {
      console.log('❌ Reprocess request failed');
      return;
    }
    
    console.log('✅ Python extraction triggered');
    
    // Monitor processing more frequently since we know it should work
    console.log('\n4. Monitoring processing (expecting 100+ products based on previous success)...');
    
    for (let i = 0; i < 60; i++) { // Monitor for 10 minutes
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      
      const currentUpload = await prisma.upload.findUnique({
        where: { id: uploadId },
        include: {
          _count: { select: { prices: true } }
        }
      });
      
      if (currentUpload) {
        console.log(`   Check ${i + 1}: Status=${currentUpload.status}, Products=${currentUpload._count.prices}`);
        
        if (currentUpload.processingDetails) {
          try {
            const details = typeof currentUpload.processingDetails === 'string' 
              ? JSON.parse(currentUpload.processingDetails) 
              : currentUpload.processingDetails;
            console.log(`              Stage=${details.stage}, Progress=${details.progress}%`);
          } catch (e) {
            // Ignore parsing errors
          }
        }
        
        if (currentUpload.extractedData) {
          try {
            const data = typeof currentUpload.extractedData === 'string' 
              ? JSON.parse(currentUpload.extractedData) 
              : currentUpload.extractedData;
            if (data.totalRowsDetected > 0) {
              console.log(`              Rows detected: ${data.totalRowsDetected}, Processed: ${data.totalRowsProcessed}`);
              console.log(`              Method: ${data.extractionMethods?.bestMethod}`);
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
        
        if (currentUpload.status === 'completed') {
          console.log(`\n🎉 Processing completed!`);
          console.log(`   Final product count: ${currentUpload._count.prices}`);
          
          // Get detailed extraction information
          if (currentUpload.extractedData) {
            try {
              const data = typeof currentUpload.extractedData === 'string' 
                ? JSON.parse(currentUpload.extractedData) 
                : currentUpload.extractedData;
              
              console.log('\n📊 EXTRACTION SUMMARY:');
              console.log(`   Method used: ${data.extractionMethods?.bestMethod || 'unknown'}`);
              console.log(`   Rows detected: ${data.totalRowsDetected || 0}`);
              console.log(`   Rows processed: ${data.totalRowsProcessed || 0}`);
              console.log(`   Completeness: ${((data.completenessRatio || 0) * 100).toFixed(1)}%`);
              console.log(`   Processing time: ${data.processingTimeMs || 0}ms`);
              console.log(`   Tokens used: ${data.tokensUsed || 0}`);
              console.log(`   Cost: $${data.costUsd || 0}`);
              
              if (data.products && data.products.length > 0) {
                console.log(`\n📦 SAMPLE PRODUCTS (first 5):`);
                data.products.slice(0, 5).forEach((product, i) => {
                  console.log(`   ${i + 1}. ${product.cleanedName || product.name} - ${product.price} ${product.unit}`);
                });
              }
              
              if (data.errors && data.errors.length > 0) {
                console.log(`\n⚠️ Processing errors: ${data.errors.length}`);
                data.errors.slice(0, 3).forEach(error => {
                  console.log(`   - ${error}`);
                });
              }
              
            } catch (e) {
              console.log('   Could not parse extraction data');
            }
          }
          break;
        }
        
        if (currentUpload.status === 'failed') {
          console.log(`\n❌ Processing failed!`);
          if (currentUpload.errorMessage) {
            console.log(`   Error: ${currentUpload.errorMessage}`);
          }
          break;
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

forcePythonExtraction();