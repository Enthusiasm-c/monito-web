const { PrismaClient } = require('@prisma/client');

async function syncToRemote() {
  console.log('🔄 Starting sync from local to remote database...');
  
  // First, get all data from local database
  const localPrisma = new PrismaClient();
  
  try {
    console.log('📥 Reading local database...');
    
    const localData = {
      suppliers: await localPrisma.supplier.findMany({
        include: {
          prices: true,
          uploads: true,
          priceHistory: true
        }
      }),
      products: await localPrisma.product.findMany({
        include: {
          prices: true,
          priceHistory: true
        }
      })
    };
    
    console.log(`📊 Local data counts:`);
    console.log(`  Suppliers: ${localData.suppliers.length}`);
    console.log(`  Products: ${localData.products.length}`);
    
    let totalPrices = 0;
    let totalUploads = 0;
    let totalPriceHistory = 0;
    
    localData.suppliers.forEach(supplier => {
      totalPrices += supplier.prices.length;
      totalUploads += supplier.uploads.length;
      totalPriceHistory += supplier.priceHistory.length;
    });
    
    console.log(`  Prices: ${totalPrices}`);
    console.log(`  Uploads: ${totalUploads}`);
    console.log(`  Price History: ${totalPriceHistory}`);
    
    // Now send to remote via API
    console.log('\n🚀 Syncing to remote server...');
    
    // Upload suppliers first
    for (const supplier of localData.suppliers) {
      try {
        const response = await fetch('http://209.38.85.196:3000/api/sync/supplier', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(supplier)
        });
        
        if (response.ok) {
          console.log(`✅ Synced supplier: ${supplier.name}`);
        } else {
          console.log(`❌ Failed to sync supplier: ${supplier.name}`);
        }
      } catch (error) {
        console.log(`❌ Error syncing supplier ${supplier.name}:`, error.message);
      }
    }
    
    // Upload products
    console.log('\n📦 Syncing products...');
    let productsSynced = 0;
    
    for (const product of localData.products) {
      try {
        const response = await fetch('http://209.38.85.196:3000/api/sync/product', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(product)
        });
        
        if (response.ok) {
          productsSynced++;
          if (productsSynced % 100 === 0) {
            console.log(`📊 Synced ${productsSynced}/${localData.products.length} products...`);
          }
        }
      } catch (error) {
        console.log(`❌ Error syncing product ${product.name}`);
      }
    }
    
    console.log('\n✅ Sync completed!');
    console.log(`📈 Products synced: ${productsSynced}/${localData.products.length}`);
    
  } catch (error) {
    console.error('❌ Sync error:', error);
  } finally {
    await localPrisma.$disconnect();
  }
}

// Check if sync API exists first
async function checkSyncAPI() {
  try {
    const response = await fetch('http://209.38.85.196:3000/api/sync/test');
    if (response.ok) {
      console.log('✅ Sync API available');
      return true;
    }
  } catch (error) {
    console.log('❌ Sync API not available, using direct database approach');
    return false;
  }
}

// Alternative: Create backup and restore it remotely
async function createFullBackup() {
  const localPrisma = new PrismaClient();
  
  try {
    console.log('📥 Creating full backup of current state...');
    
    const backupData = {
      metadata: {
        backupDate: new Date().toISOString(),
        version: "2.0",
        source: "local-with-july-2025-plus-historical",
        counts: {
          suppliers: await localPrisma.supplier.count(),
          products: await localPrisma.product.count(),
          uploads: await localPrisma.upload.count(),
          prices: await localPrisma.price.count(),
          priceHistory: await localPrisma.priceHistory.count()
        }
      },
      data: {
        suppliers: await localPrisma.supplier.findMany(),
        products: await localPrisma.product.findMany(),
        uploads: await localPrisma.upload.findMany(),
        prices: await localPrisma.price.findMany(),
        priceHistory: await localPrisma.priceHistory.findMany()
      }
    };
    
    const backupFilename = `full-backup-${Date.now()}.json`;
    require('fs').writeFileSync(backupFilename, JSON.stringify(backupData, null, 2));
    
    console.log(`✅ Backup created: ${backupFilename}`);
    console.log('📊 Backup contains:');
    Object.entries(backupData.metadata.counts).forEach(([table, count]) => {
      console.log(`  ${table}: ${count}`);
    });
    
    return backupFilename;
    
  } catch (error) {
    console.error('❌ Backup error:', error);
  } finally {
    await localPrisma.$disconnect();
  }
}

// Run backup creation
createFullBackup();