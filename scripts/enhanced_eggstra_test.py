#!/usr/bin/env python3
"""
Enhanced test for Eggstra PDF with improved settings to extract all 200+ products
"""

import sys
import os
import time
import requests
import base64
import tempfile
import json
import asyncio
import aiohttp
from io import BytesIO
from pathlib import Path
from typing import List, Dict, Any

try:
    import fitz  # PyMuPDF
    from PIL import Image
    from dotenv import load_dotenv
except ImportError as e:
    print(f"ERROR: Missing dependency: {e}")
    sys.exit(1)

class EnhancedEggstraExtractor:
    def __init__(self, openai_api_key: str):
        self.openai_api_key = openai_api_key
        self.api_url = "https://api.openai.com/v1/chat/completions"
    
    def pdf_to_images(self, pdf_path: str, dpi: int = 150) -> List[str]:
        """Convert PDF pages to base64-encoded images with enhanced settings"""
        try:
            print(f"[INFO] 🔍 Opening PDF: {pdf_path}")
            doc = fitz.open(pdf_path)
            total_pages = len(doc)
            print(f"[INFO] 📄 Found {total_pages} pages in PDF")
            
            # Process ALL pages (remove limit for thorough extraction)
            max_pages = total_pages  # Process all pages
            print(f"[INFO] 🚀 Processing ALL {max_pages} pages for complete extraction")
            
            images = []
            
            for page_num in range(max_pages):
                try:
                    print(f"[INFO] 🔄 Processing page {page_num + 1}/{max_pages}")
                    page = doc.load_page(page_num)
                    
                    # Higher DPI for better text recognition
                    mat = fitz.Matrix(dpi/72, dpi/72)
                    pix = page.get_pixmap(matrix=mat)
                    
                    # Convert to PIL Image
                    img_data = pix.tobytes("png")
                    img = Image.open(BytesIO(img_data))
                    
                    # Higher resolution for better text recognition
                    max_width = 768  # Increased from 480
                    if img.width > max_width:
                        ratio = max_width / img.width
                        new_height = int(img.height * ratio)
                        img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
                    
                    # Use PNG for better quality (no compression artifacts)
                    buffer = BytesIO()
                    img.save(buffer, format="PNG", optimize=True)
                    img_base64 = base64.b64encode(buffer.getvalue()).decode()
                    
                    images.append(img_base64)
                    print(f"[INFO] ✅ Page {page_num + 1}: {len(img_base64)} chars (PNG)")
                    
                except Exception as page_error:
                    print(f"[ERROR] Failed to process page {page_num + 1}: {page_error}")
                    continue
            
            doc.close()
            print(f"[INFO] 🎉 Successfully converted {len(images)} pages to images")
            return images
            
        except Exception as e:
            print(f"[ERROR] Failed to convert PDF to images: {e}")
            return []
    
    async def extract_data_from_image(self, session: aiohttp.ClientSession, image_base64: str, page_num: int) -> Dict[str, Any]:
        """Extract data with enhanced prompt for comprehensive extraction"""
        
        # Enhanced prompt for maximum product extraction
        prompt = """You are an expert at extracting ALL products from price lists. This is a comprehensive price quotation document.

CRITICAL: Extract EVERY SINGLE product visible on this page, no matter how small or how formatted.

EXTRACTION REQUIREMENTS:
1. Find ALL products with prices (even if prices are in different columns)
2. Look for products in tables, lists, or any format
3. Extract product names, prices, units, descriptions
4. Include supplier contact information if visible

PRODUCT FORMATS TO RECOGNIZE:
- Table rows with product names and prices
- List items with pricing
- Product codes with descriptions and prices
- Any item that has a name and price/cost

SUPPLIER INFORMATION:
- Company name, address, phone, email, contact person
- Any business details visible on the page

Return ONLY JSON format:
{
  "supplier": {
    "name": "Company Name",
    "address": "Full address if visible", 
    "phone": "Phone number",
    "email": "Email if visible",
    "contact_person": "Contact name if visible"
  },
  "products": [
    {
      "name": "Complete Product Name",
      "price": 123.45,
      "currency": "IDR",
      "unit": "kg",
      "description": "Any additional details",
      "product_code": "Code if visible"
    }
  ],
  "page_info": {
    "has_price_list": true,
    "total_items_found": 25,
    "confidence": 0.9
  }
}

IMPORTANT: Extract EVERY product visible - do not skip any items with prices."""

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.openai_api_key}"
        }
        
        payload = {
            "model": "gpt-o3",
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{image_base64}",
                            "detail": "high"  # Use high detail for maximum extraction
                        }
                    }
                ]
            }],
            "max_tokens": 3000,  # Increased for large product lists
            "temperature": 0.1
        }
        
        try:
            start_time = time.time()
            print(f"[INFO] 🤖 Sending page {page_num} to OpenAI Vision API (HIGH detail)...")
            
            async with session.post(self.api_url, headers=headers, json=payload, timeout=aiohttp.ClientTimeout(total=120)) as response:
                api_time = time.time() - start_time
                
                if response.status == 200:
                    result = await response.json()
                    content = result['choices'][0]['message']['content']
                    usage = result.get('usage', {})
                    
                    # Extract JSON from response
                    try:
                        start_idx = content.find('{')
                        end_idx = content.rfind('}') + 1
                        if start_idx != -1 and end_idx != -1:
                            json_str = content[start_idx:end_idx]
                            extracted_data = json.loads(json_str)
                            
                            products_count = len(extracted_data.get('products', []))
                            total_items = extracted_data.get('page_info', {}).get('total_items_found', products_count)
                            
                            print(f"[INFO] ✅ Page {page_num}: Found {products_count} products (claimed {total_items}) in {api_time:.2f}s")
                            print(f"[INFO] 🎯 Tokens: {usage.get('total_tokens', 0):,}")
                            
                            extracted_data['_metadata'] = {
                                'page_number': page_num,
                                'tokens_used': usage.get('total_tokens', 0),
                                'api_time_s': api_time
                            }
                            
                            return extracted_data
                        else:
                            print(f"[ERROR] No JSON found in API response for page {page_num}")
                    except json.JSONDecodeError as e:
                        print(f"[ERROR] Failed to parse JSON for page {page_num}: {e}")
                        print(f"[DEBUG] Content preview: {content[:200]}...")
                else:
                    error_text = await response.text()
                    print(f"[ERROR] API error for page {page_num}: {response.status} - {error_text[:200]}")
                    
        except Exception as e:
            print(f"[ERROR] Exception for page {page_num}: {e}")
        
        return {"supplier": {}, "products": [], "page_info": {"has_price_list": False}}

async def test_enhanced_extraction():
    print("🥚 Enhanced Eggstra PDF Analysis")
    print("📋 Goal: Extract ALL 200+ products with improved settings")
    
    # Load environment
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
    
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("❌ No API key found")
        return
    
    pdf_url = "https://cdc1w79ssc4kg6xh.public.blob.vercel-storage.com/PRICE%20QUOTATATION%20FOR%20EGGSTRA%20CAFE-jxtc940Um2B5E8YPygH1qi5bAx2sHQ.pdf"
    
    print(f"📄 PDF URL: {pdf_url[:60]}...")
    print("🔧 Enhanced settings:")
    print("   • Process ALL pages (no limit)")
    print("   • Higher DPI: 150 (was 100)")
    print("   • Higher resolution: 768px (was 480px)")
    print("   • PNG format (was JPEG)")
    print("   • High detail mode (was low)")
    print("   • Increased token limit: 3000 (was 1500)")
    
    total_start = time.time()
    extractor = EnhancedEggstraExtractor(api_key)
    
    # Download PDF
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(pdf_url, timeout=aiohttp.ClientTimeout(total=60)) as response:
                if response.status != 200:
                    print(f"❌ Failed to download PDF: HTTP {response.status}")
                    return
                pdf_content = await response.read()
    except Exception as e:
        print(f"❌ Download error: {e}")
        return
    
    # Save to temporary file
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
        tmp_file.write(pdf_content)
        pdf_path = tmp_file.name
    
    try:
        # Convert PDF to images
        images = extractor.pdf_to_images(pdf_path, dpi=150)
        if not images:
            print("❌ Failed to convert PDF to images")
            return
        
        print(f"\n🚀 Processing {len(images)} pages with enhanced AI extraction...")
        
        # Process pages in smaller batches to avoid rate limits
        batch_size = 3
        all_results = []
        
        async with aiohttp.ClientSession() as session:
            for i in range(0, len(images), batch_size):
                batch = images[i:i+batch_size]
                print(f"\n📦 Processing batch {i//batch_size + 1} (pages {i+1}-{min(i+batch_size, len(images))})")
                
                tasks = [
                    extractor.extract_data_from_image(session, image_base64, i + j + 1)
                    for j, image_base64 in enumerate(batch)
                ]
                
                batch_results = await asyncio.gather(*tasks, return_exceptions=True)
                all_results.extend([r for r in batch_results if not isinstance(r, Exception)])
                
                # Small delay between batches
                if i + batch_size < len(images):
                    print("⏳ Waiting 5 seconds between batches...")
                    await asyncio.sleep(5)
        
        # Combine results
        total_products = 0
        all_products = []
        supplier_info = {}
        
        print(f"\n📊 Processing Results from {len(all_results)} pages:")
        for i, result in enumerate(all_results):
            page_products = len(result.get('products', []))
            total_products += page_products
            all_products.extend(result.get('products', []))
            
            if not supplier_info and result.get('supplier'):
                supplier_info = result['supplier']
            
            print(f"   Page {result.get('_metadata', {}).get('page_number', i+1)}: {page_products} products")
        
        total_time = time.time() - total_start
        
        print(f"\n🎉 Enhanced Extraction Complete!")
        print(f"📄 Pages processed: {len(all_results)}")
        print(f"🛍️ Total products found: {total_products}")
        print(f"⏱️ Total time: {total_time:.1f}s")
        print(f"📈 Products per page: {total_products/len(all_results):.1f}")
        
        if supplier_info:
            print(f"\n🏢 Supplier Information:")
            for key, value in supplier_info.items():
                if value:
                    print(f"   {key.title()}: {value}")
        
        print(f"\n📋 Sample products (first 10):")
        for i, product in enumerate(all_products[:10]):
            name = product.get('name', 'Unknown')
            price = product.get('price', 0)
            currency = product.get('currency', '')
            unit = product.get('unit', '')
            print(f"   {i+1}. \"{name}\" - {price} {currency} ({unit})")
        
        if total_products >= 200:
            print(f"\n✅ SUCCESS: Found {total_products} products (target: 200+)")
        else:
            print(f"\n⚠️ PARTIAL: Found {total_products} products (target: 200+)")
            print(f"   Consider processing more pages or adjusting extraction settings")
        
    finally:
        try:
            os.unlink(pdf_path)
        except:
            pass

if __name__ == "__main__":
    asyncio.run(test_enhanced_extraction())