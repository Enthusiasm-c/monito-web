const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function examineLatestUpload() {
  try {
    console.log('Examining the latest Island Organics upload with 6 products...\n');
    
    // Find the latest upload for Island Organics
    const upload = await prisma.upload.findFirst({
      where: {
        supplier: {
          name: 'Island Organics Bali'
        }
      },
      include: {
        supplier: true,
        prices: {
          include: {
            product: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!upload) {
      console.log('No upload found for Island Organics Bali');
      return;
    }

    console.log('=== LATEST UPLOAD RECORD ===');
    console.log(`ID: ${upload.id}`);
    console.log(`Original Name: ${upload.originalName}`);
    console.log(`Status: ${upload.status}`);
    console.log(`Created: ${upload.createdAt}`);
    console.log(`Updated: ${upload.updatedAt}`);
    console.log(`Error Message: ${upload.errorMessage || 'None'}`);

    console.log('\n=== EXTRACTED DATA ===');
    if (upload.extractedData) {
      console.log(JSON.stringify(upload.extractedData, null, 2));
    } else {
      console.log('No extracted data found');
    }

    console.log('\n=== PRODUCTS/PRICES CREATED ===');
    console.log(`Number of prices created: ${upload.prices.length}`);
    
    if (upload.prices.length > 0) {
      upload.prices.forEach((price, index) => {
        console.log(`\n--- Product ${index + 1} ---`);
        console.log(`Raw Name: ${price.product.rawName}`);
        console.log(`Cleaned Name: ${price.product.name}`);
        console.log(`Standardized Name: ${price.product.standardizedName}`);
        console.log(`Category: ${price.product.category || 'None'}`);
        console.log(`Unit: ${price.product.unit}`);
        console.log(`Standardized Unit: ${price.product.standardizedUnit}`);
        console.log(`Price: ${price.amount} ${price.unit}`);
      });
    }

  } catch (error) {
    console.error('Error examining upload:', error);
  } finally {
    await prisma.$disconnect();
  }
}

examineLatestUpload();