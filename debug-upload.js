import { prisma } from 'lib/prisma';

const { PrismaClient } = require('@prisma/client');


async function debugUpload() {
  try {
    // Check if there are any products at all
    const productCount = await prisma.product.count();
    const priceCount = await prisma.price.count();
    
    console.log('Database counts:');
    console.log('Products:', productCount);
    console.log('Prices:', priceCount);
    
    // Check the last upload's extracted data
    const lastUpload = await prisma.upload.findFirst({
      orderBy: { createdAt: 'desc' }
    });
    
    if (lastUpload && lastUpload.extractedData) {
      console.log('\nExtracted products:');
      const products = lastUpload.extractedData.products || [];
      products.slice(0, 3).forEach(p => {
        console.log(`- ${p.name}: ${p.price} per ${p.unit}`);
      });
    }
    
    // Check if auto-approval actually worked
    console.log('\nUpload was auto-approved:', lastUpload.autoApproved);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugUpload();
