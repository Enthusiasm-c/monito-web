const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLastPdfUpload() {
  try {
    const lastPdfUpload = await prisma.upload.findFirst({
      where: {
        originalName: {
          endsWith: '.pdf'
        }
      },
      orderBy: { createdAt: 'desc' },
      include: { 
        supplier: true,
        prices: {
          include: { product: true }
        }
      }
    });
    
    if (lastPdfUpload) {
      console.log('Last PDF upload details:');
      console.log('ID:', lastPdfUpload.id);
      console.log('File:', lastPdfUpload.originalName);
      console.log('Status:', lastPdfUpload.status);
      console.log('Approval Status:', lastPdfUpload.approvalStatus);
      console.log('Total Rows Detected:', lastPdfUpload.totalRowsDetected);
      console.log('Total Rows Processed:', lastPdfUpload.totalRowsProcessed);
      console.log('Prices created:', lastPdfUpload.prices.length);
      console.log('Error:', lastPdfUpload.errorMessage);
      console.log('Processing Time:', lastPdfUpload.processingTimeMs, 'ms');
      
      if (lastPdfUpload.extractedData) {
        const data = lastPdfUpload.extractedData;
        console.log('\nExtracted Data Summary:');
        console.log('Products in extracted data:', data.products?.length || 0);
        if (data.products && data.products.length > 0) {
          console.log('First 3 products:');
          data.products.slice(0, 3).forEach(p => {
            console.log(`- ${p.name}: ${p.price} per ${p.unit}`);
          });
        }
      }
    } else {
      console.log('No PDF uploads found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLastPdfUpload();
