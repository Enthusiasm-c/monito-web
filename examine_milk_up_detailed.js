const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function examineUpload() {
  try {
    const upload = await prisma.upload.findFirst({
      where: { fileName: 'milk up.pdf' },
      orderBy: { createdAt: 'desc' },
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
      console.log('No milk up upload found');
      return;
    }
    
    console.log('=== MILK UP UPLOAD ANALYSIS ===');
    console.log('Upload ID:', upload.id);
    console.log('File:', upload.originalName || upload.fileName);
    console.log('Status:', upload.status);
    console.log('Supplier:', upload.supplier.name);
    console.log('Total Rows Detected:', upload.totalRowsDetected);
    console.log('Total Rows Processed:', upload.totalRowsProcessed);
    console.log('Products/Prices Created:', upload.prices.length);
    console.log('Approval Status:', upload.approvalStatus);
    console.log('Auto Approved:', upload.autoApproved);
    
    // Check for duplicates
    const pricesByProduct = {};
    upload.prices.forEach(price => {
      const key = price.product.standardizedName + '_' + price.product.standardizedUnit;
      if (!pricesByProduct[key]) {
        pricesByProduct[key] = [];
      }
      pricesByProduct[key].push(price);
    });
    
    const duplicates = Object.entries(pricesByProduct).filter(([key, prices]) => prices.length > 1);
    console.log('Products with multiple prices:', duplicates.length);
    
    if (duplicates.length > 0) {
      console.log('\nSample duplicates:');
      duplicates.slice(0, 5).forEach(([key, prices]) => {
        console.log(`${key}: ${prices.length} prices`);
        prices.forEach(p => {
          console.log(`  - ${p.amount} ${p.unit} (ID: ${p.id})`);
        });
      });
    }
    
    // Show extracted data structure
    if (upload.extractedData) {
      const extractedProducts = upload.extractedData.products || [];
      console.log('\nExtracted products from JSON:', extractedProducts.length);
      
      // Check for patterns in extracted data
      const extractedByName = {};
      extractedProducts.forEach(product => {
        const name = product.name || product.product_name;
        if (!extractedByName[name]) {
          extractedByName[name] = [];
        }
        extractedByName[name].push(product);
      });
      
      const extractedDuplicates = Object.entries(extractedByName).filter(([name, products]) => products.length > 1);
      console.log('Extracted products with same name:', extractedDuplicates.length);
      
      if (extractedDuplicates.length > 0) {
        console.log('\nSample extracted duplicates:');
        extractedDuplicates.slice(0, 3).forEach(([name, products]) => {
          console.log(`${name}: ${products.length} variations`);
          products.forEach(p => {
            console.log(`  - ${p.price || p.amount} ${p.unit} (page: ${p.source_page || p.page})`);
          });
        });
      }
    }
    
    // Unique products count
    const uniqueProducts = new Set(upload.prices.map(p => p.product.standardizedName + '_' + p.product.standardizedUnit));
    console.log('\nUnique products (by standardized name + unit):', uniqueProducts.size);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

examineUpload();