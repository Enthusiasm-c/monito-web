import { enhancedPdfExtractor } from '../app/services/enhancedPdfExtractor';

async function testIslandOrganics() {
  console.log('Testing Island Organics PDF with enhanced extractor...');
  
  const pdfUrl = 'http://localhost:8888/Island%20Organics%20Bali.pdf';
  const fileName = 'Island Organics Bali.pdf';
  
  try {
    const result = await enhancedPdfExtractor.extractFromPdf(pdfUrl, fileName);
    
    console.log('\n=== EXTRACTION RESULTS ===');
    console.log(`Products extracted: ${result.products.length}`);
    console.log(`Completeness: ${(result.completenessRatio * 100).toFixed(1)}%`);
    console.log(`Best method: ${result.extractionMethods.bestMethod}`);
    console.log(`Errors: ${result.errors.length}`);
    
    // Show first 10 products
    console.log('\nFirst 10 products:');
    result.products.slice(0, 10).forEach((product, i) => {
      console.log(`${i + 1}. ${product.name}: ${product.price.toLocaleString('id-ID')} IDR`);
    });
    
    // Check if AI fallback should be triggered
    if (result.products.length < 50) {
      console.log('\n⚠️ Low extraction count - AI Vision should be triggered');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Set environment variable
process.env.AI_VISION_ENABLED = 'true';

testIslandOrganics();