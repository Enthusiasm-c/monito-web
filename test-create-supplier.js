const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCreateSupplier() {
  console.log('Testing supplier creation...\n');
  
  try {
    // Create a test supplier
    const supplier = await prisma.supplier.create({
      data: {
        id: 'test-supplier-' + Date.now(),
        name: 'Test Supplier',
        email: 'test@example.com',
        phone: '+1234567890'
      }
    });
    
    console.log('✅ Successfully created supplier:', supplier);
    
    // Count suppliers
    const count = await prisma.supplier.count();
    console.log(`\nTotal suppliers in database: ${count}`);
    
  } catch (error) {
    console.error('❌ Error creating supplier:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCreateSupplier();