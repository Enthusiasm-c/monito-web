#!/usr/bin/env node

/**
 * Upload test PDF to Vercel Blob Storage and get URL for testing
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function uploadTestPdf() {
  try {
    console.log('📤 Uploading test PDF to Vercel Blob...');
    
    const pdfPath = path.join(__dirname, 'test-eggstra.pdf');
    
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }
    
    // Read file
    const fileBuffer = fs.readFileSync(pdfPath);
    
    // Upload to Vercel Blob using the endpoint
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: 'test-eggstra.pdf',
      contentType: 'application/pdf'
    });
    
    const response = await fetch('https://blob.vercel-storage.com', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    console.log('✅ Upload successful!');
    console.log(`   URL: ${result.url}`);
    console.log(`   Size: ${result.size} bytes`);
    
    // Now test the Python converter with the real URL
    console.log('\\n🐍 Testing Python converter with real URL...');
    
    await testPythonConverter(result.url);
    
    return result.url;
    
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    
    // Fallback: try to test with a mock/local approach
    console.log('\\n🔄 Trying alternative approach...');
    await testWithLocalFile();
  }
}

async function testPythonConverter(pdfUrl) {
  const { spawn } = require('child_process');
  
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'scripts', 'pdf_to_images.py');
    const maxPages = 3;
    
    console.log(`   Running: python3 ${scriptPath} ${pdfUrl} ${maxPages}`);
    
    const pythonProcess = spawn('python3', [
      scriptPath,
      pdfUrl,
      maxPages.toString()
    ]);
    
    let outputData = '';
    let errorData = '';
    
    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (errorData) {
        console.log('   Warnings:', errorData.trim());
      }
      
      if (code !== 0) {
        console.error('❌ Python script failed with code:', code);
        reject(new Error(`Python script failed with code ${code}`));
        return;
      }
      
      try {
        const result = JSON.parse(outputData);
        
        if (result.success) {
          console.log('✅ PDF to images conversion successful!');
          console.log(`   Pages processed: ${result.pages_processed}`);
          console.log(`   Images generated: ${result.images.length}`);
          
          // Analyze the first image
          if (result.images.length > 0) {
            analyzeImages(result.images);
          }
          
          resolve(result);
        } else {
          console.error('❌ PDF conversion failed:', result.error);
          reject(new Error(result.error));
        }
      } catch (parseError) {
        console.error('❌ Failed to parse output:', parseError);
        console.log('Raw output:', outputData);
        reject(parseError);
      }
    });
  });
}

function analyzeImages(images) {
  console.log('\\n📊 Image Analysis:');
  
  images.forEach((image, index) => {
    const sizeKB = (image.length * 0.75 / 1024).toFixed(2); // base64 is ~33% larger
    console.log(`   Page ${index + 1}: ${sizeKB} KB`);
    
    // Save first image for visual inspection
    if (index === 0) {
      const imageBuffer = Buffer.from(image, 'base64');
      const imagePath = path.join(__dirname, 'eggstra-page1-extracted.png');
      fs.writeFileSync(imagePath, imageBuffer);
      console.log(`   Saved as: ${imagePath}`);
    }
  });
  
  const totalSize = images.reduce((sum, img) => sum + img.length * 0.75, 0);
  console.log(`   Total size: ${(totalSize / 1024).toFixed(2)} KB`);
}

async function testWithLocalFile() {
  console.log('🔧 Testing with modified Python script for local files...');
  
  // Create a modified version that can handle local files
  const modifiedScript = `#!/usr/bin/env python3
"""
Modified PDF to Images converter for local testing
"""

import sys
import json
import base64
import os
from io import BytesIO

try:
    import fitz  # PyMuPDF
except ImportError:
    print(json.dumps({"success": False, "error": "PyMuPDF not installed"}))
    sys.exit(1)

try:
    from PIL import Image
except ImportError:
    print(json.dumps({"success": False, "error": "Pillow not installed"}))
    sys.exit(1)

def process_local_pdf(pdf_path: str, max_pages: int = 8) -> list:
    """Process local PDF file"""
    try:
        # Read the local PDF file
        with open(pdf_path, 'rb') as f:
            pdf_data = f.read()
        
        doc = fitz.open(stream=pdf_data, filetype="pdf")
        images = []
        
        for page_num in range(min(len(doc), max_pages)):
            page = doc[page_num]
            
            # Render page to image with good quality
            mat = fitz.Matrix(2.0, 2.0)  # 2x scaling for better quality
            pix = page.get_pixmap(matrix=mat)
            
            # Convert to PIL Image
            img_data = pix.tobytes("png")
            img = Image.open(BytesIO(img_data))
            
            # Optimize image size for API (max 1024x1024)
            if img.width > 1024 or img.height > 1024:
                img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
            
            # Convert to base64
            buffer = BytesIO()
            img.save(buffer, format='PNG', optimize=True)
            img_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            images.append(img_base64)
        
        doc.close()
        return images
        
    except Exception as e:
        raise Exception(f"Failed to convert PDF to images: {e}")

def main():
    if len(sys.argv) != 3:
        print(json.dumps({"success": False, "error": "Usage: python3 script.py <pdf_path> <max_pages>"}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    max_pages = int(sys.argv[2])
    
    # Remove file:// prefix if present
    if pdf_path.startswith('file://'):
        pdf_path = pdf_path[7:]
    
    if not os.path.exists(pdf_path):
        print(json.dumps({"success": False, "error": f"PDF file not found: {pdf_path}"}))
        sys.exit(1)
    
    try:
        images = process_local_pdf(pdf_path, max_pages)
        
        result = {
            "success": True,
            "images": images,
            "pages_processed": len(images),
            "max_pages": max_pages
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e),
            "images": []
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()
`;

  const scriptPath = path.join(__dirname, 'test-pdf-converter.py');
  fs.writeFileSync(scriptPath, modifiedScript);
  fs.chmodSync(scriptPath, '755');
  
  // Test with local file
  const pdfPath = path.join(__dirname, 'test-eggstra.pdf');
  await testPythonConverter2(scriptPath, pdfPath);
}

async function testPythonConverter2(scriptPath, pdfPath) {
  const { spawn } = require('child_process');
  
  return new Promise((resolve, reject) => {
    const maxPages = 3;
    
    console.log(`   Running: python3 ${scriptPath} ${pdfPath} ${maxPages}`);
    
    const pythonProcess = spawn('python3', [
      scriptPath,
      pdfPath,
      maxPages.toString()
    ]);
    
    let outputData = '';
    let errorData = '';
    
    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (errorData) {
        console.log('   Warnings:', errorData.trim());
      }
      
      if (code !== 0) {
        console.error('❌ Local test failed with code:', code);
        return;
      }
      
      try {
        const result = JSON.parse(outputData);
        
        if (result.success) {
          console.log('✅ Local PDF processing successful!');
          console.log(`   Pages processed: ${result.pages_processed}`);
          console.log(`   Images generated: ${result.images.length}`);
          
          if (result.images.length > 0) {
            analyzeImages(result.images);
            
            // Now simulate what would happen with Gemini processing
            simulateGeminiProcessing(result.images);
          }
          
          resolve(result);
        } else {
          console.error('❌ Local processing failed:', result.error);
        }
      } catch (parseError) {
        console.error('❌ Failed to parse output:', parseError);
      }
    });
  });
}

function simulateGeminiProcessing(images) {
  console.log('\\n🤖 Simulating Gemini Vision processing...');
  console.log('   This is what would be sent to Gemini API:');
  
  images.forEach((image, index) => {
    console.log(`   Page ${index + 1}:`);
    console.log(`     - Image size: ${(image.length * 0.75 / 1024).toFixed(2)} KB`);
    console.log(`     - Base64 length: ${image.length} chars`);
    console.log(`     - Would be processed with model: gemini-2.0-flash-exp`);
  });
  
  // Estimate token usage
  const estimatedTokens = images.length * 500; // rough estimate
  const estimatedCost = (estimatedTokens / 1000) * 0.001; // rough cost estimate
  
  console.log(`\\n💰 Estimated processing:`)
  console.log(`   Tokens: ~${estimatedTokens}`);
  console.log(`   Cost: ~$${estimatedCost.toFixed(6)}`);
  
  console.log('\\n📋 Expected extraction for Eggstra PDF:');
  console.log('   Based on typical Indonesian supplier price lists:');
  console.log('   - Expected products: 30-60');
  console.log('   - Categories: Meat, Seafood, Vegetables, Dairy');
  console.log('   - Units: kg, g, pcs, pack');
  console.log('   - Price range: 15k - 500k IDR');
  console.log('   - Supplier: Should detect "Eggstra" in document');
}

// Run the test
if (require.main === module) {
  uploadTestPdf();
}

module.exports = { uploadTestPdf };