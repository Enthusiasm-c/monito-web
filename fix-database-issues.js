const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDatabaseIssues() {
  console.log('Fixing database issues...\n');
  
  try {
    // 1. Fix products without rawName
    console.log('1. Checking products without rawName...');
    const productsWithoutRawName = await prisma.product.findMany({
      where: {
        rawName: null
      }
    });
    
    if (productsWithoutRawName.length > 0) {
      console.log(`Found ${productsWithoutRawName.length} products without rawName`);
      
      for (const product of productsWithoutRawName) {
        await prisma.product.update({
          where: { id: product.id },
          data: { 
            rawName: product.name || product.standardizedName 
          }
        });
      }
      console.log('✅ Fixed all products without rawName\n');
    } else {
      console.log('✅ All products have rawName\n');
    }
    
    // 2. Check for duplicate standardized names
    console.log('2. Checking for duplicate standardized names...');
    const duplicates = await prisma.$queryRaw`
      SELECT standardizedName, standardizedUnit, COUNT(*) as count
      FROM products
      GROUP BY standardizedName, standardizedUnit
      HAVING COUNT(*) > 1
    `;
    
    if (duplicates.length > 0) {
      console.log(`Found ${duplicates.length} duplicate combinations:`);
      duplicates.forEach(dup => {
        console.log(`  - "${dup.standardizedname}" (${dup.standardizedunit}): ${dup.count} duplicates`);
      });
      console.log('');
    } else {
      console.log('✅ No duplicate standardized names found\n');
    }
    
    // 3. Check uploads without required fields
    console.log('3. Checking uploads...');
    const uploadsWithIssues = await prisma.upload.findMany({
      where: {
        OR: [
          { fileName: null },
          { url: null }
        ]
      }
    });
    
    if (uploadsWithIssues.length > 0) {
      console.log(`Found ${uploadsWithIssues.length} uploads with missing fields`);
      
      for (const upload of uploadsWithIssues) {
        const updates = {};
        if (!upload.fileName && upload.originalName) {
          updates.fileName = upload.originalName;
        }
        if (!upload.url) {
          updates.url = 'placeholder-url';
        }
        
        if (Object.keys(updates).length > 0) {
          await prisma.upload.update({
            where: { id: upload.id },
            data: updates
          });
        }
      }
      console.log('✅ Fixed upload records\n');
    } else {
      console.log('✅ All uploads have required fields\n');
    }
    
    // 4. Summary of current database state
    console.log('4. Database Summary:');
    const stats = {
      products: await prisma.product.count(),
      suppliers: await prisma.supplier.count(),
      prices: await prisma.price.count(),
      uploads: await prisma.upload.count()
    };
    
    console.log(`  - Products: ${stats.products}`);
    console.log(`  - Suppliers: ${stats.suppliers}`);
    console.log(`  - Prices: ${stats.prices}`);
    console.log(`  - Uploads: ${stats.uploads}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixDatabaseIssues();