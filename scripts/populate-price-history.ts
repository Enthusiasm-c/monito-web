/**
 * Script to populate price history from existing price data
 * Run with: npx ts-node scripts/populate-price-history.ts
 */

import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function populatePriceHistory() {
  console.log('🚀 Starting price history population...');
  
  try {
    // Get all existing prices
    const prices = await prisma.price.findMany({
      include: {
        product: {
          select: { id: true, name: true }
        },
        supplier: {
          select: { id: true, name: true }
        },
        upload: {
          select: { id: true, originalName: true }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`📊 Found ${prices.length} existing prices to migrate`);

    if (prices.length === 0) {
      console.log('✅ No prices found, nothing to migrate');
      return;
    }

    let processed = 0;
    let errors = 0;

    // Process in batches to avoid memory issues
    const batchSize = 100;
    const totalBatches = Math.ceil(prices.length / batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, prices.length);
      const batch = prices.slice(startIndex, endIndex);

      console.log(`📦 Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} items)`);

      // Prepare batch data for insertion
      const historyData = batch.map(price => ({
        id: `hist_${price.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        productId: price.productId,
        supplierId: price.supplierId,
        price: price.amount,
        unit: price.unit,
        unitPrice: price.unitPrice,
        quantity: null, // We don't have quantity data in existing prices
        changedFrom: null, // First entry, no previous price
        changePercentage: null,
        changeReason: 'initial',
        changedBy: null,
        uploadId: price.uploadId,
        notes: 'Migrated from existing price data',
        createdAt: price.createdAt
      }));

      try {
        // Insert batch
        await prisma.priceHistory.createMany({
          data: historyData,
          skipDuplicates: true
        });

        processed += batch.length;
        console.log(`✅ Batch ${batchIndex + 1} completed. Progress: ${processed}/${prices.length}`);

      } catch (error) {
        console.error(`❌ Error processing batch ${batchIndex + 1}:`, error);
        errors += batch.length;
      }

      // Small delay between batches to avoid overwhelming the database
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`✅ Successfully processed: ${processed} price records`);
    console.log(`❌ Errors: ${errors} records`);
    console.log(`📊 Total: ${processed + errors} records`);

    if (errors === 0) {
      console.log('🎉 Price history migration completed successfully!');
    } else {
      console.log('⚠️  Migration completed with some errors. Check logs above.');
    }

    // Show some statistics
    const totalHistory = await prisma.priceHistory.count();
    const uniqueProducts = await prisma.priceHistory.groupBy({
      by: ['productId'],
      _count: true
    });
    const uniqueSuppliers = await prisma.priceHistory.groupBy({
      by: ['supplierId'],
      _count: true
    });

    console.log('\n📊 Database Statistics:');
    console.log(`💰 Total price history records: ${totalHistory}`);
    console.log(`📦 Products with history: ${uniqueProducts.length}`);
    console.log(`🏪 Suppliers with history: ${uniqueSuppliers.length}`);

  } catch (error) {
    console.error('💥 Fatal error during migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Create admin user if it doesn't exist
async function createAdminUser() {
  console.log('👤 Creating default admin user...');
  
  try {
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@monito-web.com' }
    });

    if (existingAdmin) {
      console.log('✅ Admin user already exists');
      return;
    }

    // In a real app, you'd hash the password
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@monito-web.com',
        name: 'System Administrator',
        password: 'admin123', // TODO: Hash this password
        role: 'admin',
        isActive: true
      }
    });

    console.log(`✅ Created admin user: ${adminUser.email}`);
    console.log('⚠️  Default password: admin123 (change immediately!)');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  }
}

// Main execution
async function main() {
  console.log('🔄 Starting database population script...\n');
  
  await createAdminUser();
  console.log(''); // Empty line for separation
  await populatePriceHistory();
  
  console.log('\n🏁 Script completed!');
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}

export { populatePriceHistory, createAdminUser };