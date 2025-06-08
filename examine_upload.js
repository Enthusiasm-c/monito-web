const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function examineIslandOrganicsUpload() {
  try {
    console.log('Searching for Island Organics Bali.pdf upload...\n');
    
    // Find the upload record
    const upload = await prisma.upload.findFirst({
      where: {
        originalName: {
          contains: 'Island Organics Bali.pdf'
        }
      },
      include: {
        supplier: true,
        prices: {
          include: {
            product: true
          }
        }
      }
    });

    if (!upload) {
      console.log('No upload found for Island Organics Bali.pdf');
      
      // Let's see all uploads to find the correct name
      console.log('\nAll uploads:');
      const allUploads = await prisma.upload.findMany({
        select: {
          id: true,
          originalName: true,
          filename: true,
          status: true,
          createdAt: true,
          supplier: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      allUploads.forEach(u => {
        console.log(`- ${u.originalName} (${u.status}) - ${u.supplier.name} - ${u.createdAt}`);
      });
      
      return;
    }

    console.log('=== UPLOAD RECORD ===');
    console.log(`ID: ${upload.id}`);
    console.log(`Original Name: ${upload.originalName}`);
    console.log(`Filename: ${upload.filename}`);
    console.log(`Status: ${upload.status}`);
    console.log(`Supplier: ${upload.supplier.name}`);
    console.log(`File Size: ${upload.fileSize} bytes`);
    console.log(`MIME Type: ${upload.mimeType}`);
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
        console.log(`Description: ${price.product.description || 'None'}`);
      });
    }

    // Also check if there are any other uploads for this supplier
    console.log('\n=== OTHER UPLOADS FOR THIS SUPPLIER ===');
    const otherUploads = await prisma.upload.findMany({
      where: {
        supplierId: upload.supplierId,
        id: {
          not: upload.id
        }
      },
      select: {
        id: true,
        originalName: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            prices: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (otherUploads.length > 0) {
      otherUploads.forEach(u => {
        console.log(`- ${u.originalName} (${u.status}) - ${u._count.prices} products - ${u.createdAt}`);
      });
    } else {
      console.log('No other uploads for this supplier');
    }

  } catch (error) {
    console.error('Error examining upload:', error);
  } finally {
    await prisma.$disconnect();
  }
}

examineIslandOrganicsUpload();