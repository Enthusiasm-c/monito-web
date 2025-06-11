#!/usr/bin/env python3
"""
AI Structuring Service with Function Calling
Implements Task 7: AI structuring with function calling

Features:
- GPT-o3 integration with structured function calling
- Standardized JSON schema for product data
- Intelligent data validation and correction
- Batch processing for efficiency
- Token usage monitoring and optimization
- Fallback strategies for API failures
- Quality scoring and confidence metrics
"""

import sys
import os
import json
import time
from pathlib import Path
from typing import Dict, Any, List, Optional, Union, Tuple
import logging
from datetime import datetime
import asyncio
import aiohttp

# OpenAI for GPT-o3 function calling
try:
    import openai
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    print("[WARNING] OpenAI library not available, AI structuring disabled", file=sys.stderr)
    OPENAI_AVAILABLE = False

# Import AI cache service for response caching
try:
    from ai_cache_service import AICacheService
    CACHE_AVAILABLE = True
except ImportError:
    print("[WARNING] AI cache service not available", file=sys.stderr)
    CACHE_AVAILABLE = False

# pydantic for data validation
try:
    from pydantic import BaseModel, Field, validator
    from typing import Optional
    PYDANTIC_AVAILABLE = True
except ImportError:
    print("[WARNING] pydantic not available, data validation limited", file=sys.stderr)
    PYDANTIC_AVAILABLE = False


# Product data schemas
if PYDANTIC_AVAILABLE:
    class ProductData(BaseModel):
        """Standardized product data schema"""
        name: str = Field(..., description="Product name or title")
        unit: Optional[str] = Field(None, description="Unit of measurement (kg, liter, piece, etc.)")
        price: Optional[float] = Field(None, description="Price as a number")
        price_text: Optional[str] = Field(None, description="Original price text from document")
        currency: Optional[str] = Field("IDR", description="Currency code (IDR, USD, etc.)")
        category: Optional[str] = Field(None, description="Product category")
        subcategory: Optional[str] = Field(None, description="Product subcategory")
        supplier: Optional[str] = Field(None, description="Supplier or vendor name")
        brand: Optional[str] = Field(None, description="Brand name")
        description: Optional[str] = Field(None, description="Product description")
        sku: Optional[str] = Field(None, description="Product SKU or code")
        stock_quantity: Optional[int] = Field(None, description="Stock quantity if available")
        minimum_order: Optional[str] = Field(None, description="Minimum order quantity")
        discount: Optional[str] = Field(None, description="Discount information")
        validity: Optional[str] = Field(None, description="Price validity period")
        notes: Optional[str] = Field(None, description="Additional notes")
        confidence: float = Field(0.0, description="AI confidence score (0-1)")
        
        @validator('price')
        def validate_price(cls, v):
            if v is not None and v < 0:
                raise ValueError('Price cannot be negative')
            return v
        
        @validator('confidence')
        def validate_confidence(cls, v):
            return max(0.0, min(1.0, v))

    class StructuringResult(BaseModel):
        """Result of AI structuring process"""
        products: List[ProductData]
        metadata: Dict[str, Any]
        processing_stats: Dict[str, Any]
        success: bool
        error: Optional[str] = None
else:
    # Fallback classes without pydantic
    class ProductData:
        def __init__(self, **kwargs):
            for key, value in kwargs.items():
                setattr(self, key, value)
    
    class StructuringResult:
        def __init__(self, **kwargs):
            for key, value in kwargs.items():
                setattr(self, key, value)


class AIStructuringService:
    """AI service for structuring extracted data using GPT-o3 function calling"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        
        # Configuration
        self.api_key = self.config.get('openai_api_key') or os.getenv('OPENAI_API_KEY')
        self.model = self.config.get('model', 'gpt-o3')
        self.max_tokens = self.config.get('max_tokens', 4000)
        self.temperature = self.config.get('temperature', 0.1)
        self.batch_size = self.config.get('batch_size', 10)
        self.max_retries = self.config.get('max_retries', 3)
        self.timeout = self.config.get('timeout', 60)
        
        # Quality thresholds
        self.min_confidence = self.config.get('min_confidence', 0.7)
        self.require_price = self.config.get('require_price', True)
        self.require_name = self.config.get('require_name', True)
        
        # Initialize OpenAI client
        if OPENAI_AVAILABLE and self.api_key:
            self.client = OpenAI(api_key=self.api_key)
            self.enabled = True
        else:
            self.client = None
            self.enabled = False
        
        # Initialize cache service
        cache_config = self.config.get('cache_config', {})
        if CACHE_AVAILABLE and cache_config.get('enabled', True):
            self.cache_service = AICacheService(cache_config)
            self.cache_enabled = self.cache_service.enabled
        else:
            self.cache_service = None
            self.cache_enabled = False
        
        print(f"[INFO] AI Structuring Service initialized", file=sys.stderr)
        print(f"[INFO] OpenAI: {'✓' if OPENAI_AVAILABLE else '✗'}", file=sys.stderr)
        print(f"[INFO] API Key: {'✓' if self.api_key else '✗'}", file=sys.stderr)
        print(f"[INFO] Cache: {'✓' if self.cache_enabled else '✗'}", file=sys.stderr)
        print(f"[INFO] Model: {self.model}", file=sys.stderr)
    
    def structure_extracted_data(self, extracted_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Structure extracted data using AI function calling
        
        Args:
            extracted_data: Raw data from table extraction or OCR
            
        Returns:
            Structured product data with standardized schema
        """
        start_time = time.time()
        
        print(f"[INFO] Starting AI structuring of extracted data", file=sys.stderr)
        
        if not self.enabled:
            return self._create_fallback_result(extracted_data, "AI service not available")
        
        result = {
            "products": [],
            "metadata": {
                "input_data_type": extracted_data.get("data_type", "unknown"),
                "total_input_rows": 0,
                "processed_rows": 0,
                "skipped_rows": 0,
                "ai_model": self.model,
                "processing_time_ms": 0,
                "token_usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                "api_calls": 0,
                "confidence_scores": []
            },
            "processing_stats": {
                "high_confidence_products": 0,
                "medium_confidence_products": 0,
                "low_confidence_products": 0,
                "products_with_prices": 0,
                "products_with_categories": 0,
                "validation_errors": []
            },
            "success": False,
            "error": None
        }
        
        try:
            # Prepare data for AI processing
            prepared_data = self._prepare_data_for_ai(extracted_data)
            result["metadata"]["total_input_rows"] = len(prepared_data)
            
            if not prepared_data:
                result["error"] = "No valid data to process"
                return result
            
            # Process data in batches
            all_products = []
            total_token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
            total_api_calls = 0
            
            for batch_idx, batch in enumerate(self._create_batches(prepared_data)):
                print(f"[INFO] Processing batch {batch_idx + 1}/{len(list(self._create_batches(prepared_data)))}", file=sys.stderr)
                
                batch_result = self._process_batch_with_ai(batch, batch_idx)
                
                if batch_result["success"]:
                    all_products.extend(batch_result["products"])
                    
                    # Update token usage
                    batch_tokens = batch_result.get("token_usage", {})
                    for key in total_token_usage:
                        total_token_usage[key] += batch_tokens.get(key, 0)
                    
                    total_api_calls += 1
                    result["metadata"]["processed_rows"] += len(batch)
                else:
                    print(f"[WARNING] Batch {batch_idx + 1} failed: {batch_result.get('error')}", file=sys.stderr)
                    result["metadata"]["skipped_rows"] += len(batch)
            
            # Post-process and validate products
            validated_products = self._validate_and_enhance_products(all_products)
            
            # Calculate statistics
            stats = self._calculate_processing_stats(validated_products)
            
            result["products"] = [p.__dict__ if hasattr(p, '__dict__') else p for p in validated_products]
            result["metadata"]["token_usage"] = total_token_usage
            result["metadata"]["api_calls"] = total_api_calls
            result["metadata"]["confidence_scores"] = [p.confidence if hasattr(p, 'confidence') else 0.0 for p in validated_products]
            result["processing_stats"].update(stats)
            result["success"] = True
            
            print(f"[INFO] AI structuring completed: {len(validated_products)} products structured", file=sys.stderr)
            
        except Exception as e:
            result["error"] = str(e)
            result["success"] = False
            print(f"[ERROR] AI structuring failed: {e}", file=sys.stderr)
        
        finally:
            result["metadata"]["processing_time_ms"] = int((time.time() - start_time) * 1000)
        
        return result
    
    def _prepare_data_for_ai(self, extracted_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Prepare extracted data for AI processing"""
        
        prepared_rows = []
        
        # Handle different input data formats
        if "tables" in extracted_data:
            # Data from table extraction
            for table in extracted_data["tables"]:
                table_data = table.get("data", [])
                headers = table.get("headers", [])
                
                for row in table_data:
                    if self._is_valid_data_row(row):
                        row_dict = {}
                        if headers:
                            for i, value in enumerate(row):
                                header = headers[i] if i < len(headers) else f"column_{i+1}"
                                row_dict[header] = value
                        else:
                            row_dict = {f"column_{i+1}": value for i, value in enumerate(row)}
                        
                        row_dict["_source_table"] = table.get("table_id", "unknown")
                        row_dict["_source_page"] = table.get("page", 1)
                        prepared_rows.append(row_dict)
        
        elif "sheets" in extracted_data:
            # Data from Excel extraction
            for sheet_name, sheet_data in extracted_data["sheets"].items():
                for row in sheet_data.get("data", []):
                    if isinstance(row, dict) and self._is_valid_data_row(list(row.values())):
                        row["_source_sheet"] = sheet_name
                        prepared_rows.append(row)
        
        elif "text_content" in extracted_data:
            # Data from text extraction - need to parse
            text_lines = extracted_data["text_content"].split('\n')
            for i, line in enumerate(text_lines):
                if line.strip() and self._looks_like_product_line(line):
                    prepared_rows.append({
                        "raw_text": line.strip(),
                        "_source_line": i + 1
                    })
        
        return prepared_rows
    
    def _is_valid_data_row(self, row: List[Any]) -> bool:
        """Check if a row contains valid product data"""
        
        if not row:
            return False
        
        # Check if row has any non-empty content
        non_empty_cells = [cell for cell in row if cell and str(cell).strip()]
        if len(non_empty_cells) < 2:  # Need at least 2 non-empty cells
            return False
        
        # Check if row looks like header (all strings, no numbers)
        string_cells = [cell for cell in non_empty_cells if isinstance(cell, str)]
        if len(string_cells) == len(non_empty_cells) and len(non_empty_cells) > 3:
            # Might be header if all cells are strings and there are many of them
            header_keywords = ['name', 'product', 'price', 'unit', 'category', 'supplier']
            if any(keyword in str(cell).lower() for cell in non_empty_cells for keyword in header_keywords):
                return False  # This is likely a header row
        
        return True
    
    def _looks_like_product_line(self, line: str) -> bool:
        """Check if a text line looks like product information"""
        
        # Skip very short lines
        if len(line.strip()) < 10:
            return False
        
        # Skip lines that look like headers or metadata
        skip_patterns = [
            r'^(page|table|sheet|document|file)',
            r'^(total|subtotal|grand total)',
            r'^(date|time|generated|created)',
            r'^\d+\s*$',  # Just numbers
            r'^[A-Z\s]+$'  # All caps (likely headers)
        ]
        
        for pattern in skip_patterns:
            if re.match(pattern, line.strip(), re.IGNORECASE):
                return False
        
        # Look for product-like patterns
        product_indicators = [
            r'\d+[.,]\d+',  # Numbers (prices)
            r'(kg|liter|piece|pcs|unit|box|pack)',  # Units
            r'(rp|idr|\$|usd|eur)',  # Currency
        ]
        
        for pattern in product_indicators:
            if re.search(pattern, line, re.IGNORECASE):
                return True
        
        return False
    
    def _create_batches(self, data: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
        """Create batches for processing"""
        
        batches = []
        for i in range(0, len(data), self.batch_size):
            batch = data[i:i + self.batch_size]
            batches.append(batch)
        
        return batches
    
    def _process_batch_with_ai(self, batch: List[Dict[str, Any]], batch_idx: int) -> Dict[str, Any]:
        """Process a batch of data with AI function calling"""
        
        try:
            # Create function calling schema
            function_schema = self._get_function_schema()
            
            # Prepare prompt
            prompt = self._create_structured_prompt(batch)
            
            # Prepare cache key data
            cache_input = {
                "prompt": prompt,
                "system_prompt": self._get_system_prompt(),
                "function_schema": function_schema,
                "batch_size": len(batch)
            }
            
            api_params = {
                "temperature": self.temperature,
                "max_tokens": self.max_tokens,
                "function_call": {"name": "structure_product_data"}
            }
            
            # Try to get from cache first
            if self.cache_enabled:
                cached_response = self.cache_service.get_ai_response(
                    cache_input, 
                    model=self.model,
                    **api_params
                )
                if cached_response:
                    print(f"[INFO] Using cached AI response for batch {batch_idx}", file=sys.stderr)
                    return cached_response
            
            # Call OpenAI API
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": self._get_system_prompt()
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                functions=[function_schema],
                function_call={"name": "structure_product_data"},
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                timeout=self.timeout
            )
            
            # Parse function call response
            if response.choices[0].message.function_call:
                function_args = json.loads(response.choices[0].message.function_call.arguments)
                products = self._parse_function_response(function_args)
                
                result = {
                    "success": True,
                    "products": products,
                    "token_usage": {
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens
                    }
                }
                
                # Cache the successful response
                if self.cache_enabled:
                    self.cache_service.cache_ai_response(
                        cache_input,
                        result,
                        model=self.model,
                        **api_params
                    )
                    print(f"[INFO] Cached AI response for batch {batch_idx}", file=sys.stderr)
                
                return result
            else:
                error_result = {
                    "success": False,
                    "error": "No function call in response",
                    "products": []
                }
                
                # Don't cache failed responses, but log for debugging
                print(f"[WARNING] No function call in AI response for batch {batch_idx}", file=sys.stderr)
                return error_result
        
        except Exception as e:
            print(f"[WARNING] AI processing failed for batch {batch_idx}: {e}", file=sys.stderr)
            return {
                "success": False,
                "error": str(e),
                "products": []
            }
    
    def _get_system_prompt(self) -> str:
        """Get system prompt for AI structuring"""
        
        return """You are an expert data analyst specializing in extracting and structuring product information from Indonesian supplier documents, price lists, and catalogs.

Your task is to analyze the provided data and extract structured product information. Focus on:

1. **Product Names**: Clean and normalize product names, remove excessive whitespace
2. **Prices**: Extract numerical prices, identify currency (usually IDR for Indonesian suppliers)
3. **Units**: Identify units of measurement (kg, liter, piece, box, pack, etc.)
4. **Categories**: Infer logical product categories (Food & Beverage, Electronics, etc.)
5. **Suppliers**: Extract supplier or vendor information when available

Important guidelines:
- Be conservative with confidence scores - only give high confidence (>0.8) when you're very certain
- If price information is unclear or missing, set confidence lower
- Normalize Indonesian product names but preserve original meaning
- Handle composite prices like "Rp 15,000/kg" or "2 pcs @ Rp 5,000"
- Skip obviously invalid rows (headers, totals, empty rows)
- For unclear data, provide your best interpretation but lower the confidence score

Always use the structure_product_data function to return results."""
    
    def _get_function_schema(self) -> Dict[str, Any]:
        """Get OpenAI function calling schema"""
        
        return {
            "name": "structure_product_data",
            "description": "Structure raw product data into standardized format",
            "parameters": {
                "type": "object",
                "properties": {
                    "products": {
                        "type": "array",
                        "description": "Array of structured product data",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {
                                    "type": "string",
                                    "description": "Clean product name"
                                },
                                "unit": {
                                    "type": "string",
                                    "description": "Unit of measurement (kg, liter, piece, etc.)"
                                },
                                "price": {
                                    "type": "number",
                                    "description": "Numerical price value"
                                },
                                "price_text": {
                                    "type": "string",
                                    "description": "Original price text from source"
                                },
                                "currency": {
                                    "type": "string",
                                    "description": "Currency code (IDR, USD, etc.)",
                                    "default": "IDR"
                                },
                                "category": {
                                    "type": "string",
                                    "description": "Product category"
                                },
                                "subcategory": {
                                    "type": "string",
                                    "description": "Product subcategory"
                                },
                                "supplier": {
                                    "type": "string",
                                    "description": "Supplier name"
                                },
                                "brand": {
                                    "type": "string",
                                    "description": "Brand name"
                                },
                                "description": {
                                    "type": "string",
                                    "description": "Additional product description"
                                },
                                "sku": {
                                    "type": "string",
                                    "description": "Product SKU or code"
                                },
                                "minimum_order": {
                                    "type": "string",
                                    "description": "Minimum order quantity"
                                },
                                "confidence": {
                                    "type": "number",
                                    "description": "Confidence score from 0.0 to 1.0",
                                    "minimum": 0.0,
                                    "maximum": 1.0
                                }
                            },
                            "required": ["name", "confidence"]
                        }
                    }
                },
                "required": ["products"]
            }
        }
    
    def _create_structured_prompt(self, batch: List[Dict[str, Any]]) -> str:
        """Create structured prompt for AI processing"""
        
        prompt_parts = [
            "Please analyze the following product data and structure it using the provided function schema.",
            "",
            "Data to process:",
            ""
        ]
        
        for i, row in enumerate(batch, 1):
            row_text = f"Row {i}: "
            
            if "raw_text" in row:
                # Text-based data
                row_text += row["raw_text"]
            else:
                # Tabular data
                row_parts = []
                for key, value in row.items():
                    if not key.startswith("_") and value:  # Skip metadata fields
                        row_parts.append(f"{key}: {value}")
                row_text += " | ".join(row_parts)
            
            prompt_parts.append(row_text)
        
        prompt_parts.extend([
            "",
            "Please extract and structure product information from this data. Focus on identifying:",
            "- Product names and descriptions",
            "- Prices and units",
            "- Categories and suppliers",
            "- Any other relevant product attributes",
            "",
            "Return only valid products with appropriate confidence scores."
        ])
        
        return "\n".join(prompt_parts)
    
    def _parse_function_response(self, function_args: Dict[str, Any]) -> List[ProductData]:
        """Parse function calling response into ProductData objects"""
        
        products = []
        
        for product_data in function_args.get("products", []):
            try:
                if PYDANTIC_AVAILABLE:
                    product = ProductData(**product_data)
                else:
                    product = ProductData(**product_data)
                
                products.append(product)
                
            except Exception as e:
                print(f"[WARNING] Failed to parse product data: {e}", file=sys.stderr)
                print(f"[WARNING] Product data: {product_data}", file=sys.stderr)
        
        return products
    
    def _validate_and_enhance_products(self, products: List[ProductData]) -> List[ProductData]:
        """Validate and enhance product data"""
        
        validated_products = []
        
        for product in products:
            try:
                # Basic validation
                if not self._is_valid_product(product):
                    continue
                
                # Enhance product data
                enhanced_product = self._enhance_product_data(product)
                
                validated_products.append(enhanced_product)
                
            except Exception as e:
                print(f"[WARNING] Product validation failed: {e}", file=sys.stderr)
        
        return validated_products
    
    def _is_valid_product(self, product: ProductData) -> bool:
        """Validate product data quality"""
        
        # Check required fields
        if self.require_name and (not hasattr(product, 'name') or not product.name or not product.name.strip()):
            return False
        
        if self.require_price and (not hasattr(product, 'price') or product.price is None or product.price <= 0):
            return False
        
        # Check minimum confidence
        confidence = getattr(product, 'confidence', 0.0)
        if confidence < self.min_confidence:
            return False
        
        return True
    
    def _enhance_product_data(self, product: ProductData) -> ProductData:
        """Enhance and normalize product data"""
        
        # Normalize product name
        if hasattr(product, 'name') and product.name:
            product.name = self._normalize_product_name(product.name)
        
        # Normalize units
        if hasattr(product, 'unit') and product.unit:
            product.unit = self._normalize_unit(product.unit)
        
        # Set default currency
        if not hasattr(product, 'currency') or not product.currency:
            product.currency = "IDR"
        
        # Infer category if missing
        if hasattr(product, 'name') and product.name and (not hasattr(product, 'category') or not product.category):
            product.category = self._infer_category(product.name)
        
        return product
    
    def _normalize_product_name(self, name: str) -> str:
        """Normalize product name"""
        
        # Clean whitespace
        normalized = " ".join(name.split())
        
        # Remove common prefixes/suffixes
        prefixes_to_remove = ['item:', 'product:', 'barang:']
        for prefix in prefixes_to_remove:
            if normalized.lower().startswith(prefix):
                normalized = normalized[len(prefix):].strip()
        
        # Capitalize first letter of each word
        normalized = normalized.title()
        
        return normalized
    
    def _normalize_unit(self, unit: str) -> str:
        """Normalize unit of measurement"""
        
        unit_mappings = {
            'kilogram': 'kg',
            'kilo': 'kg',
            'liter': 'liter',
            'litre': 'liter',
            'pieces': 'piece',
            'pcs': 'piece',
            'units': 'unit',
            'boxes': 'box',
            'packs': 'pack',
            'bottles': 'bottle',
            'cans': 'can'
        }
        
        normalized = unit.lower().strip()
        return unit_mappings.get(normalized, normalized)
    
    def _infer_category(self, product_name: str) -> str:
        """Infer product category from name"""
        
        name_lower = product_name.lower()
        
        category_keywords = {
            'Food & Beverage': ['rice', 'bread', 'milk', 'coffee', 'tea', 'juice', 'water', 'snack', 'biscuit'],
            'Vegetables': ['tomato', 'carrot', 'onion', 'potato', 'cabbage', 'lettuce', 'spinach'],
            'Fruits': ['apple', 'banana', 'orange', 'mango', 'grape', 'pineapple', 'watermelon'],
            'Meat & Seafood': ['chicken', 'beef', 'pork', 'fish', 'shrimp', 'crab', 'salmon'],
            'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream'],
            'Cleaning': ['soap', 'detergent', 'shampoo', 'sanitizer', 'bleach'],
            'Office Supplies': ['paper', 'pen', 'pencil', 'folder', 'stapler']
        }
        
        for category, keywords in category_keywords.items():
            if any(keyword in name_lower for keyword in keywords):
                return category
        
        return "General"
    
    def _calculate_processing_stats(self, products: List[ProductData]) -> Dict[str, Any]:
        """Calculate processing statistics"""
        
        stats = {
            "high_confidence_products": 0,
            "medium_confidence_products": 0,
            "low_confidence_products": 0,
            "products_with_prices": 0,
            "products_with_categories": 0,
            "validation_errors": []
        }
        
        for product in products:
            confidence = getattr(product, 'confidence', 0.0)
            
            if confidence >= 0.8:
                stats["high_confidence_products"] += 1
            elif confidence >= 0.6:
                stats["medium_confidence_products"] += 1
            else:
                stats["low_confidence_products"] += 1
            
            if hasattr(product, 'price') and product.price is not None:
                stats["products_with_prices"] += 1
            
            if hasattr(product, 'category') and product.category:
                stats["products_with_categories"] += 1
        
        return stats
    
    def _create_fallback_result(self, extracted_data: Dict[str, Any], error_message: str) -> Dict[str, Any]:
        """Create fallback result when AI is not available"""
        
        return {
            "products": [],
            "metadata": {
                "input_data_type": extracted_data.get("data_type", "unknown"),
                "total_input_rows": 0,
                "processed_rows": 0,
                "ai_model": "fallback",
                "processing_time_ms": 0,
                "token_usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
            },
            "processing_stats": {
                "high_confidence_products": 0,
                "medium_confidence_products": 0,
                "low_confidence_products": 0
            },
            "success": False,
            "error": error_message
        }


def main():
    """CLI interface for AI structuring"""
    
    if len(sys.argv) < 2:
        print("Usage: python ai_structuring_service.py <extracted_data_json> [output_json]", file=sys.stderr)
        sys.exit(1)
    
    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)
    
    # Configuration from environment
    config = {
        "openai_api_key": os.getenv("OPENAI_API_KEY"),
        "model": os.getenv("AI_MODEL", "gpt-o3"),
        "max_tokens": int(os.getenv("MAX_TOKENS", "4000")),
        "batch_size": int(os.getenv("BATCH_SIZE", "10")),
        "min_confidence": float(os.getenv("MIN_CONFIDENCE", "0.7"))
    }
    
    try:
        # Load extracted data
        with open(input_path, 'r', encoding='utf-8') as f:
            extracted_data = json.load(f)
        
        # Structure data with AI
        ai_service = AIStructuringService(config)
        result = ai_service.structure_extracted_data(extracted_data)
        
        # Output result
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            print(f"[INFO] Results saved to {output_path}", file=sys.stderr)
        else:
            print(f"AI_STRUCTURING_RESULT:{json.dumps(result)}")
        
        # Summary to stderr
        metadata = result["metadata"]
        stats = result["processing_stats"]
        print(f"[SUMMARY] Products: {len(result['products'])}, "
              f"High confidence: {stats['high_confidence_products']}, "
              f"Tokens: {metadata['token_usage']['total_tokens']}, "
              f"Time: {metadata['processing_time_ms']}ms", file=sys.stderr)
        
    except Exception as e:
        print(f"[ERROR] AI structuring failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()