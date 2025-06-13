const fs = require('fs');
const path = require('path');

async function uploadWidiWiguna() {
  try {
    console.log('🧪 Testing widi wiguna.xlsx with AI pipeline...');
    
    const filePath = '/Users/denisdomashenko/Downloads/AIbuyer/widi wiguna.xlsx';
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ File not found:', filePath);
      return;
    }
    
    const stats = fs.statSync(filePath);
    console.log(`📁 File size: ${Math.round(stats.size / 1024)}KB`);
    
    // Read file as buffer
    const fileBuffer = fs.readFileSync(filePath);
    
    // Create form data manually for upload
    const fetch = (await import('node-fetch')).default;
    const FormData = require('form-data');
    
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename: 'widi wiguna.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    
    console.log('🚀 Uploading to AI pipeline...');
    console.log('🕐 This may take several minutes for batch processing...');
    
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/upload-ai', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log(`⏱️ Processing completed in ${duration} seconds`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Upload failed (${response.status}):`, errorText);
      return;
    }
    
    const result = await response.json();
    
    console.log('✅ Upload completed!');
    console.log('📊 Results:', {
      uploadId: result.uploadId,
      status: result.status,
      message: result.message
    });
    
    if (result.stats) {
      console.log('📈 Processing Stats:');
      console.log(`   📦 Total analyzed: ${result.stats.totalAnalyzed}`);
      console.log(`   🎯 Data quality: ${result.stats.dataQuality}`);
      console.log(`   🤖 AI action: ${result.stats.recommendedAction}`);
      console.log(`   📊 Extraction accuracy: ${(result.stats.extractionAccuracy * 100).toFixed(1)}%`);
      
      if (result.stats.decisions) {
        console.log('   📝 Decisions breakdown:');
        Object.entries(result.stats.decisions).forEach(([decision, count]) => {
          console.log(`      ${decision}: ${count}`);
        });
      }
    }
    
    if (result.aiDecision && result.aiDecision.insights) {
      console.log('💡 Key insights:');
      result.aiDecision.insights.slice(0, 3).forEach(insight => {
        console.log(`   - ${insight}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('🔌 Make sure the development server is running on http://localhost:3000');
    }
  }
}

uploadWidiWiguna();