#!/usr/bin/env python3
"""
Test script to debug AI Vision PDF processing step by step
"""

import sys
import os
import time
import traceback

# Add the path to find our modules
sys.path.append('/Users/denisdomashenko/monito-web/scripts')

from pdf_image_extractor import PDFImageExtractor

def test_step_by_step():
    print("🔧 Testing AI Vision PDF processing step by step...")
    
    # Test parameters
    pdf_url = "https://cdc1w79ssc4kg6xh.public.blob.vercel-storage.com/milk%20up-hNIcLdUBfpq7ZE7b4atXdXokwBa9HJ.pdf"
    api_key = os.environ.get('OPENAI_API_KEY')
    
    if not api_key:
        print("❌ OPENAI_API_KEY not found!")
        return
    
    print(f"✅ API Key found: {api_key[:10]}...")
    
    try:
        # Step 1: Initialize extractor
        print("\n🚀 Step 1: Initializing PDFImageExtractor...")
        extractor = PDFImageExtractor(api_key)
        print("✅ Extractor initialized")
        
        # Step 2: Download PDF
        print("\n📥 Step 2: Testing PDF download...")
        import requests
        import tempfile
        
        start_time = time.time()
        response = requests.get(pdf_url, timeout=30)
        download_time = time.time() - start_time
        print(f"✅ PDF downloaded in {download_time:.1f}s, size: {len(response.content)} bytes")
        
        # Save to temp file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
            tmp_file.write(response.content)
            pdf_path = tmp_file.name
        
        print(f"✅ PDF saved to: {pdf_path}")
        
        # Step 3: Convert to images
        print("\n🖼️ Step 3: Converting PDF to images...")
        start_time = time.time()
        
        images = extractor.pdf_to_images(pdf_path, dpi=100)  # Lower DPI for testing
        
        conversion_time = time.time() - start_time
        print(f"✅ Converted {len(images)} pages in {conversion_time:.1f}s")
        
        if not images:
            print("❌ No images created!")
            return
        
        # Show image sizes
        for i, img_b64 in enumerate(images):
            print(f"   Page {i+1}: {len(img_b64)} characters")
        
        # Step 4: Test AI Vision on first page only
        print("\n🤖 Step 4: Testing AI Vision on first page...")
        start_time = time.time()
        
        result = extractor.extract_data_from_image(images[0], 1)
        
        api_time = time.time() - start_time
        print(f"✅ AI Vision completed in {api_time:.1f}s")
        print(f"📊 Result: {len(result.get('products', []))} products found")
        
        # Clean up
        os.unlink(pdf_path)
        print("✅ Cleanup completed")
        
        print("\n🎉 All steps completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error at step: {e}")
        print(f"📝 Traceback:\n{traceback.format_exc()}")

if __name__ == "__main__":
    test_step_by_step()