const fs = require('fs');
const path = require('path');

const SUPPLIER_FOLDER = "/Users/denisdomashenko/Downloads/ SUPPLIER JULY 2025";
const API_URL = "http://209.38.85.196:3000/api/async-upload";

const BATCH_1_FILES = [
  "AF Seafood 03_07.pdf", 
  "Bali diary 05_07 .pdf",
  "Benoa fish market 03_07.pdf",
  "Berkah laut 03_07.jpg"
];

function extractSupplierName(filename) {
  let name = filename.replace(/\d{2}_\d{2}\.(pdf|xlsx?|jpg|docx|txt)$/i, '').trim();
  name = name.replace(/^(PT\.?\s*|CV\s*)/i, '');
  
  const mappings = {
    '0z britts 1': 'Oz Britts',
    'AF Seafood': 'AF Seafood',
    'Bali diary': 'Bali Dairy', 
    'Benoa fish market': 'Benoa Fish Market',
    'Berkah laut': 'Berkah Laut'
  };
  
  return mappings[name] || name;
}

async function uploadFile(filename) {
  const filePath = path.join(SUPPLIER_FOLDER, filename);
  const supplierName = extractSupplierName(filename);
  
  console.log(`📤 Uploading: ${filename}`);
  console.log(`🏪 Supplier: ${supplierName}`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return null;
  }
  
  try {
    const FormData = require('form-data');
    const fetch = require('node-fetch');
    
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('supplierName', supplierName);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log(`✅ ${filename} uploaded successfully`);
      console.log(`   Upload ID: ${result.uploadId}`);
      return result.uploadId;
    } else {
      console.log(`❌ Failed to upload ${filename}:`, result.error || result.message);
      return null;
    }
  } catch (error) {
    console.log(`❌ Error uploading ${filename}:`, error.message);
    return null;
  }
}

async function uploadBatch1() {
  console.log('🚀 STARTING BATCH 1 UPLOAD (5 files)');
  console.log('='.repeat(50));
  
  const results = [];
  
  for (const filename of BATCH_1_FILES) {
    const uploadId = await uploadFile(filename);
    results.push({ filename, uploadId, supplier: extractSupplierName(filename) });
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n📊 BATCH 1 UPLOAD SUMMARY:');
  console.log('='.repeat(30));
  
  const successful = results.filter(r => r.uploadId);
  const failed = results.filter(r => !r.uploadId);
  
  console.log(`✅ Successful: ${successful.length}/${BATCH_1_FILES.length}`);
  console.log(`❌ Failed: ${failed.length}/${BATCH_1_FILES.length}`);
  
  if (successful.length > 0) {
    console.log('\n✅ Successfully uploaded:');
    successful.forEach(r => console.log(`   - ${r.filename} (${r.supplier}) → ${r.uploadId}`));
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed uploads:');
    failed.forEach(r => console.log(`   - ${r.filename} (${r.supplier})`));
  }
  
  return results;
}

uploadBatch1().catch(console.error);