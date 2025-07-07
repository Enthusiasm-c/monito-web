const fs = require('fs');

async function deployBackupToRemote() {
  try {
    console.log('📤 Deploying backup to remote server...');
    
    // Read the backup file
    const backupData = JSON.parse(fs.readFileSync('./full-backup-1751864978248.json', 'utf8'));
    
    console.log('📊 Backup data loaded:');
    Object.entries(backupData.metadata.counts).forEach(([table, count]) => {
      console.log(`  ${table}: ${count}`);
    });
    
    // First, clear remote database
    console.log('\n🧹 Clearing remote database...');
    try {
      await fetch('http://209.38.85.196:3000/api/admin/system-cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clearAll: true,
          confirmation: 'CLEAR_ALL_DATA'
        })
      });
      console.log('✅ Remote database cleared');
    } catch (error) {
      console.log('⚠️ Could not clear via API, continuing...');
    }
    
    // Upload data in chunks
    console.log('\n📦 Uploading suppliers...');
    const suppliersResponse = await fetch('http://209.38.85.196:3000/api/restore/suppliers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(backupData.data.suppliers)
    });
    
    if (suppliersResponse.ok) {
      console.log('✅ Suppliers uploaded');
    } else {
      console.log('❌ Failed to upload suppliers');
    }
    
    console.log('\n📦 Uploading products...');
    const productsResponse = await fetch('http://209.38.85.196:3000/api/restore/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(backupData.data.products)
    });
    
    if (productsResponse.ok) {
      console.log('✅ Products uploaded');
    } else {
      console.log('❌ Failed to upload products');
    }
    
    console.log('\n📦 Uploading uploads...');
    const uploadsResponse = await fetch('http://209.38.85.196:3000/api/restore/uploads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(backupData.data.uploads)
    });
    
    if (uploadsResponse.ok) {
      console.log('✅ Uploads uploaded');
    } else {
      console.log('❌ Failed to upload uploads');
    }
    
    console.log('\n📦 Uploading prices...');
    const pricesResponse = await fetch('http://209.38.85.196:3000/api/restore/prices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(backupData.data.prices)
    });
    
    if (pricesResponse.ok) {
      console.log('✅ Prices uploaded');
    } else {
      console.log('❌ Failed to upload prices');
    }
    
    console.log('\n📦 Uploading price history...');
    const historyResponse = await fetch('http://209.38.85.196:3000/api/restore/price-history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(backupData.data.priceHistory)
    });
    
    if (historyResponse.ok) {
      console.log('✅ Price history uploaded');
    } else {
      console.log('❌ Failed to upload price history');
    }
    
    // Verify final state
    console.log('\n🔍 Verifying remote database state...');
    const statsResponse = await fetch('http://209.38.85.196:3000/api/products?limit=1');
    if (statsResponse.ok) {
      console.log('✅ Remote database accessible');
    }
    
    console.log('\n✅ Backup deployment completed!');
    
  } catch (error) {
    console.error('❌ Deployment error:', error);
    
    // Manual deployment instructions
    console.log('\n📝 Manual deployment required:');
    console.log('1. Copy full-backup-1751864978248.json to remote server');
    console.log('2. Run restore script on remote server');
    console.log('3. Verify data integrity');
  }
}

deployBackupToRemote();