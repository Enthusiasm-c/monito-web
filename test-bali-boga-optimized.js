const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testBaliBoga() {
  try {
    const pdfPath = '/Users/denisdomashenko/Downloads/AIbuyer/bali boga.pdf';
    
    const formData = new FormData();
    formData.append('files', fs.createReadStream(pdfPath), 'bali boga.pdf');
    formData.append('model', 'gpt-4o-mini');

    console.log('🚀 Testing bali boga.pdf with OPTIMIZATIONS:');
    console.log('  ✅ Parallel page processing');
    console.log('  ✅ Image size optimization (max 1200px width)');
    console.log('  ✅ JPEG compression (quality 85%)');
    console.log('  ✅ Lower DPI (120 instead of 150)');
    console.log('\n📏 File size:', (fs.statSync(pdfPath).size / 1024 / 1024).toFixed(2), 'MB');
    
    const startTime = Date.now();
    console.log('\n⏳ Processing started at:', new Date().toLocaleTimeString());
    
    const response = await fetch('http://localhost:3000/api/upload-ai', {
      method: 'POST',
      body: formData,
      timeout: 300000 // 5 minutes
    });

    const endTime = Date.now();
    const result = await response.json();
    const processingTime = (endTime - startTime) / 1000;
    
    console.log('✅ Processing completed at:', new Date().toLocaleTimeString());
    console.log(`⏱️  Total processing time: ${processingTime.toFixed(1)}s`);
    
    if (result.success) {
      console.log('\n📊 RESULTS:');
      console.log(`   ✅ Status: SUCCESS`);
      console.log(`   📦 Products extracted: ${result.stats.totalExtracted}`);
      console.log(`   ✨ New products created: ${result.stats.newProducts}`);
      console.log(`   🏢 Supplier: ${result.supplier.name}`);
      console.log(`   💰 Processing cost: $${result.stats.estimatedCostUsd.toFixed(4)}`);
      
      // Compare with previous results
      console.log('\n📈 COMPARISON WITH PREVIOUS TEST:');
      console.log('   Previous time: 229.6s');
      console.log(`   Current time: ${processingTime.toFixed(1)}s`);
      console.log(`   Time saved: ${(229.6 - processingTime).toFixed(1)}s (${((1 - processingTime/229.6) * 100).toFixed(1)}% faster)`);
      
      console.log('\n   Previous products extracted: 79');
      console.log(`   Current products extracted: ${result.stats.totalExtracted}`);
      
    } else {
      console.log('\n❌ FAILED:');
      console.log(`   Error: ${result.error || 'Unknown error'}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Clear database before test
async function clearDatabase() {
  console.log('🗑️  Clearing database...');
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    await prisma.product.deleteMany({});
    await prisma.upload.deleteMany({});
    await prisma.supplier.deleteMany({});
    
    console.log('✅ Database cleared successfully\n');
  } catch (error) {
    console.error('❌ Failed to clear database:', error.message);
  }
}

// Run test
clearDatabase().then(() => {
  testBaliBoga();
});