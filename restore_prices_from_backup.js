const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function restorePricesFromBackup() {
  const prisma = new PrismaClient();
  
  try {
    console.log('📥 Loading backup data...');
    const backupData = JSON.parse(fs.readFileSync('./production-backup-20250627-130117.json', 'utf8'));
    
    console.log('💰 Restoring prices from backup...');
    
    // Get existing products and suppliers by their original IDs
    const products = await prisma.product.findMany({ select: { id: true } });
    const suppliers = await prisma.supplier.findMany({ select: { id: true } });
    const uploads = await prisma.upload.findMany({ select: { id: true } });
    
    const productIds = new Set(products.map(p => p.id));
    const supplierIds = new Set(suppliers.map(s => s.id));
    const uploadIds = new Set(uploads.map(u => u.id));
    
    let pricesAdded = 0;
    let pricesSkipped = 0;
    
    console.log(`Processing ${backupData.data.prices?.length || 0} prices...`);
    
    for (const price of backupData.data.prices || []) {
      // Check if product, supplier exist
      if (productIds.has(price.productId) && supplierIds.has(price.supplierId)) {
        // Check if upload exists (optional)
        const uploadExists = !price.uploadId || uploadIds.has(price.uploadId);
        
        try {
          await prisma.price.create({
            data: {
              id: price.id,
              amount: parseFloat(price.amount),
              unit: price.unit,
              unitPrice: price.unitPrice ? parseFloat(price.unitPrice) : null,
              supplierId: price.supplierId,
              productId: price.productId,
              uploadId: uploadExists ? price.uploadId : null,
              validFrom: new Date(price.validFrom),
              validTo: price.validTo ? new Date(price.validTo) : null,
              createdAt: new Date(price.createdAt),
              updatedAt: new Date(price.updatedAt)
            }
          });
          pricesAdded++;
          
          if (pricesAdded % 100 === 0) {
            console.log(`  📊 Restored ${pricesAdded} prices...`);
          }
        } catch (error) {
          pricesSkipped++;
          // Skip duplicates or constraint violations
        }
      } else {
        pricesSkipped++;
      }
    }
    
    console.log('\n💰 Restoring price history...');
    let historyAdded = 0;
    let historySkipped = 0;
    
    for (const history of backupData.data.priceHistory || []) {
      if (productIds.has(history.productId) && supplierIds.has(history.supplierId)) {
        const uploadExists = !history.uploadId || uploadIds.has(history.uploadId);
        
        try {
          await prisma.priceHistory.create({
            data: {
              id: history.id,
              productId: history.productId,
              supplierId: history.supplierId,
              price: parseFloat(history.price),
              unit: history.unit,
              unitPrice: history.unitPrice ? parseFloat(history.unitPrice) : null,
              quantity: history.quantity ? parseFloat(history.quantity) : null,
              changedFrom: history.changedFrom ? parseFloat(history.changedFrom) : null,
              changePercentage: history.changePercentage,
              changeReason: history.changeReason,
              changedBy: history.changedBy,
              uploadId: uploadExists ? history.uploadId : null,
              notes: history.notes,
              createdAt: new Date(history.createdAt)
            }
          });
          historyAdded++;
          
          if (historyAdded % 100 === 0) {
            console.log(`  📊 Restored ${historyAdded} price history entries...`);
          }
        } catch (error) {
          historySkipped++;
        }
      } else {
        historySkipped++;
      }
    }
    
    console.log('\n📊 Final database state:');
    const finalCounts = {
      suppliers: await prisma.supplier.count(),
      products: await prisma.product.count(),
      uploads: await prisma.upload.count(),
      prices: await prisma.price.count(),
      priceHistory: await prisma.priceHistory.count()
    };
    
    Object.entries(finalCounts).forEach(([table, count]) => {
      console.log(`  ${table}: ${count}`);
    });
    
    console.log('\n✅ Price restoration completed!');
    console.log(`💰 Added: ${pricesAdded} prices (skipped ${pricesSkipped})`);
    console.log(`📈 Added: ${historyAdded} price history entries (skipped ${historySkipped})`);
    
  } catch (error) {
    console.error('❌ Price restoration error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restorePricesFromBackup();