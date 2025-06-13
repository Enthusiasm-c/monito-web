const fs = require('fs');
const path = require('path');

// Configuration
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

// Test configuration
const testFile = '/Users/denisdomashenko/Downloads/AIbuyer/bali boga.pdf';

async function testBaliBogaOptimized() {
  console.log('Testing Bali Boga PDF with optimized approach...\n');
  
  try {
    // Read file
    const fileContent = fs.readFileSync(testFile);
    const base64Content = fileContent.toString('base64');
    
    console.log(`File: ${path.basename(testFile)}`);
    console.log(`Size: ${(fileContent.length / 1024).toFixed(2)} KB`);
    
    // Optimized prompt that encourages efficient JSON output
    const prompt = `Extract product data from this price list. Return ONLY a JSON array of products.

Each product should have this structure:
{"n":"product name","p":price_or_null,"u":"unit","c":"category","s":0.9}

Where:
- n = name (lowercase)
- p = price (number or null)
- u = unit (kg/pcs/l/ml/g/pack)
- c = category
- s = confidence score

CRITICAL: 
1. Extract ALL products (200+)
2. Use the shortened field names to save tokens
3. NO formatting, NO spaces between items
4. Return ONLY the array, nothing else
5. Start with [ and end with ]`;

    // API request with increased token limit
    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Content
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 32768, // Maximum available
        topP: 0.95,
        topK: 40
      }
    };

    console.log('\nSending request to Gemini API with max tokens...');
    const startTime = Date.now();
    
    const response = await fetch(`${API_URL}?key=${GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    const processingTime = (Date.now() - startTime) / 1000;
    console.log(`Response received in ${processingTime.toFixed(1)} seconds`);

    if (!response.ok) {
      const error = await response.text();
      console.error('\nAPI Error:', response.status, error);
      return;
    }

    const result = await response.json();
    
    // Extract text response
    const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textResponse) {
      console.error('\nNo text response from API');
      return;
    }

    console.log('\nResponse length:', textResponse.length, 'characters');
    
    // Save raw response
    fs.writeFileSync('bali-boga-optimized-raw.txt', textResponse);
    
    // Parse the compact JSON
    console.log('\nParsing compact response...');
    
    try {
      // Clean response - remove any markdown if present
      let cleanJson = textResponse.trim();
      if (cleanJson.includes('```')) {
        cleanJson = cleanJson.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }
      
      // Find array boundaries
      const start = cleanJson.indexOf('[');
      const end = cleanJson.lastIndexOf(']');
      
      if (start === -1 || end === -1) {
        throw new Error('No JSON array found in response');
      }
      
      cleanJson = cleanJson.substring(start, end + 1);
      
      // Try to fix common truncation issues
      if (!cleanJson.endsWith(']')) {
        // Remove incomplete last item
        const lastComma = cleanJson.lastIndexOf(',');
        if (lastComma > 0) {
          cleanJson = cleanJson.substring(0, lastComma) + ']';
        }
      }
      
      // Parse compact format
      const compactProducts = JSON.parse(cleanJson);
      
      // Convert to full format
      const products = compactProducts.map(p => ({
        name: p.n,
        price: p.p,
        unit: p.u,
        category: p.c || null,
        confidence: p.s || 0.9
      }));
      
      // Create full response
      const fullResponse = {
        documentType: "price_list",
        supplierName: "Bali Boga",
        supplierContact: {
          email: "order@metzgerbali.com",
          phone: "0361 3354 280",
          address: "Jl. Poh Gading 1A, Jimbaran - Bali"
        },
        products: products,
        extractionQuality: 0.9,
        metadata: {
          totalPages: 10,
          language: "Indonesian",
          currency: "IDR"
        }
      };
      
      // Save results
      fs.writeFileSync('bali-boga-optimized.json', JSON.stringify(fullResponse, null, 2));
      console.log('Parsed data saved to: bali-boga-optimized.json');
      
      // Show results
      console.log('\n=== EXTRACTION RESULTS ===');
      console.log(`Products Extracted: ${products.length}`);
      
      // Analyze categories
      const categories = [...new Set(products.map(p => p.c))].filter(Boolean);
      console.log(`\nCategories found: ${categories.join(', ')}`);
      
      // Show sample products
      console.log('\nFirst 5 products:');
      products.slice(0, 5).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name} - ${p.price ? `Rp ${p.price}` : 'No price'} per ${p.unit}`);
      });
      
      console.log('\nLast 5 products:');
      products.slice(-5).forEach((p, i) => {
        console.log(`${products.length - 4 + i}. ${p.name} - ${p.price ? `Rp ${p.price}` : 'No price'} per ${p.unit}`);
      });
      
      // Check if we got more than 200 products
      if (products.length > 200) {
        console.log(`\n✅ SUCCESS: Extracted ${products.length} products (target was 200+)`);
      } else if (products.length > 145) {
        console.log(`\n⚠️  PARTIAL SUCCESS: Extracted ${products.length} products (better than before)`);
      } else {
        console.log(`\n❌ Still truncated at ${products.length} products`);
      }
      
    } catch (parseError) {
      console.error('\nParse Error:', parseError.message);
      
      // Try to salvage what we can
      console.log('\nAttempting to salvage partial data...');
      
      // Count how many complete products we have
      const matches = textResponse.match(/\{"n":/g);
      if (matches) {
        console.log(`Found ${matches.length} product entries in raw response`);
      }
    }
    
  } catch (error) {
    console.error('\nTest failed:', error.message);
  }
}

// Run test
if (!GOOGLE_API_KEY) {
  console.error('Error: GOOGLE_API_KEY environment variable not set');
  process.exit(1);
}

testBaliBogaOptimized();