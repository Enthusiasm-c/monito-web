const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function restoreNestedPrices() {
  const prisma = new PrismaClient();
  
  try {
    console.log('📥 Loading backup data...');
    const backupData = JSON.parse(fs.readFileSync('./production-backup-20250627-130117.json', 'utf8'));
    
    console.log('💰 Extracting prices from products...');
    
    let pricesFound = 0;
    let pricesAdded = 0;
    let pricesSkipped = 0;
    
    // Extract prices from products
    for (const product of backupData.data.products) {
      if (product.prices && product.prices.length > 0) {
        pricesFound += product.prices.length;
        
        for (const price of product.prices) {
          try {
            // Check if product and supplier still exist
            const productExists = await prisma.product.findUnique({
              where: { id: price.productId }
            });
            const supplierExists = await prisma.supplier.findUnique({
              where: { id: price.supplierId }
            });
            
            if (productExists && supplierExists) {
              await prisma.price.create({
                data: {
                  id: price.id,
                  amount: parseFloat(price.amount),
                  unit: price.unit,
                  unitPrice: price.unitPrice ? parseFloat(price.unitPrice) : null,
                  supplierId: price.supplierId,
                  productId: price.productId,
                  uploadId: price.uploadId,
                  validFrom: new Date(price.validFrom),
                  validTo: price.validTo ? new Date(price.validTo) : null,
                  createdAt: new Date(price.createdAt),
                  updatedAt: new Date(price.updatedAt)
                }
              });
              pricesAdded++;
              
              if (pricesAdded % 100 === 0) {
                console.log(`  📊 Restored ${pricesAdded}/${pricesFound} prices...`);
              }
            } else {
              pricesSkipped++;
            }
          } catch (error) {
            pricesSkipped++;
            // Skip duplicates or constraint violations
          }
        }
      }
    }
    
    // Also extract prices from suppliers 
    console.log('💰 Extracting prices from suppliers...');
    for (const supplier of backupData.data.suppliers) {
      if (supplier.prices && supplier.prices.length > 0) {
        for (const price of supplier.prices) {
          try {
            // Check if product exists
            const productExists = await prisma.product.findUnique({
              where: { id: price.productId }
            });
            
            if (productExists) {
              await prisma.price.create({
                data: {
                  id: price.id,
                  amount: parseFloat(price.amount),
                  unit: price.unit,
                  unitPrice: price.unitPrice ? parseFloat(price.unitPrice) : null,
                  supplierId: price.supplierId,
                  productId: price.productId,
                  uploadId: price.uploadId,
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
            } else {
              pricesSkipped++;
            }
          } catch (error) {
            pricesSkipped++;
          }
        }
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
    
    console.log('\n✅ Nested price restoration completed!');
    console.log(`💰 Found: ${pricesFound} prices in backup`);
    console.log(`💰 Added: ${pricesAdded} new prices`);
    console.log(`⚠️ Skipped: ${pricesSkipped} prices`);
    
  } catch (error) {
    console.error('❌ Nested price restoration error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreNestedPrices();