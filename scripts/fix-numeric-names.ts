/**
 * Script to fix numeric and weight-only product names
 * These are parsing errors where product names were replaced with quantities/weights
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding products with numeric/weight-only names...\n');

  // Find specific problematic products
  const problematicProducts = await prisma.product.findMany({
    where: {
      standardizedName: { 
        in: ['20', '30', '40', '50', '600gr', 'Idr'] 
      }
    },
    include: {
      prices: {
        include: {
          supplier: true
        }
      }
    }
  });

  console.log(`Found ${problematicProducts.length} products to fix:\n`);

  for (const product of problematicProducts) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Product: "${product.standardizedName}"`);
    console.log(`Category: ${product.category}`);
    console.log(`Unit: ${product.unit}`);
    console.log(`ID: ${product.id}`);
    
    if (product.prices.length > 0) {
      console.log(`Supplier: ${product.prices[0].supplier.name}`);
      console.log(`Price: ${product.prices[0].amount.toNumber()} IDR/${product.unit}`);
    }

    let newName: string | null = null;
    let confidence = 'low';

    // Handle numeric names from AF Seafood (likely fish/seafood sizes)
    if (['20', '30', '40', '50'].includes(product.standardizedName)) {
      if (product.prices[0]?.supplier.name === 'AF Seafood') {
        // These are likely shrimp/prawn sizes
        newName = `Shrimp Size ${product.standardizedName}`;
        confidence = 'medium';
        console.log(`\n💡 Analysis: Numeric name from seafood supplier`);
        console.log(`   Likely represents shrimp/prawn size grade`);
      }
    }
    
    // Handle "600gr" from Milk Up in CAKES category
    else if (product.standardizedName === '600gr' && product.category === 'CAKES') {
      newName = 'Cake 600gr';
      confidence = 'medium';
      console.log(`\n💡 Analysis: Weight-only name in CAKES category`);
      console.log(`   Product name was lost, only weight remains`);
    }
    
    // Handle "Idr" - this is clearly an error (IDR is currency)
    else if (product.standardizedName === 'Idr') {
      if (product.category === 'YOGURT' && product.prices[0]?.supplier.name === 'Milk Up') {
        newName = 'Yogurt Product';
        confidence = 'low';
        console.log(`\n💡 Analysis: "Idr" is Indonesian currency, not a product`);
        console.log(`   Critical parsing error - product name completely lost`);
      }
    }

    if (newName) {
      console.log(`\n✅ Fix: "${product.standardizedName}" → "${newName}" (confidence: ${confidence})`);
      
      // Update the product
      await prisma.product.update({
        where: { id: product.id },
        data: {
          name: newName,
          standardizedName: newName
        }
      });
      
      console.log(`   Updated successfully!`);
    } else {
      console.log(`\n⚠️ Could not determine appropriate fix`);
      console.log(`   Requires manual review`);
    }
  }

  // Look for more numeric patterns
  console.log('\n\n🔍 Checking for other numeric/pattern names...\n');
  
  const allProducts = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      standardizedName: true,
      category: true
    }
  });

  const suspiciousPatterns = allProducts.filter(p => {
    if (!p.standardizedName) return false;
    
    // Pure numbers
    if (/^\d+$/.test(p.standardizedName)) return true;
    
    // Just weight/size (e.g., "250gr", "1kg", "500ml")
    if (/^\d+\s*(gr|g|kg|ml|l|oz|lb)$/i.test(p.standardizedName)) return true;
    
    // Currency names
    if (/^(idr|usd|eur|gbp|aud|sgd|myr)$/i.test(p.standardizedName)) return true;
    
    // Single letters or very short
    if (p.standardizedName.length <= 2 && !/^(ok|id|kg|ml|gr|oz|lb)$/i.test(p.standardizedName)) return true;
    
    return false;
  });

  if (suspiciousPatterns.length > 0) {
    console.log(`Found ${suspiciousPatterns.length} more suspicious patterns:`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const grouped = suspiciousPatterns.reduce((acc, p) => {
      const pattern = getPattern(p.standardizedName);
      if (!acc[pattern]) acc[pattern] = [];
      acc[pattern].push(p);
      return acc;
    }, {} as Record<string, typeof suspiciousPatterns>);

    for (const [pattern, products] of Object.entries(grouped)) {
      console.log(`\n${pattern} (${products.length} products):`);
      products.slice(0, 5).forEach(p => {
        console.log(`  - "${p.standardizedName}" [${p.category}]`);
      });
      if (products.length > 5) {
        console.log(`  ... and ${products.length - 5} more`);
      }
    }
  }

  console.log('\n\n✅ Numeric name fix completed!');
}

function getPattern(name: string): string {
  if (/^\d+$/.test(name)) return 'Pure numbers';
  if (/^\d+\s*(gr|g|kg|ml|l|oz|lb)$/i.test(name)) return 'Weight/volume only';
  if (/^(idr|usd|eur|gbp|aud|sgd|myr)$/i.test(name)) return 'Currency codes';
  if (name.length <= 2) return 'Single/double letters';
  return 'Other patterns';
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });