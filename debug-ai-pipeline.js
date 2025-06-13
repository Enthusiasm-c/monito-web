// Простой тест для отладки AI pipeline
const { PrismaClient } = require('@prisma/client');

async function debugAIPipeline() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Debugging AI Pipeline issue...');
    
    // Проверяем недавние uploads
    const recentUploads = await prisma.upload.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        supplier: true,
        _count: {
          select: { prices: true }
        }
      }
    });
    
    console.log('📋 Recent uploads:');
    recentUploads.forEach((upload, index) => {
      console.log(`${index + 1}. ${upload.originalName}:`, {
        status: upload.status,
        approvalStatus: upload.approvalStatus,
        totalRowsDetected: upload.totalRowsDetected,
        totalRowsProcessed: upload.totalRowsProcessed,
        pricesCount: upload._count.prices,
        supplier: upload.supplier.name,
        hasExtractedData: !!upload.extractedData,
        createdAt: upload.createdAt.toISOString()
      });
      
      if (upload.extractedData) {
        const data = upload.extractedData;
        if (data.aiDecision) {
          console.log(`   AI Decision:`, {
            dataQuality: data.aiDecision.dataQuality,
            recommendedAction: data.aiDecision.recommendedAction,
            productsCount: data.aiDecision.products?.length || 0,
            supplierName: data.aiDecision.supplierName
          });
          
          // Показываем первые несколько продуктов AI
          if (data.aiDecision.products?.length > 0) {
            console.log(`   First 3 AI products:`, 
              data.aiDecision.products.slice(0, 3).map(p => ({
                name: p.cleanedName,
                price: p.price,
                decision: p.decision
              }))
            );
          }
        }
      }
    });
    
    // Проверяем общую статистику
    const totalProducts = await prisma.product.count();
    const totalPrices = await prisma.price.count();
    const totalSuppliers = await prisma.supplier.count();
    
    console.log('\n📊 Database statistics:');
    console.log('- Products:', totalProducts);
    console.log('- Prices:', totalPrices);
    console.log('- Suppliers:', totalSuppliers);
    
    // Проверяем последние созданные продукты
    const recentProducts = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        prices: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            supplier: true,
            upload: {
              select: { originalName: true }
            }
          }
        }
      }
    });
    
    console.log('\n📦 Recent products:');
    recentProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}:`, {
        category: product.category,
        unit: product.unit,
        pricesCount: product.prices.length,
        latestPrice: product.prices[0] ? {
          amount: product.prices[0].amount,
          supplier: product.prices[0].supplier.name,
          upload: product.prices[0].upload.originalName,
          createdAt: product.prices[0].createdAt.toISOString()
        } : null
      });
    });
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAIPipeline();