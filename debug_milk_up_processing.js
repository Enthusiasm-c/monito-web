const { advancedPdfProcessor } = require('./app/services/advancedPdfProcessor.ts');

async function debugMilkUpProcessing() {
  const fileUrl = 'https://cdc1w79ssc4kg6xh.public.blob.vercel-storage.com/milk%20up-NfjH4tricnfL7EYkqp0FCp8IawEbgU.pdf';
  
  console.log('🔍 Starting debug processing for milk up.pdf...');
  console.log('📎 File URL:', fileUrl);
  
  try {
    console.log('🚀 Starting advanced PDF processing...');
    const result = await advancedPdfProcessor.processComplexPdf(fileUrl);
    
    console.log('✅ Processing completed successfully!');
    console.log('📊 Result summary:');
    console.log(`- Products found: ${result.products.length}`);
    console.log(`- Supplier info: ${result.supplier ? 'Yes' : 'No'}`);
    
    if (result.supplier) {
      console.log('🏢 Supplier details:', JSON.stringify(result.supplier, null, 2));
    }
    
    if (result.products.length > 0) {
      console.log('📦 First 5 products:');
      result.products.slice(0, 5).forEach((product, index) => {
        console.log(`  ${index + 1}. ${product.name} - ${product.price} ${product.unit}`);
      });
    }
    
    console.log('\n🔍 Full result:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Processing failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

debugMilkUpProcessing();