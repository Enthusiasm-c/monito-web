const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStatus() {
  console.log('🔍 Checking restoration status...');
  
  const supplier = await prisma.supplier.findUnique({
    where: { name: 'Island Organics Bali' },
    include: {
      _count: {
        select: {
          prices: true,
          uploads: true
        }
      }
    }
  });
  
  if (!supplier) {
    console.log('❌ Supplier not found');
    return;
  }
  
  console.log('📊 Current status:');
  console.log('Supplier:', supplier.name);
  console.log('ID:', supplier.id);
  console.log('Prices:', supplier._count.prices, '/ 412 target');
  console.log('Uploads:', supplier._count.uploads, '/ 2 target');
  
  if (supplier._count.prices >= 340) {
    console.log('✅ Restoration successful!');
    console.log('🎉 Island Organics Bali has been restored with substantial data');
  } else {
    console.log('⚠️  Restoration incomplete');
  }
  
  await prisma.$disconnect();
}

checkStatus().catch(console.error);