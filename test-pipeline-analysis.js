#!/usr/bin/env node

/**
 * Pipeline Analysis - Analyze recent successful uploads and performance
 */

const fetch = require('node-fetch');
require('dotenv').config();

const REMOTE_SERVER = process.env.NEXTAUTH_URL || 'http://209.38.85.196:3000';

async function analyzePipeline() {
  console.log('🔍 ANALYZING PDF PROCESSING PIPELINE PERFORMANCE');
  console.log('=' .repeat(60));
  console.log(`📡 Server: ${REMOTE_SERVER}`);
  console.log('');

  try {
    // Step 1: Get recent uploads
    console.log('📊 Step 1: Fetching recent upload data...');
    const uploadsResponse = await fetch(`${REMOTE_SERVER}/api/admin/uploads/status`);
    
    if (!uploadsResponse.ok) {
      throw new Error(`Failed to fetch uploads: ${uploadsResponse.status}`);
    }
    
    const uploads = await uploadsResponse.json();
    console.log(`✅ Found ${uploads.length} recent uploads`);
    console.log('');

    // Step 2: Analyze successful PDF uploads
    const pdfUploads = uploads.filter(upload => 
      upload.mimeType === 'application/pdf' && 
      upload.status === 'completed'
    );
    
    console.log('📄 PDF UPLOAD ANALYSIS:');
    console.log(`   📦 Total PDF uploads: ${pdfUploads.length}`);
    
    if (pdfUploads.length === 0) {
      console.log('   ❌ No successful PDF uploads found');
      return;
    }

    // Step 3: Performance metrics analysis
    console.log('\n⏱️  PERFORMANCE METRICS:');
    
    const processingTimes = pdfUploads
      .map(u => u.processingTimeMs || u.extractedData?.processingTimeMs)
      .filter(t => t && t > 0);
    
    const costs = pdfUploads
      .map(u => u.processingCostUsd || u.extractedData?.costUsd)
      .filter(c => c && c > 0);
    
    const tokens = pdfUploads
      .map(u => u.tokensUsed || u.extractedData?.tokensUsed)
      .filter(t => t && t > 0);

    if (processingTimes.length > 0) {
      const avgTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      const minTime = Math.min(...processingTimes);
      const maxTime = Math.max(...processingTimes);
      
      console.log(`   ⏱️  Processing Time:`);
      console.log(`      Average: ${(avgTime/1000).toFixed(1)}s`);
      console.log(`      Range: ${(minTime/1000).toFixed(1)}s - ${(maxTime/1000).toFixed(1)}s`);
    }
    
    if (costs.length > 0) {
      const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length;
      const totalCost = costs.reduce((a, b) => a + b, 0);
      
      console.log(`   💰 Cost Analysis:`);
      console.log(`      Average per file: $${avgCost.toFixed(6)}`);
      console.log(`      Total cost: $${totalCost.toFixed(6)}`);
    }
    
    if (tokens.length > 0) {
      const avgTokens = tokens.reduce((a, b) => a + b, 0) / tokens.length;
      const totalTokens = tokens.reduce((a, b) => a + b, 0);
      
      console.log(`   🔤 Token Usage:`);
      console.log(`      Average per file: ${Math.round(avgTokens)} tokens`);
      console.log(`      Total tokens: ${totalTokens}`);
    }

    // Step 4: Detailed analysis of successful uploads
    console.log('\n📋 DETAILED UPLOAD ANALYSIS:');
    
    pdfUploads.slice(0, 5).forEach((upload, i) => {
      console.log(`\n${i + 1}. ${upload.originalName}`);
      console.log(`   📅 Date: ${new Date(upload.createdAt).toLocaleString()}`);
      console.log(`   📏 Size: ${(upload.fileSize / 1024).toFixed(2)} KB`);
      console.log(`   ⏱️  Processing: ${upload.processingTimeMs ? (upload.processingTimeMs/1000).toFixed(1) + 's' : 'N/A'}`);
      console.log(`   📊 Status: ${upload.status}`);
      console.log(`   🎯 Approval: ${upload.approvalStatus}`);
      
      if (upload.extractedData) {
        const data = upload.extractedData;
        console.log(`   📦 Products: ${data.products?.length || data.totalRowsProcessed || 0}`);
        console.log(`   💰 Cost: $${data.costUsd || 0}`);
        console.log(`   🔤 Tokens: ${data.tokensUsed || 0}`);
        console.log(`   🎯 Completeness: ${data.completenessRatio ? (data.completenessRatio * 100).toFixed(1) + '%' : 'N/A'}`);
        
        if (data.extractionMethods) {
          console.log(`   🤖 Method: ${data.extractionMethods.bestMethod}`);
        }
        
        if (data.errors && data.errors.length > 0) {
          console.log(`   ⚠️  Errors: ${data.errors.length}`);
          data.errors.slice(0, 2).forEach(error => {
            console.log(`      - ${error.substring(0, 80)}...`);
          });
        }
      }
    });

    // Step 5: Check products from successful uploads
    console.log('\n🔍 Step 2: Checking extracted products...');
    
    const productsResponse = await fetch(`${REMOTE_SERVER}/api/products?page=1&limit=50&sortBy=name&sortOrder=desc`);
    
    if (productsResponse.ok) {
      const productsData = await productsResponse.json();
      console.log(`📦 Found ${productsData.products.length} products in database`);
      console.log(`📊 Total products: ${productsData.pagination.total}`);
      
      // Analyze product distribution
      const categories = {};
      const suppliers = {};
      
      productsData.products.forEach(product => {
        const category = product.category || 'Unknown';
        categories[category] = (categories[category] || 0) + 1;
        
        product.prices.forEach(price => {
          const supplierId = price.supplier.name;
          suppliers[supplierId] = (suppliers[supplierId] || 0) + 1;
        });
      });
      
      console.log('\n📂 Category Distribution:');
      Object.entries(categories)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([category, count]) => {
          console.log(`   ${category}: ${count} products`);
        });
      
      console.log('\n🏢 Top Suppliers:');
      Object.entries(suppliers)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([supplier, count]) => {
          console.log(`   ${supplier}: ${count} prices`);
        });
    }

    // Step 6: Pipeline efficiency analysis
    console.log('\n📈 PIPELINE EFFICIENCY ANALYSIS:');
    
    const totalFiles = uploads.length;
    const completedFiles = uploads.filter(u => u.status === 'completed').length;
    const failedFiles = uploads.filter(u => u.status === 'failed').length;
    const pendingFiles = uploads.filter(u => u.status === 'pending' || u.status === 'processing').length;
    
    console.log(`   📊 Success Rate: ${(completedFiles/totalFiles*100).toFixed(1)}% (${completedFiles}/${totalFiles})`);
    console.log(`   ❌ Failure Rate: ${(failedFiles/totalFiles*100).toFixed(1)}% (${failedFiles}/${totalFiles})`);
    console.log(`   ⏳ Pending: ${(pendingFiles/totalFiles*100).toFixed(1)}% (${pendingFiles}/${totalFiles})`);
    
    // Excel vs PDF performance
    const excelUploads = uploads.filter(u => u.mimeType?.includes('spreadsheet'));
    const excelSuccess = excelUploads.filter(u => u.status === 'completed').length;
    const pdfSuccess = pdfUploads.length;
    
    console.log(`\n📄 Format Performance:`);
    console.log(`   PDF Success: ${pdfSuccess}/${uploads.filter(u => u.mimeType === 'application/pdf').length}`);
    console.log(`   Excel Success: ${excelSuccess}/${excelUploads.length}`);

    // Step 7: Recent activity timeline
    console.log('\n📅 RECENT ACTIVITY TIMELINE:');
    
    const recentUploads = uploads
      .slice(0, 10)
      .map(upload => ({
        name: upload.originalName,
        date: new Date(upload.createdAt).toLocaleString(),
        status: upload.status,
        supplier: upload.supplier?.name || 'Unknown',
        products: upload.extractedData?.products?.length || upload.extractedData?.totalRowsProcessed || 0
      }));
    
    recentUploads.forEach((upload, i) => {
      const statusIcon = upload.status === 'completed' ? '✅' : 
                       upload.status === 'failed' ? '❌' : '⏳';
      console.log(`   ${statusIcon} ${upload.date} - ${upload.name.substring(0, 30)}`);
      console.log(`      ${upload.supplier} | ${upload.products} products`);
    });

    // Final summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 PIPELINE SUMMARY');
    console.log('=' .repeat(60));
    
    if (processingTimes.length > 0) {
      const avgTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      console.log(`⏱️  Average Processing Time: ${(avgTime/1000).toFixed(1)}s`);
    }
    
    if (costs.length > 0) {
      const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length;
      console.log(`💰 Average Cost per File: $${avgCost.toFixed(6)}`);
    }
    
    console.log(`📊 Overall Success Rate: ${(completedFiles/totalFiles*100).toFixed(1)}%`);
    console.log(`🤖 AI Processing: ${pdfUploads.filter(u => u.extractedData?.extractionMethods?.bestMethod?.includes('ai')).length} AI-processed files`);
    
    return {
      totalUploads: totalFiles,
      successRate: completedFiles/totalFiles,
      avgProcessingTime: processingTimes.length > 0 ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length : 0,
      avgCost: costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0,
      pdfUploads: pdfUploads.length
    };
    
  } catch (error) {
    console.error('\n❌ ANALYSIS FAILED:', error.message);
    throw error;
  }
}

// Run the analysis
if (require.main === module) {
  analyzePipeline()
    .then(result => {
      console.log('\n✅ Analysis completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Analysis failed!');
      process.exit(1);
    });
}

module.exports = { analyzePipeline };