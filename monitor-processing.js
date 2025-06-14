async function monitorProcessing() {
  const fetch = (await import('node-fetch')).default;
  
  console.log('⏳ Monitoring current system processing...');
  console.log('📄 File: widi wiguna.xlsx');
  console.log('🕐 Started at:', new Date().toLocaleTimeString());
  console.log('');
  
  let attempts = 0;
  const maxAttempts = 120; // 10 minutes max
  const checkInterval = 5000; // 5 seconds
  
  while (attempts < maxAttempts) {
    try {
      const response = await fetch('http://localhost:3000/api/uploads/pending');
      const data = await response.json();
      const upload = data.uploads[0]; // Latest upload
      
      if (!upload) {
        console.log('❌ No uploads found');
        break;
      }
      
      const elapsed = Math.round((Date.now() - new Date(upload.createdAt).getTime()) / 1000);
      
      console.log(`[${new Date().toLocaleTimeString()}] Status: ${upload.status} | Elapsed: ${elapsed}s | Products: ${upload.estimatedProductsCount}`);
      
      if (upload.status !== 'processing') {
        console.log('\n🎉 Processing completed!');
        console.log('📊 Final Results:');
        console.log('================');
        console.log(`Status: ${upload.status}`);
        console.log(`Processing Time: ${upload.processingTimeMs ? Math.round(upload.processingTimeMs / 1000) : 'unknown'}s`);
        console.log(`Products Extracted: ${upload.estimatedProductsCount}`);
        console.log(`Tokens Used: ${upload.tokensUsed || 'unknown'}`);
        console.log(`Cost: $${upload.processingCostUsd || 'unknown'}`);
        
        if (upload.errorMessage) {
          console.log(`Error: ${upload.errorMessage}`);
        }
        
        if (upload.extractedProducts && upload.extractedProducts.length > 0) {
          console.log('\n📦 Sample Products:');
          upload.extractedProducts.slice(0, 5).forEach((product, i) => {
            console.log(`${i + 1}. ${product.name} - ${product.price} per ${product.unit}`);
          });
        }
        
        // Now we can do fair comparison
        console.log('\n🏁 FAIR COMPARISON NOW POSSIBLE');
        console.log('================================');
        console.log('Current System Results:');
        console.log(`  ⏱️  Time: ${upload.processingTimeMs ? Math.round(upload.processingTimeMs / 1000) : elapsed}s`);
        console.log(`  📦 Products: ${upload.estimatedProductsCount}`);
        console.log(`  💰 Cost: $${upload.processingCostUsd || 'unknown'}`);
        console.log(`  ✅ Success: ${upload.status === 'completed' ? 'Yes' : 'No'}`);
        
        console.log('\nClaude Sonnet 4 Results:');
        console.log(`  ⏱️  Time: 17.4s`);
        console.log(`  📦 Products: 31`);
        console.log(`  💰 Cost: $0.0423`);
        console.log(`  ✅ Success: Yes`);
        
        if (upload.estimatedProductsCount > 0 && upload.status === 'completed') {
          const currentTime = upload.processingTimeMs ? Math.round(upload.processingTimeMs / 1000) : elapsed;
          const currentCost = upload.processingCostUsd || 0;
          
          console.log('\n🏆 Winner Analysis:');
          console.log(`Time: ${currentTime < 17.4 ? 'Current System' : 'Claude'} (${Math.abs(currentTime - 17.4).toFixed(1)}s difference)`);
          console.log(`Products: ${upload.estimatedProductsCount > 31 ? 'Current System' : 'Claude'} (${Math.abs(upload.estimatedProductsCount - 31)} difference)`);
          console.log(`Cost: ${currentCost < 0.0423 ? 'Current System' : 'Claude'} ($${Math.abs(currentCost - 0.0423).toFixed(4)} difference)`);
        } else if (upload.status !== 'completed') {
          console.log('\n🏆 Winner: Claude Sonnet 4 (Current system failed)');
        }
        
        break;
      }
      
      // Check if stuck
      if (elapsed > 300) { // 5 minutes
        console.log('\n⚠️  Processing seems stuck (>5 minutes). This may indicate an issue.');
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      
    } catch (error) {
      console.error('❌ Error checking status:', error.message);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }
  
  if (attempts >= maxAttempts) {
    console.log('\n⏰ Timeout reached. Processing did not complete within 10 minutes.');
    console.log('🏆 Winner by timeout: Claude Sonnet 4');
  }
}

monitorProcessing();