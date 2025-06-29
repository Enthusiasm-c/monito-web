/**
 * Import test data to remote database
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function importTestData() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🚀 Starting data import...');
    
    // Read exported data
    const exportData = JSON.parse(fs.readFileSync('test-data-export.json', 'utf8'));
    console.log('📖 Loaded export data:', exportData.metadata);
    
    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await prisma.price.deleteMany();
    await prisma.product.deleteMany();
    await prisma.supplier.deleteMany();
    console.log('   ✅ Data cleared');
    
    // Import suppliers
    console.log('📦 Importing suppliers...');
    for (const supplier of exportData.suppliers) {
      const { id, createdAt, updatedAt, ...supplierData } = supplier;
      await prisma.supplier.create({
        data: supplierData
      });
      console.log('   ✅', supplierData.name);
    }
    
    // Import products
    console.log('🥬 Importing products...');
    for (const product of exportData.products) {
      const { id, createdAt, updatedAt, ...productData } = product;
      await prisma.product.create({
        data: productData
      });
      console.log('   ✅', productData.name);
    }
    
    // Verify import
    const suppliersCount = await prisma.supplier.count();
    const productsCount = await prisma.product.count();
    
    console.log('\\n🎉 Import completed successfully!');
    console.log('📊 Imported:');
    console.log('   Suppliers:', suppliersCount);
    console.log('   Products:', productsCount);
    
    // Show sample data
    const sampleSuppliers = await prisma.supplier.findMany({ take: 3 });
    const sampleProducts = await prisma.product.findMany({ take: 5 });
    
    console.log('\\n📋 Sample imported data:');
    console.log('Suppliers:');
    sampleSuppliers.forEach(s => console.log('   -', s.name, '(' + s.email + ')'));
    console.log('Products:');
    sampleProducts.forEach(p => console.log('   -', p.name, '(' + p.category + ')'));
    
    console.log('\\n💡 Ready for admin panel testing!');
    
  } catch (error) {
    console.error('❌ Import error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  importTestData().catch(console.error);
}

module.exports = { importTestData };