#!/usr/bin/env python3
"""
Test Eggstra PDF to understand why only 51 products were extracted from 200+
"""

import os
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# Load environment
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    load_dotenv(env_path)

from async_pdf_image_extractor import AsyncPDFImageExtractor

async def test_eggstra_pdf():
    print("🥚 Testing Eggstra PDF extraction...")
    
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("❌ No API key found")
        return
    
    # Found the actual blob URL
    pdf_url = "https://cdc1w79ssc4kg6xh.public.blob.vercel-storage.com/PRICE%20QUOTATATION%20FOR%20EGGSTRA%20CAFE-jxtc940Um2B5E8YPygH1qi5bAx2sHQ.pdf"
    
    print(f"📄 PDF URL: {pdf_url}")
    print("📋 Expected analysis:")
    print("   - Should find 200+ product positions")
    print("   - Currently only finding 51 products")
    print("   - Need to identify why products are missing")
    
    # We'll need the actual blob URL to test this
    print("\n⚠️ Need actual blob URL to test extraction")
    print("   Please provide the blob URL from the database")
    
    # Mock analysis of the issue
    print("\n🔍 Potential causes for missing products:")
    print("1. 📄 AI Vision processing limited pages (current limit: 6 pages)")
    print("2. 🖼️ Poor image quality preventing text recognition")
    print("3. 🧠 AI model not recognizing all table structures")
    print("4. 📝 Complex layout that confuses the extraction")
    print("5. 🔢 Large tables split across multiple pages")
    print("6. 📐 Small text that gets lost in image compression")
    
    print("\n💡 Debugging steps needed:")
    print("1. Check how many pages the PDF has")
    print("2. Test with higher DPI/resolution")
    print("3. Process more pages (increase limit from 6)")
    print("4. Use different image format (PNG vs JPEG)")
    print("5. Test with 'high' detail mode instead of 'low'")
    print("6. Analyze each page individually")

if __name__ == "__main__":
    asyncio.run(test_eggstra_pdf())