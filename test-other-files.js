const fs = require('fs');
const path = require('path');

// Configuration
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

// Test files
const testFiles = [
  { path: '/Users/denisdomashenko/Downloads/AIbuyer/Oka veg supplier.xlsx', type: 'Excel' },
  { path: '/Users/denisdomashenko/Downloads/AIbuyer/sri 2 vegetables supplier.xlsx', type: 'Excel' },
  { path: '/Users/denisdomashenko/Downloads/AIbuyer/munch bakery.jpg', type: 'Image' },
  { path: '/Users/denisdomashenko/Downloads/AIbuyer/VALENTA cheese supplier.pdf', type: 'PDF' }
];

async function testFile(filePath, fileType) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing ${fileType}: ${path.basename(filePath)}`);
  console.log('='.repeat(60));
  
  try {
    // Read file
    const fileContent = fs.readFileSync(filePath);
    const base64Content = fileContent.toString('base64');
    
    console.log(`Size: ${(fileContent.length / 1024).toFixed(2)} KB`);
    
    // Determine mime type
    let mimeType = 'application/octet-stream';
    if (filePath.endsWith('.xlsx')) mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    else if (filePath.endsWith('.jpg')) mimeType = 'image/jpeg';
    else if (filePath.endsWith('.pdf')) mimeType = 'application/pdf';
    
    // Create appropriate prompt
    const prompt = `Extract ALL product information from this ${fileType} file.
Return ONLY valid JSON in this format:
{
  "documentType": "price_list",
  "supplierName": "supplier name from file",
  "products": [
    {
      "name": "product name",
      "price": numeric_value_or_null,
      "unit": "unit",
      "category": "category or null",
      "confidence": 0.9
    }
  ]
}

For Excel files: Extract data from all rows and columns.
For Images: Use OCR to extract all visible text and products.
Return ONLY the JSON, no markdown formatting.`;

    // API request
    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
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

    console.log('Sending to Gemini API...');
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
      console.error('API Error:', response.status, error);
      return { success: false, error: `API Error: ${response.status}` };
    }

    const result = await response.json();
    const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textResponse) {
      console.error('No text response from API');
      return { success: false, error: 'No response content' };
    }

    // Parse JSON
    try {
      let cleanJson = textResponse;
      // Remove markdown if present
      if (cleanJson.includes('```json')) {
        cleanJson = cleanJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      }
      
      const parsedData = JSON.parse(cleanJson);
      
      console.log('\n✅ SUCCESS:');
      console.log(`- Supplier: ${parsedData.supplierName}`);
      console.log(`- Products extracted: ${parsedData.products?.length || 0}`);
      
      if (parsedData.products && parsedData.products.length > 0) {
        console.log('\nFirst 3 products:');
        parsedData.products.slice(0, 3).forEach((p, i) => {
          console.log(`  ${i + 1}. ${p.name} - ${p.price ? `Rp ${p.price}` : 'No price'} per ${p.unit}`);
        });
      }
      
      return {
        success: true,
        file: path.basename(filePath),
        type: fileType,
        productsExtracted: parsedData.products?.length || 0,
        processingTime: processingTime
      };
      
    } catch (parseError) {
      console.error('\n❌ JSON Parse Error:', parseError.message);
      console.log('Response preview:', textResponse.substring(0, 200) + '...');
      return { success: false, error: `Parse error: ${parseError.message}` };
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('Testing Gemini Flash 2.0 on different file types...\n');
  
  const results = [];
  
  for (const fileToTest of testFiles) {
    if (fs.existsSync(fileToTest.path)) {
      const result = await testFile(fileToTest.path, fileToTest.type);
      results.push(result);
    } else {
      console.log(`\n⚠️  File not found: ${fileToTest.path}`);
      results.push({ 
        success: false, 
        file: path.basename(fileToTest.path),
        type: fileToTest.type,
        error: 'File not found' 
      });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\nTotal files tested: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);
  
  if (successful.length > 0) {
    console.log('\n✅ Successful files:');
    successful.forEach(r => {
      console.log(`  - ${r.file} (${r.type}): ${r.productsExtracted} products in ${r.processingTime.toFixed(1)}s`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed files:');
    failed.forEach(r => {
      console.log(`  - ${r.file} (${r.type}): ${r.error}`);
    });
  }
}

// Run tests
if (!GOOGLE_API_KEY) {
  console.error('Error: GOOGLE_API_KEY environment variable not set');
  process.exit(1);
}

runAllTests();