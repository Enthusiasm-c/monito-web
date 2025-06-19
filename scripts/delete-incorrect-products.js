import { prisma } from '../lib/prisma';

const { PrismaClient } = require('@prisma/client');



async function deleteIncorrectProducts() {
  console.log('🗑️ Finding and deleting incorrect products from last milk up upload...');
  
  try {
    // Find the latest milk up upload
    const latestUpload = await prisma.upload.findFirst({
      where: {
        originalName: {
          contains: 'milk up',
          mode: 'insensitive'
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (!latestUpload) {
      console.log('❌ No milk up upload found');
      return;
    }
    
    console.log(`📄 Found latest upload: ${latestUpload.id} - ${latestUpload.originalName}`);
    console.log(`   Status: ${latestUpload.status}`);
    console.log(`   Created: ${latestUpload.createdAt}`);
    
    // Find all prices associated with this upload
    const prices = await prisma.price.findMany({
      where: {
        uploadId: latestUpload.id
      },
      include: {
        product: true
      }
    });
    
    console.log(`💰 Found ${prices.length} prices to delete`);
    
    if (prices.length > 0) {
      // Show sample of incorrect products
      console.log('\n📦 Sample products to be deleted:');
      prices.slice(0, 5).forEach((price, i) => {
        console.log(`   ${i+1}. "${price.product.name}" - ${price.amount} ${price.unit}`);
      });
      
      // Delete prices first
      const deletedPrices = await prisma.price.deleteMany({
        where: {
          uploadId: latestUpload.id
        }
      });
      
      console.log(`✅ Deleted ${deletedPrices.count} prices`);
      
      // Find products that no longer have any prices (orphaned products)
      const productIds = [...new Set(prices.map(p => p.product.id))];
      
      let orphanedCount = 0;
      for (const productId of productIds) {
        const remainingPrices = await prisma.price.count({
          where: { productId }
        });
        
        if (remainingPrices === 0) {
          await prisma.product.delete({
            where: { id: productId }
          });
          orphanedCount++;
        }
      }
      
      console.log(`✅ Deleted ${orphanedCount} orphaned products`);
      
      // Update upload status to failed
      await prisma.upload.update({
        where: { id: latestUpload.id },
        data: {
          status: 'failed',
          errorMessage: 'Products extracted incorrectly - deleted for reprocessing',
          updatedAt: new Date()
        }
      });
      
      console.log(`✅ Updated upload status to failed for reprocessing`);
    }
    
    console.log('\n🎉 Cleanup completed successfully');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteIncorrectProducts();