const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugBackgroundProcessor() {
  try {
    console.log('=== BACKGROUND PROCESSOR DEBUG ===');
    
    // Check all processing uploads
    const processingUploads = await prisma.upload.findMany({
      where: { status: 'processing' },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`Found ${processingUploads.length} uploads in processing status:`);
    
    processingUploads.forEach(upload => {
      console.log(`\nUpload: ${upload.id}`);
      console.log(`  File: ${upload.originalName}`);
      console.log(`  Created: ${upload.createdAt}`);
      console.log(`  Updated: ${upload.updatedAt}`);
      console.log(`  Processing Time: ${Date.now() - new Date(upload.createdAt).getTime()}ms`);
      
      if (upload.processingDetails) {
        try {
          const details = typeof upload.processingDetails === 'string' 
            ? JSON.parse(upload.processingDetails) 
            : upload.processingDetails;
          console.log(`  Stage: ${details.stage || 'unknown'}`);
          console.log(`  Progress: ${details.progress || 0}%`);
          console.log(`  Message: ${details.message || 'none'}`);
          console.log(`  Job ID: ${details.jobId || 'none'}`);
          
          if (details.lastUpdated) {
            const lastUpdate = new Date(details.lastUpdated);
            const timeSinceUpdate = Date.now() - lastUpdate.getTime();
            console.log(`  Last Updated: ${lastUpdate} (${timeSinceUpdate}ms ago)`);
          }
        } catch (e) {
          console.log(`  Raw Details: ${upload.processingDetails}`);
        }
      }
    });
    
    // Check for stuck uploads (processing > 15 minutes)
    const stuckUploads = processingUploads.filter(upload => {
      const processingTime = Date.now() - new Date(upload.createdAt).getTime();
      return processingTime > 15 * 60 * 1000; // 15 minutes
    });
    
    if (stuckUploads.length > 0) {
      console.log('\n⚠️ STUCK UPLOADS DETECTED:');
      stuckUploads.forEach(upload => {
        const processingTime = Date.now() - new Date(upload.createdAt).getTime();
        console.log(`  ${upload.id} - ${Math.round(processingTime / 60000)} minutes`);
      });
      
      console.log('\n🔧 Recommendation: These uploads should be marked as failed or reprocessed.');
    }
    
    // Analyze the specific upload
    const targetUploadId = 'cmcfvupq90002s2w98b5o2vy7';
    const targetUpload = processingUploads.find(u => u.id === targetUploadId);
    if (targetUpload) {
      console.log('\n=== TARGET UPLOAD ANALYSIS ===');
      const processingTime = Date.now() - new Date(targetUpload.createdAt).getTime();
      console.log(`Processing time: ${Math.round(processingTime / 1000)} seconds`);
      
      if (processingTime > 10 * 60 * 1000) {
        console.log('⚠️ This upload has been processing for more than 10 minutes');
        console.log('   This suggests the background processor is not working properly');
      }
      
      // Check file accessibility
      if (targetUpload.url) {
        console.log(`File URL: ${targetUpload.url}`);
        console.log('File appears to be stored in Vercel Blob Storage');
      }
    } else {
      console.log('\n=== TARGET UPLOAD NOT IN PROCESSING STATUS ===');
      // Check if the upload exists at all
      const specificUpload = await prisma.upload.findUnique({
        where: { id: targetUploadId },
        include: {
          _count: { select: { prices: true } }
        }
      });
      
      if (specificUpload) {
        console.log(`Upload found with status: ${specificUpload.status}`);
        console.log(`Products extracted: ${specificUpload._count.prices}`);
        console.log(`Created: ${specificUpload.createdAt}`);
        console.log(`Updated: ${specificUpload.updatedAt}`);
        
        if (specificUpload.processingDetails) {
          try {
            const details = typeof specificUpload.processingDetails === 'string' 
              ? JSON.parse(specificUpload.processingDetails) 
              : specificUpload.processingDetails;
            console.log('Processing Details:', JSON.stringify(details, null, 2));
          } catch (e) {
            console.log('Raw Processing Details:', specificUpload.processingDetails);
          }
        }
        
        if (specificUpload.status === 'completed' && specificUpload._count.prices === 0) {
          console.log('\n⚠️ ISSUE DETECTED: Upload is marked as completed but has 0 products');
          console.log('   This suggests the processing failed or was incomplete');
        }
      } else {
        console.log('Upload not found in database');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugBackgroundProcessor();