const fetch = require('node-fetch');

async function checkProductionStatus() {
  const uploadId = 'cmcfvupq90002s2w98b5o2vy7';
  const apiUrl = 'http://209.38.85.196:3000';
  
  try {
    console.log('=== CHECKING PRODUCTION SERVER STATUS ===');
    console.log(`Server: ${apiUrl}`);
    console.log(`Upload ID: ${uploadId}`);
    
    // Check if server is accessible
    console.log('\n1. Testing server connectivity...');
    try {
      const healthResponse = await fetch(`${apiUrl}/api/stats`, {
        method: 'GET',
        timeout: 5000
      });
      console.log(`   Server status: ${healthResponse.status}`);
      if (healthResponse.ok) {
        const stats = await healthResponse.json();
        console.log(`   Total uploads: ${stats.totalUploads || 'N/A'}`);
        console.log(`   Total products: ${stats.totalProducts || 'N/A'}`);
      }
    } catch (healthError) {
      console.log(`   ❌ Server not accessible: ${healthError.message}`);
      return;
    }
    
    // Check upload status via API
    console.log('\n2. Checking upload status via API...');
    try {
      const statusResponse = await fetch(`${apiUrl}/api/admin/uploads/status/${uploadId}`, {
        method: 'GET',
        timeout: 10000
      });
      
      console.log(`   Status API response: ${statusResponse.status}`);
      
      if (statusResponse.ok) {
        const uploadStatus = await statusResponse.json();
        console.log('   Upload details:', JSON.stringify(uploadStatus, null, 2));
      } else {
        const errorText = await statusResponse.text();
        console.log(`   Error response: ${errorText}`);
      }
    } catch (statusError) {
      console.log(`   ❌ Status check failed: ${statusError.message}`);
    }
    
    // Check if there are any uploads in processing status
    console.log('\n3. Checking all upload statuses...');
    try {
      const allStatusResponse = await fetch(`${apiUrl}/api/admin/uploads/status?limit=10`, {
        method: 'GET',
        timeout: 10000
      });
      
      if (allStatusResponse.ok) {
        const allUploads = await allStatusResponse.json();
        console.log(`   Recent uploads count: ${allUploads.length || 0}`);
        
        if (allUploads.length > 0) {
          console.log('   Recent uploads:');
          allUploads.forEach((upload, index) => {
            console.log(`     ${index + 1}. ${upload.id.substring(0, 8)}... - ${upload.originalName} - Status: ${upload.status}`);
            if (upload.id === uploadId) {
              console.log(`        ⭐ This is our target upload!`);
            }
          });
        }
      }
    } catch (allStatusError) {
      console.log(`   ❌ All status check failed: ${allStatusError.message}`);
    }
    
    // Try to get processing logs if available
    console.log('\n4. Checking processing logs...');
    try {
      const logsResponse = await fetch(`${apiUrl}/api/processing-logs?uploadId=${uploadId}`, {
        method: 'GET',
        timeout: 10000
      });
      
      if (logsResponse.ok) {
        const logs = await logsResponse.json();
        console.log('   Processing logs:', JSON.stringify(logs, null, 2));
      } else {
        console.log(`   No processing logs endpoint or not accessible (${logsResponse.status})`);
      }
    } catch (logsError) {
      console.log(`   Processing logs not available: ${logsError.message}`);
    }
    
    // Check debug endpoint if available
    console.log('\n5. Checking debug information...');
    try {
      const debugResponse = await fetch(`${apiUrl}/api/admin/uploads/status/${uploadId}/debug`, {
        method: 'GET',
        timeout: 10000
      });
      
      if (debugResponse.ok) {
        const debugInfo = await debugResponse.json();
        console.log('   Debug info:', JSON.stringify(debugInfo, null, 2));
      } else {
        console.log(`   Debug endpoint not accessible (${debugResponse.status})`);
      }
    } catch (debugError) {
      console.log(`   Debug info not available: ${debugError.message}`);
    }
    
  } catch (error) {
    console.error('❌ General error:', error);
  }
}

checkProductionStatus();