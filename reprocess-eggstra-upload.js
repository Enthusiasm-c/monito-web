const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function reprocessEggstraUpload() {
  const uploadId = 'cmcfvupq90002s2w98b5o2vy7';
  const apiUrl = 'http://209.38.85.196:3000'; // Production server
  
  try {
    console.log('=== REPROCESSING EGGSTRA CAFE UPLOAD ===');
    console.log(`Upload ID: ${uploadId}`);
    console.log(`API URL: ${apiUrl}`);
    
    // First, check current status
    console.log('\n1. Checking current upload status...');
    const currentUpload = await prisma.upload.findUnique({
      where: { id: uploadId },
      include: {
        _count: { select: { prices: true } },
        supplier: true
      }
    });
    
    if (!currentUpload) {
      console.log('❌ Upload not found in database');
      return;
    }
    
    console.log(`   Status: ${currentUpload.status}`);
    console.log(`   Products: ${currentUpload._count.prices}`);
    console.log(`   File: ${currentUpload.originalName}`);
    console.log(`   Supplier: ${currentUpload.supplier?.name || 'N/A'}`);
    console.log(`   Created: ${currentUpload.createdAt}`);
    
    // Call the reprocess API
    console.log('\n2. Calling reprocess API...');
    const response = await fetch(`${apiUrl}/api/admin/uploads/reprocess`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uploadId })
    });
    
    console.log(`   Response status: ${response.status}`);
    
    const result = await response.json();
    console.log('   Response:', JSON.stringify(result, null, 2));
    
    if (!response.ok) {
      console.log('❌ API call failed');
      return;
    }
    
    console.log('✅ Reprocessing request sent successfully');
    
    // Monitor progress
    console.log('\n3. Monitoring processing progress...');
    
    for (let i = 0; i < 30; i++) { // Monitor for 5 minutes (30 * 10 seconds)
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      
      const updatedUpload = await prisma.upload.findUnique({
        where: { id: uploadId },
        include: {
          _count: { select: { prices: true } }
        }
      });
      
      if (updatedUpload) {
        console.log(`   Check ${i + 1}: Status=${updatedUpload.status}, Products=${updatedUpload._count.prices}`);
        
        if (updatedUpload.processingDetails) {
          try {
            const details = typeof updatedUpload.processingDetails === 'string' 
              ? JSON.parse(updatedUpload.processingDetails) 
              : updatedUpload.processingDetails;
            console.log(`              Stage=${details.stage}, Progress=${details.progress}%`);
          } catch (e) {
            // Ignore parsing errors
          }
        }
        
        if (updatedUpload.status === 'completed' || updatedUpload.status === 'failed') {
          console.log(`\n🎉 Processing finished with status: ${updatedUpload.status}`);
          console.log(`   Products extracted: ${updatedUpload._count.prices}`);
          
          if (updatedUpload.errorMessage) {
            console.log(`   Error message: ${updatedUpload.errorMessage}`);
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

reprocessEggstraUpload();