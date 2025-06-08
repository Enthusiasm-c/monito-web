const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugIslandOrganicsProcessing() {
  try {
    console.log('Looking for processing insights...\n');
    
    // Get the latest upload to understand what's happening
    const latestUpload = await prisma.upload.findFirst({
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

    if (!latestUpload) {
      console.log('No upload found');
      return;
    }

    console.log('=== LATEST UPLOAD DEBUG INFO ===');
    console.log(`Upload ID: ${latestUpload.id}`);
    console.log(`File: ${latestUpload.originalName}`);
    console.log(`File URL: ${latestUpload.filename}`);
    console.log(`Status: ${latestUpload.status}`);
    console.log(`MIME Type: ${latestUpload.mimeType}`);
    console.log(`File Size: ${latestUpload.fileSize} bytes`);
    console.log(`Created: ${latestUpload.createdAt}`);
    console.log(`Updated: ${latestUpload.updatedAt}`);
    console.log(`Processing Time: ${(new Date(latestUpload.updatedAt).getTime() - new Date(latestUpload.createdAt).getTime()) / 1000}s`);

    console.log('\n=== EXTRACTED DATA ANALYSIS ===');
    if (latestUpload.extractedData) {
      const data = latestUpload.extractedData;
      console.log('Raw extracted data:', JSON.stringify(data, null, 2));
      
      if (data.products && Array.isArray(data.products)) {
        console.log(`Products in extractedData: ${data.products.length}`);
        if (data.products.length === 0) {
          console.log('❌ ISSUE: No products found in extracted data!');
        } else {
          console.log('Sample products from extractedData:');
          data.products.slice(0, 3).forEach((p, i) => {
            console.log(`  ${i + 1}. ${p.name} - ${p.price} ${p.unit}`);
          });
        }
      } else {
        console.log('❌ ISSUE: No products array in extracted data!');
      }
      
      if (data.supplier) {
        console.log(`Supplier from extraction: ${data.supplier.name}`);
      } else {
        console.log('No supplier info in extracted data');
      }
    } else {
      console.log('❌ ISSUE: No extracted data at all!');
    }

    console.log('\n=== ACTUAL PRODUCTS IN DATABASE ===');
    console.log(`Products/prices created: ${latestUpload.prices.length}`);
    
    if (latestUpload.prices.length > 0) {
      console.log('\nSample products in database:');
      latestUpload.prices.slice(0, 6).forEach((price, i) => {
        console.log(`  ${i + 1}. "${price.product.rawName}" → "${price.product.standardizedName}" - ${price.amount} ${price.unit}`);
      });
      
      // Check for duplicates
      const uniqueProducts = new Set(latestUpload.prices.map(p => p.product.standardizedName));
      if (uniqueProducts.size < latestUpload.prices.length) {
        console.log(`\n⚠️ WARNING: Found ${latestUpload.prices.length - uniqueProducts.size} duplicate products!`);
        console.log('Unique products:', Array.from(uniqueProducts));
      }
      
      // Check if all products are "sample" products
      const sampleProducts = latestUpload.prices.filter(p => 
        p.product.rawName.toLowerCase().includes('sample')
      );
      
      if (sampleProducts.length === latestUpload.prices.length) {
        console.log('\n❌ CRITICAL ISSUE: ALL products are "Sample Product" - extraction failed completely!');
      } else if (sampleProducts.length > 0) {
        console.log(`\n⚠️ WARNING: ${sampleProducts.length} out of ${latestUpload.prices.length} products are "Sample Product"`);
      }
    }

    // Let's also check what might have gone wrong in the processing
    console.log('\n=== POSSIBLE ISSUES ===');
    
    if (!latestUpload.extractedData || !latestUpload.extractedData.products || latestUpload.extractedData.products.length === 0) {
      console.log('1. ❌ PDF extraction failed - no products found in raw extraction');
      console.log('   - This could be due to complex PDF structure');
      console.log('   - Vision API might have failed to read the PDF content');
      console.log('   - Text extraction might have failed');
    }
    
    if (latestUpload.prices.length > 0 && latestUpload.prices.every(p => p.product.rawName.includes('Sample'))) {
      console.log('2. ❌ Fallback data used - system created sample products when extraction failed');
      console.log('   - This suggests the advanced PDF processor returned empty results');
      console.log('   - System fell back to creating dummy sample data');
    }
    
    console.log('\n=== RECOMMENDATIONS ===');
    console.log('1. Check the actual PDF file structure and content');
    console.log('2. Review PDF processing logs for specific error messages');
    console.log('3. Test the Vision API directly with the PDF URL');
    console.log('4. Consider manual inspection of the PDF to understand its structure');

  } catch (error) {
    console.error('Error debugging processing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugIslandOrganicsProcessing();