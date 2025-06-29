/**
 * Restore production backup to any database
 * Usage: node restore-production-backup.js [backup-file]
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function restoreBackup(backupFile) {
  const prisma = new PrismaClient();
  
  try {
    console.log('🚀 Starting backup restoration...');
    console.log('📂 Backup file:', backupFile);
    
    // Read backup data
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    console.log('📊 Backup metadata:', backupData.metadata);
    
    // Clear existing data (CAUTION!)
    console.log('🧹 Clearing existing data...');
    await prisma.priceHistory.deleteMany();
    await prisma.unmatchedQueue.deleteMany();
    await prisma.price.deleteMany();
    await prisma.productAlias.deleteMany();
    await prisma.upload.deleteMany();
    await prisma.product.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.languageDictionary.deleteMany();
    await prisma.unitDictionary.deleteMany();
    console.log('✅ Existing data cleared');
    
    const { data } = backupData;
    
    // Restore suppliers
    console.log('📦 Restoring suppliers...');
    for (const supplier of data.suppliers) {
      const { id, prices, uploads, priceHistory, ...supplierData } = supplier;
      await prisma.supplier.create({
        data: {
          id,
          ...supplierData
        }
      });
    }
    console.log(`✅ Restored ${data.suppliers.length} suppliers`);
    
    // Restore products
    console.log('🥬 Restoring products...');
    for (const product of data.products) {
      const { id, prices, aliases, priceHistory, ...productData } = product;
      await prisma.product.create({
        data: {
          id,
          ...productData
        }
      });
    }
    console.log(`✅ Restored ${data.products.length} products`);
    
    // Restore product aliases
    console.log('🏷️ Restoring product aliases...');
    const allAliases = data.products.flatMap(p => p.aliases || []);
    for (const alias of allAliases) {
      const { id, ...aliasData } = alias;
      await prisma.productAlias.create({
        data: {
          id,
          ...aliasData
        }
      });
    }
    console.log(`✅ Restored ${allAliases.length} product aliases`);
    
    // Restore uploads
    console.log('📁 Restoring uploads...');
    for (const upload of data.uploads) {
      const { id, ...uploadData } = upload;
      await prisma.upload.create({
        data: {
          id,
          ...uploadData
        }
      });
    }
    console.log(`✅ Restored ${data.uploads.length} uploads`);
    
    // Restore prices from suppliers (to maintain relationships)
    console.log('💰 Restoring prices...');
    let priceCount = 0;
    for (const supplier of data.suppliers) {
      for (const price of supplier.prices || []) {
        const { id, product, supplier: supplierRef, upload, ...priceData } = price;
        await prisma.price.create({
          data: {
            id,
            ...priceData,
            productId: price.productId,
            supplierId: price.supplierId,
            uploadId: price.uploadId
          }
        });
        priceCount++;
      }
    }
    console.log(`✅ Restored ${priceCount} prices`);
    
    // Restore price history
    console.log('📈 Restoring price history...');
    for (const history of data.priceHistory) {
      const { id, product, supplier, upload, ...historyData } = history;
      await prisma.priceHistory.create({
        data: {
          id,
          ...historyData
        }
      });
    }
    console.log(`✅ Restored ${data.priceHistory.length} price history records`);
    
    // Restore dictionaries
    console.log('📚 Restoring dictionaries...');
    for (const lang of data.languageDictionary) {
      const { id, ...langData } = lang;
      await prisma.languageDictionary.create({
        data: { id, ...langData }
      });
    }
    for (const unit of data.unitDictionary) {
      const { id, ...unitData } = unit;
      await prisma.unitDictionary.create({
        data: { id, ...unitData }
      });
    }
    console.log(`✅ Restored ${data.languageDictionary.length} language + ${data.unitDictionary.length} unit dictionary entries`);
    
    // Restore unmatched queue
    console.log('🔄 Restoring unmatched queue...');
    for (const unmatched of data.unmatchedQueue) {
      const { id, supplier, upload, assignedProduct, ...unmatchedData } = unmatched;
      await prisma.unmatchedQueue.create({
        data: { id, ...unmatchedData }
      });
    }
    console.log(`✅ Restored ${data.unmatchedQueue.length} unmatched queue items`);
    
    // Verify restoration
    const counts = {
      suppliers: await prisma.supplier.count(),
      products: await prisma.product.count(),
      prices: await prisma.price.count(),
      uploads: await prisma.upload.count(),
      priceHistory: await prisma.priceHistory.count(),
    };
    
    console.log('\n🎉 Backup restoration completed successfully!');
    console.log('📊 Final counts:');
    console.log('   Suppliers:', counts.suppliers);
    console.log('   Products:', counts.products);
    console.log('   Prices:', counts.prices);
    console.log('   Uploads:', counts.uploads);
    console.log('   Price History:', counts.priceHistory);
    
  } catch (error) {
    console.error('❌ Restoration error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get backup file from command line argument
const backupFile = process.argv[2] || 'production-backup-20250627-130117.json';

if (!fs.existsSync(backupFile)) {
  console.error('❌ Backup file not found:', backupFile);
  process.exit(1);
}

restoreBackup(backupFile)
  .then(() => {
    console.log('✅ Restoration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Restoration failed:', error.message);
    process.exit(1);
  });