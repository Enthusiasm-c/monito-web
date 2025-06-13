// Скрипт для отката автоматически обработанных файлов в статус pending_review
const { PrismaClient } = require('@prisma/client');

async function resetToPendingReview() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔄 Resetting auto-processed uploads back to pending review...');
    
    // Найдем все uploads которые были автоматически одобрены
    const autoApprovedUploads = await prisma.upload.findMany({
      where: {
        status: 'completed',
        approvalStatus: 'approved',
        OR: [
          { autoApproved: true },
          { approvedBy: 'AI_SYSTEM' },
          { approvedBy: 'SYSTEM_REPROCESS' }
        ]
      },
      include: {
        prices: {
          include: {
            product: true
          }
        }
      }
    });
    
    console.log(`📋 Found ${autoApprovedUploads.length} auto-approved uploads to reset`);
    
    for (const upload of autoApprovedUploads) {
      console.log(`\n🔄 Resetting upload: ${upload.originalName}`);
      
      // Удаляем цены, связанные с этим upload
      const deletedPrices = await prisma.price.deleteMany({
        where: { uploadId: upload.id }
      });
      
      console.log(`🗑️ Deleted ${deletedPrices.count} prices`);
      
      // Находим продукты, которые остались без цен (и удаляем их)
      const productsWithoutPrices = await prisma.product.findMany({
        where: {
          prices: {
            none: {}
          }
        }
      });
      
      if (productsWithoutPrices.length > 0) {
        const deletedProducts = await prisma.product.deleteMany({
          where: {
            id: { in: productsWithoutPrices.map(p => p.id) }
          }
        });
        
        console.log(`🗑️ Deleted ${deletedProducts.count} orphaned products`);
      }
      
      // Возвращаем upload в статус pending_review
      await prisma.upload.update({
        where: { id: upload.id },
        data: {
          status: 'pending_review',
          approvalStatus: 'pending_review',
          autoApproved: false,
          approvedBy: null,
          approvedAt: null
        }
      });
      
      console.log(`✅ Reset upload "${upload.originalName}" to pending_review`);
    }
    
    // Проверяем финальную статистику
    const finalStats = {
      totalProducts: await prisma.product.count(),
      totalPrices: await prisma.price.count(),
      pendingUploads: await prisma.upload.count({
        where: {
          status: 'pending_review',
          approvalStatus: 'pending_review'
        }
      })
    };
    
    console.log('\n📊 Final statistics:');
    console.log('- Total products:', finalStats.totalProducts);
    console.log('- Total prices:', finalStats.totalPrices);
    console.log('- Pending uploads for admin review:', finalStats.pendingUploads);
    
    console.log('\n🎉 Reset completed! Now all uploads require manual admin approval.');
    
  } catch (error) {
    console.error('❌ Reset error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetToPendingReview();