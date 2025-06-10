const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function examineMilkUpUpload() {
  try {
    const uploadId = 'cmbp2b4jr0002ou8mc90ouuej';
    console.log(`Examining upload with ID: ${uploadId}\n`);
    
    // Find the specific upload record
    const upload = await prisma.upload.findUnique({
      where: {
        id: uploadId
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
      console.log(`No upload found with ID: ${uploadId}`);
      
      // Let's see recent uploads that might be related
      console.log('\nRecent uploads:');
      const recentUploads = await prisma.upload.findMany({
        select: {
          id: true,
          originalName: true,
          fileName: true,
          status: true,
          createdAt: true,
          errorMessage: true,
          totalRowsDetected: true,
          totalRowsProcessed: true,
          supplier: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10
      });
      
      recentUploads.forEach(u => {
        console.log(`- ID: ${u.id}`);
        console.log(`  Name: ${u.originalName || u.fileName}`);
        console.log(`  Status: ${u.status}`);
        console.log(`  Supplier: ${u.supplier.name}`);
        console.log(`  Rows: ${u.totalRowsDetected}/${u.totalRowsProcessed}`);
        console.log(`  Created: ${u.createdAt}`);
        console.log(`  Error: ${u.errorMessage || 'None'}`);
        console.log('');
      });
      
      return;
    }

    console.log('=== UPLOAD RECORD ===');
    console.log(`ID: ${upload.id}`);
    console.log(`Original Name: ${upload.originalName}`);
    console.log(`Filename: ${upload.fileName}`);
    console.log(`Status: ${upload.status}`);
    console.log(`Supplier: ${upload.supplier.name}`);
    console.log(`File Size: ${upload.fileSize} bytes`);
    console.log(`MIME Type: ${upload.mimeType}`);
    console.log(`URL: ${upload.url || 'None'}`);
    console.log(`Created: ${upload.createdAt}`);
    console.log(`Updated: ${upload.updatedAt}`);
    console.log(`Error Message: ${upload.errorMessage || 'None'}`);
    console.log(`Processing Details: ${upload.processingDetails || 'None'}`);

    // Processing metrics
    console.log('\n=== PROCESSING METRICS ===');
    console.log(`Total Rows Detected: ${upload.totalRowsDetected || 'None'}`);
    console.log(`Total Rows Processed: ${upload.totalRowsProcessed || 'None'}`);
    console.log(`Completeness Ratio: ${upload.completenessRatio || 'None'}`);
    console.log(`Processing Time (ms): ${upload.processingTimeMs || 'None'}`);
    console.log(`Tokens Used: ${upload.tokensUsed || 'None'}`);
    console.log(`Processing Cost (USD): ${upload.processingCostUsd || 'None'}`);

    if (upload.sheetsProcessed) {
      console.log('\n=== SHEETS PROCESSED ===');
      console.log(JSON.stringify(upload.sheetsProcessed, null, 2));
    }

    console.log('\n=== EXTRACTED DATA ===');
    if (upload.extractedData) {
      console.log(JSON.stringify(upload.extractedData, null, 2));
    } else {
      console.log('No extracted data found');
    }

    console.log('\n=== PRODUCTS/PRICES CREATED ===');
    console.log(`Number of prices created: ${upload.prices.length}`);
    
    if (upload.prices.length > 0) {
      upload.prices.slice(0, 5).forEach((price, index) => {
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
      
      if (upload.prices.length > 5) {
        console.log(`\n... and ${upload.prices.length - 5} more products`);
      }
    }

  } catch (error) {
    console.error('Error examining upload:', error);
  } finally {
    await prisma.$disconnect();
  }
}

examineMilkUpUpload();