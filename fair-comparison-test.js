const fs = require('fs');

async function fairComparisonTest() {
  try {
    console.log('🏁 FAIR PERFORMANCE COMPARISON TEST');
    console.log('===================================');
    console.log('📄 File: widi wiguna.xlsx (fresh upload for both systems)');
    console.log('🎯 Objective: Compare processing time and results\n');
    
    const filePath = '/Users/denisdomashenko/Downloads/AIbuyer/widi wiguna.xlsx';
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ File not found:', filePath);
      return;
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    const fetch = (await import('node-fetch')).default;
    const FormData = require('form-data');
    
    console.log('📁 File size:', Math.round(fileBuffer.length / 1024), 'KB');
    console.log('📅 Test started:', new Date().toLocaleString());
    console.log('');
    
    // === TEST 1: Current System (Clean Database) ===
    console.log('🔵 TEST 1: Current System (Fresh Upload)');
    console.log('=========================================');
    
    // First clean the system to ensure fair test
    console.log('🧹 Cleaning system for fair test...');
    const cleanResponse = await fetch('http://localhost:3000/api/admin/system-cleanup', {
      method: 'POST'
    });
    
    if (cleanResponse.ok) {
      console.log('✅ System cleaned successfully');
    } else {
      console.log('⚠️  Could not clean system, proceeding anyway');
    }
    
    const currentSystemStartTime = Date.now();
    
    const form1 = new FormData();
    form1.append('files', fileBuffer, {
      filename: 'widi wiguna.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    form1.append('autoApprove', 'true');
    
    console.log('⏱️  Starting current system processing...');
    
    const uploadResponse = await fetch('http://localhost:3000/api/upload-smart', {
      method: 'POST',
      body: form1,
      headers: form1.getHeaders()
    });
    
    let currentSystemResult = null;
    let currentSystemSuccess = false;
    let currentSystemTime = 0;
    let currentSystemProducts = 0;
    let currentSystemCost = 0;
    let currentSystemTokens = 0;
    
    if (uploadResponse.ok) {
      const uploadData = await uploadResponse.json();
      console.log('📤 Upload initiated, monitoring processing...');
      
      // Monitor until completion
      let attempts = 0;
      const maxAttempts = 120; // 10 minutes
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        
        const statusResponse = await fetch('http://localhost:3000/api/uploads/pending');
        const statusData = await statusResponse.json();
        const upload = statusData.uploads[0];
        
        if (!upload) {
          console.log('❌ Upload not found');
          break;
        }
        
        const elapsed = Math.round((Date.now() - currentSystemStartTime) / 1000);
        console.log(`   [${elapsed}s] Status: ${upload.status} | Products: ${upload.estimatedProductsCount}`);
        
        if (upload.status !== 'processing') {
          currentSystemTime = elapsed;
          currentSystemProducts = upload.estimatedProductsCount;
          currentSystemCost = upload.processingCostUsd || 0;
          currentSystemTokens = upload.tokensUsed || 0;
          currentSystemSuccess = upload.status === 'completed';
          currentSystemResult = upload;
          
          console.log('✅ Current system processing completed');
          break;
        }
        
        attempts++;
        if (elapsed > 300) { // 5 minutes warning
          console.log('   ⚠️  Processing time exceeded 5 minutes...');
        }
      }
      
      if (attempts >= maxAttempts) {
        currentSystemTime = 600; // 10 minutes timeout
        console.log('❌ Current system timed out after 10 minutes');
      }
      
    } else {
      const errorText = await uploadResponse.text();
      console.log('❌ Current system upload failed:', errorText);
    }
    
    console.log('');
    console.log('📊 Current System Results:');
    console.log(`   ⏱️  Time: ${currentSystemTime}s`);
    console.log(`   📦 Products: ${currentSystemProducts}`);
    console.log(`   🎯 Tokens: ${currentSystemTokens.toLocaleString()}`);
    console.log(`   💰 Cost: $${currentSystemCost.toFixed(4)}`);
    console.log(`   ✅ Success: ${currentSystemSuccess ? 'Yes' : 'No'}`);
    
    // === TEST 2: Claude Sonnet 4 ===
    console.log('\n🟣 TEST 2: Claude Sonnet 4');
    console.log('============================');
    
    console.log('⏱️  Starting Claude processing...');
    const claudeStartTime = Date.now();
    
    // Use the same test we ran before
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const XLSX = require('xlsx');
    
    // Load environment
    require('dotenv').config();
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    // Convert Excel to text
    const workbook = XLSX.readFile(filePath);
    let excelContent = '';
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const csvContent = XLSX.utils.sheet_to_csv(worksheet);
      excelContent += `\n\n=== SHEET: ${sheetName} ===\n${csvContent}`;
    });
    
    const prompt = `You are an expert at extracting product information from Excel spreadsheets.

I have converted an Excel file "widi wiguna.xlsx" to text format. Please analyze this data and extract ALL products with their pricing information.

Excel Content:
${excelContent}

Return a JSON object with this EXACT structure:
{
  "supplier": {
    "name": "supplier company name (if found)"
  },
  "products": [
    {
      "name": "standardized product name in English",
      "price": numeric_price_only,
      "unit": "standardized unit (kg, pcs, l, etc.)",
      "category": "product category"
    }
  ]
}

Return ONLY the JSON object, no other text:`;
    
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });
    
    const claudeEndTime = Date.now();
    const claudeTime = Math.round((claudeEndTime - claudeStartTime) / 1000);
    
    // Parse Claude results
    let claudeProducts = 0;
    let claudeSuccess = false;
    
    try {
      let responseText = message.content[0].text.trim();
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }
      const result = JSON.parse(responseText);
      claudeProducts = result.products ? result.products.length : 0;
      claudeSuccess = claudeProducts > 0;
    } catch (e) {
      console.log('⚠️  Claude response parsing failed');
    }
    
    const claudeTokens = message.usage.input_tokens + message.usage.output_tokens;
    const claudeCost = ((message.usage.input_tokens / 1000000) * 3.0) + ((message.usage.output_tokens / 1000000) * 15.0);
    
    console.log('✅ Claude processing completed');
    console.log('');
    console.log('📊 Claude Sonnet 4 Results:');
    console.log(`   ⏱️  Time: ${claudeTime}s`);
    console.log(`   📦 Products: ${claudeProducts}`);
    console.log(`   🎯 Tokens: ${claudeTokens.toLocaleString()}`);
    console.log(`   💰 Cost: $${claudeCost.toFixed(4)}`);
    console.log(`   ✅ Success: ${claudeSuccess ? 'Yes' : 'No'}`);
    
    // === FAIR COMPARISON ===
    console.log('\n🏆 FAIR COMPARISON RESULTS');
    console.log('==========================');
    
    console.log('\n⏱️  PROCESSING TIME:');
    const timeDiff = Math.abs(currentSystemTime - claudeTime);
    const timeWinner = currentSystemTime < claudeTime ? 'Current System' : 'Claude Sonnet 4';
    console.log(`   Current System: ${currentSystemTime}s`);
    console.log(`   Claude Sonnet 4: ${claudeTime}s`);
    console.log(`   Winner: ${timeWinner} (${timeDiff}s faster)`);
    
    console.log('\n📦 EXTRACTION QUALITY:');
    const productDiff = Math.abs(currentSystemProducts - claudeProducts);
    const qualityWinner = currentSystemProducts > claudeProducts ? 'Current System' : 'Claude Sonnet 4';
    console.log(`   Current System: ${currentSystemProducts} products`);
    console.log(`   Claude Sonnet 4: ${claudeProducts} products`);
    console.log(`   Winner: ${qualityWinner} (+${productDiff} products)`);
    
    console.log('\n💰 COST EFFICIENCY:');
    const costDiff = Math.abs(currentSystemCost - claudeCost);
    const costWinner = currentSystemCost < claudeCost ? 'Current System' : 'Claude Sonnet 4';
    console.log(`   Current System: $${currentSystemCost.toFixed(4)}`);
    console.log(`   Claude Sonnet 4: $${claudeCost.toFixed(4)}`);
    console.log(`   Winner: ${costWinner} ($${costDiff.toFixed(4)} cheaper)`);
    
    console.log('\n🎯 OVERALL ASSESSMENT:');
    if (currentSystemSuccess && claudeSuccess) {
      // Both succeeded, compare metrics
      const currentScore = (currentSystemProducts / Math.max(1, currentSystemTime)) * (1 / Math.max(0.0001, currentSystemCost));
      const claudeScore = (claudeProducts / claudeTime) * (1 / claudeCost);
      
      const overallWinner = currentScore > claudeScore ? 'Current System' : 'Claude Sonnet 4';
      console.log(`   🏆 Winner: ${overallWinner}`);
      console.log(`   📊 Efficiency Score: Current (${currentScore.toFixed(2)}) vs Claude (${claudeScore.toFixed(2)})`);
    } else if (currentSystemSuccess && !claudeSuccess) {
      console.log(`   🏆 Winner: Current System (only successful processor)`);
    } else if (!currentSystemSuccess && claudeSuccess) {
      console.log(`   🏆 Winner: Claude Sonnet 4 (only successful processor)`);
    } else {
      console.log(`   🤷 Both systems failed to process the file`);
    }
    
    // Save results
    const fairResults = {
      timestamp: new Date().toISOString(),
      file: 'widi wiguna.xlsx',
      currentSystem: {
        time: currentSystemTime,
        products: currentSystemProducts,
        tokens: currentSystemTokens,
        cost: currentSystemCost,
        success: currentSystemSuccess
      },
      claude: {
        time: claudeTime,
        products: claudeProducts,
        tokens: claudeTokens,
        cost: claudeCost,
        success: claudeSuccess
      },
      winners: {
        time: timeWinner,
        quality: qualityWinner,
        cost: costWinner
      }
    };
    
    const fileName = `fair-comparison-${Date.now()}.json`;
    fs.writeFileSync(fileName, JSON.stringify(fairResults, null, 2));
    console.log(`\n💾 Fair comparison results saved to: ${fileName}`);
    
  } catch (error) {
    console.error('❌ Fair comparison test failed:', error.message);
  }
}

fairComparisonTest();