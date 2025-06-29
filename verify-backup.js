/**
 * Verify backup file integrity
 */

const fs = require('fs');

function verifyBackup(backupFile) {
  try {
    console.log('🔍 Verifying backup file:', backupFile);
    
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    const { metadata, data } = backupData;
    
    console.log('\n📊 Backup Information:');
    console.log('   Created:', metadata.backupDate);
    console.log('   Version:', metadata.version);
    console.log('   Source:', metadata.source);
    
    console.log('\n📈 Data Counts:');
    Object.entries(metadata.counts).forEach(([key, value]) => {
      console.log(`   ${key}: ${value.toLocaleString()}`);
    });
    
    console.log('\n✅ Backup file is valid and contains:');
    console.log(`   📦 ${data.suppliers.length} suppliers`);
    console.log(`   🥬 ${data.products.length} products`);
    console.log(`   📁 ${data.uploads.length} uploads`);
    console.log(`   💰 ${data.priceHistory.length} price history records`);
    
    // Sample data
    console.log('\n📋 Sample Suppliers:');
    data.suppliers.slice(0, 5).forEach(s => {
      console.log(`   - ${s.name} (${s.prices?.length || 0} prices)`);
    });
    
    console.log('\n📋 Sample Products:');
    data.products.slice(0, 5).forEach(p => {
      console.log(`   - ${p.name} (${p.category})`);
    });
    
    console.log('\n🎉 Backup verification successful!');
    
  } catch (error) {
    console.error('❌ Backup verification failed:', error.message);
    return false;
  }
  
  return true;
}

const backupFile = process.argv[2] || 'production-backup-20250627-130117.json';

if (!fs.existsSync(backupFile)) {
  console.error('❌ Backup file not found:', backupFile);
  process.exit(1);
}

if (verifyBackup(backupFile)) {
  console.log('\n✅ Backup is ready for restoration!');
  console.log(`\n🔧 To restore, run:`);
  console.log(`   node restore-production-backup.js ${backupFile}`);
} else {
  process.exit(1);
}