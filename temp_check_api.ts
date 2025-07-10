
import fetch from 'node-fetch';

async function checkApi() {
  try {
    const response = await fetch('http://localhost:3000/api/admin/suppliers?page=1&limit=5');
    if (!response.ok) {
      console.error('API request failed with status:', response.status);
      const errorBody = await response.text();
      console.error('Error body:', errorBody);
      return;
    }
    const data = await response.json();
    console.log('API Response:');
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error during fetch:', e);
  }
}

checkApi();
