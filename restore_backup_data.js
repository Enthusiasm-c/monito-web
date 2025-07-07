const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function restoreBackupData() {
  const prisma = new PrismaClient();
  
  try {
    console.log('📥 Loading backup data...');
    const backupData = JSON.parse(fs.readFileSync('./production-backup-20250627-130117.json', 'utf8'));
    
    console.log('📊 Backup contains:');
    Object.entries(backupData.metadata.counts).forEach(([table, count]) => {
      console.log(`  ${table}: ${count}`);
    });
    
    console.log('\n🔍 Current database state:');
    const currentCounts = {
      suppliers: await prisma.supplier.count(),
      products: await prisma.product.count(),
      uploads: await prisma.upload.count(),
      prices: await prisma.price.count(),
      priceHistory: await prisma.priceHistory.count()
    };
    
    Object.entries(currentCounts).forEach(([table, count]) => {
      console.log(`  ${table}: ${count}`);
    });
    
    console.log('\n🚀 Starting restoration...');
    
    // Get existing supplier names to avoid duplicates
    const existingSuppliers = await prisma.supplier.findMany({
      select: { name: true }
    });
    const existingSupplierNames = new Set(existingSuppliers.map(s => s.name));
    
    // Get existing product names to avoid duplicates  
    const existingProducts = await prisma.product.findMany({
      select: { standardizedName: true, standardizedUnit: true }
    });
    const existingProductKeys = new Set(existingProducts.map(p => `${p.standardizedName}|${p.standardizedUnit}`));
    
    let suppliersAdded = 0;
    let productsAdded = 0;
    let pricesAdded = 0;
    
    // Restore suppliers
    console.log('\n📦 Restoring suppliers...');
    for (const supplier of backupData.data.suppliers) {
      if (!existingSupplierNames.has(supplier.name)) {
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
        suppliersAdded++;
        console.log(`  ✅ Added supplier: ${supplier.name}`);
      }
    }
    
    // Restore products 
    console.log('\n📦 Restoring products...');
    for (const product of backupData.data.products) {
      const productKey = `${product.standardizedName}|${product.standardizedUnit}`;
      if (!existingProductKeys.has(productKey)) {
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
        productsAdded++;
        if (productsAdded % 100 === 0) {
          console.log(`  📊 Restored ${productsAdded} products...`);
        }
      }
    }
    
    // Restore uploads (only if supplier exists)
    console.log('\n📦 Restoring uploads...');
    const allSuppliers = await prisma.supplier.findMany({ select: { id: true } });
    const supplierIds = new Set(allSuppliers.map(s => s.id));
    
    for (const upload of backupData.data.uploads) {
      if (supplierIds.has(upload.supplierId)) {
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
          console.log(`  ⚠️ Skipped upload ${upload.originalName} (duplicate ID)`);
        }
      }
    }
    
    console.log('\n📊 Final counts:');
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
    console.log(`📈 Added: ${suppliersAdded} suppliers, ${productsAdded} products`);
    
  } catch (error) {
    console.error('❌ Restoration error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreBackupData();