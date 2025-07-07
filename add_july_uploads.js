// Загрузим July 2025 файлы заново
const files = [
  '0z britts 1 04_07.pdf',
  'AF Seafood 03_07.pdf',
  'Bali diary 05_07 .pdf', 
  'Benoa fish market 03_07.pdf',
  'CV alam Sari 05_07 .pdf',
  'Cheese work  04_07.pdf',
  'Cheese+Boutique+Menu+2025-compressed.pdf',
  'Gloria seafood Bali 03_07.pdf',
  'Happy farm bali 03_07.pdf',
  'Meat Mart 2 03_07.pdf',
  'Meat mart 1 03_07.pdf',
  'Milk up 04_07.pdf',
  'PT Gioa cheese 04_07.pdf',
  'PT Raja boga 04_07.pdf',
  'PT pangan lestari 04_07.pdf',
  'PT puri pangan utama 03_07.pdf',
  'PT.Bali boga sejati 03_07.pdf',
  'PT.Pasti enak 03_07.pdf',
  'SAI FRESH 03_07.pdf',
  'Siap Bali 03_07.pdf',
  'Widi Wiguna 03_07.xlsx',
  'seven choice_PT satria pangan sejati 04_07.pdf',
  'oz britts 2 04_07.pdf',
  'shy cow 04_07.pdf'
];

async function uploadJulyFiles() {
  console.log('📤 Re-uploading July 2025 files...');
  
  const SUPPLIER_FOLDER = "/Users/denisdomashenko/Downloads/ SUPPLIER JULY 2025";
  
  const supplierMappings = {
    '0z britts 1 04_07.pdf': 'Oz Britts',
    'AF Seafood 03_07.pdf': 'AF Seafood', 
    'Bali diary 05_07 .pdf': 'Bali Dairy',
    'Benoa fish market 03_07.pdf': 'Benoa Fish Market',
    'CV alam Sari 05_07 .pdf': 'Alam Sari',
    'Cheese work  04_07.pdf': 'Cheese Work',
    'Cheese+Boutique+Menu+2025-compressed.pdf': 'Cheese Boutique',
    'Gloria seafood Bali 03_07.pdf': 'Gloria Seafood Bali',
    'Happy farm bali 03_07.pdf': 'Happy Farm Bali',
    'Meat Mart 2 03_07.pdf': 'Meat Mart',
    'Meat mart 1 03_07.pdf': 'Meat Mart',
    'Milk up 04_07.pdf': 'Milk Up',
    'PT Gioa cheese 04_07.pdf': 'Gioa Cheese',
    'PT Raja boga 04_07.pdf': 'Raja Boga',
    'PT pangan lestari 04_07.pdf': 'Pangan Lestari',
    'PT puri pangan utama 03_07.pdf': 'Puri Pangan Utama',
    'PT.Bali boga sejati 03_07.pdf': 'Bali Boga Sejati',
    'PT.Pasti enak 03_07.pdf': 'Pasti Enak',
    'SAI FRESH 03_07.pdf': 'Sai Fresh',
    'Siap Bali 03_07.pdf': 'Siap Bali',
    'Widi Wiguna 03_07.xlsx': 'Widi Wiguna',
    'seven choice_PT satria pangan sejati 04_07.pdf': 'Seven Choice Satria Pangan Sejati',
    'oz britts 2 04_07.pdf': 'Oz Britts',
    'shy cow 04_07.pdf': 'Shy Cow'
  };
  
  for (const filename of files) {
    const supplierName = supplierMappings[filename];
    console.log(`📤 Uploading: ${filename} (${supplierName})`);
    
    try {
      const response = await fetch('http://localhost:3000/api/async-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filePath: `${SUPPLIER_FOLDER}/${filename}`,
          supplierName: supplierName
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ ${filename} uploaded successfully`);
      } else {
        console.log(`❌ Failed to upload ${filename}`);
      }
      
      // Wait between uploads
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      console.log(`❌ Error uploading ${filename}:`, error.message);
    }
  }
  
  console.log('✅ July 2025 upload completed!');
}

console.log('📊 Current state - we have historical data restored');
console.log('📅 Now we need to add July 2025 data to complete the picture');
console.log('🎯 Target: ~4000+ products (historical + July 2025)');

uploadJulyFiles();