#!/usr/bin/env node

/**
 * Test script for processing Eggstra PDF file
 * Tests the complete PDF processing pipeline
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';
const PDF_PATH = path.join(__dirname, 'test-eggstra.pdf');

async function uploadAndProcessFile() {
  try {
    console.log('🔄 Starting Eggstra PDF processing test...\n');
    
    // Check if file exists
    if (!fs.existsSync(PDF_PATH)) {
      throw new Error(`PDF file not found: ${PDF_PATH}`);
    }
    
    const fileStats = fs.statSync(PDF_PATH);
    console.log(`📁 File: test-eggstra.pdf`);
    console.log(`📏 Size: ${(fileStats.size / 1024).toFixed(2)} KB`);
    console.log(`📅 Modified: ${fileStats.mtime.toISOString()}\n`);
    
    // Create form data
    const formData = new FormData();
    formData.append('file', fs.createReadStream(PDF_PATH));
    formData.append('supplierName', 'Eggstra Test');
    
    console.log('🚀 Uploading file to unified endpoint...');
    
    // Upload file with different strategies
    const strategies = ['auto', 'single'];
    
    for (const strategy of strategies) {
      console.log(`\n🎯 Testing strategy: ${strategy}`);
      
      const uploadUrl = `${BASE_URL}/api/upload-unified?strategy=${strategy}&model=gemini-2.0-flash-exp`;
      
      const startTime = Date.now();
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        timeout: 120000 // 2 minutes timeout
      });
      
      const processingTime = Date.now() - startTime;
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Upload failed (${response.status}):`, errorText);
        continue;
      }
      
      const result = await response.json();
      
      console.log('✅ Processing completed!');
      console.log(`⏱️  Processing time: ${processingTime}ms`);
      
      // Analyze results
      analyzeResults(result, strategy);
      
      // Create a new FormData for next iteration
      if (strategy !== strategies[strategies.length - 1]) {
        const newFormData = new FormData();
        newFormData.append('file', fs.createReadStream(PDF_PATH));
        newFormData.append('supplierName', 'Eggstra Test');
        formData = newFormData;
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Make sure the development server is running: npm run dev');
    }
  }
}

function analyzeResults(result, strategy) {
  console.log(`\n📊 Analysis for strategy: ${strategy}`);
  console.log('=' .repeat(50));
  
  // Basic metrics
  console.log(`📦 Products extracted: ${result.products?.length || 0}`);
  console.log(`🏢 Supplier detected: ${result.supplier?.name || 'Not detected'}`);
  console.log(`💰 Cost: $${result.metadata?.costUsd?.toFixed(4) || '0.0000'}`);
  console.log(`🔤 Tokens used: ${result.metadata?.tokensUsed || 0}`);
  
  if (result.metadata) {
    console.log(`⏱️  Processing time: ${result.metadata.processingTimeMs || 0}ms`);
    console.log(`📈 Completeness ratio: ${(result.metadata.completenessRatio * 100 || 0).toFixed(1)}%`);
    console.log(`🎯 Confidence: ${(result.metadata.confidence * 100 || 0).toFixed(1)}%`);
  }
  
  // Product analysis
  if (result.products && result.products.length > 0) {
    console.log('\n📋 Sample products (first 10):');
    result.products.slice(0, 10).forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   💰 Price: ${formatPrice(product.price)} ${product.unit || ''}`);
      console.log(`   📁 Category: ${product.category || 'Unknown'}`);
      if (product.standardizedName && product.standardizedName !== product.name) {
        console.log(`   🔄 Standardized: ${product.standardizedName}`);
      }
      console.log('');
    });
    
    // Price distribution analysis
    const prices = result.products.map(p => p.price).filter(p => p && p > 0);
    if (prices.length > 0) {
      console.log('💹 Price distribution:');
      console.log(`   Min: ${formatPrice(Math.min(...prices))}`);
      console.log(`   Max: ${formatPrice(Math.max(...prices))}`);
      console.log(`   Avg: ${formatPrice(prices.reduce((a, b) => a + b, 0) / prices.length)}`);
    }
    
    // Category distribution
    const categories = {};
    result.products.forEach(p => {
      const cat = p.category || 'Unknown';
      categories[cat] = (categories[cat] || 0) + 1;
    });
    
    console.log('\n📊 Category distribution:');
    Object.entries(categories)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count} products`);
      });
    
    // Unit distribution
    const units = {};
    result.products.forEach(p => {
      const unit = p.unit || 'Unknown';
      units[unit] = (units[unit] || 0) + 1;
    });
    
    console.log('\n📏 Unit distribution:');
    Object.entries(units)
      .sort(([,a], [,b]) => b - a)
      .forEach(([unit, count]) => {
        console.log(`   ${unit}: ${count} products`);
      });
  }
  
  // Quality assessment
  console.log('\n🎯 Quality Assessment:');
  const quality = assessQuality(result);
  Object.entries(quality).forEach(([metric, score]) => {
    const emoji = score >= 0.8 ? '✅' : score >= 0.6 ? '⚠️' : '❌';
    console.log(`   ${emoji} ${metric}: ${(score * 100).toFixed(1)}%`);
  });
  
  // Errors and warnings
  if (result.errors && result.errors.length > 0) {
    console.log('\n⚠️ Errors/Warnings:');
    result.errors.forEach(error => {
      console.log(`   - ${error}`);
    });
  }
  
  console.log('\n' + '=' .repeat(50));
}

function assessQuality(result) {
  const quality = {};
  
  // Product extraction completeness
  const productCount = result.products?.length || 0;
  quality['Product Extraction'] = Math.min(productCount / 50, 1); // Assuming ~50 products expected
  
  // Price validity
  const validPrices = result.products?.filter(p => p.price && p.price > 0).length || 0;
  quality['Price Validity'] = productCount > 0 ? validPrices / productCount : 0;
  
  // Name quality (non-empty, reasonable length)
  const validNames = result.products?.filter(p => p.name && p.name.length > 2).length || 0;
  quality['Name Quality'] = productCount > 0 ? validNames / productCount : 0;
  
  // Unit detection
  const hasUnits = result.products?.filter(p => p.unit && p.unit.trim()).length || 0;
  quality['Unit Detection'] = productCount > 0 ? hasUnits / productCount : 0;
  
  // Category assignment
  const hasCategories = result.products?.filter(p => p.category && p.category !== 'Unknown').length || 0;
  quality['Category Assignment'] = productCount > 0 ? hasCategories / productCount : 0;
  
  // Supplier detection
  quality['Supplier Detection'] = result.supplier?.name ? 1 : 0;
  
  return quality;
}

function formatPrice(price) {
  if (!price || price === 0) return '0';
  
  // Indonesian Rupiah formatting
  if (price >= 1000000) {
    return `${(price / 1000000).toFixed(1)}jt`;
  } else if (price >= 1000) {
    return `${(price / 1000).toFixed(0)}k`;
  } else {
    return price.toString();
  }
}

// Run the test
if (require.main === module) {
  uploadAndProcessFile();
}

module.exports = { uploadAndProcessFile, analyzeResults };