const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProcessingDetails() {
  try {
    // Get specific upload with full details
    const uploadId = 'cmcfvupq90002s2w98b5o2vy7';
    const upload = await prisma.upload.findUnique({
      where: { id: uploadId },
      include: {
        supplier: true,
        prices: {
          include: {
            product: true
          }
        },
        _count: {
          select: { prices: true }
        }
      }
    });

    if (!upload) {
      console.log('Upload not found');
      return;
    }

    console.log('=== DETAILED UPLOAD ANALYSIS ===');
    console.log(`ID: ${upload.id}`);
    console.log(`File: ${upload.originalName}`);
    console.log(`File Path: ${upload.fileName}`);
    console.log(`Status: ${upload.status}`);
    console.log(`URL: ${upload.url}`);
    console.log(`MIME Type: ${upload.mimeType}`);
    console.log(`File Size: ${upload.fileSize} bytes`);
    console.log(`Supplier: ${upload.supplier?.name || 'N/A'}`);
    console.log(`Total Products Extracted: ${upload._count.prices}`);
    console.log(`Created: ${upload.createdAt}`);
    console.log(`Updated: ${upload.updatedAt}`);

    // Analyze extracted products
    if (upload.prices && upload.prices.length > 0) {
      console.log('\n=== EXTRACTED PRODUCTS ANALYSIS ===');
      console.log(`Total Products: ${upload.prices.length}`);
      
      // Group products by status/validity
      const validProducts = upload.prices.filter(p => p.product && p.product.name);
      const invalidProducts = upload.prices.filter(p => !p.product || !p.product.name);
      
      console.log(`Valid Products: ${validProducts.length}`);
      console.log(`Invalid/Incomplete Products: ${invalidProducts.length}`);
      
      // Price analysis
      const productsWithPrices = upload.prices.filter(p => p.price && p.price > 0);
      const productsWithoutPrices = upload.prices.filter(p => !p.price || p.price <= 0);
      
      console.log(`Products with valid prices: ${productsWithPrices.length}`);
      console.log(`Products without prices: ${productsWithoutPrices.length}`);
      
      // Unit analysis
      const productsWithUnits = upload.prices.filter(p => p.unit);
      console.log(`Products with units: ${productsWithUnits.length}`);
      
      // Show first 10 products as examples
      console.log('\n=== SAMPLE PRODUCTS (First 10) ===');
      upload.prices.slice(0, 10).forEach((priceEntry, index) => {
        console.log(`${index + 1}. Product: ${priceEntry.product?.name || 'UNKNOWN'}`);
        console.log(`   Price: ${priceEntry.price || 'N/A'} ${priceEntry.unit || ''}`);
        console.log(`   Raw Name: ${priceEntry.rawProductName || 'N/A'}`);
        console.log(`   Category: ${priceEntry.product?.category || 'N/A'}`);
        console.log('   ---');
      });
      
      if (upload.prices.length > 10) {
        console.log(`... and ${upload.prices.length - 10} more products`);
      }
    } else {
      console.log('\n=== NO PRODUCTS EXTRACTED ===');
      console.log('No products were extracted from this upload.');
    }

    if (upload.processingDetails) {
      console.log('\n=== PROCESSING DETAILS ===');
      try {
        const details = typeof upload.processingDetails === 'string' 
          ? JSON.parse(upload.processingDetails) 
          : upload.processingDetails;
        console.log('Processing Details:', JSON.stringify(details, null, 2));
      } catch (e) {
        console.log('Raw Processing Details:', upload.processingDetails);
      }
    }

    if (upload.errorMessage) {
      console.log('\n=== ERROR MESSAGE ===');
      console.log(upload.errorMessage);
    }

    // Check if file exists
    if (upload.url) {
      console.log('\n=== FILE CHECK ===');
      console.log(`File URL: ${upload.url}`);
      
      // If it's a local file path, check if it exists
      if (upload.url.startsWith('/') || upload.url.startsWith('./')) {
        const fs = require('fs');
        try {
          const stats = fs.statSync(upload.url);
          console.log(`File exists: Yes (${stats.size} bytes)`);
          console.log(`File modified: ${stats.mtime}`);
        } catch (e) {
          console.log(`File exists: No - ${e.message}`);
        }
      }
    }

    // Check progress in logs
    console.log('\n=== RECENT LOG ENTRIES ===');
    const fs = require('fs');
    try {
      const logContent = fs.readFileSync('/Users/denisdomashenko/monito-web/logs/processing.log', 'utf8');
      const lines = logContent.split('\n');
      const relevantLines = lines.filter(line => line.includes(upload.id));
      
      if (relevantLines.length > 0) {
        console.log('Found in processing logs:');
        relevantLines.forEach(line => {
          console.log(`  ${line}`);
        });
      } else {
        console.log('No entries found in processing.log');
      }
    } catch (e) {
      console.log('Could not read processing.log:', e.message);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProcessingDetails();