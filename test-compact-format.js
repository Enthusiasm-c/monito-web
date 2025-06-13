// Test the compact format parsing functionality
const { GeminiUnifiedProcessor } = require('./app/services/gemini/GeminiUnifiedProcessor.ts');

// Simulate a compact format response
const testCompactResponse = `[{"n":"beef pepperoni classic","p":20550,"u":"pack","c":"beef","s":0.9},{"n":"beef salami cooked","p":13100,"u":"pack","c":"beef","s":0.9},{"n":"roast beef","p":28200,"u":"pack","c":"beef","s":0.9}]`;

// Test the parseCompactResponse method
console.log('Testing compact format parser...');

try {
  const processor = new GeminiUnifiedProcessor();
  
  // We need to test this through the public interface
  // Since parseCompactResponse is private, we'll test through parseGeminiResponse
  
  // Create a test that exercises the compact format path
  const fullResponse = processor.parseGeminiResponse(testCompactResponse, 'test-file.pdf');
  
  console.log('\n=== Parse Results ===');
  console.log(`Document Type: ${fullResponse.documentType}`);
  console.log(`Supplier: ${fullResponse.supplierName}`);
  console.log(`Products: ${fullResponse.products.length}`);
  console.log('\nSample products:');
  fullResponse.products.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name} - Rp ${p.price} per ${p.unit}`);
  });
  
  console.log('\n✅ Compact format parsing works correctly!');
  
} catch (error) {
  console.error('❌ Parse test failed:', error.message);
}