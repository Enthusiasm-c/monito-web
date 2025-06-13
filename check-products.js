const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProducts() {
  try {
    const productCount = await prisma.product.count();
    const priceCount = await prisma.price.count();
    const lastUpload = await prisma.upload.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { 
        prices: {
          include: { product: true }
        }
      }
    });
    
    console.log('📊 Database stats:');
    console.log('   Total products:', productCount);
    console.log('   Total prices:', priceCount);
    
    if (lastUpload) {
      console.log('\n📁 Last upload:');
      console.log('   Status:', lastUpload.status);
      console.log('   Prices created:', lastUpload.prices.length);
      
      if (lastUpload.prices.length > 0) {
        console.log('\n🛍️ Products from this upload:');
        lastUpload.prices.forEach(price => {
          console.log(`   - ${price.product.name}: ${price.amount} per ${price.unit}`);
        });
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProducts();