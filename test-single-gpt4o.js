const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testSingleFile() {
  try {
    const pdfPath = '/Users/denisdomashenko/Downloads/milk up.pdf';
    
    const formData = new FormData();
    formData.append('files', fs.createReadStream(pdfPath), 'milk up.pdf');
    formData.append('model', 'gpt-4o');

    console.log('Testing milk up.pdf with gpt-4o...');
    
    const response = await fetch('http://localhost:3000/api/upload-ai', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

testSingleFile();