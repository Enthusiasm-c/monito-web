const { PrismaClient } = require('@prisma/client');

async function checkDatabase() {
  const prisma = new PrismaClient();
  
  try {
    const products = await prisma.product.count();
    const suppliers = await prisma.supplier.count();
    const uploads = await prisma.upload.count();
    const prices = await prisma.price.count();
    const priceHistory = await prisma.priceHistory.count();
    
    console.log('=== DATABASE COUNTS ===');
    console.log(`Products: ${products}`);
    console.log(`Suppliers: ${suppliers}`);
    console.log(`Uploads: ${uploads}`);
    console.log(`Prices: ${prices}`);
    console.log(`Price History: ${priceHistory}`);
    console.log('=====================');
    
    // Recent uploads
    const recentUploads = await prisma.upload.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        originalName: true,
        status: true,
        totalRowsProcessed: true,
        createdAt: true,
        supplier: {
          select: { name: true }
        }
      }
    });
    
    console.log('\n=== RECENT UPLOADS ===');
    recentUploads.forEach(upload => {
      console.log(`${upload.originalName} (${upload.supplier.name}) - ${upload.totalRowsProcessed} rows - ${upload.status}`);
    });
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();