import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding test data...');

  // Create test suppliers
  const supplier1 = await prisma.supplier.create({
    data: {
      name: 'Toko Sembako Jaya',
      email: 'toko.jaya@example.com',
      phone: '+62812345678',
      address: 'Jl. Pasar Baru No. 123'
    }
  });

  const supplier2 = await prisma.supplier.create({
    data: {
      name: 'CV Mitra Pangan',
      email: 'mitra@example.com',
      phone: '+62887654321',
      address: 'Jl. Industri No. 45'
    }
  });

  const supplier3 = await prisma.supplier.create({
    data: {
      name: 'UD Berkah Makmur',
      email: 'berkah@example.com',
      phone: '+62856789012',
      address: 'Jl. Sejahtera No. 67'
    }
  });

  console.log('✅ Created 3 suppliers');

  // Create test products with realistic Indonesian prices
  const products = [
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
    },
    {
      rawName: 'Indomie Goreng',
      name: 'Indomie Goreng',
      standardizedName: 'indomie goreng',
      unit: 'dus',
      standardizedUnit: 'dus',
      category: 'Instant Food',
      prices: [95000, 98000, 100000]
    },
    {
      rawName: 'Kecap Manis ABC 600ml',
      name: 'Kecap Manis ABC 600ml',
      standardizedName: 'kecap manis abc 600ml',
      unit: 'bottle',
      standardizedUnit: 'bottle',
      category: 'Condiments',
      prices: [22000, 23000, 24000]
    },
    {
      rawName: 'Tepung Terigu Segitiga 1kg',
      name: 'Tepung Terigu Segitiga 1kg',
      standardizedName: 'tepung terigu segitiga 1kg',
      unit: 'pack',
      standardizedUnit: 'pack',
      category: 'Groceries',
      prices: [12000, 12500, 13000]
    }
  ];

  const suppliers = [supplier1, supplier2, supplier3];

  for (const productData of products) {
    const { prices, ...productInfo } = productData;
    
    const product = await prisma.product.create({
      data: productInfo
    });

    // Add prices from each supplier
    for (let i = 0; i < suppliers.length; i++) {
      await prisma.price.create({
        data: {
          productId: product.id,
          supplierId: suppliers[i].id,
          amount: prices[i],
          unit: product.unit,
          validFrom: new Date()
        }
      });
    }
  }

  console.log('✅ Created 8 products with prices');

  // Skip user and upload creation since those models don't exist
  console.log('✅ Skipping user/upload creation (models not in schema)');

  console.log('\n🎉 Test data seeded successfully!');
  console.log('\nYou can now test the bot with:');
  console.log('- /price beras');
  console.log('- /price minyak');
  console.log('- /price ayam');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });