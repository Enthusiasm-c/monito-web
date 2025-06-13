#!/usr/bin/env npx tsx

/**
 * Cleanup Invalid Products Script
 * Removes products without suppliers, prices, or names
 * Also removes the last 157 products that were incorrectly entered
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Starting product cleanup...');
  
  try {
    // 1. Delete the last 157 products (most recent)
    console.log('\n1️⃣ Removing last 157 products...');
    
    const lastProducts = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      take: 157,
      select: { 
        id: true, 
        name: true, 
        prices: { 
          select: { 
            supplier: { select: { name: true } } 
          },
          take: 1
        } 
      }
    });
    
    console.log(`Found ${lastProducts.length} recent products to delete:`);
    lastProducts.slice(0, 5).forEach((product, i) => {
      const supplierName = product.prices[0]?.supplier?.name || 'None';
      console.log(`  ${i+1}. ${product.name} (Supplier: ${supplierName})`);
    });
    if (lastProducts.length > 5) {
      console.log(`  ... and ${lastProducts.length - 5} more`);
    }
    
    const lastProductIds = lastProducts.map(p => p.id);
    
    if (lastProductIds.length > 0) {
      // First delete related prices
      await prisma.price.deleteMany({
        where: { productId: { in: lastProductIds } }
      });
      
      // Then delete products
      const deletedLast = await prisma.product.deleteMany({
        where: { id: { in: lastProductIds } }
      });
      console.log(`✅ Deleted ${deletedLast.count} recent products and their prices`);
    }
    
    // 2. Delete products with invalid data (no prices or empty names)
    console.log('\n2️⃣ Removing invalid products...');
    
    // Find products without any prices
    const productsWithoutPrices = await prisma.product.findMany({
      where: {
        prices: {
          none: {}
        }
      },
      select: { id: true, name: true }
    });
    
    if (productsWithoutPrices.length > 0) {
      const productIds = productsWithoutPrices.map(p => p.id);
      const deletedNoPrice = await prisma.product.deleteMany({
        where: { id: { in: productIds } }
      });
      console.log(`✅ Deleted ${deletedNoPrice.count} products without prices`);
    }
    
    // Delete products without name or with empty name
    const deletedNoName = await prisma.product.deleteMany({
      where: {
        OR: [
          { name: { in: ['', ' '] } },
          { standardizedName: { in: ['', ' '] } },
          { rawName: { in: ['', ' '] } }
        ]
      }
    });
    console.log(`✅ Deleted ${deletedNoName.count} products without valid name`);
    
    // Delete prices with zero or negative amounts
    const deletedInvalidPrices = await prisma.price.deleteMany({
      where: {
        amount: { lte: 0 }
      }
    });
    console.log(`✅ Deleted ${deletedInvalidPrices.count} invalid prices (≤ 0)`);
    
    // 3. Show final statistics
    console.log('\n3️⃣ Final database statistics...');
    
    const totalProducts = await prisma.product.count();
    const totalSuppliers = await prisma.supplier.count();
    const totalUploads = await prisma.upload.count();
    
    console.log(`📊 Remaining in database:`);
    console.log(`   Products: ${totalProducts}`);
    console.log(`   Suppliers: ${totalSuppliers}`);
    console.log(`   Uploads: ${totalUploads}`);
    
    // 4. Show products by supplier (via prices)
    const supplierStats = await prisma.supplier.findMany({
      include: {
        _count: {
          select: { prices: true }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    console.log(`\n📈 Products by supplier:`);
    supplierStats.forEach((supplier, i) => {
      if (supplier._count.prices > 0) {
        console.log(`   ${i+1}. ${supplier.name}: ${supplier._count.prices} prices`);
      }
    });
    
    // 5. Remove suppliers with no prices
    console.log('\n4️⃣ Removing empty suppliers...');
    
    const deletedEmptySuppliers = await prisma.supplier.deleteMany({
      where: {
        prices: {
          none: {}
        }
      }
    });
    console.log(`✅ Deleted ${deletedEmptySuppliers.count} suppliers with no prices`);
    
    console.log('\n🎉 Cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { main as cleanupInvalidProducts };