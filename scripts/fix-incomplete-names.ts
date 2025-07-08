/**
 * Script to fix incomplete product names like "400gr, Plastic", "Glass", "Plastic"
 * These are likely parsing errors where the actual product name was lost
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding products with incomplete names...\n');

  // Find products with problematic names
  const problematicNames = [
    '400gr, Plastic',
    'Plastic', 
    'Glass',
    'Bottle',
    'Box',
    'Pack',
    'Bag',
    'Can',
    '250gr',
    '400gr',
    '500gr',
    '1kg',
    '2kg',
    '5kg'
  ];

  const products = await prisma.product.findMany({
    where: {
      standardizedName: { in: problematicNames }
    },
    include: {
      prices: {
        include: {
          supplier: true
        }
      }
    }
  });

  console.log(`Found ${products.length} products with incomplete names:\n`);

  for (const product of products) {
    console.log(`\nProduct: "${product.standardizedName}"`);
    console.log(`  Original name: "${product.name}"`);
    console.log(`  Category: ${product.category}`);
    console.log(`  Unit: ${product.unit}`);
    console.log(`  ID: ${product.id}`);
    
    // Try to infer the actual product from category and other fields
    let newName = product.name;
    let shouldUpdate = false;

    // If the standardized name is just packaging/weight, it's definitely wrong
    if (problematicNames.includes(product.standardizedName)) {
      // Check if we can extract more info from the original name
      if (product.name && product.name !== product.standardizedName) {
        // Use original name if it's more descriptive
        newName = product.name;
        shouldUpdate = true;
      } else {
        // Try to infer from category
        const categoryHints: Record<string, string> = {
          'CHEESE': 'Cheese',
          'YOGURT': 'Yogurt',
          'Dairy': 'Dairy Product',
          'DESSERT': 'Dessert',
          'Grains': 'Grain Product'
        };

        if (product.category && categoryHints[product.category]) {
          newName = `${categoryHints[product.category]} ${product.standardizedName}`;
          shouldUpdate = true;
        }
      }
    }

    if (shouldUpdate) {
      console.log(`  → Suggested fix: "${newName}"`);
      
      // Ask for confirmation in production
      console.log(`  Updating product...`);
      
      await prisma.product.update({
        where: { id: product.id },
        data: {
          name: newName,
          standardizedName: newName
        }
      });
      
      console.log(`  ✅ Updated!`);
    } else {
      console.log(`  ⚠️ Could not determine proper name, needs manual review`);
    }
  }

  // Additional check for products with very short names
  console.log('\n\n🔍 Checking for products with suspiciously short names...\n');
  
  const allProducts = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      standardizedName: true,
      category: true
    }
  });
  
  const shortNameProducts = allProducts.filter(p => 
    p.standardizedName && p.standardizedName !== ''
  );

  const suspiciousProducts = shortNameProducts.filter(p => {
    if (!p.standardizedName) return false;
    return p.standardizedName.length <= 5 || 
      /^[0-9]+[a-z]+$/.test(p.standardizedName) ||
      (/^[A-Z][a-z]+$/.test(p.standardizedName) && problematicNames.includes(p.standardizedName));
  });

  if (suspiciousProducts.length > 0) {
    console.log(`Found ${suspiciousProducts.length} products with suspicious names:`);
    suspiciousProducts.forEach(p => {
      console.log(`- "${p.standardizedName}" (${p.category}) - Original: "${p.name}"`);
    });
  }

  console.log('\n✅ Incomplete name fix completed!');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });