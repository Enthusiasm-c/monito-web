import { prisma } from 'lib/prisma';

const { PrismaClient } = require('@prisma/client');


async function checkDatabase() {
  console.log('Checking database tables...\n');
  
  try {
    // Check if tables exist by trying to query them
    const tables = [
      { name: 'suppliers', model: prisma.supplier },
      { name: 'products', model: prisma.product },
      { name: 'prices', model: prisma.price },
      { name: 'uploads', model: prisma.upload }
    ];
    
    for (const table of tables) {
      try {
        const count = await table.model.count();
        console.log(`✅ Table "${table.name}" exists with ${count} records`);
      } catch (error) {
        console.log(`❌ Table "${table.name}" - Error: ${error.message}`);
      }
    }
    
    // Try raw query to see actual tables
    console.log('\nChecking actual database tables:');
    const actualTables = await prisma.$queryRaw`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;
    
    console.log('\nFound tables:');
    actualTables.forEach(table => {
      console.log(`  - ${table.tablename}`);
    });
    
  } catch (error) {
    console.error('\nDatabase connection error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();