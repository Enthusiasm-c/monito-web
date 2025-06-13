const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function approvePendingUploads() {
  try {
    console.log('🔍 Finding pending uploads...');
    
    // Find all uploads with pending_review status that have extracted data
    const pendingUploads = await prisma.upload.findMany({
      where: {
        approvalStatus: 'pending_review',
        extractedData: {
          not: null
        }
      },
      include: {
        supplier: true
      }
    });
    
    console.log(`📋 Found ${pendingUploads.length} pending uploads with extracted data`);
    
    if (pendingUploads.length === 0) {
      console.log('✅ No pending uploads to approve');
      return;
    }
    
    let totalProductsCreated = 0;
    let successCount = 0;
    let failureCount = 0;
    
    // Process each pending upload
    for (const upload of pendingUploads) {
      try {
        console.log(`\n📦 Processing upload: ${upload.id}`);
        console.log(`   File: ${upload.originalName}`);
        console.log(`   Supplier: ${upload.supplier.name}`);
        
        const extractedData = upload.extractedData;
        const products = extractedData.products || [];
        
        console.log(`   📊 Found ${products.length} products to create`);
        
        let productsCreated = 0;
        
        // Create products and prices
        for (const productData of products) {
          try {
            // Skip products without price
            if (!productData.price || productData.price <= 0) {
              console.log(`   ⚠️ Skipping product without price: ${productData.name}`);
              continue;
            }
            
            // Normalize product data
            const normalizedName = productData.name.toLowerCase().trim();
            const normalizedUnit = (productData.unit || 'pcs').toLowerCase().trim();
            
            // Find or create product
            let product = await prisma.product.findFirst({
              where: {
                standardizedName: normalizedName,
                standardizedUnit: normalizedUnit
              }
            });
            
            if (!product) {
              product = await prisma.product.create({
                data: {
                  id: `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  name: productData.name,
                  rawName: productData.name,
                  standardizedName: normalizedName,
                  category: productData.category || 'Other',
                  unit: productData.unit || 'pcs',
                  standardizedUnit: normalizedUnit,
                  description: productData.description,
                  createdAt: new Date(),
                  updatedAt: new Date()
                }
              });
            }
            
            // Deactivate old prices
            await prisma.price.updateMany({
              where: {
                productId: product.id,
                supplierId: upload.supplierId,
                validTo: null
              },
              data: {
                validTo: new Date()
              }
            });
            
            // Create new price
            await prisma.price.create({
              data: {
                id: `price_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                amount: productData.price,
                unit: productData.unit || 'pcs',
                productId: product.id,
                supplierId: upload.supplierId,
                uploadId: upload.id,
                validFrom: new Date()
              }
            });
            
            productsCreated++;
            
          } catch (error) {
            console.log(`   ❌ Error creating product ${productData.name}:`, error.message);
          }
        }
        
        // Update upload status
        await prisma.upload.update({
          where: { id: upload.id },
          data: {
            approvalStatus: 'approved',
            approvedBy: 'System Auto-Approval',
            approvedAt: new Date(),
            reviewNotes: 'Bulk approval of pending uploads',
            status: productsCreated > 0 ? 'completed' : 'completed_with_errors'
          }
        });
        
        console.log(`   ✅ Created ${productsCreated} products`);
        totalProductsCreated += productsCreated;
        successCount++;
        
      } catch (error) {
        console.error(`   ❌ Error processing ${upload.id}:`, error.message);
        failureCount++;
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`   ✅ Successfully processed: ${successCount} uploads`);
    console.log(`   🛍️ Total products created: ${totalProductsCreated}`);
    console.log(`   ❌ Failed: ${failureCount}`);
    console.log(`   📋 Total uploads: ${pendingUploads.length}`);
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

approvePendingUploads();