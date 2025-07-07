#!/usr/bin/env node

/**
 * Complete PDF Upload Test with Remote Server
 * Tests the full pipeline: Upload → Processing → Database Storage
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

// Load environment variables
require('dotenv').config();

const REMOTE_SERVER = process.env.NEXTAUTH_URL || 'http://209.38.85.196:3000';
const PDF_FILE_PATH = path.join(__dirname, 'test-eggstra.pdf');

async function testRemotePdfUpload() {
  console.log('🚀 TESTING COMPLETE PDF PIPELINE WITH REMOTE SERVER');
  console.log('=' .repeat(60));
  console.log(`📡 Remote Server: ${REMOTE_SERVER}`);
  console.log(`📄 PDF File: ${PDF_FILE_PATH}`);
  console.log('');

  const startTime = Date.now();
  
  try {
    // Step 1: Check if PDF file exists
    if (!fs.existsSync(PDF_FILE_PATH)) {
      throw new Error(`PDF file not found: ${PDF_FILE_PATH}`);
    }
    
    const fileStats = fs.statSync(PDF_FILE_PATH);
    console.log(`📋 File Info:`);
    console.log(`   📁 Name: test-eggstra.pdf`);
    console.log(`   📏 Size: ${(fileStats.size / 1024).toFixed(2)} KB`);
    console.log(`   📅 Modified: ${fileStats.mtime.toISOString()}`);
    console.log('');

    // Step 2: Create suppliers list for selection
    console.log('🏢 Step 1: Fetching suppliers list...');
    const suppliersResponse = await fetch(`${REMOTE_SERVER}/api/suppliers`);
    
    if (!suppliersResponse.ok) {
      throw new Error(`Failed to fetch suppliers: ${suppliersResponse.status} ${suppliersResponse.statusText}`);
    }
    
    const suppliers = await suppliersResponse.json();
    console.log(`✅ Found ${suppliers.length} suppliers`);
    
    // Find or use first supplier
    let selectedSupplier = suppliers.find(s => s.name.toLowerCase().includes('eggstra')) || 
                          suppliers.find(s => s.name.toLowerCase().includes('alamboga')) ||
                          suppliers[0];
    
    if (!selectedSupplier && suppliers.length === 0) {
      console.log('📝 Creating test supplier...');
      const createSupplierResponse = await fetch(`${REMOTE_SERVER}/api/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'ALAMBOGA INTERNUSA (Test)',
          email: 'test@alamboga.com',
          phone: '+62-123-456-7890',
          address: 'Jakarta, Indonesia'
        })
      });
      
      if (createSupplierResponse.ok) {
        selectedSupplier = await createSupplierResponse.json();
        console.log(`✅ Created supplier: ${selectedSupplier.name}`);
      } else {
        throw new Error('Failed to create test supplier');
      }
    }
    
    console.log(`🎯 Selected Supplier: ${selectedSupplier.name} (ID: ${selectedSupplier.id})`);
    console.log('');

    // Step 3: Upload PDF file
    console.log('📤 Step 2: Uploading PDF file...');
    const uploadStartTime = Date.now();
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(PDF_FILE_PATH));
    formData.append('supplierId', selectedSupplier.id);
    
    const uploadResponse = await fetch(`${REMOTE_SERVER}/api/upload-unified`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });
    
    const uploadTime = Date.now() - uploadStartTime;
    console.log(`⏱️  Upload time: ${uploadTime}ms`);
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
    }
    
    const uploadResult = await uploadResponse.json();
    console.log(`✅ Upload successful!`);
    console.log(`   📊 Upload ID: ${uploadResult.uploadId}`);
    console.log(`   📋 Status: ${uploadResult.status}`);
    console.log(`   🔗 File URL: ${uploadResult.fileUrl?.substring(0, 50)}...`);
    console.log('');

    // Step 4: Monitor processing status
    console.log('⏳ Step 3: Monitoring processing status...');
    const uploadId = uploadResult.uploadId;
    let processingComplete = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts = 5 minutes max
    let processingResult = null;
    
    while (!processingComplete && attempts < maxAttempts) {
      attempts++;
      
      try {
        const statusResponse = await fetch(`${REMOTE_SERVER}/api/admin/uploads/status/${uploadId}`);
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          console.log(`   📊 Attempt ${attempts}: Status = ${statusData.status}`);
          
          if (statusData.status === 'completed' || statusData.status === 'completed_with_errors') {
            processingComplete = true;
            processingResult = statusData;
            console.log(`✅ Processing completed with status: ${statusData.status}`);
          } else if (statusData.status === 'failed') {
            throw new Error(`Processing failed: ${statusData.metadata?.error || 'Unknown error'}`);
          } else {
            console.log(`   ⏳ Still processing... (${statusData.status})`);
          }
        } else {
          console.log(`   ⚠️  Status check failed: ${statusResponse.status}`);
        }
      } catch (error) {
        console.log(`   ❌ Status check error: ${error.message}`);
      }
      
      if (!processingComplete) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      }
    }
    
    const totalTime = Date.now() - startTime;
    
    if (!processingComplete) {
      console.log(`⏰ Processing timeout after ${maxAttempts} attempts (${(totalTime/1000).toFixed(1)}s)`);
      console.log('   The file may still be processing in the background.');
    }
    
    console.log('');

    // Step 5: Get final results
    console.log('📊 Step 4: Analyzing results...');
    
    if (processingResult) {
      console.log(`📈 PROCESSING RESULTS:`);
      console.log(`   ⏱️  Total processing time: ${(totalTime/1000).toFixed(1)}s`);
      console.log(`   📄 Status: ${processingResult.status}`);
      
      if (processingResult.metadata) {
        const meta = processingResult.metadata;
        console.log(`   📦 Products extracted: ${meta.productsCreated || meta.totalRowsProcessed || 'N/A'}`);
        console.log(`   🎯 Completeness ratio: ${meta.completenessRatio ? (meta.completenessRatio * 100).toFixed(1) + '%' : 'N/A'}`);
        console.log(`   🔤 Tokens used: ${meta.tokensUsed || 'N/A'}`);
        console.log(`   💰 Cost (USD): $${meta.costUsd || 'N/A'}`);
        
        if (meta.extractionDetails) {
          const details = meta.extractionDetails;
          console.log(`   🤖 AI Vision pages: ${details.aiVision?.pages || 'N/A'}`);
          console.log(`   📋 Best method: ${details.bestMethod || 'N/A'}`);
        }
        
        if (meta.errors && meta.errors.length > 0) {
          console.log(`   ⚠️  Errors: ${meta.errors.length}`);
          meta.errors.forEach((error, i) => {
            console.log(`      ${i + 1}. ${error}`);
          });
        }
      }
    }
    
    // Step 6: Query database for results
    console.log('\n🔍 Step 5: Querying database for extracted products...');
    
    try {
      const productsResponse = await fetch(`${REMOTE_SERVER}/api/products?search=&page=1&limit=100&sortBy=name&sortOrder=desc`);
      
      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        const recentProducts = productsData.products.filter(p => 
          p.prices.some(price => price.supplierId === selectedSupplier.id)
        );
        
        console.log(`📦 Found ${recentProducts.length} products from this supplier in database`);
        
        if (recentProducts.length > 0) {
          console.log(`\n📋 Sample products (first 10):`);
          recentProducts.slice(0, 10).forEach((product, i) => {
            const supplierPrice = product.prices.find(p => p.supplierId === selectedSupplier.id);
            if (supplierPrice) {
              console.log(`   ${i + 1}. ${product.standardizedName}`);
              console.log(`      💰 Price: ${formatPrice(supplierPrice.amount)} ${supplierPrice.unit}`);
              console.log(`      📂 Category: ${product.category || 'N/A'}`);
            }
          });
          
          // Price range analysis
          const prices = recentProducts
            .map(p => p.prices.find(pr => pr.supplierId === selectedSupplier.id))
            .filter(p => p)
            .map(p => parseFloat(p.amount));
          
          if (prices.length > 0) {
            console.log(`\n💹 Price Analysis:`);
            console.log(`   📊 Products with prices: ${prices.length}`);
            console.log(`   💰 Price range: ${formatPrice(Math.min(...prices))} - ${formatPrice(Math.max(...prices))}`);
            console.log(`   📈 Average price: ${formatPrice(prices.reduce((a, b) => a + b, 0) / prices.length)}`);
          }
        }
      } else {
        console.log(`❌ Failed to query products: ${productsResponse.status}`);
      }
    } catch (error) {
      console.log(`❌ Database query error: ${error.message}`);
    }
    
    // Final summary
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 PIPELINE TEST COMPLETED');
    console.log('=' .repeat(60));
    console.log(`⏱️  Total execution time: ${(totalTime/1000).toFixed(1)} seconds`);
    console.log(`📡 Server: ${REMOTE_SERVER}`);
    console.log(`📄 File: test-eggstra.pdf (${(fileStats.size / 1024).toFixed(2)} KB)`);
    console.log(`🏢 Supplier: ${selectedSupplier.name}`);
    console.log(`📊 Final Status: ${processingResult?.status || 'Unknown'}`);
    
    if (processingResult?.metadata) {
      const meta = processingResult.metadata;
      console.log(`📦 Products: ${meta.productsCreated || meta.totalRowsProcessed || 0}`);
      console.log(`💰 Cost: $${meta.costUsd || '0.00'}`);
      console.log(`🎯 Success: ${processingComplete ? '✅' : '⏰ Timeout'}`);
    }
    
    return {
      success: processingComplete,
      totalTime: totalTime,
      uploadTime: uploadTime,
      processingResult: processingResult,
      supplier: selectedSupplier
    };
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Stack trace:', error.stack);
    
    const totalTime = Date.now() - startTime;
    console.log(`⏱️  Failed after: ${(totalTime/1000).toFixed(1)} seconds`);
    
    throw error;
  }
}

function formatPrice(price) {
  const num = parseFloat(price);
  if (isNaN(num)) return '0';
  
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}jt`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}k`;
  } else {
    return num.toString();
  }
}

// Run the test
if (require.main === module) {
  testRemotePdfUpload()
    .then(result => {
      console.log('\n✅ Test completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Test failed!');
      process.exit(1);
    });
}

module.exports = { testRemotePdfUpload };