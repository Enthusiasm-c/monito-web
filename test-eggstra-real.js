#!/usr/bin/env node

/**
 * Real test of Eggstra PDF processing using actual Gemini API
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Load environment variables
require('dotenv').config();

async function testEggstraWithRealAPI() {
  try {
    console.log('🚀 Testing Eggstra PDF with REAL Gemini API...\n');
    
    // Step 1: Convert PDF to images (we already have this working)
    console.log('📄 Step 1: Converting PDF to images...');
    const images = await convertPdfToImages();
    
    console.log(`✅ Generated ${images.length} images from PDF`);
    
    // Step 2: Process each image with real Gemini API
    console.log('\n🤖 Step 2: Processing images with Gemini 2.0 Flash...');
    
    let allProducts = [];
    let totalTokens = 0;
    let totalCost = 0;
    let supplier = null;
    
    for (let i = 0; i < images.length; i++) {
      console.log(`\n🔍 Processing page ${i + 1}/${images.length}...`);
      
      const pageResult = await processImageWithGemini(images[i], i + 1);
      
      if (pageResult.success) {
        const products = pageResult.data.products || [];
        console.log(`✅ Page ${i + 1}: ${products.length} products extracted`);
        
        // Add page info to products
        products.forEach(product => {
          product.sourcePage = i + 1;
          product.sourceMethod = 'gemini_vision';
        });
        
        allProducts = allProducts.concat(products);
        
        // Get supplier from first successful page
        if (!supplier && pageResult.data.supplier) {
          supplier = pageResult.data.supplier;
          console.log(`🏢 Supplier detected: ${supplier.name}`);
        }
        
        totalTokens += pageResult.tokensUsed || 0;
        totalCost += pageResult.cost || 0;
        
        // Show some sample products
        if (products.length > 0) {
          console.log('   Sample products:');
          products.slice(0, 3).forEach(p => {
            console.log(`   - ${p.name}: ${formatPrice(p.price)} ${p.unit || ''}`);
          });
        }
      } else {
        console.log(`❌ Page ${i + 1}: ${pageResult.error}`);
      }
      
      // Add delay between requests to respect rate limits
      if (i < images.length - 1) {
        console.log('   ⏳ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Step 3: Analyze results
    console.log('\n📊 FINAL RESULTS:');
    console.log('=' .repeat(50));
    
    console.log(`📦 Total products extracted: ${allProducts.length}`);
    console.log(`🏢 Supplier: ${supplier?.name || 'Not detected'}`);
    console.log(`💰 Total cost: $${totalCost.toFixed(6)}`);
    console.log(`🔤 Total tokens: ${totalTokens}`);
    
    if (allProducts.length > 0) {
      analyzeProducts(allProducts);
    }
    
    // Step 4: Test standardization on a few products
    if (allProducts.length > 0) {
      console.log('\n🔄 Step 3: Testing AI standardization...');
      await testStandardization(allProducts.slice(0, 10));
    }
    
    return {
      totalProducts: allProducts.length,
      supplier: supplier,
      cost: totalCost,
      tokens: totalTokens,
      products: allProducts
    };
    
  } catch (error) {
    console.error('❌ Real test failed:', error.message);
    throw error;
  }
}

async function convertPdfToImages() {
  const { spawn } = require('child_process');
  
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'test-pdf-converter.py');
    const pdfPath = path.join(__dirname, 'test-eggstra.pdf');
    const maxPages = 8;
    
    const pythonProcess = spawn('python3', [scriptPath, pdfPath, maxPages.toString()]);
    
    let outputData = '';
    let errorData = '';
    
    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`PDF conversion failed with code ${code}`));
        return;
      }
      
      try {
        const result = JSON.parse(outputData);
        if (result.success) {
          resolve(result.images);
        } else {
          reject(new Error(result.error));
        }
      } catch (e) {
        reject(new Error('Failed to parse PDF conversion result'));
      }
    });
  });
}

async function processImageWithGemini(base64Image, pageNumber) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY not found');
  }
  
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + apiKey;
  
  const prompt = `You are "GeminiExtractor" specialized in extracting product data from Indonesian price lists and invoices.

Analyze this image and extract ALL products with their prices. Return a JSON object with this exact structure:

{
  "supplier": {
    "name": "detected supplier name",
    "email": "email if found",
    "phone": "phone if found", 
    "address": "address if found"
  },
  "products": [
    {
      "name": "product name in English",
      "price": numeric_price_in_rupiah,
      "unit": "unit (kg/g/pcs/pack/etc)",
      "category": "category (Meat/Seafood/Vegetables/Dairy/Other)",
      "description": "any additional details"
    }
  ],
  "metadata": {
    "confidence": 0.95,
    "totalItems": number_of_products_found,
    "language": "detected language",
    "currency": "IDR"
  }
}

CRITICAL RULES:
1. Translate Indonesian product names to English
2. Convert Indonesian price formats: "15k" = 15000, "1.5jt" = 1500000
3. Standard categories: Meat, Seafood, Vegetables, Fruits, Dairy, Grains, Other
4. Standard units: kg, g, l, ml, pcs, pack, box, bottle, can, bunch
5. Extract ALL visible products, don't skip any
6. Be precise with numbers and units`;

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: 'image/png',
            data: base64Image
          }
        }
      ]
    }]
  };
  
  try {
    console.log(`   🌐 Calling Gemini API for page ${pageNumber}...`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    
    // Extract token usage
    const usage = result.usageMetadata || {};
    const inputTokens = usage.promptTokenCount || 0;
    const outputTokens = usage.candidatesTokenCount || 0;
    const totalTokens = inputTokens + outputTokens;
    
    // Calculate cost (approximate for Gemini 2.0 Flash)
    const cost = (inputTokens * 0.00015 + outputTokens * 0.0006) / 1000;
    
    console.log(`   📊 Tokens: ${totalTokens} (${inputTokens} input + ${outputTokens} output)`);
    console.log(`   💰 Cost: $${cost.toFixed(6)}`);
    
    // Extract the generated text
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error('No content in Gemini response');
    }
    
    // Parse JSON from the response
    let extractedData;
    try {
      // Clean the response (remove markdown code blocks if present)
      let cleanContent = content;
      
      // Remove markdown code blocks
      if (cleanContent.includes('```json')) {
        cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      } else if (cleanContent.includes('```')) {
        cleanContent = cleanContent.replace(/```\s*/g, '');
      }
      
      cleanContent = cleanContent.trim();
      
      // Find JSON object boundaries
      const jsonStart = cleanContent.indexOf('{');
      const jsonEnd = cleanContent.lastIndexOf('}') + 1;
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        cleanContent = cleanContent.substring(jsonStart, jsonEnd);
      }
      
      extractedData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.log('   ⚠️ JSON parse failed, raw response:', content.substring(0, 200) + '...');
      throw new Error(`Failed to parse Gemini JSON response: ${parseError.message}`);
    }
    
    return {
      success: true,
      data: extractedData,
      tokensUsed: totalTokens,
      cost: cost,
      rawResponse: content
    };
    
  } catch (error) {
    console.log(`   ❌ API call failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
      tokensUsed: 0,
      cost: 0
    };
  }
}

async function testStandardization(products) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('❌ OpenAI API key not found, skipping standardization test');
    return;
  }
  
  console.log(`🔄 Standardizing ${products.length} products with OpenAI o3-mini...`);
  
  const systemPrompt = `You are "Monito-Normalizer". Standardize Indonesian product names to clean English grocery terms.

CRITICAL MAPPINGS:
• "daun bawang" → "Chives"
• "bawang merah" → "Onion Red" 
• "ayam" → "Chicken"
• "daging sapi" → "Beef"
• "ikan" → "Fish"
• "udang" → "Shrimp"

Return JSON array with format:
[{
  "originalName": "input name",
  "standardizedName": "clean English name",
  "category": "category",
  "confidence": 0.95
}]`;

  const userPrompt = products.map(p => p.name).join('\n');
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const result = await response.json();
    const content = result.choices[0]?.message?.content;
    
    if (content) {
      const standardized = JSON.parse(content);
      
      console.log('✅ Standardization results:');
      standardized.forEach(item => {
        if (item.originalName !== item.standardizedName) {
          console.log(`   "${item.originalName}" → "${item.standardizedName}"`);
        }
      });
      
      const tokens = result.usage?.total_tokens || 0;
      const cost = (tokens / 1000) * 0.0015; // GPT-4o-mini pricing
      console.log(`   💰 Standardization cost: $${cost.toFixed(6)} (${tokens} tokens)`);
    }
    
  } catch (error) {
    console.log(`❌ Standardization failed: ${error.message}`);
  }
}

function analyzeProducts(products) {
  console.log('\n📋 Product Analysis:');
  
  // Price analysis
  const prices = products.map(p => p.price).filter(p => p && p > 0);
  if (prices.length > 0) {
    console.log(`💰 Price range: ${formatPrice(Math.min(...prices))} - ${formatPrice(Math.max(...prices))}`);
    console.log(`   Average: ${formatPrice(prices.reduce((a, b) => a + b, 0) / prices.length)}`);
  }
  
  // Category distribution
  const categories = {};
  products.forEach(p => {
    const cat = p.category || 'Unknown';
    categories[cat] = (categories[cat] || 0) + 1;
  });
  
  console.log('\n📊 Categories:');
  Object.entries(categories)
    .sort(([,a], [,b]) => b - a)
    .forEach(([category, count]) => {
      console.log(`   ${category}: ${count} products`);
    });
  
  // Unit distribution  
  const units = {};
  products.forEach(p => {
    const unit = p.unit || 'Unknown';
    units[unit] = (units[unit] || 0) + 1;
  });
  
  console.log('\n📏 Units:');
  Object.entries(units)
    .sort(([,a], [,b]) => b - a)
    .forEach(([unit, count]) => {
      console.log(`   ${unit}: ${count} products`);
    });
  
  // Sample products
  console.log('\n📦 Sample products:');
  products.slice(0, 10).forEach((product, i) => {
    console.log(`${i + 1}. ${product.name} - ${formatPrice(product.price)} ${product.unit || ''} (${product.category || 'Unknown'})`);
  });
}

function formatPrice(price) {
  if (!price || price === 0) return '0';
  
  if (price >= 1000000) {
    return `${(price / 1000000).toFixed(1)}jt`;
  } else if (price >= 1000) {
    return `${(price / 1000).toFixed(0)}k`;
  } else {
    return price.toString();
  }
}

// Run the real test
if (require.main === module) {
  testEggstraWithRealAPI()
    .then(result => {
      console.log('\n🎉 Real test completed successfully!');
      console.log(`Final result: ${result.totalProducts} products extracted`);
      console.log(`Total cost: $${result.cost.toFixed(6)}`);
    })
    .catch(error => {
      console.error('\n💥 Real test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testEggstraWithRealAPI };