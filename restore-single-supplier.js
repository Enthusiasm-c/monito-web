/**
 * Restore single supplier from backup
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function restoreSingleSupplier(backupFile, supplierName) {
  try {
    console.log(`🔍 Looking for supplier "${supplierName}" in backup...`);
    
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    const { data } = backupData;
    
    // Find the supplier
    const supplier = data.suppliers.find(s => s.name === supplierName);
    if (!supplier) {
      console.error(`❌ Supplier "${supplierName}" not found in backup`);
      return false;
    }
    
    console.log(`📦 Found supplier: ${supplier.name} (ID: ${supplier.id})`);
    
    // Check if supplier already exists
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id: supplier.id }
    });
    
    if (existingSupplier) {
      console.log(`⚠️  Supplier already exists, skipping restoration`);
      return true;
    }
    
    // Find related data
    const supplierPrices = supplier.prices || [];
    const supplierUploads = data.uploads.filter(u => u.supplierId === supplier.id);
    
    console.log(`📊 Found ${supplierPrices.length} prices and ${supplierUploads.length} uploads`);
    
    // Restore supplier
    await prisma.supplier.upsert({
      where: { id: supplier.id },
      update: {},
      create: {
        id: supplier.id,
        name: supplier.name,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        contactInfo: supplier.contactInfo,
        createdAt: new Date(supplier.createdAt),
        updatedAt: new Date(supplier.updatedAt)
      }
    });
    
    console.log(`✅ Restored supplier: ${supplier.name}`);
    
    // Restore uploads
    for (const upload of supplierUploads) {
      await prisma.upload.upsert({
        where: { id: upload.id },
        update: {},
        create: {
          id: upload.id,
          filename: upload.filename,
          originalName: upload.originalName,
          filePath: upload.filePath,
          fileSize: upload.fileSize,
          mimeType: upload.mimeType,
          status: upload.status,
          processedCount: upload.processedCount,
          errorCount: upload.errorCount,
          supplierId: upload.supplierId,
          createdAt: new Date(upload.createdAt),
          updatedAt: new Date(upload.updatedAt)
        }
      });
    }
    
    console.log(`✅ Restored ${supplierUploads.length} uploads`);
    
    // Collect all unique products first
    const uniqueProducts = new Map();
    for (const price of supplierPrices) {
      if (!uniqueProducts.has(price.productId)) {
        const product = data.products.find(p => p.id === price.productId);
        if (product) {
          uniqueProducts.set(price.productId, product);
        }
      }
    }
    
    console.log(`📦 Creating ${uniqueProducts.size} unique products...`);
    
    // Restore all unique products
    for (const [productId, product] of uniqueProducts) {
      await prisma.product.upsert({
        where: { id: productId },
        update: {},
        create: {
          id: product.id,
          rawName: product.rawName || product.name,
          name: product.name,
          standardizedName: product.standardizedName || product.standardName || product.name,
          category: product.category,
          unit: product.unit,
          standardizedUnit: product.standardizedUnit || product.unit,
          description: product.description,
          createdAt: new Date(product.createdAt),
          updatedAt: new Date(product.updatedAt)
        }
      });
    }
    
    console.log(`✅ Restored ${uniqueProducts.size} products`);
    
    // Restore prices in batches
    const batchSize = 50;
    for (let i = 0; i < supplierPrices.length; i += batchSize) {
      const batch = supplierPrices.slice(i, i + batchSize);
      console.log(`📈 Processing price batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(supplierPrices.length/batchSize)}`);
      
      for (const price of batch) {
        await prisma.price.upsert({
          where: { id: price.id },
          update: {},
          create: {
            id: price.id,
            amount: price.amount,
            unit: price.unit,
            unitPrice: price.unitPrice,
            validFrom: new Date(price.validFrom),
            validTo: price.validTo ? new Date(price.validTo) : null,
            supplierId: price.supplierId,
            productId: price.productId,
            uploadId: price.uploadId,
            createdAt: new Date(price.createdAt),
            updatedAt: new Date(price.updatedAt)
          }
        });
      }
    }
    
    console.log(`✅ Restored ${supplierPrices.length} prices`);
    
    console.log(`🎉 Successfully restored supplier "${supplierName}" with all data!`);
    return true;
    
  } catch (error) {
    console.error('❌ Error restoring supplier:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run restoration
const backupFile = process.argv[2] || 'production-backup-20250627-130117.json';
const supplierName = process.argv[3] || 'Island Organics Bali';

if (!fs.existsSync(backupFile)) {
  console.error('❌ Backup file not found:', backupFile);
  process.exit(1);
}

restoreSingleSupplier(backupFile, supplierName)
  .then(success => {
    if (success) {
      console.log(`\n✅ Restoration completed successfully!`);
      console.log(`🔧 Supplier "${supplierName}" has been restored from backup`);
    } else {
      console.log(`\n❌ Restoration failed!`);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Restoration failed:', error);
    process.exit(1);
  });