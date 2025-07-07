
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function restoreFromBackup() {
  const prisma = new PrismaClient();
  
  try {
    console.log('📥 Loading backup data...');
    const backupData = JSON.parse(fs.readFileSync('./full-backup-1751864978248.json', 'utf8'));
    
    console.log('📊 Backup contains:');
    Object.entries(backupData.metadata.counts).forEach(([table, count]) => {
      console.log(`  ${table}: ${count}`);
    });
    
    console.log('\n🚀 Starting restoration...');
    
    // Restore suppliers
    console.log('📦 Restoring suppliers...');
    for (const supplier of backupData.data.suppliers) {
      try {
        await prisma.supplier.create({
          data: {
            id: supplier.id,
            name: supplier.name,
            contactInfo: supplier.contactInfo,
            email: supplier.email,
            phone: supplier.phone,
            address: supplier.address,
            createdAt: new Date(supplier.createdAt),
            updatedAt: new Date(supplier.updatedAt)
          }
        });
      } catch (error) {
        console.log(`⚠️ Skipped supplier ${supplier.name} (duplicate)`);
      }
    }
    
    // Restore products
    console.log('📦 Restoring products...');
    let productsRestored = 0;
    for (const product of backupData.data.products) {
      try {
        await prisma.product.create({
          data: {
            id: product.id,
            rawName: product.rawName,
            name: product.name,
            standardizedName: product.standardizedName,
            category: product.category,
            unit: product.unit,
            standardizedUnit: product.standardizedUnit,
            description: product.description,
            createdAt: new Date(product.createdAt),
            updatedAt: new Date(product.updatedAt)
          }
        });
        productsRestored++;
        if (productsRestored % 100 === 0) {
          console.log(`  📊 Restored ${productsRestored} products...`);
        }
      } catch (error) {
        // Skip duplicates
      }
    }
    
    // Restore uploads
    console.log('📦 Restoring uploads...');
    for (const upload of backupData.data.uploads) {
      try {
        await prisma.upload.create({
          data: {
            id: upload.id,
            originalName: upload.originalName,
            fileSize: upload.fileSize,
            mimeType: upload.mimeType,
            status: upload.status,
            supplierId: upload.supplierId,
            extractedData: upload.extractedData,
            errorMessage: upload.errorMessage,
            fileName: upload.fileName,
            processingDetails: upload.processingDetails,
            url: upload.url,
            completenessRatio: upload.completenessRatio,
            processingCostUsd: upload.processingCostUsd,
            processingTimeMs: upload.processingTimeMs,
            sheetsProcessed: upload.sheetsProcessed,
            tokensUsed: upload.tokensUsed,
            totalRowsDetected: upload.totalRowsDetected,
            totalRowsProcessed: upload.totalRowsProcessed,
            approvalStatus: upload.approvalStatus || 'approved',
            approvedBy: upload.approvedBy,
            approvedAt: upload.approvedAt ? new Date(upload.approvedAt) : null,
            rejectionReason: upload.rejectionReason,
            reviewNotes: upload.reviewNotes,
            autoApproved: upload.autoApproved || false,
            createdAt: new Date(upload.createdAt),
            updatedAt: new Date(upload.updatedAt)
          }
        });
      } catch (error) {
        // Skip duplicates
      }
    }
    
    // Restore prices
    console.log('📦 Restoring prices...');
    let pricesRestored = 0;
    for (const price of backupData.data.prices) {
      try {
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
        pricesRestored++;
        if (pricesRestored % 100 === 0) {
          console.log(`  📊 Restored ${pricesRestored} prices...`);
        }
      } catch (error) {
        // Skip duplicates
      }
    }
    
    // Restore price history
    console.log('📦 Restoring price history...');
    let historyRestored = 0;
    for (const history of backupData.data.priceHistory) {
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
            uploadId: history.uploadId,
            notes: history.notes,
            createdAt: new Date(history.createdAt)
          }
        });
        historyRestored++;
        if (historyRestored % 100 === 0) {
          console.log(`  📊 Restored ${historyRestored} price history entries...`);
        }
      } catch (error) {
        // Skip duplicates
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
    
    console.log('\n✅ Restoration completed!');
    
  } catch (error) {
    console.error('❌ Restoration error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreFromBackup();
