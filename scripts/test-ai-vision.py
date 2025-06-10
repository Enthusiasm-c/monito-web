#!/usr/bin/env python3
"""
Test AI Vision processing to identify the crash issue
"""

import sys
import os
import traceback
from pathlib import Path

# Add the current directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from pdf_image_extractor import PDFImageExtractor
    print("✅ Successfully imported PDFImageExtractor")
except ImportError as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)

def test_ai_vision():
    print("🔍 Testing AI Vision processing...")
    
    # Test URL (milk up PDF)
    pdf_url = "https://cdc1w79ssc4kg6xh.public.blob.vercel-storage.com/milk%20up-RB2AKmAEQe0cBDWBdHPI8yULfxjE1C.pdf"
    api_key = os.getenv('OPENAI_API_KEY')
    
    if not api_key:
        print("❌ OPENAI_API_KEY not found in environment")
        return
    
    print(f"🔑 API Key: {'*' * 10}... (configured)")
    print(f"🔗 PDF URL: {pdf_url[:50]}...")
    
    try:
        print("🏗️ Creating PDFImageExtractor...")
        extractor = PDFImageExtractor(api_key)
        
        print("🚀 Starting PDF processing...")
        result = extractor.process_pdf(pdf_url)
        
        print("✅ Processing completed!")
        print(f"📄 Pages processed: {result.get('metrics', {}).get('pages_processed', 0)}")
        print(f"🛍️ Products found: {result.get('metrics', {}).get('total_products', 0)}")
        print(f"💰 Cost: ${result.get('metrics', {}).get('cost_usd', 0):.4f}")
        
        if 'error' in result:
            print(f"⚠️ Error in result: {result['error']}")
        
        return result
        
    except Exception as e:
        print(f"💥 Exception occurred: {e}")
        print("📋 Traceback:")
        traceback.print_exc()
        return None

if __name__ == "__main__":
    # Load environment variables
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
        print(f"✅ Loaded environment from {env_path}")
    else:
        print(f"⚠️ No .env file found at {env_path}")
    
    test_ai_vision()