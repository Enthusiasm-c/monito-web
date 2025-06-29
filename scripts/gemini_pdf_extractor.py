#!/usr/bin/env python3
"""
Gemini Flash 2.0 PDF to Image AI Extractor
Processes PDF pages using Google Gemini Flash 2.0 Vision API
"""

import sys
import json
import asyncio
import aiohttp
import base64
import tempfile
import os
import time
from io import BytesIO
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

# Try to import required libraries
try:
    import fitz  # PyMuPDF
except ImportError:
    print("ERROR: PyMuPDF not installed. Install with: pip install PyMuPDF", file=sys.stderr)
    sys.exit(1)

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow not installed. Install with: pip install Pillow", file=sys.stderr)
    sys.exit(1)

@dataclass
class RateLimitConfig:
    """Gemini API rate limits"""
    requests_per_minute: int = 1000
    concurrent_requests: int = 15
    
class GeminiPDFImageExtractor:
    def __init__(self, google_api_key: str):
        self.google_api_key = google_api_key
        self.api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={google_api_key}"
        self.rate_limit = RateLimitConfig()
        
        # Rate limiting state
        self.request_times = []
        self.semaphore = asyncio.Semaphore(self.rate_limit.concurrent_requests)
    
    def pdf_to_images(self, pdf_path: str, dpi: int = 150) -> List[str]:
        """Convert PDF pages to base64 encoded images"""
        try:
            doc = fitz.open(pdf_path)
            images = []
            
            max_pages = int(os.getenv('AI_VISION_MAX_PAGES', '8'))
            
            for page_num in range(min(len(doc), max_pages)):
                page = doc[page_num]
                
                # Render page to image
                mat = fitz.Matrix(dpi/72, dpi/72)
                pix = page.get_pixmap(matrix=mat)
                
                # Convert to PIL Image
                img_data = pix.tobytes("png")
                img = Image.open(BytesIO(img_data))
                
                # Optimize image size for API
                if img.width > 1024 or img.height > 1024:
                    img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
                
                # Convert to base64
                buffer = BytesIO()
                img.save(buffer, format='PNG', optimize=True)
                img_base64 = base64.b64encode(buffer.getvalue()).decode()
                
                images.append(img_base64)
                print(f"📄 Processed page {page_num + 1}/{min(len(doc), max_pages)}")
            
            doc.close()
            return images
            
        except Exception as e:
            print(f"❌ Error converting PDF to images: {e}", file=sys.stderr)
            return []
    
    async def analyze_image(self, session: aiohttp.ClientSession, image_base64: str, page_num: int) -> Dict[str, Any]:
        """Analyze single image with Gemini Flash 2.0"""
        async with self.semaphore:
            await self.rate_limit_check()
            
            prompt = """Analyze this image and extract all product information in JSON format. Look for:
1. Product names
2. Prices (numbers with currency symbols)
3. Units of measurement (kg, gram, liter, piece, etc.)
4. Any supplier information

Return ONLY a JSON object with this structure:
{
  "products": [
    {
      "name": "product name",
      "price": numeric_value,
      "unit": "unit_of_measurement"
    }
  ],
  "supplier": {
    "name": "supplier name if found",
    "email": "email if found",
    "phone": "phone if found"
  }
}

Extract ALL products you can see, even if some information is missing. Be thorough."""

            payload = {
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": "image/png",
                                "data": image_base64
                            }
                        }
                    ]
                }],
                "generationConfig": {
                    "temperature": 0.1,
                    "topK": 1,
                    "topP": 1,
                    "maxOutputTokens": 2048
                }
            }
            
            try:
                async with session.post(self.api_url, json=payload) as response:
                    if response.status == 200:
                        result = await response.json()
                        
                        if 'candidates' in result and len(result['candidates']) > 0:
                            content = result['candidates'][0]['content']['parts'][0]['text']
                            
                            # Extract JSON from response
                            try:
                                # Find JSON in the response
                                start = content.find('{')
                                end = content.rfind('}') + 1
                                if start != -1 and end != -1:
                                    json_str = content[start:end]
                                    data = json.loads(json_str)
                                    
                                    # Add page information
                                    for product in data.get('products', []):
                                        product['sourcePage'] = page_num + 1
                                        product['sourceMethod'] = 'gemini_vision'
                                    
                                    return {
                                        'success': True,
                                        'data': data,
                                        'tokensUsed': result.get('usageMetadata', {}).get('totalTokenCount', 0),
                                        'page': page_num + 1
                                    }
                                else:
                                    print(f"⚠️ No JSON found in Gemini response for page {page_num + 1}")
                                    return {'success': False, 'error': 'No JSON in response', 'page': page_num + 1}
                                    
                            except json.JSONDecodeError as e:
                                print(f"⚠️ JSON parse error for page {page_num + 1}: {e}")
                                return {'success': False, 'error': f'JSON parse error: {e}', 'page': page_num + 1}
                        else:
                            print(f"⚠️ No candidates in Gemini response for page {page_num + 1}")
                            return {'success': False, 'error': 'No candidates in response', 'page': page_num + 1}
                    else:
                        error_text = await response.text()
                        print(f"❌ Gemini API error for page {page_num + 1}: {response.status} - {error_text}")
                        return {'success': False, 'error': f'API error: {response.status}', 'page': page_num + 1}
                        
            except Exception as e:
                print(f"❌ Request error for page {page_num + 1}: {e}")
                return {'success': False, 'error': str(e), 'page': page_num + 1}
    
    async def rate_limit_check(self):
        """Simple rate limiting"""
        now = time.time()
        self.request_times = [t for t in self.request_times if now - t < 60]
        
        if len(self.request_times) >= self.rate_limit.requests_per_minute:
            sleep_time = 60 - (now - self.request_times[0])
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)
        
        self.request_times.append(now)
    
    async def process_pdf(self, pdf_url: str) -> Dict[str, Any]:
        """Main processing function"""
        print(f"🚀 Starting Gemini Flash 2.0 processing: {pdf_url}")
        start_time = time.time()
        
        # Download PDF
        async with aiohttp.ClientSession() as session:
            async with session.get(pdf_url) as response:
                if response.status != 200:
                    return {
                        'success': False,
                        'error': f'Failed to download PDF: {response.status}',
                        'products': [],
                        'processingTimeMs': 0
                    }
                
                pdf_data = await response.read()
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
            tmp_file.write(pdf_data)
            pdf_path = tmp_file.name
        
        try:
            # Convert to images
            images = self.pdf_to_images(pdf_path)
            if not images:
                return {
                    'success': False,
                    'error': 'Failed to convert PDF to images',
                    'products': [],
                    'processingTimeMs': int((time.time() - start_time) * 1000)
                }
            
            print(f"📊 Processing {len(images)} pages with Gemini Flash 2.0...")
            
            # Process images in parallel
            async with aiohttp.ClientSession() as session:
                tasks = [
                    self.analyze_image(session, img, i) 
                    for i, img in enumerate(images)
                ]
                
                results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Combine results
            all_products = []
            total_tokens = 0
            supplier_info = None
            errors = []
            successful_pages = 0
            
            for result in results:
                if isinstance(result, Exception):
                    errors.append(f"Processing error: {result}")
                    continue
                
                if result.get('success'):
                    successful_pages += 1
                    data = result.get('data', {})
                    
                    # Collect products
                    products = data.get('products', [])
                    all_products.extend(products)
                    
                    # Get supplier info from first successful page
                    if not supplier_info and data.get('supplier'):
                        supplier_info = data['supplier']
                    
                    # Track tokens
                    total_tokens += result.get('tokensUsed', 0)
                else:
                    errors.append(f"Page {result.get('page', '?')}: {result.get('error', 'Unknown error')}")
            
            processing_time = int((time.time() - start_time) * 1000)
            
            # Calculate cost (Gemini Flash 2.0 pricing)
            cost_per_1k_tokens = 0.000075  # $0.075 per 1M tokens
            cost_usd = (total_tokens / 1000) * cost_per_1k_tokens
            
            print(f"✅ Gemini processing completed: {len(all_products)} products from {successful_pages}/{len(images)} pages")
            print(f"💰 Cost: ${cost_usd:.6f} ({total_tokens} tokens)")
            
            return {
                'success': True,
                'products': all_products,
                'supplier': supplier_info,
                'pagesProcessed': len(images),
                'successfulPages': successful_pages,
                'tokensUsed': total_tokens,
                'costUsd': cost_usd,
                'processingTimeMs': processing_time,
                'errors': errors
            }
            
        finally:
            # Clean up temp file
            try:
                os.unlink(pdf_path)
            except:
                pass

async def main():
    if len(sys.argv) != 3:
        print("Usage: python3 gemini_pdf_extractor.py <pdf_url> <google_api_key>")
        sys.exit(1)
    
    pdf_url = sys.argv[1]
    google_api_key = sys.argv[2]
    
    if not google_api_key:
        print("Error: Google API key is required")
        sys.exit(1)
    
    extractor = GeminiPDFImageExtractor(google_api_key)
    result = await extractor.process_pdf(pdf_url)
    
    # Output JSON result
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())