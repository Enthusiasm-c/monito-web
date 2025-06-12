const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding test data...');

  try {
    // Check if data already exists
    const existingSupplier = await prisma.supplier.findFirst({
      where: { name: 'Toko Sembako Jaya' }
    });

    if (existingSupplier) {
      console.log('⚠️  Test data already exists, skipping...');
      return;
    }

    // Create suppliers
    const suppliers = await Promise.all([
      prisma.supplier.create({
        data: {
          name: 'Toko Sembako Jaya',
          email: 'toko.jaya@example.com',
          phone: '+62812345678'
        }
      }),
      prisma.supplier.create({
        data: {
          name: 'CV Mitra Pangan',
          email: 'mitra@example.com',
          phone: '+62887654321'
        }
      }),
      prisma.supplier.create({
        data: {
          name: 'UD Berkah Makmur',
          email: 'berkah@example.com',
          phone: '+62856789012'
        }
      })
    ]);

    console.log('✅ Created 3 suppliers');

    // Create products
    const productData = [
      {
        rawName: 'Beras Premium 5kg',
        name: 'Beras Premium 5kg',
        standardizedName: 'beras premium 5kg',
        unit: 'pack',
        standardizedUnit: 'pack',
        category: 'Groceries',
        prices: [65000, 68000, 70000]
      },
      {
        rawName: 'Minyak Goreng Bimoli 2L',
        name: 'Minyak Goreng Bimoli 2L',
        standardizedName: 'minyak goreng bimoli 2l',
        unit: 'bottle',
        standardizedUnit: 'bottle',
        category: 'Groceries',
        prices: [32000, 33000, 35000]
      },
      {
        rawName: 'Gula Pasir Gulaku 1kg',
        name: 'Gula Pasir Gulaku 1kg',
        standardizedName: 'gula pasir gulaku 1kg',
        unit: 'pack',
        standardizedUnit: 'pack',
        category: 'Groceries',
        prices: [14000, 14500, 15000]
      },
      {
        rawName: 'Ayam Potong Segar',
        name: 'Ayam Potong Segar',
        standardizedName: 'ayam potong segar',
        unit: 'kg',
        standardizedUnit: 'kg',
        category: 'Meat',
        prices: [35000, 38000, 40000]
      },
      {
        rawName: 'Telur Ayam Negeri',
        name: 'Telur Ayam Negeri',
        standardizedName: 'telur ayam negeri',
        unit: 'kg',
        standardizedUnit: 'kg',
        category: 'Dairy',
        prices: [28000, 29000, 30000]
      }
    ];

    for (const data of productData) {
      const { prices, ...productInfo } = data;
      
      const product = await prisma.product.create({
        data: productInfo
      });

      // Create prices for each supplier
      for (let i = 0; i < suppliers.length; i++) {
        await prisma.price.create({
          data: {
            productId: product.id,
            supplierId: suppliers[i].id,
            amount: prices[i],
            unit: product.unit
          }
        });
      }
    }

    console.log('✅ Created 5 products with prices');
    console.log('\n🎉 Test data seeded successfully!');
    console.log('\nYou can now test the bot with:');
    console.log('- /price beras');
    console.log('- /price minyak');
    console.log('- /price ayam');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });