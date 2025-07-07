const fs = require('fs');

async function uploadViaAPI() {
  console.log('📤 Attempting to restore data via existing API...');
  
  // Read our backup
  const backupData = JSON.parse(fs.readFileSync('./full-backup-1751864978248.json', 'utf8'));
  
  console.log('📊 Creating structured data files...');
  
  // Group products by supplier
  const supplierProducts = {};
  
  // First, organize products by their primary supplier (from prices)
  for (const product of backupData.data.products) {
    // Find prices for this product
    const productPrices = backupData.data.prices.filter(p => p.productId === product.id);
    
    if (productPrices.length > 0) {
      // Group by supplier
      for (const price of productPrices) {
        const supplier = backupData.data.suppliers.find(s => s.id === price.supplierId);
        if (supplier) {
          if (!supplierProducts[supplier.name]) {
            supplierProducts[supplier.name] = [];
          }
          
          supplierProducts[supplier.name].push({
            name: product.name,
            category: product.category || 'Other',
            unit: product.unit,
            price: parseFloat(price.amount),
            unitPrice: price.unitPrice ? parseFloat(price.unitPrice) : null
          });
        }
      }
    }
  }
  
  console.log('📦 Uploading data for each supplier...');
  
  for (const [supplierName, products] of Object.entries(supplierProducts)) {
    console.log(`\n📤 Uploading ${products.length} products for ${supplierName}...`);
    
    // Create CSV-like data
    let csvData = 'Product Name,Category,Unit,Price\n';
    for (const product of products) {
      csvData += `"${product.name}","${product.category}","${product.unit}",${product.price}\n`;
    }
    
    // Create a temporary file
    const tempFileName = `temp_${supplierName.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    fs.writeFileSync(tempFileName, csvData);
    
    try {
      // Upload via form data
      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', fs.createReadStream(tempFileName));
      form.append('supplierName', supplierName);
      
      const response = await fetch('http://209.38.85.196:3000/api/async-upload', {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ ${supplierName}: ${result.processingResult?.extractionDetails?.totalRowsDetected || 0} products uploaded`);
      } else {
        console.log(`❌ Failed to upload ${supplierName}`);
      }
      
      // Clean up temp file
      fs.unlinkSync(tempFileName);
      
      // Wait between uploads
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`❌ Error uploading ${supplierName}:`, error.message);
      // Clean up temp file
      if (fs.existsSync(tempFileName)) {
        fs.unlinkSync(tempFileName);
      }
    }
  }
  
  console.log('\n✅ Upload via API completed!');
}

uploadViaAPI();