/**
 * Cleanup Duplicate Prices Script
 * Removes duplicate price records and keeps only the latest one for each supplier-product combination
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface DuplicateGroup {
  supplierId: string;
  productId: string;
  count: number;
}

async function cleanupDuplicatePrices() {
  console.log('🧹 Starting cleanup of duplicate prices...');
  
  try {
    // Step 1: Find all supplier-product combinations that have multiple active prices
    console.log('🔍 Finding duplicate price combinations...');
    
    const duplicateGroups = await prisma.price.groupBy({
      by: ['supplierId', 'productId'],
      where: {
        validTo: null // Only active prices
      },
      having: {
        supplierId: {
          _count: {
            gt: 1 // More than 1 record
          }
        }
      },
      _count: {
        supplierId: true
      }
    });

    console.log(`📊 Found ${duplicateGroups.length} supplier-product combinations with duplicates`);

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicates found, database is clean!');
      return;
    }

    let totalDuplicatesRemoved = 0;

    // Step 2: Process each duplicate group
    for (const group of duplicateGroups) {
      console.log(`🔄 Processing ${group.supplierId} - Product ${group.productId} (${group._count.supplierId} records)`);
      
      // Get all price records for this combination, ordered by creation date (newest first)
      const priceRecords = await prisma.price.findMany({
        where: {
          supplierId: group.supplierId,
          productId: group.productId,
          validTo: null
        },
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          supplier: { select: { name: true } },
          product: { select: { name: true } }
        }
      });

      if (priceRecords.length <= 1) {
        continue; // Skip if somehow no duplicates found
      }

      // Keep the newest record, mark others as expired
      const [keepRecord, ...expireRecords] = priceRecords;
      
      console.log(`  ✅ Keeping latest price: ${keepRecord.amount} (${keepRecord.supplier.name} - ${keepRecord.product.name})`);
      console.log(`  ❌ Expiring ${expireRecords.length} duplicate records`);

      // Mark duplicate records as expired
      const expiredIds = expireRecords.map(record => record.id);
      
      await prisma.price.updateMany({
        where: {
          id: {
            in: expiredIds
          }
        },
        data: {
          validTo: new Date()
        }
      });

      totalDuplicatesRemoved += expireRecords.length;
    }

    console.log(`🎉 Cleanup completed!`);
    console.log(`📊 Total duplicate records marked as expired: ${totalDuplicatesRemoved}`);
    console.log(`📊 Supplier-product combinations cleaned: ${duplicateGroups.length}`);

    // Step 3: Show cleanup results
    const remainingDuplicates = await prisma.price.groupBy({
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

    if (remainingDuplicates.length === 0) {
      console.log('✅ All duplicates successfully removed!');
    } else {
      console.warn(`⚠️ ${remainingDuplicates.length} duplicate combinations still remain`);
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Execute cleanup if run directly
if (require.main === module) {
  cleanupDuplicatePrices()
    .then(() => {
      console.log('🎉 Cleanup script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup script failed:', error);
      process.exit(1);
    });
}

export { cleanupDuplicatePrices };