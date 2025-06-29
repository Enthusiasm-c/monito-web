#!/usr/bin/env node

/**
 * Direct test of Eggstra PDF processing via enhanced PDF extractor
 */

const fs = require('fs');
const path = require('path');
const { put } = require('@vercel/blob');

// Import the PDF extractor (we'll need to adjust the import path)
async function testEggstraProcessing() {
  try {
    console.log('🔄 Testing Eggstra PDF processing directly...\n');
    
    const pdfPath = path.join(__dirname, 'test-eggstra.pdf');
    
    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }
    
    const fileStats = fs.statSync(pdfPath);
    console.log(`📁 File: test-eggstra.pdf`);
    console.log(`📏 Size: ${(fileStats.size / 1024).toFixed(2)} KB\n`);
    
    // First, let's test the Python PDF to images converter directly
    console.log('🐍 Testing Python PDF to images converter...');
    
    // Upload file to blob storage first (simulate the real flow)
    const fileBuffer = fs.readFileSync(pdfPath);
    
    // For testing, we'll save the file locally and use a local path
    // In real system, this would be a Vercel Blob URL
    const testFileUrl = `file://${pdfPath}`;
    
    console.log(`📤 Using file URL: ${testFileUrl}`);
    
    // Test the Python script directly
    await testPythonConverter(pdfPath);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testPythonConverter(pdfPath) {
  const { spawn } = require('child_process');
  
  return new Promise((resolve, reject) => {
    console.log('🔄 Running Python PDF to images converter...');
    
    const scriptPath = path.join(__dirname, 'scripts', 'pdf_to_images.py');
    
    // Check if script exists
    if (!fs.existsSync(scriptPath)) {
      console.log('❌ Python script not found, creating a test version...');
      createTestPythonScript(scriptPath);
    }
    
    // Use file:// URL for local testing
    const fileUrl = `file://${pdfPath}`;
    const maxPages = 8;
    
    console.log(`   Script: ${scriptPath}`);
    console.log(`   PDF URL: ${fileUrl}`);
    console.log(`   Max pages: ${maxPages}`);
    
    const pythonProcess = spawn('python3', [
      scriptPath,
      fileUrl,
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
      console.log(`   Python process exited with code: ${code}`);
      
      if (code !== 0) {
        console.error('❌ Python script failed:');
        console.error('STDERR:', errorData);
        reject(new Error(`Python script failed with code ${code}`));
        return;
      }
      
      try {
        const result = JSON.parse(outputData);
        
        if (result.success) {
          console.log('✅ PDF to images conversion successful!');
          console.log(`   Pages processed: ${result.pages_processed}`);
          console.log(`   Images generated: ${result.images.length}`);
          
          // Test first image
          if (result.images.length > 0) {
            const firstImage = result.images[0];
            console.log(`   First image size: ${(firstImage.length / 1024).toFixed(2)} KB (base64)`);
            
            // Save first image for inspection
            const imageBuffer = Buffer.from(firstImage, 'base64');
            const imagePath = path.join(__dirname, 'test-eggstra-page1.png');
            fs.writeFileSync(imagePath, imageBuffer);
            console.log(`   Saved first page as: ${imagePath}`);
          }
          
          resolve(result);
        } else {
          console.error('❌ PDF conversion failed:', result.error);
          reject(new Error(result.error));
        }
      } catch (parseError) {
        console.error('❌ Failed to parse Python output:', parseError);
        console.error('Raw output:', outputData);
        reject(parseError);
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('❌ Failed to start Python process:', error);
      reject(error);
    });
  });
}

function createTestPythonScript(scriptPath) {
  const scriptDir = path.dirname(scriptPath);
  
  // Create scripts directory if it doesn't exist
  if (!fs.existsSync(scriptDir)) {
    fs.mkdirSync(scriptDir, { recursive: true });
  }
  
  // Copy the existing script
  const sourceScript = path.join(__dirname, 'scripts', 'pdf_to_images.py');
  if (fs.existsSync(sourceScript)) {
    console.log('✅ Using existing Python script');
    return;
  }
  
  // Create a simple test script
  const testScript = `#!/usr/bin/env python3
import sys
import json

# Simple test script that returns a mock result
def main():
    if len(sys.argv) != 3:
        print(json.dumps({"success": False, "error": "Usage: python3 pdf_to_images.py <pdf_url> <max_pages>"}))
        sys.exit(1)
    
    pdf_url = sys.argv[1]
    max_pages = int(sys.argv[2])
    
    # Mock result for testing
    result = {
        "success": False,
        "error": "PyMuPDF not installed. Please run: pip install PyMuPDF Pillow requests",
        "images": [],
        "pages_processed": 0,
        "max_pages": max_pages
    }
    
    print(json.dumps(result))

if __name__ == "__main__":
    main()
`;
  
  fs.writeFileSync(scriptPath, testScript);
  fs.chmodSync(scriptPath, '755');
  console.log(`📝 Created test Python script at: ${scriptPath}`);
}

// Run the test
if (require.main === module) {
  testEggstraProcessing();
}

module.exports = { testEggstraProcessing };