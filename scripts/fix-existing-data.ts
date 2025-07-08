/**
 * Script to fix existing incorrect data in the database
 * Applies all the critical fixes to existing products and prices
 */

import { PrismaClient } from '@prisma/client';
import { dataNormalizer } from '../app/services/dataNormalizer';
import { standardizeUnit } from '../app/services/standardization';
import { calculateUnitPrice } from '../app/lib/utils/unit-price-calculator';
import OpenAI from 'openai';

const prisma = new PrismaClient();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface FixReport {
  totalProducts: number;
  totalPrices: number;
  fixedProducts: number;
  fixedPrices: number;
  deletedDuplicates: number;
  errors: string[];
}

const report: FixReport = {
  totalProducts: 0,
  totalPrices: 0,
  fixedProducts: 0,
  fixedPrices: 0,
  deletedDuplicates: 0,
  errors: []
};

/**
 * Fix product names that are in Indonesian (like "apel fuji")
 */
async function fixProductNames() {
  console.log('\n📝 Step 1: Fixing product names with Indonesian words...');
  
  // Get all products
  const products = await prisma.product.findMany({
    include: {
      prices: {
        take: 1 // Just to check if product has prices
      }
    }
  });
  
  report.totalProducts = products.length;
  console.log(`Found ${products.length} products to check`);
  
  // Find products that need fixing
  const indonesianWords = ['apel', 'wortel', 'tomat', 'bawang', 'kentang', 'ayam', 'sapi', 'ikan', 'sayur', 'buah'];
  const productsToFix = products.filter(p => {
    const nameLower = p.standardizedName.toLowerCase();
    return indonesianWords.some(word => nameLower.includes(word));
  });
  
  console.log(`Found ${productsToFix.length} products with Indonesian names to fix`);
  
  if (productsToFix.length > 0) {
    // Process in batches of 50
    const batchSize = 50;
    
    for (let i = 0; i < productsToFix.length; i += batchSize) {
      const batch = productsToFix.slice(i, i + batchSize);
      console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(productsToFix.length / batchSize)}`);
      
      try {
        // Prepare batch for AI
        const batchData = batch.map((p, idx) => ({
          id: idx,
          name: p.standardizedName,
          category: p.category || 'unknown'
        }));
        
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are an expert product name standardizer. Translate Indonesian product names to English.
              
Common translations:
- apel = Apple, wortel = Carrot, tomat = Tomato, bawang = Onion
- kentang = Potato, ayam = Chicken, sapi = Beef, ikan = Fish
- sayur = Vegetable, buah = Fruit, daging = Meat, gula = Sugar

Return JSON array: [{"id": 0, "nameStd": "Standardized English Name"}, ...]`
            },
            {
              role: 'user',
              content: `Standardize these product names:\n${JSON.stringify(batchData, null, 2)}`
            }
          ],
          temperature: 0
        });
        
        const content = response.choices[0]?.message?.content?.trim() || '';
        let standardizedData: Array<{id: number, nameStd: string}> = [];
        
        try {
          let cleanContent = content;
          if (cleanContent.includes('```json')) {
            cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```/g, '');
          }
          standardizedData = JSON.parse(cleanContent);
        } catch (e) {
          console.error('Failed to parse AI response');
          continue;
        }
        
        // Update products
        for (const item of standardizedData) {
          const product = batch[item.id];
          if (product && item.nameStd !== product.standardizedName) {
            console.log(`  Fixing: "${product.standardizedName}" → "${item.nameStd}"`);
            
            await prisma.product.update({
              where: { id: product.id },
              data: { 
                standardizedName: item.nameStd,
                name: item.nameStd // Also update display name
              }
            });
            
            report.fixedProducts++;
          }
        }
        
      } catch (error) {
        console.error('Batch processing error:', error);
        report.errors.push(`Product name fixing error: ${error}`);
      }
    }
  }
}

/**
 * Fix standardized units
 */
async function fixUnits() {
  console.log('\n🔧 Step 2: Fixing standardized units...');
  
  // Get all unique units
  const products = await prisma.product.findMany({
    select: {
      id: true,
      unit: true,
      standardizedUnit: true
    }
  });
  
  let fixedCount = 0;
  
  for (const product of products) {
    const correctUnit = standardizeUnit(product.unit);
    
    if (product.standardizedUnit !== correctUnit) {
      console.log(`  Fixing unit: "${product.unit}" → "${correctUnit}" (was "${product.standardizedUnit}")`);
      
      await prisma.product.update({
        where: { id: product.id },
        data: { standardizedUnit: correctUnit }
      });
      
      fixedCount++;
    }
  }
  
  report.fixedProducts += fixedCount;
  console.log(`Fixed ${fixedCount} product units`);
}

/**
 * Fix unit prices for all prices
 */
async function fixUnitPrices() {
  console.log('\n💰 Step 3: Fixing unit prices...');
  
  const prices = await prisma.price.findMany({
    where: {
      OR: [
        { unitPrice: null },
        { unitPrice: 0 }
      ]
    }
  });
  
  report.totalPrices = prices.length;
  console.log(`Found ${prices.length} prices with missing/zero unit prices`);
  
  let fixedCount = 0;
  
  for (const price of prices) {
    try {
      // Calculate unit price (assumes quantity = 1 if not specified)
      const unitPrice = calculateUnitPrice(
        price.amount.toNumber(),
        1, // Default quantity
        price.unit
      );
      
      await prisma.price.update({
        where: { id: price.id },
        data: { unitPrice: unitPrice }
      });
      
      fixedCount++;
      
      if (fixedCount % 100 === 0) {
        console.log(`  Progress: ${fixedCount}/${prices.length}`);
      }
      
    } catch (error) {
      console.error(`Failed to fix unit price for price ${price.id}:`, error);
      report.errors.push(`Unit price error for ${price.id}: ${error}`);
    }
  }
  
  report.fixedPrices = fixedCount;
  console.log(`Fixed ${fixedCount} unit prices`);
}

/**
 * Remove duplicate products (same standardizedName + standardizedUnit)
 */
async function removeDuplicates() {
  console.log('\n🗑️ Step 4: Removing duplicate products...');
  
  // Find duplicates
  const duplicates = await prisma.$queryRaw<Array<{
    standardizedName: string;
    standardizedUnit: string;
    count: bigint;
  }>>`
    SELECT "standardizedName", "standardizedUnit", COUNT(*) as count
    FROM products
    WHERE "standardizedName" IS NOT NULL AND "standardizedUnit" IS NOT NULL
    GROUP BY "standardizedName", "standardizedUnit"
    HAVING COUNT(*) > 1
  `;
  
  console.log(`Found ${duplicates.length} duplicate product groups`);
  
  for (const dup of duplicates) {
    console.log(`\n  Processing duplicates for: ${dup.standardizedName} (${dup.standardizedUnit})`);
    
    // Get all products with this name/unit
    const products = await prisma.product.findMany({
      where: {
        standardizedName: dup.standardizedName,
        standardizedUnit: dup.standardizedUnit
      },
      include: {
        prices: true
      },
      orderBy: {
        createdAt: 'asc' // Keep the oldest
      }
    });
    
    if (products.length <= 1) continue;
    
    const [keepProduct, ...duplicateProducts] = products;
    console.log(`    Keeping product ${keepProduct.id}, removing ${duplicateProducts.length} duplicates`);
    
    // Move all prices from duplicates to the kept product
    for (const dupProduct of duplicateProducts) {
      if (dupProduct.prices.length > 0) {
        console.log(`    Moving ${dupProduct.prices.length} prices from ${dupProduct.id} to ${keepProduct.id}`);
        
        await prisma.price.updateMany({
          where: { productId: dupProduct.id },
          data: { productId: keepProduct.id }
        });
      }
      
      // Delete the duplicate product
      await prisma.product.delete({
        where: { id: dupProduct.id }
      });
      
      report.deletedDuplicates++;
    }
  }
  
  console.log(`Removed ${report.deletedDuplicates} duplicate products`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting data fix process...');
  console.log('================================\n');
  
  try {
    // Run all fixes in sequence
    await fixProductNames();
    await fixUnits();
    await fixUnitPrices();
    await removeDuplicates();
    
    // Generate summary
    console.log('\n\n📊 Fix Summary:');
    console.log('================');
    console.log(`Total products checked: ${report.totalProducts}`);
    console.log(`Products fixed: ${report.fixedProducts}`);
    console.log(`Prices fixed: ${report.fixedPrices}`);
    console.log(`Duplicates removed: ${report.deletedDuplicates}`);
    console.log(`Errors encountered: ${report.errors.length}`);
    
    if (report.errors.length > 0) {
      console.log('\n⚠️ Errors:');
      report.errors.forEach(err => console.log(`  - ${err}`));
    }
    
    console.log('\n✅ Data fix completed!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Add command line options
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipNames = args.includes('--skip-names');
const skipUnits = args.includes('--skip-units');
const skipPrices = args.includes('--skip-prices');
const skipDuplicates = args.includes('--skip-duplicates');

if (dryRun) {
  console.log('🔍 DRY RUN MODE - No changes will be made\n');
}

console.log('Options:');
console.log(`  --dry-run: ${dryRun ? 'Yes' : 'No'}`);
console.log(`  --skip-names: ${skipNames ? 'Yes' : 'No'}`);
console.log(`  --skip-units: ${skipUnits ? 'Yes' : 'No'}`);
console.log(`  --skip-prices: ${skipPrices ? 'Yes' : 'No'}`);
console.log(`  --skip-duplicates: ${skipDuplicates ? 'Yes' : 'No'}`);
console.log('');

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });