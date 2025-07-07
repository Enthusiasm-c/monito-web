const { PrismaClient } = require('@prisma/client');

async function checkLocalDatabase() {
  const prisma = new PrismaClient();
  
  try {
    const products = await prisma.product.count();
    const suppliers = await prisma.supplier.count();
    const uploads = await prisma.upload.count();
    const prices = await prisma.price.count();
    const priceHistory = await prisma.priceHistory.count();
    
    console.log('=== LOCAL DATABASE COUNTS ===');
    console.log(`Products: ${products}`);
    console.log(`Suppliers: ${suppliers}`);
    console.log(`Uploads: ${uploads}`);
    console.log(`Prices: ${prices}`);
    console.log(`Price History: ${priceHistory}`);
    console.log('===============================');
    
    // Sample of products
    if (products > 0) {
      const sampleProducts = await prisma.product.findMany({
        take: 10,
        include: {
          prices: {
            take: 1,
            include: {
              supplier: true
            }
          }
        }
      });
      
      console.log('\n=== SAMPLE PRODUCTS ===');
      sampleProducts.forEach(product => {
        const price = product.prices[0];
        if (price) {
          console.log(`${product.name} - ${price.amount} ${price.unit} (${price.supplier.name})`);
        }
      });
    }
    
  } catch (error) {
    console.error('Local database error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLocalDatabase();