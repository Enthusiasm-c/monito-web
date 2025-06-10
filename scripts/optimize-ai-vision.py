#!/usr/bin/env python3
"""
Test different optimization strategies for AI Vision
Compare JPEG vs PNG, different sizes, shorter prompts
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

def test_optimization_strategies():
    print("🚀 Testing AI Vision optimization strategies...")
    
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
    
    # Download and prepare PDF
    response = requests.get(pdf_url, timeout=30)
    response.raise_for_status()
    
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
        tmp_file.write(response.content)
        pdf_path = tmp_file.name
    
    try:
        doc = fitz.open(pdf_path)
        page = doc.load_page(0)  # Test with first page only
        
        # Test configurations
        configs = [
            {
                "name": "CURRENT (PNG, 512px, full prompt)",
                "format": "PNG",
                "max_width": 512,
                "quality": None,
                "prompt_type": "full"
            },
            {
                "name": "JPEG OPTIMIZED (JPEG, 512px, short prompt)",
                "format": "JPEG",
                "max_width": 512,
                "quality": 75,
                "prompt_type": "short"
            },
            {
                "name": "SMALLER IMAGE (PNG, 400px, short prompt)",
                "format": "PNG", 
                "max_width": 400,
                "quality": None,
                "prompt_type": "short"
            },
            {
                "name": "ULTRA FAST (JPEG, 384px, minimal prompt)",
                "format": "JPEG",
                "max_width": 384,
                "quality": 70,
                "prompt_type": "minimal"
            }
        ]
        
        results = []
        
        for config in configs:
            print(f"\n🧪 Testing: {config['name']}")
            
            # Convert page to image
            dpi = 100
            mat = fitz.Matrix(dpi/72, dpi/72)
            pix = page.get_pixmap(matrix=mat)
            
            # Convert to PIL Image
            img_data = pix.tobytes("png")
            img = Image.open(BytesIO(img_data))
            
            # Resize if needed
            if img.width > config['max_width']:
                ratio = config['max_width'] / img.width
                new_height = int(img.height * ratio)
                img = img.resize((config['max_width'], new_height), Image.Resampling.LANCZOS)
            
            # Convert to target format
            buffer = BytesIO()
            if config['format'] == 'JPEG':
                img_rgb = img.convert('RGB')
                img_rgb.save(buffer, format="JPEG", quality=config['quality'], optimize=True)
            else:
                img.save(buffer, format="PNG", optimize=True)
            
            image_data = buffer.getvalue()
            img_base64 = base64.b64encode(image_data).decode()
            
            # Prepare prompts
            prompts = {
                "full": """You are an expert at extracting structured data from supplier price lists and product catalogs.

Analyze this image and extract ALL products with their pricing information, regardless of the document format or layout complexity.

EXTRACTION STRATEGY:
1. Look for any visible company/supplier information (name, contact details)
2. Identify all products with prices, even if the layout is complex or non-standard
3. Extract product details: name, price, unit, description, specifications

PRICE PATTERNS TO RECOGNIZE:
- Currency symbols: $, €, £, ¥, ₹, Rp, IDR, USD, EUR, etc.
- Numbers with separators: 1,000.50, 1.000,50, 1 000.50
- Various formats: "IDR 104,000", "$25.99", "€15.50", "Price: 1000"
- CRITICAL: Use the EXACT currency found in the document, do NOT convert or assume

Return ONLY a JSON object in this exact format:
{
  "supplier": {"name": "Company Name", "address": "", "phone": "", "email": ""},
  "products": [
    {"name": "Product Name", "price": 104000, "currency": "IDR", "unit": "ml", "category": "dairy", "description": ""}
  ],
  "page_info": {"has_price_list": true, "layout_type": "table", "confidence": 0.85}
}

Extract ALL products visible on this page.""",
                
                "short": """Extract all products and prices from this supplier catalog image.

Return ONLY JSON:
{
  "supplier": {"name": "Company Name"},
  "products": [
    {"name": "Product Name", "price": 104000, "currency": "IDR", "unit": "ml"}
  ],
  "page_info": {"has_price_list": true, "confidence": 0.9}
}

Use EXACT currency from document. Extract ALL visible products.""",
                
                "minimal": """Extract products and prices. Return JSON only:
{"products": [{"name": "Product", "price": 123, "currency": "IDR", "unit": "ml"}]}"""
            }
            
            prompt = prompts[config['prompt_type']]
            
            # Prepare API payload
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
                                "url": f"data:image/{config['format'].lower()};base64,{img_base64}",
                                "detail": "low"
                            }
                        }
                    ]
                }],
                "max_tokens": 1500,
                "temperature": 0.1
            }
            
            # Measure API call time
            start_time = time.time()
            
            try:
                response = requests.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=60
                )
                
                api_time = time.time() - start_time
                
                if response.status_code == 200:
                    result = response.json()
                    usage = result.get('usage', {})
                    content = result['choices'][0]['message']['content']
                    
                    # Try to extract products count
                    products_count = 0
                    try:
                        start_idx = content.find('{')
                        end_idx = content.rfind('}') + 1
                        if start_idx != -1 and end_idx != -1:
                            json_str = content[start_idx:end_idx]
                            extracted_data = json.loads(json_str)
                            products_count = len(extracted_data.get('products', []))
                    except:
                        pass
                    
                    results.append({
                        "config": config['name'],
                        "image_size_kb": len(image_data) / 1024,
                        "base64_size_kb": len(img_base64) / 1024,
                        "api_time_s": api_time,
                        "input_tokens": usage.get('prompt_tokens', 0),
                        "output_tokens": usage.get('completion_tokens', 0),
                        "total_tokens": usage.get('total_tokens', 0),
                        "products_found": products_count,
                        "status": "success"
                    })
                    
                    print(f"   ✅ Success in {api_time:.2f}s")
                    print(f"   📊 Image: {len(image_data)/1024:.1f} KB")
                    print(f"   🎯 Tokens: {usage.get('total_tokens', 0):,}")
                    print(f"   🛍️ Products: {products_count}")
                    
                else:
                    print(f"   ❌ Failed: {response.status_code}")
                    results.append({
                        "config": config['name'],
                        "api_time_s": api_time,
                        "status": f"error_{response.status_code}"
                    })
                    
            except requests.exceptions.Timeout:
                api_time = time.time() - start_time
                print(f"   ⏰ Timeout after {api_time:.2f}s")
                results.append({
                    "config": config['name'],
                    "api_time_s": api_time,
                    "status": "timeout"
                })
                
            except Exception as e:
                api_time = time.time() - start_time
                print(f"   ❌ Error: {e}")
                results.append({
                    "config": config['name'],
                    "api_time_s": api_time,
                    "status": "error"
                })
        
        # Summary
        print(f"\n📊 OPTIMIZATION RESULTS:")
        print(f"{'Configuration':<40} {'Time':<8} {'Size':<8} {'Tokens':<8} {'Products':<10} {'Status'}")
        print("-" * 90)
        
        for result in results:
            if result['status'] == 'success':
                print(f"{result['config']:<40} {result['api_time_s']:<7.1f}s {result['image_size_kb']:<7.0f}KB {result['total_tokens']:<7,} {result['products_found']:<10} {result['status']}")
            else:
                print(f"{result['config']:<40} {result['api_time_s']:<7.1f}s {'N/A':<7} {'N/A':<7} {'N/A':<10} {result['status']}")
        
        # Find best performing
        successful_results = [r for r in results if r['status'] == 'success']
        if successful_results:
            fastest = min(successful_results, key=lambda x: x['api_time_s'])
            print(f"\n🏆 FASTEST: {fastest['config']} ({fastest['api_time_s']:.1f}s)")
            
            if fastest['api_time_s'] < 10:
                print(f"✅ Meets 10s target!")
            else:
                print(f"⚠️ Still exceeds 10s target")
        
        doc.close()
        
    finally:
        try:
            os.unlink(pdf_path)
        except:
            pass

if __name__ == "__main__":
    test_optimization_strategies()