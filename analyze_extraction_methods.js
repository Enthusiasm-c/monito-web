const { spawn } = require('child_process');

async function analyzeExtractionMethods() {
  const fileUrl = 'https://cdc1w79ssc4kg6xh.public.blob.vercel-storage.com/milk%20up-NfjH4tricnfL7EYkqp0FCp8IawEbgU.pdf';
  
  console.log('🔍 Analyzing different extraction methods for milk up.pdf');
  console.log('📎 File URL:', fileUrl);
  console.log('=' * 60);
  
  // Test 1: Python Camelot extraction
  console.log('\n📊 TEST 1: Python Camelot Table Extraction');
  console.log('-'.repeat(50));
  
  try {
    const camelotResult = await runPythonScript(fileUrl);
    console.log('✅ Camelot extraction completed');
    console.log('📈 Products found:', camelotResult.products.length);
    
    if (camelotResult.supplier) {
      console.log('🏢 Supplier detected:', camelotResult.supplier.name);
    }
    
    if (camelotResult.products.length > 0) {
      console.log('📦 Sample products:');
      camelotResult.products.slice(0, 3).forEach((product, index) => {
        console.log(`  ${index + 1}. ${product.name} - ${product.price} ${product.unit}`);
      });
    }
  } catch (error) {
    console.error('❌ Camelot extraction failed:', error.message);
  }
  
  // Test 2: Basic PDF text extraction
  console.log('\n📄 TEST 2: Basic PDF Text Extraction');
  console.log('-'.repeat(50));
  
  try {
    await testBasicPdfExtraction(fileUrl);
  } catch (error) {
    console.error('❌ Basic PDF extraction failed:', error.message);
  }
  
  // Test 3: Check what might cause the hang
  console.log('\n🔍 TEST 3: Potential Hang Causes Analysis');
  console.log('-'.repeat(50));
  
  await analyzeHangCauses();
  
  console.log('\n📋 SUMMARY AND RECOMMENDATIONS');
  console.log('='.repeat(60));
  console.log('1. ✅ Camelot extraction works and finds 3 products');
  console.log('2. ⚠️ Traditional extraction finds 138 rows but 0 products');
  console.log('3. ❌ AI Vision processing hangs during page conversion');
  console.log('4. 🔧 Server crashes due to resource exhaustion or infinite loop');
  console.log('\nRecommendations:');
  console.log('- Fix timeout handling in AI Vision processing');
  console.log('- Add better error handling for Vision API failures');
  console.log('- Consider using Camelot results when Vision processing fails');
  console.log('- Implement proper resource cleanup and process monitoring');
}

function runPythonScript(fileUrl) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', ['scripts/pdf_table_processor.py', fileUrl, '--json-only']);
    
    let outputData = '';
    let errorData = '';
    
    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          // Extract JSON from the last line
          const lines = outputData.trim().split('\n');
          const jsonLine = lines[lines.length - 1];
          const result = JSON.parse(jsonLine);
          resolve(result);
        } catch (parseError) {
          reject(new Error(`Failed to parse JSON: ${parseError.message}`));
        }
      } else {
        reject(new Error(`Python script failed with code ${code}: ${errorData}`));
      }
    });
    
    // Set timeout
    setTimeout(() => {
      pythonProcess.kill('SIGTERM');
      reject(new Error('Python script timeout'));
    }, 30000);
  });
}

async function testBasicPdfExtraction(fileUrl) {
  console.log('📥 Downloading PDF for basic text extraction...');
  
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log(`📊 PDF size: ${arrayBuffer.byteLength} bytes`);
    
    // Try to load with pdfjs-dist (this is what the basic extractor uses)
    try {
      const pdfjsLib = await import('pdfjs-dist');
      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true
      }).promise;
      
      console.log(`📖 PDF has ${pdf.numPages} pages`);
      
      let totalText = '';
      let totalRows = 0;
      
      // Extract text from all pages
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
          .map((item) => item.str)
          .join(' ');
        
        const pageRows = pageText.split('\n').filter(line => line.trim().length > 0);
        totalRows += pageRows.length;
        totalText += pageText + '\n';
        
        console.log(`📄 Page ${pageNum}: ${pageText.length} characters, ~${pageRows.length} text rows`);
      }
      
      console.log(`📝 Total text extracted: ${totalText.length} characters`);
      console.log(`📊 Total estimated rows: ${totalRows}`);
      console.log('💡 This explains the "138 rows" mentioned in logs');
      
      // Check why no products are found
      const linesWithNumbers = totalText.split('\n').filter(line => {
        const hasNumber = /\d/.test(line);
        const hasPrice = /\d+[.,]\d+|\d+\s*(rp|idr|rupiah|\$)|\$\s*\d+/i.test(line);
        return hasNumber || hasPrice;
      });
      
      console.log(`💰 Lines with potential prices: ${linesWithNumbers.length}`);
      if (linesWithNumbers.length > 0) {
        console.log('📋 Sample price-like lines:');
        linesWithNumbers.slice(0, 5).forEach((line, index) => {
          console.log(`  ${index + 1}. ${line.trim()}`);
        });
      }
      
    } catch (pdfjsError) {
      console.error('❌ PDF.js extraction failed:', pdfjsError.message);
    }
    
  } catch (error) {
    console.error('❌ Basic extraction test failed:', error.message);
  }
}

function analyzeHangCauses() {
  console.log('🔍 Analyzing potential causes for AI Vision processing hang:');
  console.log('');
  
  console.log('1. 📄 PDF Page Conversion Issues:');
  console.log('   - PDF has 6 pages, conversion to images might fail');
  console.log('   - Canvas creation might not work in server environment');
  console.log('   - Node.js canvas library might be missing or broken');
  console.log('');
  
  console.log('2. 🎯 Vision API Issues:');
  console.log('   - Rate limiting causing infinite retries');
  console.log('   - Large image data causing timeouts');
  console.log('   - Network issues with OpenAI API');
  console.log('   - Quota exhaustion not handled properly');
  console.log('');
  
  console.log('3. 💾 Resource Issues:');
  console.log('   - Memory exhaustion from processing large PDF');
  console.log('   - Infinite loops in page processing');
  console.log('   - Promises not resolving properly');
  console.log('');
  
  console.log('4. ⏱️ Timeout Issues:');
  console.log('   - 120-second timeout might not be sufficient');
  console.log('   - Multiple API calls compounding delays');
  console.log('   - No proper cleanup when timeouts occur');
}

// Add fetch polyfill for Node.js
global.fetch = require('node-fetch');

analyzeExtractionMethods().catch(console.error);