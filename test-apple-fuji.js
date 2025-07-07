const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAppleFujiAnalytics() {
  try {
    // First, get the Apple Fuji product ID
    const product = await prisma.product.findFirst({
      where: {
        standardizedName: 'apple fuji'
      }
    });
    
    if (!product) {
      console.log('Apple Fuji product not found');
      return;
    }
    
    console.log('Apple Fuji product found:', product.id);
    console.log('Product name:', product.name);
    
    // Check current prices
    const currentPrices = await prisma.price.findMany({
      where: {
        productId: product.id,
        validTo: null
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    
    console.log('Current prices:', currentPrices.length);
    if (currentPrices.length > 0) {
      console.log('Current prices details:', currentPrices.map(p => ({
        supplier: p.supplier.name,
        amount: p.amount.toString(),
        unit: p.unit
      })));
    }
    
    // Check price history
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const priceHistory = await prisma.priceHistory.findMany({
      where: { 
        productId: product.id,
        createdAt: {
          gte: sixMonthsAgo
        }
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log('Price history records:', priceHistory.length);
    if (priceHistory.length > 0) {
      console.log('Price history sample:', priceHistory.slice(0, 3).map(h => ({
        supplier: h.supplier.name,
        price: h.price.toString(),
        unit: h.unit,
        createdAt: h.createdAt.toISOString()
      })));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAppleFujiAnalytics();