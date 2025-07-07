const { PrismaClient } = require('@prisma/client');

async function approveAllUploads() {
  const prisma = new PrismaClient();
  
  try {
    // Find all pending uploads
    const pendingUploads = await prisma.upload.findMany({
      where: {
        approvalStatus: 'pending_review'
      },
      select: {
        id: true,
        originalName: true,
        totalRowsProcessed: true,
        supplier: { select: { name: true } }
      }
    });
    
    console.log(`Found ${pendingUploads.length} pending uploads:`);
    pendingUploads.forEach(upload => {
      console.log(`- ${upload.originalName} (${upload.supplier.name}) - ${upload.totalRowsProcessed} rows`);
    });
    
    // Approve all pending uploads
    const result = await prisma.upload.updateMany({
      where: {
        approvalStatus: 'pending_review'
      },
      data: {
        approvalStatus: 'approved',
        approvedBy: 'system',
        approvedAt: new Date(),
        autoApproved: true,
        status: 'completed'
      }
    });
    
    console.log(`\n✅ Approved ${result.count} uploads!`);
    
  } catch (error) {
    console.error('Error approving uploads:', error);
  } finally {
    await prisma.$disconnect();
  }
}

approveAllUploads();