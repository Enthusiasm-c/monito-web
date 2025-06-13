#!/usr/bin/env python3
"""
AI-powered PDF OCR Extractor
Converts PDF pages to images and uses AI vision to extract products
"""

import os
import sys
import json
import base64
import tempfile
from typing import Dict, List, Any, Optional
import requests
from pdf2image import convert_from_path
from PIL import Image
import io

class AiPdfOcrExtractor:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.model = "gpt-4o-mini"
        
    def log(self, message: str, level: str = 'INFO'):
        """Log messages"""
        print(f"[{level}] {message}", file=sys.stderr if level == 'ERROR' else sys.stdout)
        
    def pdf_to_images(self, pdf_path: str, dpi: int = 200) -> List[str]:
        """Convert PDF pages to images"""
        try:
            self.log(f"Converting PDF to images at {dpi} DPI...")
            
            # Convert PDF to PIL images
            images = convert_from_path(pdf_path, dpi=dpi)
            
            # Save images to temp files
            image_paths = []
            for i, image in enumerate(images):
                temp_path = tempfile.mktemp(suffix=f'_page_{i+1}.jpg')
                image.save(temp_path, 'JPEG', quality=95)
                image_paths.append(temp_path)
                self.log(f"  Page {i+1} saved to {temp_path}")
                
            return image_paths
            
        except Exception as e:
            self.log(f"Failed to convert PDF to images: {e}", 'ERROR')
            return []
            
    def image_to_base64(self, image_path: str) -> str:
        """Convert image to base64"""
        with open(image_path, 'rb') as img_file:
            return base64.b64encode(img_file.read()).decode('utf-8')
            
    def extract_products_from_image(self, image_path: str, page_num: int) -> Dict[str, Any]:
        """Extract products from a single image using AI vision"""
        try:
            self.log(f"Processing page {page_num} with AI vision...")
            
            # Convert image to base64
            base64_image = self.image_to_base64(image_path)
            
            # Prepare the prompt
            prompt = """You are analyzing a price list image from Indonesia. Extract ALL products with their prices.

IMPORTANT RULES:
1. Extract EVERY product you can see, including partial ones at edges
2. For products with multiple prices (wholesale/retail), extract BOTH as separate entries
3. Indonesian price format: dots are thousand separators (e.g., 316.350 = 316,350)
4. Common units: kg, gr, ml, ltr, pcs, pack, box
5. If you see "K" suffix, multiply by 1000 (e.g., 179K = 179,000)
6. For products with size options (e.g., "500g Rp 35.000 | 200g Rp 17.500"), extract each as separate product

Return a JSON object with this structure:
{
  "products": [
    {
      "name": "Product Name",
      "price": 123000,
      "unit": "kg",
      "size": "1 kg",
      "price_type": "wholesale|retail|standard",
      "notes": "any special notes"
    }
  ],
  "page_info": {
    "has_table": true/false,
    "table_type": "standard|complex|multi-column",
    "total_products_visible": number
  }
}

EXTRACT EVERY PRODUCT VISIBLE, even if partially shown."""

            # Call OpenAI API
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            
            data = {
                'model': self.model,
                'messages': [
                    {
                        'role': 'user',
                        'content': [
                            {'type': 'text', 'text': prompt},
                            {
                                'type': 'image_url',
                                'image_url': {
                                    'url': f'data:image/jpeg;base64,{base64_image}'
                                }
                            }
                        ]
                    }
                ],
                'max_tokens': 4096,
                'temperature': 0.1
            }
            
            response = requests.post(
                'https://api.openai.com/v1/chat/completions',
                headers=headers,
                json=data,
                timeout=60
            )
            
            if response.status_code != 200:
                self.log(f"API error: {response.status_code} - {response.text}", 'ERROR')
                return {'products': [], 'error': f'API error: {response.status_code}'}
                
            result = response.json()
            content = result['choices'][0]['message']['content']
            
            # Parse JSON from response
            try:
                # Extract JSON from markdown if present
                if '```json' in content:
                    json_start = content.find('```json') + 7
                    json_end = content.find('```', json_start)
                    content = content[json_start:json_end].strip()
                    
                extracted_data = json.loads(content)
                
                # Add page number to each product
                for product in extracted_data.get('products', []):
                    product['source_page'] = page_num
                    
                self.log(f"  Extracted {len(extracted_data.get('products', []))} products from page {page_num}")
                
                return extracted_data
                
            except json.JSONDecodeError as e:
                self.log(f"Failed to parse AI response: {e}", 'ERROR')
                return {'products': [], 'error': 'JSON parse error'}
                
        except Exception as e:
            self.log(f"Failed to process image: {e}", 'ERROR')
            return {'products': [], 'error': str(e)}
            
    def process_pdf(self, pdf_path: str, max_pages: Optional[int] = None) -> Dict[str, Any]:
        """Process entire PDF with AI OCR"""
        try:
            self.log(f"Starting AI OCR extraction for: {pdf_path}")
            
            # Convert PDF to images
            image_paths = self.pdf_to_images(pdf_path)
            
            if not image_paths:
                return {
                    'products': [],
                    'error': 'Failed to convert PDF to images',
                    'metrics': {'pages_processed': 0}
                }
                
            # Process each page
            all_products = []
            page_results = []
            total_tokens = 0
            
            pages_to_process = image_paths[:max_pages] if max_pages else image_paths
            
            for i, image_path in enumerate(pages_to_process):
                page_result = self.extract_products_from_image(image_path, i + 1)
                
                products = page_result.get('products', [])
                all_products.extend(products)
                
                page_results.append({
                    'page': i + 1,
                    'products_count': len(products),
                    'page_info': page_result.get('page_info', {}),
                    'error': page_result.get('error')
                })
                
                # Clean up temp image
                try:
                    os.unlink(image_path)
                except:
                    pass
                    
            # Deduplicate products
            unique_products = self.deduplicate_products(all_products)
            
            # Calculate metrics
            metrics = {
                'pages_processed': len(pages_to_process),
                'total_pages': len(image_paths),
                'products_extracted': len(unique_products),
                'products_before_dedup': len(all_products),
                'tokens_used': total_tokens,
                'cost_usd': (total_tokens / 1000) * 0.00015  # Approximate cost
            }
            
            # Try to extract supplier info
            supplier = self.extract_supplier_from_pages(page_results, all_products)
            
            self.log(f"✅ AI OCR extraction complete: {len(unique_products)} unique products from {len(pages_to_process)} pages")
            
            return {
                'supplier': supplier,
                'products': unique_products,
                'page_results': page_results,
                'metrics': metrics
            }
            
        except Exception as e:
            self.log(f"AI OCR extraction failed: {e}", 'ERROR')
            return {
                'products': [],
                'error': str(e),
                'metrics': {'pages_processed': 0}
            }
            
    def deduplicate_products(self, products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate products, keeping best price when multiple price types exist"""
        # Group products by name and size (ignoring price_type)
        product_groups = {}
        
        for product in products:
            # Create grouping key (name + size, ignore price_type)
            name = product['name'].strip()
            size = product.get('size', '').strip()
            unit = product.get('unit', '').strip()
            
            group_key = f"{name}_{size}_{unit}".lower()
            
            if group_key not in product_groups:
                product_groups[group_key] = []
            product_groups[group_key].append(product)
        
        # For each group, select the best product (prefer recommended retail > standard > retail)
        unique = []
        price_type_priority = {
            'recommended retail': 3,
            'standard': 2, 
            'retail': 1,
            '': 0
        }
        
        for group_key, group_products in product_groups.items():
            if len(group_products) == 1:
                unique.append(group_products[0])
            else:
                # Multiple products with same name+size - pick the best price type
                best_product = max(group_products, 
                                 key=lambda p: price_type_priority.get(p.get('price_type', '').lower(), 0))
                unique.append(best_product)
                
                # Log deduplication for debugging
                if len(group_products) > 1:
                    price_types = [p.get('price_type', 'unknown') for p in group_products]
                    self.log(f"🔄 Deduplicated {len(group_products)} variants of '{group_products[0]['name']}' ({', '.join(price_types)}) -> kept {best_product.get('price_type', 'unknown')}")
                
        return unique
        
    def extract_supplier_from_pages(self, page_results: List[Dict], products: List[Dict]) -> Optional[Dict[str, str]]:
        """Try to extract supplier info from products"""
        # Look for common supplier patterns in product names
        supplier_keywords = ['island organics', 'valenta', 'bali boga', 'pt.', 'cv.']
        
        for product in products[:10]:  # Check first few products
            name_lower = product.get('name', '').lower()
            for keyword in supplier_keywords:
                if keyword in name_lower:
                    return {'name': keyword.title()}
                    
        return None


def main():
    """Main entry point"""
    if len(sys.argv) < 3:
        print("Usage: python ai_pdf_ocr_extractor.py <pdf_path> <openai_api_key> [max_pages]")
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    api_key = sys.argv[2]
    max_pages = int(sys.argv[3]) if len(sys.argv) > 3 else None
    
    if not os.path.exists(pdf_path):
        print(f"Error: PDF file not found: {pdf_path}")
        sys.exit(1)
        
    # Create extractor and process
    extractor = AiPdfOcrExtractor(api_key)
    result = extractor.process_pdf(pdf_path, max_pages)
    
    # Output result
    print("=== AI_OCR_JSON_START ===")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print("=== AI_OCR_JSON_END ===")


if __name__ == "__main__":
    main()