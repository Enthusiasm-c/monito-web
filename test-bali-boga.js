const fs = require('fs');
const path = require('path');

// Configuration
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

// Test configuration
const testFile = '/Users/denisdomashenko/Downloads/AIbuyer/bali boga.pdf';

async function testBaliBoga() {
  console.log('Testing Bali Boga PDF processing...\n');
  
  try {
    // Read file
    const fileContent = fs.readFileSync(testFile);
    const base64Content = fileContent.toString('base64');
    
    console.log(`File: ${path.basename(testFile)}`);
    console.log(`Size: ${(fileContent.length / 1024).toFixed(2)} KB`);
    
    // Create prompt with specific instructions for large files
    const prompt = `You are analyzing a price list document. Extract ALL product information from this document.

CRITICAL: This document contains over 200 products. You MUST extract ALL of them.

Return the data in this EXACT JSON format with NO additional text:
{
  "documentType": "price_list",
  "supplierName": "Bali Boga",
  "supplierContact": {
    "email": null,
    "phone": null,
    "address": null
  },
  "products": [
    {
      "name": "product name in lowercase",
      "price": numeric_value_or_null,
      "unit": "kg/pcs/l/ml/g",
      "category": "category or null",
      "confidence": 0.9
    }
  ],
  "extractionQuality": 0.9,
  "metadata": {
    "totalPages": 1,
    "language": "Indonesian",
    "currency": "IDR"
  }
}

IMPORTANT RULES:
1. Extract EVERY SINGLE product you can see
2. Do NOT truncate the list - include ALL products
3. Return ONLY valid JSON - no markdown, no explanations
4. If you see more than 100 products, continue extracting
5. Each product MUST have all fields including confidence score`;

    // API request
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
        maxOutputTokens: 8192,
        topP: 0.95,
        topK: 40
      }
    };

    console.log('\nSending request to Gemini API...');
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
    
    // Save raw response for debugging
    fs.writeFileSync('bali-boga-raw-response.txt', textResponse);
    console.log('Raw response saved to: bali-boga-raw-response.txt');
    
    // Try to parse JSON
    console.log('\nAttempting to parse response...');
    
    try {
      // Clean response
      let cleanJson = textResponse;
      
      // Remove markdown blocks
      if (cleanJson.includes('```json')) {
        cleanJson = cleanJson.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }
      
      // Remove any text before first { or [
      const jsonStart = Math.min(
        cleanJson.indexOf('{') !== -1 ? cleanJson.indexOf('{') : Infinity,
        cleanJson.indexOf('[') !== -1 ? cleanJson.indexOf('[') : Infinity
      );
      
      if (jsonStart !== Infinity) {
        cleanJson = cleanJson.substring(jsonStart);
      }
      
      // Remove any text after last } or ]
      const lastBrace = cleanJson.lastIndexOf('}');
      const lastBracket = cleanJson.lastIndexOf(']');
      const jsonEnd = Math.max(lastBrace, lastBracket);
      
      if (jsonEnd !== -1) {
        cleanJson = cleanJson.substring(0, jsonEnd + 1);
      }
      
      // Parse JSON
      const parsedData = JSON.parse(cleanJson);
      
      // Save parsed data
      fs.writeFileSync('bali-boga-parsed.json', JSON.stringify(parsedData, null, 2));
      console.log('Parsed data saved to: bali-boga-parsed.json');
      
      // Show results
      console.log('\n=== EXTRACTION RESULTS ===');
      console.log(`Supplier: ${parsedData.supplierName}`);
      console.log(`Document Type: ${parsedData.documentType}`);
      console.log(`Products Extracted: ${parsedData.products?.length || 0}`);
      
      if (parsedData.products && parsedData.products.length > 0) {
        console.log('\nFirst 5 products:');
        parsedData.products.slice(0, 5).forEach((p, i) => {
          console.log(`${i + 1}. ${p.name} - ${p.price ? `Rp ${p.price}` : 'No price'} per ${p.unit}`);
        });
        
        if (parsedData.products.length > 5) {
          console.log(`\n... and ${parsedData.products.length - 5} more products`);
        }
      }
      
    } catch (parseError) {
      console.error('\nJSON Parse Error:', parseError.message);
      console.log('\nFirst 500 chars of response:');
      console.log(textResponse.substring(0, 500));
      console.log('\nLast 500 chars of response:');
      console.log(textResponse.substring(textResponse.length - 500));
      
      // Check for common issues
      if (textResponse.includes('I cannot') || textResponse.includes('I am unable')) {
        console.log('\n⚠️  Model refused to process the document');
      } else if (textResponse.length < 100) {
        console.log('\n⚠️  Response too short - possible error');
      } else {
        console.log('\n⚠️  Response appears to be malformed JSON');
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

testBaliBoga();