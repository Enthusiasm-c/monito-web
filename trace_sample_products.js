import { prisma } from 'lib/prisma';

const { PrismaClient } = require('@prisma/client');



async function traceSampleProducts() {
  try {
    console.log('🕵️ Tracing the source of Sample Products...\n');
    
    // Find all "Sample Product" entries
    const sampleProducts = await prisma.product.findMany({
      where: {
        OR: [
          { rawName: { contains: 'Sample Product' } },
          { name: { contains: 'Sample Product' } },
          { standardizedName: { contains: 'sample' } }
        ]
      },
      include: {
        prices: {
          include: {
            upload: {
              include: {
                supplier: true
              }
            }
          }
        }
      }
    });

    console.log(`Found ${sampleProducts.length} sample products:`);
    
    sampleProducts.forEach((product, i) => {
      console.log(`\n--- Sample Product ${i + 1} ---`);
      console.log(`ID: ${product.id}`);
      console.log(`Raw Name: "${product.rawName}"`);
      console.log(`Name: "${product.name}"`);
      console.log(`Standardized: "${product.standardizedName}"`);
      console.log(`Created: ${product.createdAt}`);
      console.log(`Unit: ${product.unit} → ${product.standardizedUnit}`);
      console.log(`Category: ${product.category}`);
      
      if (product.prices.length > 0) {
        console.log(`\nAssociated prices (${product.prices.length}):`);
        product.prices.forEach((price, j) => {
          console.log(`  ${j + 1}. ${price.amount} ${price.unit} - Supplier: ${price.upload?.supplier.name || 'Unknown'}`);
          console.log(`     Upload: ${price.upload?.originalName || 'No upload'} (${price.upload?.id || 'N/A'})`);
          console.log(`     Created: ${price.createdAt}`);
        });
      }
    });

    // Check specifically for Island Organics prices with sample products
    console.log('\n🏝️ Island Organics Sample Product Analysis:');
    
    const islandOrganicsPrices = await prisma.price.findMany({
      where: {
        supplier: {
          name: 'Island Organics Bali'
        },
        product: {
          rawName: { contains: 'Sample Product' }
        }
      },
      include: {
        product: true,
        supplier: true,
        upload: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${islandOrganicsPrices.length} Island Organics prices with sample products:`);
    
    islandOrganicsPrices.forEach((price, i) => {
      console.log(`\n${i + 1}. Product: "${price.product.rawName}"`);
      console.log(`   Price: ${price.amount} ${price.unit}`);
      console.log(`   Upload: ${price.upload?.originalName || 'No upload'} (ID: ${price.upload?.id || 'N/A'})`);
      console.log(`   Created: ${price.createdAt}`);
    });

    // Let's check what the file processor would do with an empty extracted data
    console.log('\n🔍 Analyzing the processing flow...');
    
    // Get the latest Island Organics upload
    const latestUpload = await prisma.upload.findFirst({
      where: {
        supplier: {
          name: 'Island Organics Bali'
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (latestUpload && latestUpload.extractedData) {
      console.log('\nLatest upload extracted data:', JSON.stringify(latestUpload.extractedData, null, 2));
      
      if (latestUpload.extractedData.products && latestUpload.extractedData.products.length === 0) {
        console.log('\n❌ FOUND THE ISSUE: extractedData.products is an empty array!');
        console.log('This means the PDF processing completely failed.');
        console.log('But somehow, sample products were still created...');
        
        // Check if there's a fallback mechanism we're missing
        console.log('\n🔍 Checking for potential fallback mechanisms...');
        
        // The sample products must be coming from somewhere else
        // Let's check if they're created during the processExtractedData call
        console.log('📝 processExtractedData receives an empty array, but sample products are created');
        console.log('This suggests there might be:');
        console.log('1. A hidden fallback in the processing chain');
        console.log('2. Sample data being injected at another point');
        console.log('3. Database constraints or triggers creating default data');
        console.log('4. Previous processing runs that weren\'t cleaned up');
      }
    }

    // Check if there are multiple uploads for the same supplier around the same time
    console.log('\n📅 Checking for related uploads:');
    
    const allIslandUploads = await prisma.upload.findMany({
      where: {
        supplier: {
          name: 'Island Organics Bali'
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });

    allIslandUploads.forEach((upload, i) => {
      console.log(`${i + 1}. ${upload.originalName} - ${upload.status} - ${upload.createdAt}`);
      console.log(`   ID: ${upload.id}`);
      if (upload.extractedData) {
        const productsCount = upload.extractedData.products ? upload.extractedData.products.length : 0;
        console.log(`   Extracted products: ${productsCount}`);
      }
    });

  } catch (error) {
    console.error('Error tracing sample products:', error);
  } finally {
    await prisma.$disconnect();
  }
}

traceSampleProducts();