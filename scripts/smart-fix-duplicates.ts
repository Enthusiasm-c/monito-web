/**
 * Smart duplicate handling script
 * Merges duplicates and standardizes names without creating new duplicates
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Smart duplicate fixing...\n');

  // Find all products grouped by standardizedName + standardizedUnit
  const duplicateGroups = await prisma.$queryRaw<Array<{
    standardizedName: string;
    standardizedUnit: string;
    count: bigint;
  }>>`
    SELECT "standardizedName", "standardizedUnit", COUNT(*) as count
    FROM products
    WHERE "standardizedName" IS NOT NULL AND "standardizedUnit" IS NOT NULL
    GROUP BY "standardizedName", "standardizedUnit"
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `;

  console.log(`Found ${duplicateGroups.length} groups with duplicates\n`);

  let totalMerged = 0;
  let totalDeleted = 0;

  for (const group of duplicateGroups) {
    console.log(`\nProcessing: ${group.standardizedName} (${group.standardizedUnit}) - ${group.count} copies`);

    // Get all products in this group
    const products = await prisma.product.findMany({
      where: {
        standardizedName: group.standardizedName,
        standardizedUnit: group.standardizedUnit
      },
      include: {
        prices: {
          select: {
            id: true,
            supplierId: true,
            amount: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    if (products.length <= 1) continue;

    // Keep the first product (oldest)
    const [keepProduct, ...duplicates] = products;
    console.log(`  Keeping: ${keepProduct.id} (${keepProduct.prices.length} prices)`);

    // Process each duplicate
    for (const duplicate of duplicates) {
      console.log(`  Merging: ${duplicate.id} (${duplicate.prices.length} prices)`);

      // For each price in duplicate
      for (const price of duplicate.prices) {
        // Check if this supplier already has a price for the kept product
        const existingPrice = await prisma.price.findFirst({
          where: {
            productId: keepProduct.id,
            supplierId: price.supplierId,
            validTo: null
          }
        });

        if (!existingPrice) {
          // Move price to kept product
          await prisma.price.update({
            where: { id: price.id },
            data: { productId: keepProduct.id }
          });
          totalMerged++;
        } else {
          // Delete duplicate price
          await prisma.price.delete({
            where: { id: price.id }
          });
        }
      }

      // Delete the duplicate product
      await prisma.product.delete({
        where: { id: duplicate.id }
      });
      totalDeleted++;
    }
  }

  console.log('\n✅ Duplicate fix completed!');
  console.log(`   Merged ${totalMerged} prices`);
  console.log(`   Deleted ${totalDeleted} duplicate products`);

  // Now fix Indonesian names without creating new duplicates
  console.log('\n🔄 Fixing Indonesian names safely...');

  const translations: Record<string, string> = {
    'ayam': 'Chicken',
    'sapi': 'Beef',
    'ikan': 'Fish',
    'telur': 'Egg',
    'tomat': 'Tomato',
    'bawang': 'Onion',
    'wortel': 'Carrot',
    'kentang': 'Potato',
    'sayur': 'Vegetable',
    'buah': 'Fruit',
    'daging': 'Meat',
    'minyak': 'Oil',
    'gula': 'Sugar',
    'garam': 'Salt',
    'tepung': 'Flour',
    'beras': 'Rice',
    'susu': 'Milk',
    'keju': 'Cheese',
    'roti': 'Bread',
    'mie': 'Noodle',
    'cabe': 'Chili',
    'cabai': 'Chili',
    'jamur': 'Mushroom',
    'tahu': 'Tofu',
    'tempe': 'Tempeh',
    'kampung': 'Free Range',
    'merah': 'Red',
    'hijau': 'Green',
    'putih': 'White',
    'segar': 'Fresh',
    'lokal': 'Local'
  };

  const productsToFix = await prisma.product.findMany({
    where: {
      OR: Object.keys(translations).map(word => ({
        standardizedName: {
          contains: word,
          mode: 'insensitive'
        }
      }))
    }
  });

  console.log(`Found ${productsToFix.length} products with Indonesian words`);

  let fixedCount = 0;
  let skippedCount = 0;

  for (const product of productsToFix) {
    let newName = product.standardizedName;
    
    // Replace Indonesian words
    for (const [indo, eng] of Object.entries(translations)) {
      const regex = new RegExp(`\\b${indo}\\b`, 'gi');
      newName = newName.replace(regex, eng);
    }

    // Capitalize properly
    newName = newName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    if (newName !== product.standardizedName) {
      // Check if this would create a duplicate
      const existing = await prisma.product.findFirst({
        where: {
          standardizedName: newName,
          standardizedUnit: product.standardizedUnit,
          id: { not: product.id }
        }
      });

      if (existing) {
        console.log(`  Skipping "${product.standardizedName}" → "${newName}" (would create duplicate)`);
        skippedCount++;
      } else {
        await prisma.product.update({
          where: { id: product.id },
          data: {
            standardizedName: newName,
            name: newName
          }
        });
        console.log(`  Fixed: "${product.standardizedName}" → "${newName}"`);
        fixedCount++;
      }
    }
  }

  console.log(`\n✅ Name fixing completed!`);
  console.log(`   Fixed: ${fixedCount} products`);
  console.log(`   Skipped: ${skippedCount} (would create duplicates)`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });