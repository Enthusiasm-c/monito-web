#!/usr/bin/env python3
"""
PDF to Image AI Extractor
Converts PDF pages to images and uses OpenAI Vision API for data extraction
when traditional table extraction methods fail.
"""

import sys
import json
import requests
import base64
import tempfile
import os
from io import BytesIO
from typing import List, Dict, Any, Optional

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

class PDFImageExtractor:
    def __init__(self, openai_api_key: str):
        self.openai_api_key = openai_api_key
        self.api_url = "https://api.openai.com/v1/chat/completions"
    
    def pdf_to_images(self, pdf_path: str, dpi: int = 100) -> List[str]:
        """Convert PDF pages to base64-encoded images"""
        try:
            print(f"[INFO] 🔍 Opening PDF: {pdf_path}")
            doc = fitz.open(pdf_path)
            total_pages = len(doc)
            print(f"[INFO] 📄 Found {total_pages} pages in PDF")
            
            # Limit pages to prevent timeout (max 3 pages for stability)
            max_pages = min(total_pages, 3)
            if total_pages > max_pages:
                print(f"[WARNING] ⚠️ Limiting to first {max_pages} pages (PDF has {total_pages} pages)")
            
            images = []
            
            for page_num in range(max_pages):
                try:
                    print(f"[INFO] 🔄 Processing page {page_num + 1}/{max_pages}")
                    page = doc.load_page(page_num)
                    
                    # Convert page to image with reduced DPI for speed
                    mat = fitz.Matrix(dpi/72, dpi/72)  # Scale matrix for DPI
                    pix = page.get_pixmap(matrix=mat)
                    
                    # Convert to PIL Image
                    img_data = pix.tobytes("png")
                    img = Image.open(BytesIO(img_data))
                    
                    # Optimize image size for speed (low detail mode)
                    if img.width > 512:  # Much smaller for faster processing
                        ratio = 512 / img.width
                        new_height = int(img.height * ratio)
                        img = img.resize((512, new_height), Image.Resampling.LANCZOS)
                    
                    # Convert to base64
                    buffer = BytesIO()
                    img.save(buffer, format="PNG", optimize=True)
                    img_base64 = base64.b64encode(buffer.getvalue()).decode()
                    
                    images.append(img_base64)
                    print(f"[INFO] ✅ Page {page_num + 1}: {len(img_base64)} chars")
                    
                except Exception as page_error:
                    print(f"[ERROR] Failed to process page {page_num + 1}: {page_error}", file=sys.stderr)
                    continue
            
            doc.close()
            print(f"[INFO] 🎉 Successfully converted {len(images)} pages to images")
            return images
            
        except Exception as e:
            print(f"[ERROR] Failed to convert PDF to images: {e}", file=sys.stderr)
            return []
    
    def extract_data_from_image(self, image_base64: str, page_num: int) -> Dict[str, Any]:
        """Extract supplier and product data from image using OpenAI Vision API"""
        
        prompt = """You are an expert at extracting structured data from supplier price lists and product catalogs.

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

PRODUCT INFORMATION TO EXTRACT:
- Product name (clean, without extra formatting)
- Price (use the main/wholesale price if multiple prices exist)
- Currency (auto-detect from document)
- Unit of measurement (kg, ml, pcs, box, etc.)
- Category (food, electronics, clothing, etc.)
- Any specifications (size, weight, volume, description)

LAYOUT HANDLING:
- Work with tables, lists, catalogs, mixed layouts
- Extract from complex multi-column formats
- Handle products scattered across the page
- Process both structured and unstructured data

Return ONLY a JSON object in this exact format:
{
  "supplier": {
    "name": "Company Name (auto-detected)",
    "address": "Address if visible",
    "phone": "Phone if visible", 
    "email": "Email if visible"
  },
  "products": [
    {
      "name": "Clean Product Name",
      "price": 104000,
      "currency": "IDR",
      "unit": "ml",
      "category": "dairy",
      "description": "Any additional details or specifications"
    }
  ],
  "page_info": {
    "has_price_list": true,
    "layout_type": "table|list|catalog|mixed",
    "confidence": 0.85
  }
}

IMPORTANT: Always extract the ACTUAL currency from the document (IDR, USD, EUR, etc.), don't assume or change it.

Extract ALL products visible on this page, even if layout is complex or unusual."""

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.openai_api_key}"
        }
        
        payload = {
            "model": "gpt-o3",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_base64}",
                                "detail": "low"
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 2000,
            "temperature": 0.1
        }
        
        try:
            print(f"[INFO] 🤖 Sending page {page_num} to OpenAI Vision API...")
            response = requests.post(self.api_url, headers=headers, json=payload, timeout=90)  # 90 second timeout per page
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                
                # Extract JSON from response
                try:
                    # Find JSON in the response
                    start_idx = content.find('{')
                    end_idx = content.rfind('}') + 1
                    if start_idx != -1 and end_idx != -1:
                        json_str = content[start_idx:end_idx]
                        extracted_data = json.loads(json_str)
                        
                        # Add metadata
                        extracted_data['_metadata'] = {
                            'page_number': page_num,
                            'tokens_used': result['usage']['total_tokens'],
                            'cost_usd': self.calculate_cost(result['usage'])
                        }
                        
                        products_count = len(extracted_data.get('products', []))
                        print(f"[INFO] ✅ Page {page_num}: Extracted {products_count} products")
                        
                        return extracted_data
                    else:
                        print(f"[ERROR] No JSON found in API response for page {page_num}")
                        return self.empty_result(page_num)
                        
                except json.JSONDecodeError as e:
                    print(f"[ERROR] Failed to parse JSON from API response for page {page_num}: {e}")
                    print(f"[DEBUG] Response content: {content[:500]}...")
                    return self.empty_result(page_num)
            else:
                print(f"[ERROR] OpenAI API error for page {page_num}: {response.status_code} - {response.text}")
                return self.empty_result(page_num)
                
        except Exception as e:
            print(f"[ERROR] Exception during API call for page {page_num}: {e}")
            return self.empty_result(page_num)
    
    def calculate_cost(self, usage: Dict) -> float:
        """Calculate cost based on GPT-4 Vision pricing"""
        input_tokens = usage.get('prompt_tokens', 0)
        output_tokens = usage.get('completion_tokens', 0)
        
        # GPT-o3 pricing (as of 2024)
        input_cost = (input_tokens / 1000) * 0.005  # $0.005 per 1K input tokens
        output_cost = (output_tokens / 1000) * 0.015  # $0.015 per 1K output tokens
        
        return input_cost + output_cost
    
    def empty_result(self, page_num: int) -> Dict[str, Any]:
        """Return empty result structure"""
        return {
            "supplier": {},
            "products": [],
            "page_info": {
                "has_price_list": False,
                "layout_type": "unknown",
                "confidence": 0.0
            },
            "_metadata": {
                "page_number": page_num,
                "tokens_used": 0,
                "cost_usd": 0.0
            }
        }
    
    def process_pdf(self, pdf_url: str) -> Dict[str, Any]:
        """Main processing function"""
        print(f"[INFO] 🖼️ Starting PDF-to-Image AI extraction for: {pdf_url}")
        
        # Download PDF
        try:
            response = requests.get(pdf_url, timeout=30)
            response.raise_for_status()
        except Exception as e:
            print(f"[ERROR] Failed to download PDF: {e}")
            return {"error": f"Failed to download PDF: {e}"}
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
            tmp_file.write(response.content)
            pdf_path = tmp_file.name
        
        try:
            # Convert PDF to images
            images = self.pdf_to_images(pdf_path)
            if not images:
                return {"error": "Failed to convert PDF to images"}
            
            # Process each page
            all_results = []
            total_cost = 0.0
            total_tokens = 0
            
            for i, image_base64 in enumerate(images):
                result = self.extract_data_from_image(image_base64, i + 1)
                all_results.append(result)
                
                if '_metadata' in result:
                    total_cost += result['_metadata']['cost_usd']
                    total_tokens += result['_metadata']['tokens_used']
            
            # Combine results
            combined_supplier = {}
            combined_products = []
            
            for result in all_results:
                # Merge supplier info (take first non-empty)
                if not combined_supplier and result.get('supplier'):
                    supplier_info = result['supplier']
                    if any(supplier_info.values()):  # Check if any field has content
                        combined_supplier = supplier_info
                
                # Combine all products
                if result.get('products'):
                    for product in result['products']:
                        product['source_page'] = result.get('_metadata', {}).get('page_number', 0)
                        combined_products.append(product)
            
            # Deduplicate products by name
            unique_products = []
            seen_names = set()
            for product in combined_products:
                product_key = product.get('name', '').lower().strip()
                if product_key and product_key not in seen_names:
                    seen_names.add(product_key)
                    unique_products.append(product)
            
            print(f"[INFO] 📊 AI extraction completed:")
            print(f"[INFO] 📄 Pages processed: {len(images)}")
            print(f"[INFO] 🛍️ Products extracted: {len(unique_products)}")
            print(f"[INFO] 💰 Total cost: ${total_cost:.4f}")
            print(f"[INFO] 🎯 Total tokens: {total_tokens}")
            
            return {
                "supplier": combined_supplier,
                "products": unique_products,
                "metrics": {
                    "pages_processed": len(images),
                    "total_products": len(unique_products),
                    "tokens_used": total_tokens,
                    "cost_usd": total_cost
                },
                "page_results": all_results
            }
            
        finally:
            # Clean up temporary file
            try:
                os.unlink(pdf_path)
            except:
                pass

def main():
    print("[INFO] 🚀 AI Vision extractor starting...")
    print(f"[INFO] 📋 Arguments: {len(sys.argv)} provided")
    
    if len(sys.argv) != 3:
        print("Usage: python3 pdf_image_extractor.py <pdf_url> <openai_api_key>")
        sys.exit(1)
    
    pdf_url = sys.argv[1]
    api_key = sys.argv[2]
    
    print(f"[INFO] 🔗 PDF URL: {pdf_url[:50]}...")
    print(f"[INFO] 🔑 API Key: {'*' * 10}... (configured)")
    
    print("[INFO] 🏗️ Creating extractor instance...")
    extractor = PDFImageExtractor(api_key)
    
    print("[INFO] 🚀 Starting PDF processing...")
    result = extractor.process_pdf(pdf_url)
    
    print("[INFO] ✅ Processing completed, outputting JSON...")
    # Output JSON result
    print("=== AI_EXTRACTION_JSON_START ===")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print("=== AI_EXTRACTION_JSON_END ===")
    print("[INFO] 🎉 AI Vision extractor finished successfully!")

if __name__ == "__main__":
    main()