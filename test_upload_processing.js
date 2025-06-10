const fetch = require('node-fetch');

async function testUploadProcessing() {
  const uploadId = 'cmbp2b4jr0002ou8mc90ouuej';
  
  console.log('🔍 Testing upload processing for ID:', uploadId);
  
  try {
    // Test 1: Check if we can reprocess the upload
    console.log('📞 Calling reprocess API...');
    const reprocessResponse = await fetch('http://localhost:3001/api/reprocess-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uploadId })
    });
    
    const reprocessResult = await reprocessResponse.text();
    console.log('📋 Reprocess response status:', reprocessResponse.status);
    console.log('📋 Reprocess response:', reprocessResult);
    
  } catch (error) {
    console.error('❌ Error testing upload processing:', error);
  }
}

testUploadProcessing();