/**
 * Script to process all approved uploads and create missing products/prices
 * This script will go through all approved uploads and trigger the approval process
 * to create the Product and Price records from their extracted data
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function processApprovedUploads() {
  console.log('🚀 Starting to process all approved uploads...');
  
  try {
    // Find all approved uploads that haven't been processed yet
    const approvedUploads = await prisma.upload.findMany({
      where: {
        approvalStatus: 'approved',
        status: 'completed'
      },
      include: {
        supplier: true,
        prices: true // Include existing prices to check if already processed
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`Found ${approvedUploads.length} approved uploads to process`);

    let totalProductsCreated = 0;
    let uploadsProcessed = 0;
    let uploadsSkipped = 0;

    for (const upload of approvedUploads) {
      console.log(`\n📋 Processing upload: ${upload.id}`);
      console.log(`   📄 File: ${upload.originalName}`);
      console.log(`   🏢 Supplier: ${upload.supplier.name}`);
      console.log(`   📅 Created: ${upload.createdAt.toISOString()}`);
      
      // Check if this upload has extracted data
      if (!upload.extractedData) {
        console.log('   ⚠️ No extracted data found - skipping');
        uploadsSkipped++;
        continue;
      }

      const extractedData = upload.extractedData;
      const extractedProducts = extractedData.products || [];
      
      console.log(`   📦 Extracted products: ${extractedProducts.length}`);

      // Check if products were already created from this upload
      const existingPrices = upload.prices || [];
      if (existingPrices.length > 0) {
        console.log(`   ✅ Already processed - ${existingPrices.length} prices exist - skipping`);
        uploadsSkipped++;
        continue;
      }

      if (extractedProducts.length === 0) {
        console.log('   ⚠️ No products in extracted data - skipping');
        uploadsSkipped++;
        continue;
      }

      try {
        console.log('   🔄 Creating products and prices directly...');
        
        // Process products manually using the extracted data
        const productsCreated = await processExtractedProducts(
          extractedProducts,
          upload.supplierId,
          upload.id
        );

        console.log(`   ✅ Successfully created ${productsCreated} products`);
        totalProductsCreated += productsCreated;
        uploadsProcessed++;

      } catch (error) {
        console.error(`   ❌ Error processing upload ${upload.id}:`, error);
        uploadsSkipped++;
      }

      // Small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n📊 Processing Summary:');
    console.log(`   Total uploads found: ${approvedUploads.length}`);
    console.log(`   Uploads processed: ${uploadsProcessed}`);
    console.log(`   Uploads skipped: ${uploadsSkipped}`);
    console.log(`   Total products created: ${totalProductsCreated}`);

    // Verify final counts
    const finalProductCount = await prisma.product.count();
    const finalPriceCount = await prisma.price.count();
    
    console.log('\n🎯 Final Database Counts:');
    console.log(`   Products: ${finalProductCount}`);
    console.log(`   Prices: ${finalPriceCount}`);

    console.log('\n✅ Processing complete!');

  } catch (error) {
    console.error('❌ Error during processing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function processExtractedProducts(extractedProducts, supplierId, uploadId) {
  let productsCreated = 0;

  // Simple product normalization function
  function normalizeProduct(item) {
    return {
      name: item.name || item.productName || 'Unknown',
      price: parseFloat(item.price || item.amount || 0),
      unit: item.unit || 'pcs',
      category: item.category || 'Other',
      description: item.description || null
    };
  }

  // Simple standardization function
  function standardizeProductName(name) {
    return name.toLowerCase().trim().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Simple unit standardization
  function standardizeUnit(unit) {
    const normalized = unit.toLowerCase().trim();
    const unitMap = {
      'kg': 'kg', 'kilogram': 'kg', 'kilo': 'kg',
      'g': 'g', 'gram': 'g', 'gr': 'g',
      'l': 'l', 'liter': 'l', 'litre': 'l',
      'ml': 'ml', 'milliliter': 'ml',
      'pcs': 'pcs', 'piece': 'pcs', 'pc': 'pcs', 'each': 'pcs',
      'box': 'box', 'pack': 'pack', 'bottle': 'bottle', 'can': 'can'
    };
    return unitMap[normalized] || normalized;
  }

  // Filter valid products
  const validProducts = extractedProducts.filter(item => {
    const normalizedProduct = normalizeProduct(item);
    return normalizedProduct.price > 0 && normalizedProduct.name !== 'Unknown';
  });

  console.log(`     📦 Processing ${validProducts.length} valid products...`);

  // Group products by standardized name + unit to prevent duplicates
  const productGroups = new Map();

  for (const item of validProducts) {
    const normalizedProduct = normalizeProduct(item);
    const standardizedName = standardizeProductName(normalizedProduct.name);
    const standardizedUnit = standardizeUnit(normalizedProduct.unit);
    const groupKey = `${standardizedName}|${standardizedUnit}`;

    if (!productGroups.has(groupKey)) {
      productGroups.set(groupKey, {
        standardizedName,
        standardizedUnit,
        products: []
      });
    }

    productGroups.get(groupKey).products.push({
      originalItem: item,
      normalizedProduct,
      bestPrice: normalizedProduct.price
    });
  }

  console.log(`     📊 Grouped ${validProducts.length} products into ${productGroups.size} unique products`);

  // Process each unique product group
  for (const [groupKey, group] of productGroups) {
    try {
      // Find the product with the best price (lowest valid price)
      const validGroupProducts = group.products.filter(p => p.bestPrice > 0);
      if (validGroupProducts.length === 0) {
        console.warn(`     ⚠️ Skipping product group - no valid prices: ${group.standardizedName}`);
        continue;
      }

      const bestProduct = validGroupProducts.reduce((best, current) => 
        current.bestPrice < best.bestPrice ? current : best
      );

      // Find or create product
      const product = await findOrCreateProduct({
        rawName: bestProduct.originalItem.name,
        name: bestProduct.normalizedProduct.name,
        standardizedName: group.standardizedName,
        category: bestProduct.normalizedProduct.category,
        unit: bestProduct.normalizedProduct.unit,
        standardizedUnit: group.standardizedUnit,
        description: bestProduct.normalizedProduct.description
      });

      if (!product) {
        console.warn(`     ⚠️ Skipping product due to creation failure: ${group.standardizedName}`);
        continue;
      }

      // Check for existing active prices
      const existingPrices = await prisma.price.findMany({
        where: {
          productId: product.id,
          supplierId: supplierId,
          validTo: null
        }
      });

      // Check if this exact price already exists
      const exactPriceExists = existingPrices.some(price => 
        price.amount.toString() === bestProduct.bestPrice.toString() && 
        price.unit === bestProduct.normalizedProduct.unit
      );

      if (exactPriceExists) {
        console.log(`     🔄 Price already exists for ${group.standardizedName}, skipping duplicate`);
        continue;
      }

      // Create price history for existing prices
      if (existingPrices.length > 0) {
        for (const oldPrice of existingPrices) {
          const changePercentage = oldPrice.amount > 0 
            ? ((bestProduct.bestPrice - oldPrice.amount) / oldPrice.amount) * 100
            : 0;

          await prisma.priceHistory.create({
            data: {
              id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              price: bestProduct.bestPrice,
              unit: bestProduct.normalizedProduct.unit,
              changedFrom: oldPrice.amount,
              changePercentage: changePercentage,
              changeReason: 'upload',
              productId: product.id,
              supplierId: supplierId,
              uploadId: uploadId,
              createdAt: new Date()
            }
          });
        }

        // Deactivate old prices
        await prisma.price.updateMany({
          where: {
            productId: product.id,
            supplierId: supplierId,
            validTo: null
          },
          data: {
            validTo: new Date()
          }
        });
      } else {
        // Create initial price history entry
        await prisma.priceHistory.create({
          data: {
            id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            price: bestProduct.bestPrice,
            unit: bestProduct.normalizedProduct.unit,
            changedFrom: null,
            changePercentage: null,
            changeReason: 'initial',
            productId: product.id,
            supplierId: supplierId,
            uploadId: uploadId,
            createdAt: new Date()
          }
        });
      }

      // Create new price entry
      await prisma.price.create({
        data: {
          id: `price_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          amount: bestProduct.bestPrice,
          unit: bestProduct.normalizedProduct.unit,
          productId: product.id,
          supplierId: supplierId,
          uploadId: uploadId,
          validFrom: new Date()
        }
      });

      productsCreated++;

      // Log progress every 10 products
      if ((productsCreated % 10) === 0) {
        console.log(`     ✅ Processed ${productsCreated}/${productGroups.size} unique products...`);
      }

    } catch (error) {
      console.error(`     ❌ Error processing product group "${groupKey}":`, error);
    }
  }

  return productsCreated;
}

async function findOrCreateProduct(productData) {
  try {
    // Try to find existing product first
    const existing = await prisma.product.findFirst({
      where: {
        standardizedName: productData.standardizedName,
        standardizedUnit: productData.standardizedUnit
      }
    });

    if (existing) {
      return existing;
    }

    // Create new product
    return await prisma.product.create({
      data: {
        id: `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: productData.name.trim(),
        rawName: productData.rawName?.trim() || productData.name.trim(),
        standardizedName: productData.standardizedName.trim(),
        category: productData.category?.trim(),
        unit: productData.unit.trim(),
        standardizedUnit: productData.standardizedUnit?.trim() || productData.unit.trim(),
        description: productData.description?.trim(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error(`❌ Failed to create product: ${productData.name}`, error);
    return null;
  }
}

// Run the processing
processApprovedUploads().catch(console.error);