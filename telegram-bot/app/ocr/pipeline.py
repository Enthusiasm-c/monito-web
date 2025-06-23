"""OCR Pipeline for invoice processing using OpenAI Vision API"""

import base64
import io
import json
from datetime import datetime
from typing import Dict, Any, Optional, List

import openai
from PIL import Image
from loguru import logger
import httpx

from ..config import settings


class OCRPipeline:
    """Main OCR pipeline for processing invoices"""
    
    def __init__(self):
        # Create httpx client without proxy settings
        http_client = httpx.Client(
            timeout=httpx.Timeout(30.0, connect=10.0),
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
        )
        self.client = openai.OpenAI(
            api_key=settings.openai_api_key,
            http_client=http_client
        )
        self.model = settings.openai_model
    
    async def process_invoice(self, image: Image.Image) -> Dict[str, Any]:
        """
        Process invoice image and extract structured data
        
        Args:
            image: PIL Image object
            
        Returns:
            Dictionary with extracted invoice data
        """
        start_time = datetime.now()
        
        try:
            # Preprocess image
            processed_image = self._preprocess_image(image)
            
            # Convert to base64
            image_base64 = self._image_to_base64(processed_image)
            
            # Extract data using OpenAI Vision
            result = await self._extract_with_vision(image_base64)
            
            # Calculate processing time
            processing_time = (datetime.now() - start_time).total_seconds()
            result['processing_time'] = processing_time
            
            logger.info(f"OCR completed in {processing_time:.2f}s")
            return result
            
        except Exception as e:
            logger.error(f"OCR pipeline error: {e}")
            return {
                'error': str(e),
                'products': [],
                'processing_time': (datetime.now() - start_time).total_seconds()
            }
    
    def _preprocess_image(self, image: Image.Image) -> Image.Image:
        """Basic image preprocessing"""
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize if too large (max 2048x2048 for OpenAI)
        max_size = 2048
        if image.width > max_size or image.height > max_size:
            image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        return image
    
    def _image_to_base64(self, image: Image.Image) -> str:
        """Convert PIL Image to base64 string"""
        buffer = io.BytesIO()
        image.save(buffer, format='JPEG', quality=95)
        image_bytes = buffer.getvalue()
        return base64.b64encode(image_bytes).decode('utf-8')
    
    async def _extract_with_vision(self, image_base64: str) -> Dict[str, Any]:
        """Extract invoice data using OpenAI Vision API"""
        prompt = """
        Extract invoice information from this image. Focus on:
        1. Supplier/vendor name
        2. Invoice date
        3. Product list with names, quantities, unit prices, and total prices
        
        CRITICAL RULES for Indonesian invoices:
        - HARGA = unit price per item (price per kg, per pcs, etc.)
        - JUMLAH = total amount for that line (harga × quantity)
        - For unit_price field, ALWAYS use HARGA column, NOT JUMLAH
        - For total_price field, use JUMLAH column if available
        - Extract prices EXACTLY as they appear in the invoice
        - DO NOT convert or interpret numbers - return raw values
        - If you see "2.200" return 2200 (remove dots used as thousand separators)  
        - If you see "244" or "244.000" return 244000
        - Minimum realistic price is 1000 IDR
        - Dots (.) are thousand separators (e.g., 1.500 = 1500, 10.000 = 10000)
        - Commas (,) are decimal separators (rare in invoices)
        - Common units: kg, gr, ltr, pcs, dus, pak
        
        Table structure recognition:
        - Look for columns like: Nama/Product, Qty/Jumlah Barang, Satuan/Unit, Harga/Price, Jumlah/Total
        - Extract unit_price from "Harga" column (price per unit)
        - Extract total_price from "Jumlah" column (total amount)
        - VALIDATE: total_price should equal unit_price × quantity
        - If math doesn't work, prioritize the "Harga" column value for unit_price
        - If no separate columns, calculate: total_price = unit_price × quantity
        
        STEP-BY-STEP EXTRACTION:
        1. Find the table header row with column names
        2. Identify which column is HARGA (unit price) and which is JUMLAH (total)
        3. For each product row:
           - Extract quantity from Qty column 
           - Extract unit_price from HARGA column (NOT from JUMLAH!)
           - Extract total_price from JUMLAH column
           - VERIFY: unit_price × quantity = total_price
           - If verification fails, re-examine which columns you identified as HARGA vs JUMLAH
        
        COMMON MISTAKES TO AVOID:
        - DON'T mix up HARGA and JUMLAH columns
        - DON'T use JUMLAH value as unit_price
        - DON'T ignore quantity when it's > 1
        - DON'T mix up rows in the table - each product row is independent
        - Example: Fresh Milk 2L, Qty=2, Harga=25000, Jumlah=50000 → unit_price=25000, total_price=50000
        
        SPECIAL ATTENTION for products like "Fresh Milk 2L" or "Apel Fuji 2pcs":
        - The "2L" or "2pcs" in the name is NOT the quantity
        - Look for the actual quantity in the Qty/Jumlah Barang column
        - Example: "Fresh Milk 2L" with Qty=2 means 2 units of 2L bottles (total 4L)
        
        CRITICAL VALIDATION:
        - For each row, verify: Harga × Qty = Jumlah
        - If this formula doesn't match, the OCR extraction is wrong
        - Example: Green Bean, 0.5 kg, Harga: 18000, Jumlah: 9000 → unit_price=18000, total_price=9000
        
        Return a JSON object with this structure:
        {
            "supplier_name": "string",
            "date": "YYYY-MM-DD",
            "products": [
                {
                    "name": "product name",
                    "quantity": number,
                    "unit": "string", 
                    "unit_price": number (from HARGA column - price per unit),
                    "total_price": number (from JUMLAH column - total amount)
                }
            ],
            "confidence": 0.0-1.0
        }
        
        Example: if HARGA shows "Rp 2.500" and JUMLAH shows "Rp 5.000", return unit_price: 2500, total_price: 5000
        """
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_base64}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=2000,
                temperature=0.1
            )
            
            # Parse response
            content = response.choices[0].message.content
            
            # Try to extract JSON from response
            try:
                # If response is wrapped in markdown code blocks
                if "```json" in content:
                    json_start = content.find("```json") + 7
                    json_end = content.find("```", json_start)
                    content = content[json_start:json_end].strip()
                elif "```" in content:
                    json_start = content.find("```") + 3
                    json_end = content.find("```", json_start)
                    content = content[json_start:json_end].strip()
                
                result = json.loads(content)
                
                # Validate and clean data
                result = self._validate_and_clean_result(result)
                
                return result
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response: {e}")
                logger.debug(f"Raw response: {content}")
                
                # Try to extract products manually
                return self._fallback_extraction(content)
                
        except Exception as e:
            logger.error(f"OpenAI Vision API error: {e}")
            raise
    
    def _validate_and_clean_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and clean extracted data"""
        # Ensure required fields
        result.setdefault('supplier_name', 'Unknown Supplier')
        result.setdefault('date', datetime.now().strftime('%Y-%m-%d'))
        result.setdefault('products', [])
        result.setdefault('confidence', 0.8)
        
        # Clean products
        cleaned_products = []
        for product in result.get('products', []):
            if not product.get('name'):
                continue
            
            # Parse Indonesian number format
            unit_price = self._parse_indonesian_number(
                str(product.get('unit_price', 0))
            )
            total_price = self._parse_indonesian_number(
                str(product.get('total_price', unit_price))
            )
            
            # Fix common OCR mistakes with missing zeros
            # If price is suspiciously low (< 1000), multiply by 1000
            if unit_price > 0 and unit_price < 1000:
                unit_price = unit_price * 1000
            if total_price > 0 and total_price < 1000:
                total_price = total_price * 1000
            
            # Critical validation: check if OCR mixed up HARGA and JUMLAH columns
            quantity = float(product.get('quantity', 1))
            if quantity > 0 and total_price > 0 and unit_price > 0:
                # Calculate expected total from unit price
                expected_total = unit_price * quantity
                # Check if the math works: unit_price × quantity = total_price
                tolerance = 0.05  # Allow 5% tolerance for rounding errors
                
                # Log validation details for debugging
                logger.debug(f"Validating {product['name']}: qty={quantity}, unit={unit_price}, total={total_price}, expected={expected_total}")
                
                if abs(expected_total - total_price) / total_price > tolerance:
                    # OCR likely mixed up HARGA and JUMLAH columns!
                    # Calculate what unit price should be based on total
                    calculated_unit_price = total_price / quantity
                    if calculated_unit_price >= 1000:  # Reasonable unit price minimum
                        logger.warning(f"OCR column mix-up detected for {product['name']}: "
                                     f"qty={quantity}, extracted unit_price={unit_price}, total={total_price}, "
                                     f"expected_total={expected_total}, calculated_unit={calculated_unit_price}")
                        unit_price = calculated_unit_price
                    else:
                        # If calculated unit price is too low, OCR might have extracted wrong data entirely
                        logger.error(f"OCR extraction error for {product['name']}: "
                                   f"qty={quantity}, unit={unit_price}, total={total_price} - math doesn't add up!")
            
            cleaned_product = {
                'name': product['name'].strip(),
                'quantity': float(product.get('quantity', 1)),
                'unit': product.get('unit', 'pcs').lower(),
                'unit_price': unit_price,
                'total_price': total_price
            }
            
            cleaned_products.append(cleaned_product)
        
        result['products'] = cleaned_products
        return result
    
    def _parse_indonesian_number(self, number_str: str) -> float:
        """Parse Indonesian number format"""
        if not number_str:
            return 0.0
        
        # Remove currency symbols and spaces
        number_str = number_str.replace('Rp', '').replace('IDR', '').strip()
        
        # Handle Indonesian format (dots as thousands, comma as decimal)
        if ',' in number_str and '.' in number_str:
            # Both separators present
            number_str = number_str.replace('.', '').replace(',', '.')
        elif '.' in number_str:
            # Only dots - check if it's thousands separator
            parts = number_str.split('.')
            if len(parts) > 1 and len(parts[-1]) == 3:
                # Dots are thousands separators
                number_str = number_str.replace('.', '')
            # else: dot is decimal separator, keep as is
        elif ',' in number_str:
            # Only comma - decimal separator
            number_str = number_str.replace(',', '.')
        
        try:
            return float(number_str)
        except ValueError:
            logger.warning(f"Failed to parse number: {number_str}")
            return 0.0
    
    def _fallback_extraction(self, text: str) -> Dict[str, Any]:
        """Fallback extraction when JSON parsing fails"""
        logger.warning("Using fallback extraction method")
        
        # Try to extract basic information from text
        products = []
        lines = text.split('\n')
        
        for line in lines:
            # Look for price patterns
            if any(indicator in line for indicator in ['Rp', 'IDR', '000']):
                # This might be a product line
                # Very basic extraction - would need improvement
                parts = line.split()
                if len(parts) >= 2:
                    products.append({
                        'name': ' '.join(parts[:-1]),
                        'quantity': 1,
                        'unit': 'pcs',
                        'unit_price': 0,
                        'total_price': 0
                    })
        
        return {
            'supplier_name': 'Unknown Supplier',
            'date': datetime.now().strftime('%Y-%m-%d'),
            'products': products[:20],  # Limit to prevent spam
            'confidence': 0.3,
            'warning': 'Fallback extraction used - results may be inaccurate'
        }