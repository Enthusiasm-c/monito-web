import { standardizeProductData } from '../app/services/standardization';

import { prisma } from '../lib/prisma';

async function fixStandardization() {
  try {
    console.log('Starting standardization fix...\n');
    
    // Get all products
    const products = await prisma.product.findMany({
      include: {
        prices: {
          take: 1 // Just to get unit info
        }
      }
    });
    
    console.log(`Found ${products.length} products to process\n`);
    
    let updated = 0;
    let misspellings = 0;
    let duplicates = 0;
    
    for (const product of products) {
      const unit = product.prices[0]?.unit || product.standardizedUnit || 'pcs';
      const result = standardizeProductData(product.name, unit);
      
      // Check if standardization changed
      if (result.standardizedName !== product.standardizedName) {
        console.log(`Fixing: "${product.name}" → "${result.standardizedName}"`);
        console.log(`  Old: "${product.standardizedName}"`);
        console.log(`  New: "${result.standardizedName}"`);
        
        // Check if it was a misspelling
        if (product.name.includes('poteto') || 
            product.name.includes('brocoly') || 
            product.name.includes('chiken') ||
            product.name.includes('advocado') ||
            product.name.includes('tomatos')) {
          misspellings++;
        }
        
        // Check if a product with this standardized name already exists
        const existingProduct = await prisma.product.findFirst({
          where: {
            standardizedName: result.standardizedName,
            standardizedUnit: result.standardizedUnit,
            id: { not: product.id }
          }
        });
        
        if (existingProduct) {
          console.log(`  ⚠️  Duplicate found! Merging with existing product...`);
          
          // Move all prices from this product to the existing one
          await prisma.price.updateMany({
            where: { productId: product.id },
            data: { productId: existingProduct.id }
          });
          
          // Delete the duplicate product
          await prisma.product.delete({
            where: { id: product.id }
          });
          
          console.log('  ✓ Merged and deleted duplicate\n');
          duplicates++;
        } else {
          // Update the product
          await prisma.product.update({
            where: { id: product.id },
            data: { 
              standardizedName: result.standardizedName,
              category: determineCategoryFromName(result.standardizedName)
            }
          });
          
          console.log('  ✓ Updated\n');
        }
        
        updated++;
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total products: ${products.length}`);
    console.log(`Updated: ${updated}`);
    console.log(`Misspellings fixed: ${misspellings}`);
    console.log(`Duplicates merged: ${duplicates}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function determineCategoryFromName(name: string): string {
  const nameLower = name.toLowerCase();
  
  // Vegetables
  if (nameLower.includes('potato') || nameLower.includes('carrot') || 
      nameLower.includes('spinach') || nameLower.includes('broccoli') ||
      nameLower.includes('cabbage') || nameLower.includes('lettuce') ||
      nameLower.includes('tomato') || nameLower.includes('onion') ||
      nameLower.includes('garlic') || nameLower.includes('bean') ||
      nameLower.includes('corn') || nameLower.includes('cucumber') ||
      nameLower.includes('eggplant') || nameLower.includes('pepper')) {
    return 'VEGETABLE';
  }
  
  // Fruits
  if (nameLower.includes('banana') || nameLower.includes('apple') ||
      nameLower.includes('orange') || nameLower.includes('mango') ||
      nameLower.includes('grape') || nameLower.includes('watermelon') ||
      nameLower.includes('pineapple') || nameLower.includes('avocado') ||
      nameLower.includes('strawberry') || nameLower.includes('lemon') ||
      nameLower.includes('plantain')) {
    return 'FRUIT';
  }
  
  // Meat
  if (nameLower.includes('chicken') || nameLower.includes('beef') ||
      nameLower.includes('pork') || nameLower.includes('lamb') ||
      nameLower.includes('meat')) {
    return 'MEAT';
  }
  
  // Seafood
  if (nameLower.includes('fish') || nameLower.includes('shrimp') ||
      nameLower.includes('squid') || nameLower.includes('crab') ||
      nameLower.includes('lobster') || nameLower.includes('salmon') ||
      nameLower.includes('tuna')) {
    return 'SEAFOOD';
  }
  
  // Dairy
  if (nameLower.includes('milk') || nameLower.includes('cheese') ||
      nameLower.includes('yogurt') || nameLower.includes('butter') ||
      nameLower.includes('cream')) {
    return 'DAIRY';
  }
  
  // Grains
  if (nameLower.includes('rice') || nameLower.includes('bread') ||
      nameLower.includes('noodle') || nameLower.includes('pasta') ||
      nameLower.includes('flour') || nameLower.includes('wheat')) {
    return 'GRAIN';
  }
  
  return 'OTHER';
}

// Run the fix
fixStandardization();