/**
 * Check Price Cleanup Status Script
 * Provides detailed information about the current state of price cleanup in the database
 */

import { prisma } from '../../lib/prisma';

async function checkPriceCleanupStatus() {
  console.log('📊 Checking current price cleanup status...\n');
  
  try {
    // 1. Count active prices (validTo = null)
    console.log('1. Counting active price records...');
    const activePricesCount = await prisma.price.count({
      where: {
        validTo: null
      }
    });
    console.log(`   ✅ Active prices (validTo = null): ${activePricesCount}`);
    
    // 2. Count supplier-product combinations with multiple active prices
    console.log('\n2. Finding supplier-product combinations with multiple active prices...');
    const duplicateGroups = await prisma.price.groupBy({
      by: ['supplierId', 'productId'],
      where: {
        validTo: null
      },
      having: {
        supplierId: {
          _count: {
            gt: 1
          }
        }
      },
      _count: {
        supplierId: true
      }
    });
    console.log(`   ⚠️  Supplier-product combinations with multiple active prices: ${duplicateGroups.length}`);
    
    // 3. Show examples of products with duplicate suppliers (if any)
    console.log('\n3. Examples of products with duplicate active prices...');
    if (duplicateGroups.length > 0) {
      const exampleLimit = Math.min(5, duplicateGroups.length);
      console.log(`   Showing first ${exampleLimit} examples:`);
      
      for (let i = 0; i < exampleLimit; i++) {
        const group = duplicateGroups[i];
        const priceRecords = await prisma.price.findMany({
          where: {
            supplierId: group.supplierId,
            productId: group.productId,
            validTo: null
          },
          include: {
            supplier: { select: { name: true } },
            product: { select: { name: true, standardizedName: true } }
          },
          orderBy: {
            createdAt: 'desc'
          }
        });
        
        console.log(`   ${i + 1}. Product: "${priceRecords[0].product.name}" (${priceRecords[0].product.standardizedName})`);
        console.log(`      Supplier: "${priceRecords[0].supplier.name}"`);
        console.log(`      Duplicate count: ${group._count.supplierId}`);
        console.log(`      Prices: ${priceRecords.map(p => `$${p.amount}`).join(', ')}`);
        console.log('');
      }
      
      if (duplicateGroups.length > exampleLimit) {
        console.log(`   ... and ${duplicateGroups.length - exampleLimit} more combinations with duplicates`);
      }
    } else {
      console.log('   ✅ No products with duplicate active prices found!');
    }
    
    // 4. Count expired prices (validTo != null)
    console.log('\n4. Counting expired price records...');
    const expiredPricesCount = await prisma.price.count({
      where: {
        validTo: {
          not: null
        }
      }
    });
    console.log(`   📦 Expired prices (validTo != null): ${expiredPricesCount}`);
    
    // Additional statistics
    console.log('\n📈 Additional Statistics:');
    const totalPrices = await prisma.price.count();
    const totalSuppliers = await prisma.supplier.count();
    const totalProducts = await prisma.product.count();
    
    console.log(`   • Total price records: ${totalPrices}`);
    console.log(`   • Total suppliers: ${totalSuppliers}`);
    console.log(`   • Total products: ${totalProducts}`);
    
    const activePercentage = totalPrices > 0 ? ((activePricesCount / totalPrices) * 100).toFixed(1) : '0';
    const expiredPercentage = totalPrices > 0 ? ((expiredPricesCount / totalPrices) * 100).toFixed(1) : '0';
    
    console.log(`   • Active prices: ${activePercentage}% of total`);
    console.log(`   • Expired prices: ${expiredPercentage}% of total`);
    
    // Summary
    console.log('\n🎯 Summary:');
    if (duplicateGroups.length === 0) {
      console.log('   ✅ Database is clean - no duplicate active prices found!');
    } else {
      console.log(`   ⚠️  ${duplicateGroups.length} supplier-product combinations still have duplicates`);
      console.log('   💡 Consider running the cleanup script: npm run cleanup-duplicates');
    }
    
  } catch (error) {
    console.error('❌ Error checking price cleanup status:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Execute check if run directly
if (require.main === module) {
  checkPriceCleanupStatus()
    .then(() => {
      console.log('\n🎉 Status check completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Status check failed:', error);
      process.exit(1);
    });
}

export { checkPriceCleanupStatus };