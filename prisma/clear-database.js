const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearDatabase() {
  console.log('🗑️  Clearing database...');

  try {
    // Delete in correct order due to foreign key constraints
    console.log('Deleting prices...');
    await prisma.price.deleteMany({});
    
    console.log('Deleting products...');
    await prisma.product.deleteMany({});
    
    console.log('Deleting uploads...');
    await prisma.upload.deleteMany({});
    
    console.log('Deleting suppliers...');
    await prisma.supplier.deleteMany({});
    
    console.log('✅ Database cleared successfully!');
    
    // Show counts to confirm
    const counts = {
      suppliers: await prisma.supplier.count(),
      products: await prisma.product.count(),
      prices: await prisma.price.count(),
      uploads: await prisma.upload.count()
    };
    
    console.log('\nCurrent counts:');
    console.log(`Suppliers: ${counts.suppliers}`);
    console.log(`Products: ${counts.products}`);
    console.log(`Prices: ${counts.prices}`);
    console.log(`Uploads: ${counts.uploads}`);
    
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    throw error;
  }
}

clearDatabase()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });