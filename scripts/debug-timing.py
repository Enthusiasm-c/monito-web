#!/usr/bin/env python3
"""
Debug timing issues in AI Vision processing
Measure each step to find bottlenecks
"""

import sys
import os
import time
import requests
import base64
import tempfile
import json
from io import BytesIO
from pathlib import Path

try:
    import fitz  # PyMuPDF
    from PIL import Image
    from dotenv import load_dotenv
except ImportError as e:
    print(f"ERROR: Missing dependency: {e}")
    sys.exit(1)

def debug_timing():
    print("🕐 Debugging AI Vision processing timing...")
    
    # Load environment
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
    
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("❌ OPENAI_API_KEY not found")
        return
    
    # Test with milk up PDF
    pdf_url = "https://cdc1w79ssc4kg6xh.public.blob.vercel-storage.com/milk%20up-RB2AKmAEQe0cBDWBdHPI8yULfxjE1C.pdf"
    
    total_start = time.time()
    
    # Step 1: Download PDF
    step_start = time.time()
    print(f"🔄 Step 1: Downloading PDF...")
    try:
        response = requests.get(pdf_url, timeout=30)
        response.raise_for_status()
        pdf_size = len(response.content)
    except Exception as e:
        print(f"❌ Download failed: {e}")
        return
    step_time = time.time() - step_start
    print(f"✅ Step 1 completed in {step_time:.2f}s - Downloaded {pdf_size:,} bytes")
    
    # Step 2: Save to temp file
    step_start = time.time()
    print(f"🔄 Step 2: Saving to temp file...")
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
        tmp_file.write(response.content)
        pdf_path = tmp_file.name
    step_time = time.time() - step_start
    print(f"✅ Step 2 completed in {step_time:.2f}s")
    
    try:
        # Step 3: Open PDF with PyMuPDF
        step_start = time.time()
        print(f"🔄 Step 3: Opening PDF with PyMuPDF...")
        doc = fitz.open(pdf_path)
        total_pages = len(doc)
        step_time = time.time() - step_start
        print(f"✅ Step 3 completed in {step_time:.2f}s - Found {total_pages} pages")
        
        # Step 4: Process first page only for timing
        page_num = 0
        step_start = time.time()
        print(f"🔄 Step 4: Loading page {page_num + 1}...")
        page = doc.load_page(page_num)
        step_time = time.time() - step_start
        print(f"✅ Step 4 completed in {step_time:.2f}s")
        
        # Step 5: Convert to pixmap
        step_start = time.time()
        print(f"🔄 Step 5: Converting to pixmap (DPI=100)...")
        dpi = 100
        mat = fitz.Matrix(dpi/72, dpi/72)
        pix = page.get_pixmap(matrix=mat)
        step_time = time.time() - step_start
        print(f"✅ Step 5 completed in {step_time:.2f}s - Size: {pix.width}x{pix.height}")
        
        # Step 6: Convert to PIL Image
        step_start = time.time()
        print(f"🔄 Step 6: Converting to PIL Image...")
        img_data = pix.tobytes("png")
        img = Image.open(BytesIO(img_data))
        step_time = time.time() - step_start
        original_size = len(img_data)
        print(f"✅ Step 6 completed in {step_time:.2f}s - Original PNG: {original_size:,} bytes")
        
        # Step 7: Resize image
        step_start = time.time()
        print(f"🔄 Step 7: Resizing image to max 512px...")
        if img.width > 512:
            ratio = 512 / img.width
            new_height = int(img.height * ratio)
            img = img.resize((512, new_height), Image.Resampling.LANCZOS)
        step_time = time.time() - step_start
        print(f"✅ Step 7 completed in {step_time:.2f}s - New size: {img.width}x{img.height}")
        
        # Step 8: Convert to optimized PNG
        step_start = time.time()
        print(f"🔄 Step 8: Converting to optimized PNG...")
        buffer = BytesIO()
        img.save(buffer, format="PNG", optimize=True)
        png_data = buffer.getvalue()
        step_time = time.time() - step_start
        print(f"✅ Step 8 completed in {step_time:.2f}s - Optimized PNG: {len(png_data):,} bytes")
        
        # Step 9: Base64 encoding
        step_start = time.time()
        print(f"🔄 Step 9: Base64 encoding...")
        img_base64 = base64.b64encode(png_data).decode()
        step_time = time.time() - step_start
        print(f"✅ Step 9 completed in {step_time:.2f}s - Base64: {len(img_base64):,} chars")
        
        # Step 10: Prepare API payload
        step_start = time.time()
        print(f"🔄 Step 10: Preparing OpenAI API payload...")
        
        prompt = """Extract ALL products with pricing from this supplier price list image.
        
Return ONLY a JSON object with this structure:
{
  "supplier": {"name": "Company Name", "address": "", "phone": "", "email": ""},
  "products": [
    {"name": "Product Name", "price": 123.45, "currency": "IDR", "unit": "ml", "category": "dairy", "description": ""}
  ],
  "page_info": {"has_price_list": true, "layout_type": "table", "confidence": 0.9}
}

Extract the EXACT currency from the document. Look for all products even in complex layouts."""
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
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
                            "url": f"data:image/png;base64,{img_base64}",
                            "detail": "low"
                        }
                    }
                ]
            }],
            "max_tokens": 2000,
            "temperature": 0.1
        }
        
        payload_size = len(json.dumps(payload))
        step_time = time.time() - step_start
        print(f"✅ Step 10 completed in {step_time:.2f}s - Payload: {payload_size:,} bytes")
        
        # Step 11: Send to OpenAI API
        step_start = time.time()
        print(f"🔄 Step 11: Sending to OpenAI Vision API...")
        print(f"   🌐 API URL: https://api.openai.com/v1/chat/completions")
        print(f"   🎯 Model: gpt-4o")
        print(f"   📏 Detail: low")
        print(f"   ⏱️ Timeout: 90s")
        
        try:
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=90
            )
            step_time = time.time() - step_start
            
            if response.status_code == 200:
                result = response.json()
                usage = result.get('usage', {})
                content_length = len(result['choices'][0]['message']['content'])
                
                print(f"✅ Step 11 completed in {step_time:.2f}s")
                print(f"   📊 Response: {response.status_code}")
                print(f"   🎯 Input tokens: {usage.get('prompt_tokens', 0):,}")
                print(f"   🎯 Output tokens: {usage.get('completion_tokens', 0):,}")
                print(f"   🎯 Total tokens: {usage.get('total_tokens', 0):,}")
                print(f"   📝 Response length: {content_length:,} chars")
                
                # Parse response time breakdown
                response_headers = dict(response.headers)
                if 'x-ratelimit-remaining-requests' in response_headers:
                    print(f"   🚦 Rate limit remaining: {response_headers['x-ratelimit-remaining-requests']}")
                if 'x-ratelimit-remaining-tokens' in response_headers:
                    print(f"   🚦 Token limit remaining: {response_headers['x-ratelimit-remaining-tokens']}")
                    
                # Try to parse JSON response
                try:
                    content = result['choices'][0]['message']['content']
                    start_idx = content.find('{')
                    end_idx = content.rfind('}') + 1
                    if start_idx != -1 and end_idx != -1:
                        json_str = content[start_idx:end_idx]
                        extracted_data = json.loads(json_str)
                        products_count = len(extracted_data.get('products', []))
                        print(f"   🛍️ Products extracted: {products_count}")
                    else:
                        print(f"   ⚠️ No JSON found in response")
                except json.JSONDecodeError as e:
                    print(f"   ❌ JSON parse error: {e}")
                
            else:
                print(f"❌ Step 11 failed in {step_time:.2f}s")
                print(f"   📊 Response: {response.status_code}")
                print(f"   ❌ Error: {response.text[:200]}...")
                
        except requests.exceptions.Timeout:
            step_time = time.time() - step_start
            print(f"⏰ Step 11 TIMEOUT after {step_time:.2f}s")
            
        except Exception as e:
            step_time = time.time() - step_start
            print(f"❌ Step 11 error after {step_time:.2f}s: {e}")
        
        doc.close()
        
    finally:
        try:
            os.unlink(pdf_path)
        except:
            pass
    
    total_time = time.time() - total_start
    print(f"\n🏁 Total processing time: {total_time:.2f}s")
    
    # Analysis
    print(f"\n📊 Timing Analysis:")
    print(f"🔍 Image processing (steps 1-10): Usually < 5s")
    print(f"🤖 OpenAI API call (step 11): Main bottleneck")
    print(f"📈 Expected API time: 10-60s per image")
    print(f"💡 Optimization suggestions:")
    print(f"   • Use smaller images (current: 512px width)")
    print(f"   • Use JPEG instead of PNG (4x smaller)")
    print(f"   • Reduce prompt length")
    print(f"   • Process fewer pages simultaneously")

if __name__ == "__main__":
    debug_timing()