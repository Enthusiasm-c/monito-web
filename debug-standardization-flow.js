import { prisma } from 'lib/prisma';

const { PrismaClient } = require('@prisma/client');

async function debugStandardizationFlow() {
  

  try {
    console.log('=== DEBUGGING STANDARDIZATION FLOW ===\n');

    // 1. Check the most recent products with standardization data
    console.log('1. Recent products with standardization data:');
    const recentProducts = await prisma.product.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        prices: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    recentProducts.forEach((product, index) => {
      console.log(`\n--- Product ${index + 1} ---`);
      console.log(`Raw Name: "${product.rawName}"`);
      console.log(`Name: "${product.name}"`);
      console.log(`Standardized Name: "${product.standardizedName}"`);
      console.log(`Original Unit: "${product.unit}"`);
      console.log(`Standardized Unit: "${product.standardizedUnit}"`);
      
      if (product.prices[0]) {
        console.log(`Price Amount: ${product.prices[0].amount}`);
        console.log(`Price Unit: "${product.prices[0].unit}"`);
        
        // Check if this is a "K" unit case
        if (product.unit === 'K' || product.prices[0].unit === 'K') {
          console.log(`⚠️  ISSUE FOUND: Unit "K" detected but not converted!`);
          console.log(`   - Original unit: "${product.unit}"`);
          console.log(`   - Standardized unit: "${product.standardizedUnit}"`);
          console.log(`   - Price amount: ${product.prices[0].amount} (should be multiplied by 1000 if unit was K)`);
          console.log(`   - Price unit: "${product.prices[0].unit}" (should use standardized unit)`);
        }
      }
    });

    // 2. Analyze the data flow issues
    console.log('\n\n2. ANALYSIS OF ISSUES:');
    
    const kUnitProducts = recentProducts.filter(p => 
      p.unit === 'K' || (p.prices[0] && p.prices[0].unit === 'K')
    );
    
    if (kUnitProducts.length > 0) {
      console.log(`\n📋 Found ${kUnitProducts.length} products with "K" unit issues:`);
      
      kUnitProducts.forEach((product, index) => {
        console.log(`\n${index + 1}. "${product.rawName}"`);
        console.log(`   ❌ Problem: Original unit "K" is still being used`);
        console.log(`   ✅ ChatGPT standardized to: "${product.standardizedUnit}"`);
        console.log(`   💰 Price: ${product.prices[0]?.amount} (needs *1000 conversion)`);
        console.log(`   🔧 Should be: ${product.prices[0]?.amount * 1000} ${product.standardizedUnit}`);
      });
    }

    // 3. Check what's happening in the code
    console.log('\n\n3. CODE FLOW ANALYSIS:');
    console.log('The issue is in GeminiPipeline.ts processProducts method:');
    console.log('');
    console.log('Lines 328-329: Product creation stores original unit instead of standardized:');
    console.log('  unit: product.unit || "pcs",  // ❌ Should use standardized.standardizedUnit');
    console.log('  standardizedUnit: standardized.standardizedUnit,  // ✅ Correct');
    console.log('');
    console.log('Lines 342-343: Price creation uses original unit and no price conversion:');
    console.log('  amount: product.price || 0,  // ❌ Should convert K to thousands');
    console.log('  unit: product.unit || standardized.standardizedUnit,  // ❌ Should use standardized unit');
    console.log('');
    console.log('Lines 314-315: Existing product price creation also has same issues:');
    console.log('  amount: product.price || 0,  // ❌ Should convert K to thousands');
    console.log('  unit: product.unit || standardized.standardizedUnit,  // ❌ Should use standardized unit');

    // 4. Frontend display analysis
    console.log('\n\n4. FRONTEND DISPLAY ANALYSIS:');
    console.log('Frontend is correctly showing standardized data in some places:');
    console.log('');
    console.log('✅ Product names: Using product.standardizedName (line 914 in page.tsx)');
    console.log('❌ Product units: Using product.unit instead of product.standardizedUnit (line 924)');
    console.log('❌ Price amounts: No conversion applied for K units');
    console.log('✅ API sorting: Using standardizedName for sorting (lines 66-67 in /api/products/route.ts)');

  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugStandardizationFlow().catch(console.error);