#!/usr/bin/env python3
"""
Async PDF to Image AI Extractor
Processes multiple pages concurrently while respecting OpenAI rate limits
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
    """OpenAI API rate limits for GPT-4o"""
    requests_per_minute: int = 500  # TPM-based limit is usually higher
    tokens_per_minute: int = 30000  # Conservative estimate
    concurrent_requests: int = 10   # Max concurrent requests
    
class AsyncPDFImageExtractor:
    def __init__(self, openai_api_key: str):
        self.openai_api_key = openai_api_key
        self.api_url = "https://api.openai.com/v1/chat/completions"
        self.rate_limit = RateLimitConfig()
        
        # Rate limiting state
        self.request_times = []
        self.token_usage = []
        self.semaphore = asyncio.Semaphore(self.rate_limit.concurrent_requests)
    
    def pdf_to_images(self, pdf_path: str, dpi: int = 100) -> List[str]:
        """Convert PDF pages to base64-encoded images"""
        try:
            print(f"[INFO] 🔍 Opening PDF: {pdf_path}")
            doc = fitz.open(pdf_path)
            total_pages = len(doc)
            print(f"[INFO] 📄 Found {total_pages} pages in PDF")
            
            # Process all pages (remove artificial limit for async processing)
            max_pages = min(total_pages, 8)  # Still cap at 8 for cost control
            if total_pages > max_pages:
                print(f"[WARNING] ⚠️ Limiting to first {max_pages} pages (PDF has {total_pages} pages)")
            
            images = []
            
            for page_num in range(max_pages):
                try:
                    print(f"[INFO] 🔄 Processing page {page_num + 1}/{max_pages}")
                    page = doc.load_page(page_num)
                    
                    # Convert page to image with optimized settings
                    mat = fitz.Matrix(dpi/72, dpi/72)
                    pix = page.get_pixmap(matrix=mat)
                    
                    # Convert to PIL Image
                    img_data = pix.tobytes("png")
                    img = Image.open(BytesIO(img_data))
                    
                    # Optimize image size (smaller for faster processing)
                    max_width = 480  # Reduced from 512 for speed
                    if img.width > max_width:
                        ratio = max_width / img.width
                        new_height = int(img.height * ratio)
                        img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
                    
                    # Use JPEG for smaller file size
                    buffer = BytesIO()
                    img_rgb = img.convert('RGB')
                    img_rgb.save(buffer, format="JPEG", quality=75, optimize=True)
                    img_base64 = base64.b64encode(buffer.getvalue()).decode()
                    
                    images.append(img_base64)
                    print(f"[INFO] ✅ Page {page_num + 1}: {len(img_base64)} chars (JPEG)")
                    
                except Exception as page_error:
                    print(f"[ERROR] Failed to process page {page_num + 1}: {page_error}", file=sys.stderr)
                    continue
            
            doc.close()
            print(f"[INFO] 🎉 Successfully converted {len(images)} pages to images")
            return images
            
        except Exception as e:
            print(f"[ERROR] Failed to convert PDF to images: {e}", file=sys.stderr)
            return []
    
    async def check_rate_limits(self, estimated_tokens: int) -> bool:
        """Check if we can make a request without exceeding rate limits"""
        current_time = time.time()
        
        # Clean old request times (older than 1 minute)
        self.request_times = [t for t in self.request_times if current_time - t < 60]
        self.token_usage = [
            (t, tokens) for t, tokens in self.token_usage 
            if current_time - t < 60
        ]
        
        # Check request rate limit
        if len(self.request_times) >= self.rate_limit.requests_per_minute:
            return False
        
        # Check token rate limit
        total_tokens_in_minute = sum(tokens for _, tokens in self.token_usage)
        if total_tokens_in_minute + estimated_tokens > self.rate_limit.tokens_per_minute:
            return False
        
        return True
    
    async def wait_for_rate_limit(self, estimated_tokens: int):
        """Wait until we can make a request without exceeding rate limits"""
        while not await self.check_rate_limits(estimated_tokens):
            print(f"[INFO] ⏳ Rate limit reached, waiting 1 second...")
            await asyncio.sleep(1)
    
    async def extract_data_from_image(self, session: aiohttp.ClientSession, image_base64: str, page_num: int) -> Dict[str, Any]:
        """Extract supplier and product data from image using OpenAI Vision API"""
        
        # Optimized prompt with focus on supplier contact details
        prompt = """Extract products, prices, and supplier contact information from this price list image.

SUPPLIER EXTRACTION:
- Look for company/business name anywhere on the page
- Find phone numbers (format: +62, 0xxx, etc.)
- Find email addresses (format: xxx@xxx.com)
- Find physical addresses or location info

PRODUCT EXTRACTION:
- Extract ALL products with prices visible
- Use EXACT currency from document (IDR, USD, etc.)
- Include unit measurements (ml, kg, pcs, etc.)

Return ONLY JSON format:
{
  "supplier": {
    "name": "Company Name from image",
    "address": "Full address if visible",
    "phone": "Phone number with country code",
    "email": "Email address if visible"
  },
  "products": [
    {"name": "Product Name", "price": 104000, "currency": "IDR", "unit": "ml", "category": "dairy"}
  ],
  "page_info": {"has_price_list": true, "confidence": 0.9}
}

Extract ALL visible contact details and products."""

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.openai_api_key}"
        }
        
        payload = {
            "model": "gpt-4o",
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_base64}",
                            "detail": "low"
                        }
                    }
                ]
            }],
            "max_tokens": 1500,  # Reduced for faster processing
            "temperature": 0.1
        }
        
        # Estimate tokens (rough calculation)
        estimated_tokens = len(prompt) // 4 + 765  # ~765 tokens per image in low detail
        
        # Wait for rate limits
        await self.wait_for_rate_limit(estimated_tokens)
        
        # Use semaphore to limit concurrent requests
        async with self.semaphore:
            try:
                start_time = time.time()
                print(f"[INFO] 🤖 Sending page {page_num} to OpenAI Vision API...")
                
                # Record request time
                self.request_times.append(time.time())
                
                async with session.post(self.api_url, headers=headers, json=payload, timeout=aiohttp.ClientTimeout(total=60)) as response:
                    api_time = time.time() - start_time
                    
                    if response.status == 200:
                        result = await response.json()
                        content = result['choices'][0]['message']['content']
                        
                        # Record token usage
                        usage = result.get('usage', {})
                        tokens_used = usage.get('total_tokens', estimated_tokens)
                        self.token_usage.append((time.time(), tokens_used))
                        
                        # Extract JSON from response
                        try:
                            start_idx = content.find('{')
                            end_idx = content.rfind('}') + 1
                            if start_idx != -1 and end_idx != -1:
                                json_str = content[start_idx:end_idx]
                                extracted_data = json.loads(json_str)
                                
                                # Add metadata
                                extracted_data['_metadata'] = {
                                    'page_number': page_num,
                                    'tokens_used': tokens_used,
                                    'cost_usd': self.calculate_cost(usage),
                                    'api_time_s': api_time
                                }
                                
                                products_count = len(extracted_data.get('products', []))
                                print(f"[INFO] ✅ Page {page_num}: Extracted {products_count} products in {api_time:.2f}s")
                                
                                return extracted_data
                            else:
                                print(f"[ERROR] No JSON found in API response for page {page_num}")
                                return self.empty_result(page_num, api_time)
                                
                        except json.JSONDecodeError as e:
                            print(f"[ERROR] Failed to parse JSON from API response for page {page_num}: {e}")
                            return self.empty_result(page_num, api_time)
                    else:
                        error_text = await response.text()
                        print(f"[ERROR] OpenAI API error for page {page_num}: {response.status} - {error_text}")
                        return self.empty_result(page_num, api_time)
                        
            except asyncio.TimeoutError:
                api_time = time.time() - start_time
                print(f"[ERROR] Timeout for page {page_num} after {api_time:.2f}s")
                return self.empty_result(page_num, api_time)
                
            except Exception as e:
                api_time = time.time() - start_time
                print(f"[ERROR] Exception during API call for page {page_num}: {e}")
                return self.empty_result(page_num, api_time)
    
    def calculate_cost(self, usage: Dict) -> float:
        """Calculate cost based on GPT-4o pricing"""
        input_tokens = usage.get('prompt_tokens', 0)
        output_tokens = usage.get('completion_tokens', 0)
        
        # GPT-4o pricing (as of 2024)
        input_cost = (input_tokens / 1000) * 0.005  # $0.005 per 1K input tokens
        output_cost = (output_tokens / 1000) * 0.015  # $0.015 per 1K output tokens
        
        return input_cost + output_cost
    
    def empty_result(self, page_num: int, api_time: float = 0) -> Dict[str, Any]:
        """Return empty result structure"""
        return {
            "supplier": {},
            "products": [],
            "page_info": {
                "has_price_list": False,
                "confidence": 0.0
            },
            "_metadata": {
                "page_number": page_num,
                "tokens_used": 0,
                "cost_usd": 0.0,
                "api_time_s": api_time
            }
        }
    
    async def process_pdf(self, pdf_url: str) -> Dict[str, Any]:
        """Main processing function with async support"""
        print(f"[INFO] 🖼️ Starting ASYNC PDF-to-Image AI extraction for: {pdf_url}")
        total_start = time.time()
        
        # Download PDF
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(pdf_url, timeout=aiohttp.ClientTimeout(total=30)) as response:
                    if response.status != 200:
                        return {"error": f"Failed to download PDF: HTTP {response.status}"}
                    pdf_content = await response.read()
        except Exception as e:
            print(f"[ERROR] Failed to download PDF: {e}")
            return {"error": f"Failed to download PDF: {e}"}
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
            tmp_file.write(pdf_content)
            pdf_path = tmp_file.name
        
        try:
            # Convert PDF to images
            images = self.pdf_to_images(pdf_path)
            if not images:
                return {"error": "Failed to convert PDF to images"}
            
            # Process all pages concurrently
            print(f"[INFO] 🚀 Processing {len(images)} pages concurrently...")
            async with aiohttp.ClientSession() as session:
                tasks = [
                    self.extract_data_from_image(session, image_base64, i + 1)
                    for i, image_base64 in enumerate(images)
                ]
                
                # Execute all tasks concurrently
                processing_start = time.time()
                all_results = await asyncio.gather(*tasks, return_exceptions=True)
                processing_time = time.time() - processing_start
                
                print(f"[INFO] ⚡ Concurrent processing completed in {processing_time:.2f}s")
            
            # Filter out exceptions and combine results
            valid_results = [
                result for result in all_results 
                if not isinstance(result, Exception)
            ]
            
            if not valid_results:
                return {"error": "No valid results from API calls"}
            
            # Combine results
            combined_supplier = {}
            combined_products = []
            total_cost = 0.0
            total_tokens = 0
            total_api_time = 0.0
            
            for result in valid_results:
                # Merge supplier info (combine all non-empty fields from all pages)
                if result.get('supplier'):
                    supplier_info = result['supplier']
                    
                    # Initialize combined_supplier if empty
                    if not combined_supplier:
                        combined_supplier = {
                            'name': '',
                            'address': '',
                            'phone': '',
                            'email': ''
                        }
                    
                    # Merge fields, preferring non-empty values
                    for field in ['name', 'address', 'phone', 'email']:
                        current_value = combined_supplier.get(field, '')
                        new_value = supplier_info.get(field, '')
                        
                        # Use new value if current is empty, or if new value is longer/better
                        if not current_value and new_value:
                            combined_supplier[field] = new_value
                        elif new_value and len(new_value) > len(current_value):
                            combined_supplier[field] = new_value
                
                # Combine all products
                if result.get('products'):
                    for product in result['products']:
                        product['source_page'] = result.get('_metadata', {}).get('page_number', 0)
                        combined_products.append(product)
                
                # Sum up costs and metrics
                if '_metadata' in result:
                    total_cost += result['_metadata']['cost_usd']
                    total_tokens += result['_metadata']['tokens_used']
                    total_api_time += result['_metadata']['api_time_s']
            
            # Deduplicate products by name
            unique_products = []
            seen_names = set()
            for product in combined_products:
                product_key = product.get('name', '').lower().strip()
                if product_key and product_key not in seen_names:
                    seen_names.add(product_key)
                    unique_products.append(product)
            
            total_time = time.time() - total_start
            
            print(f"[INFO] 📊 ASYNC AI extraction completed:")
            print(f"[INFO] 📄 Pages processed: {len(valid_results)}")
            print(f"[INFO] 🛍️ Products extracted: {len(unique_products)}")
            print(f"[INFO] 💰 Total cost: ${total_cost:.4f}")
            print(f"[INFO] 🎯 Total tokens: {total_tokens}")
            print(f"[INFO] ⚡ Total time: {total_time:.2f}s")
            print(f"[INFO] 🏃‍♂️ API time: {total_api_time:.2f}s")
            print(f"[INFO] 🎯 Speedup: {total_api_time/processing_time:.1f}x faster than sequential")
            
            return {
                "supplier": combined_supplier,
                "products": unique_products,
                "metrics": {
                    "pages_processed": len(valid_results),
                    "total_products": len(unique_products),
                    "tokens_used": total_tokens,
                    "cost_usd": total_cost,
                    "total_time_s": total_time,
                    "api_time_s": total_api_time,
                    "processing_time_s": processing_time,
                    "speedup_factor": total_api_time / processing_time if processing_time > 0 else 1
                },
                "page_results": valid_results
            }
            
        finally:
            # Clean up temporary file
            try:
                os.unlink(pdf_path)
            except:
                pass

async def main():
    print("[INFO] 🚀 Async AI Vision extractor starting...")
    print(f"[INFO] 📋 Arguments: {len(sys.argv)} provided")
    
    if len(sys.argv) != 3:
        print("Usage: python3 async_pdf_image_extractor.py <pdf_url> <openai_api_key>")
        sys.exit(1)
    
    pdf_url = sys.argv[1]
    api_key = sys.argv[2]
    
    print(f"[INFO] 🔗 PDF URL: {pdf_url[:50]}...")
    print(f"[INFO] 🔑 API Key: {'*' * 10}... (configured)")
    
    print("[INFO] 🏗️ Creating async extractor instance...")
    extractor = AsyncPDFImageExtractor(api_key)
    
    print("[INFO] 🚀 Starting async PDF processing...")
    result = await extractor.process_pdf(pdf_url)
    
    print("[INFO] ✅ Processing completed, outputting JSON...")
    # Output JSON result
    print("=== AI_EXTRACTION_JSON_START ===")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print("=== AI_EXTRACTION_JSON_END ===")
    print("[INFO] 🎉 Async AI Vision extractor finished successfully!")

if __name__ == "__main__":
    asyncio.run(main())