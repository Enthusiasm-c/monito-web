import { prisma } from 'lib/prisma';

const { PrismaClient } = require('@prisma/client');



async function fixTomatoUnits() {
  try {
    console.log('🔧 Fixing tomato unit issues...');

    // First, create suppliers if they don't exist
    const suppliers = await Promise.all([
      prisma.supplier.upsert({
        where: { name: 'Local Farm' },
        update: {},
        create: {
          name: 'Local Farm',
          email: 'orders@localfarm.com',
          phone: '+1-555-0201',
          address: 'Local Farm Address'
        }
      }),
      prisma.supplier.upsert({
        where: { name: 'City Market' },
        update: {},
        create: {
          name: 'City Market',
          email: 'orders@citymarket.com', 
          phone: '+1-555-0202',
          address: 'City Market Address'
        }
      })
    ]);

    console.log(`✅ Created/updated ${suppliers.length} suppliers`);

    // Create tomato products
    const tomatoProduct = await prisma.product.upsert({
      where: { 
        standardizedName_standardizedUnit: { 
          standardizedName: 'tomato', 
          standardizedUnit: 'kg' 
        } 
      },
      update: {},
      create: {
        name: 'Tomato',
        standardizedName: 'tomato',
        category: 'Vegetables',
        unit: 'kg',
        standardizedUnit: 'kg',
        description: 'Fresh tomatoes'
      }
    });

    const tomatoLocalProduct = await prisma.product.upsert({
      where: { 
        standardizedName_standardizedUnit: { 
          standardizedName: 'tomato local', 
          standardizedUnit: 'kg' 
        } 
      },
      update: {},
      create: {
        name: 'Tomato Local',
        standardizedName: 'tomato local', 
        category: 'Vegetables',
        unit: 'kg', // FIXED: was 'g', should be 'kg'
        standardizedUnit: 'kg',
        description: 'Local fresh tomatoes'
      }
    });

    console.log('✅ Created tomato products');

    // Add prices - demonstrating the problem and fix
    const prices = await Promise.all([
      // Regular tomato at 20000 per kg (high price)
      prisma.price.upsert({
        where: {
          supplierId_productId_validFrom: {
            supplierId: suppliers[1].id, // City Market
            productId: tomatoProduct.id,
            validFrom: new Date()
          }
        },
        update: { amount: 20000 },
        create: {
          amount: 20000,
          unit: 'kg',
          supplierId: suppliers[1].id,
          productId: tomatoProduct.id
        }
      }),
      
      // Local tomato at 15000 per kg (better price) - FIXED unit
      prisma.price.upsert({
        where: {
          supplierId_productId_validFrom: {
            supplierId: suppliers[0].id, // Local Farm  
            productId: tomatoLocalProduct.id,
            validFrom: new Date()
          }
        },
        update: { amount: 15000 },
        create: {
          amount: 15000,
          unit: 'kg', // FIXED: was 'g', now correctly 'kg'
          supplierId: suppliers[0].id,
          productId: tomatoLocalProduct.id
        }
      })
    ]);

    console.log('✅ Added/updated tomato prices');

    // Verify the data
    const allTomatoes = await prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: 'tomato', mode: 'insensitive' } },
          { standardizedName: { contains: 'tomato', mode: 'insensitive' } }
        ]
      },
      include: {
        prices: {
          where: { validTo: null },
          include: { supplier: true }
        }
      }
    });

    console.log('\n📊 Current tomato data:');
    allTomatoes.forEach(product => {
      console.log(`- ${product.name} (${product.unit})`);
      product.prices.forEach(price => {
        console.log(`  └─ ${price.supplier.name}: ${price.amount} per ${price.unit}`);
      });
    });

    console.log('\n✅ Tomato unit fix completed!');
    console.log('Now "Tomato Local" at 15000/kg should appear as better deal for "Tomato" at 20000/kg');

  } catch (error) {
    console.error('❌ Error fixing tomato units:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixTomatoUnits();