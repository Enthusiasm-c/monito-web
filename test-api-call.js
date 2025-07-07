async function testAPICall() {
  try {
    // Test the API call that the frontend is making
    const productId = 'product_1751873650473_r6buuis40';
    const url = `http://localhost:3000/api/admin/analytics/prices?type=product&productId=${productId}`;
    
    console.log('Testing API call:', url);
    
    const response = await fetch(url);
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    const responseText = await response.text();
    console.log('Response body:', responseText);
    
    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log('Parsed data:', JSON.stringify(data, null, 2));
      } catch (parseError) {
        console.log('Failed to parse JSON:', parseError.message);
      }
    }
    
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testAPICall();