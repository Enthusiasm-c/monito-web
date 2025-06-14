/**
 * Cleanup utility to remove duplicate products and prices
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function cleanupDuplicateProducts() {
  console.log('🧹 Starting duplicate product cleanup...');
  
  try {
    // Find duplicate products by standardizedName + standardizedUnit
    const duplicateGroups = await prisma.$queryRaw<Array<{
      standardizedName: string;
      standardizedUnit: string;
      count: number;
    }>>`
      SELECT "standardizedName", "standardizedUnit", COUNT(*) as count
      FROM "products"
      GROUP BY "standardizedName", "standardizedUnit"
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;

    console.log(`📊 Found ${duplicateGroups.length} groups of duplicate products`);

    let totalProductsRemoved = 0;
    let totalPricesRemoved = 0;

    for (const group of duplicateGroups) {
      console.log(`\n🔍 Processing duplicates for: "${group.standardizedName}" (${group.standardizedUnit})`);
      
      // Get all products in this duplicate group
      const duplicateProducts = await prisma.product.findMany({
        where: {
          standardizedName: group.standardizedName,
          standardizedUnit: group.standardizedUnit
        },
        include: {
          prices: true
        },
        orderBy: {
          createdAt: 'asc' // Keep the oldest product (first created)
        }
      });

      if (duplicateProducts.length <= 1) {
        continue; // No duplicates found
      }

      // Keep the first product (oldest), merge data from others
      const keepProduct = duplicateProducts[0];
      const duplicatesToRemove = duplicateProducts.slice(1);

      console.log(`  📦 Keeping product: ${keepProduct.id} (created: ${keepProduct.createdAt})`);
      console.log(`  ❌ Removing ${duplicatesToRemove.length} duplicate products`);

      // Collect all prices from duplicate products
      const allPrices = duplicateProducts.flatMap(p => p.prices);
      
      // Group prices by supplier and keep only the latest price per supplier
      const latestPricesBySupplier = new Map<string, any>();
      
      for (const price of allPrices) {
        const key = `${price.supplierId}_${price.unit}`;
        const existing = latestPricesBySupplier.get(key);
        
        if (!existing || price.validFrom > existing.validFrom) {
          latestPricesBySupplier.set(key, price);
        }
      }

      // Update all prices to point to the kept product
      for (const [, latestPrice] of latestPricesBySupplier) {
        if (latestPrice.productId !== keepProduct.id) {
          await prisma.price.update({
            where: { id: latestPrice.id },
            data: { productId: keepProduct.id }
          });
          console.log(`  🔗 Moved price ${latestPrice.id} to kept product`);
        }
      }

      // Delete duplicate prices that are not the latest
      for (const product of duplicatesToRemove) {
        for (const price of product.prices) {
          const key = `${price.supplierId}_${price.unit}`;
          const latestPrice = latestPricesBySupplier.get(key);
          
          if (latestPrice && price.id !== latestPrice.id) {
            await prisma.price.delete({
              where: { id: price.id }
            });
            totalPricesRemoved++;
            console.log(`    🗑️ Deleted duplicate price: ${price.id}`);
          }
        }
      }

      // Update the kept product with the best information
      const bestName = duplicateProducts.find(p => p.name && p.name.length > keepProduct.name?.length)?.name || keepProduct.name;
      const bestCategory = duplicateProducts.find(p => p.category)?.category || keepProduct.category;
      const bestDescription = duplicateProducts.find(p => p.description && p.description.length > (keepProduct.description?.length || 0))?.description || keepProduct.description;

      await prisma.product.update({
        where: { id: keepProduct.id },
        data: {
          name: bestName,
          category: bestCategory,
          description: bestDescription,
          updatedAt: new Date()
        }
      });

      // Delete duplicate products (prices should be moved by now)
      for (const duplicate of duplicatesToRemove) {
        await prisma.product.delete({
          where: { id: duplicate.id }
        });
        totalProductsRemoved++;
        console.log(`  🗑️ Deleted duplicate product: ${duplicate.id}`);
      }
    }

    console.log(`\n✅ Cleanup completed!`);
    console.log(`📦 Products removed: ${totalProductsRemoved}`);
    console.log(`💰 Prices removed: ${totalPricesRemoved}`);

    return {
      success: true,
      productsRemoved: totalProductsRemoved,
      pricesRemoved: totalPricesRemoved,
      duplicateGroups: duplicateGroups.length
    };

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function cleanupDuplicatePrices() {
  console.log('🧹 Starting duplicate price cleanup...');
  
  try {
    // Find duplicate prices by productId + supplierId + unit
    const duplicatePrices = await prisma.$queryRaw<Array<{
      productId: string;
      supplierId: string;
      unit: string;
      count: number;
    }>>`
      SELECT "productId", "supplierId", "unit", COUNT(*) as count
      FROM "prices"
      WHERE "validTo" IS NULL
      GROUP BY "productId", "supplierId", "unit"
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;

    console.log(`📊 Found ${duplicatePrices.length} groups of duplicate prices`);

    let totalPricesRemoved = 0;

    for (const group of duplicatePrices) {
      // Get all duplicate prices for this product+supplier+unit combination
      const prices = await prisma.price.findMany({
        where: {
          productId: group.productId,
          supplierId: group.supplierId,
          unit: group.unit,
          validTo: null
        },
        orderBy: {
          validFrom: 'desc' // Keep the latest price
        }
      });

      if (prices.length <= 1) {
        continue;
      }

      // Keep the latest price, mark others as expired
      const keepPrice = prices[0];
      const expirePrices = prices.slice(1);

      console.log(`💰 Product ${group.productId}: keeping latest price ${keepPrice.id}, expiring ${expirePrices.length} duplicates`);

      // Mark old prices as expired
      for (const oldPrice of expirePrices) {
        await prisma.price.update({
          where: { id: oldPrice.id },
          data: { validTo: new Date(keepPrice.validFrom.getTime() - 1000) } // 1 second before new price
        });
        totalPricesRemoved++;
      }
    }

    console.log(`\n✅ Price cleanup completed!`);
    console.log(`💰 Prices expired: ${totalPricesRemoved}`);

    return {
      success: true,
      pricesExpired: totalPricesRemoved,
      duplicateGroups: duplicatePrices.length
    };

  } catch (error) {
    console.error('❌ Price cleanup failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    await prisma.$disconnect();
  }
}

// Combined cleanup function
export async function cleanupAllDuplicates() {
  console.log('🚀 Starting comprehensive duplicate cleanup...');
  
  const productResult = await cleanupDuplicateProducts();
  const priceResult = await cleanupDuplicatePrices();
  
  return {
    success: productResult.success && priceResult.success,
    products: productResult,
    prices: priceResult
  };
}