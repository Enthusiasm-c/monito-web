const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  console.log('🔍 Testing database connection...');
  
  try {
    const prisma = new PrismaClient();
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Test a simple query
    const supplierCount = await prisma.supplier.count();
    console.log(`📊 Found ${supplierCount} suppliers in database`);
    
    await prisma.$disconnect();
    console.log('✅ Database connection test passed');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();