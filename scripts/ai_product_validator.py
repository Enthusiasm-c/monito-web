#!/usr/bin/env python3
"""
AI Product Validator using GPT-4.1-mini
Validates and cleans extracted product data cheaply and efficiently
"""

import os
import json
import requests
import sys
from typing import List, Dict, Any, Tuple
import time

class AIProductValidator:
    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        self.api_key = api_key
        self.model = model
        self.api_url = "https://api.openai.com/v1/chat/completions"
        
    def validate_products_batch(self, products: List[Dict[str, Any]], supplier_name: str = "") -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """Validate and clean a batch of products using AI"""
        
        if not products:
            return [], {"tokens_used": 0, "cost_usd": 0.0, "validation_results": {}}
        
        # Prepare products for validation (increased batch size)
        batch_size = int(os.getenv('AI_VALIDATION_BATCH_SIZE', '200'))
        products_for_validation = []
        for i, product in enumerate(products[:batch_size]):
            products_for_validation.append({
                "id": i,
                "name": product.get("name", ""),
                "price": product.get("price", 0),
                "unit": product.get("unit", ""),
                "category": product.get("category"),
                "description": product.get("description")
            })
        
        prompt = f"""You are a product data validator for a price comparison system. 

TASK: Validate and clean the following extracted product data from a supplier price list.

SUPPLIER: {supplier_name or "Unknown"}

PRODUCTS TO VALIDATE:
{json.dumps(products_for_validation, indent=2)}

VALIDATION RULES:
1. REJECT products with invalid names:
   - Pure numbers (like "1", "10", "123")
   - Units only (like "1 kg", "500ml", "2 x 3")
   - Single letters or symbols
   - Empty or very short names (< 3 chars)

2. CLEAN product names:
   - Remove leading/trailing numbers if they're row numbers
   - Fix obvious typos and formatting
   - Standardize capitalization
   - Remove redundant text

3. VALIDATE prices:
   - Must be positive numbers
   - Reasonable for the product type
   - In correct currency (IDR assumed)

4. CLEAN units:
   - Standardize units (kg, gr, ltr, pcs, etc.)
   - Fix formatting issues

5. IMPROVE categories:
   - Assign appropriate categories based on product names
   - Use: dairy, meat, seafood, vegetables, fruits, grains, spices, beverages, bakery, other

RETURN FORMAT - JSON only:
{{
  "validated_products": [
    {{
      "id": 0,
      "valid": true/false,
      "cleaned_name": "Cleaned Product Name",
      "original_name": "Original Name",
      "price": 123.45,
      "unit": "kg",
      "category": "dairy",
      "confidence": 0.95,
      "issues": ["list of issues found"]
    }}
  ],
  "summary": {{
    "total_input": 50,
    "valid_products": 45,
    "rejected_products": 5,
    "common_issues": ["issue1", "issue2"]
  }}
}}

Return ONLY the JSON, no explanations."""

        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}"
            }
            
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 8000,
                "temperature": 0.1
            }
            
            start_time = time.time()
            response = requests.post(self.api_url, headers=headers, json=payload, timeout=60)
            api_time = time.time() - start_time
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                usage = result.get('usage', {})
                
                # Parse JSON response
                try:
                    # Extract JSON from response
                    start_idx = content.find('{')
                    end_idx = content.rfind('}') + 1
                    if start_idx != -1 and end_idx != -1:
                        json_str = content[start_idx:end_idx]
                        validation_result = json.loads(json_str)
                        
                        # Process validated products
                        cleaned_products = []
                        validation_stats = {
                            "total_input": len(products_for_validation),
                            "valid_products": 0,
                            "rejected_products": 0,
                            "cleaned_products": 0,
                            "tokens_used": usage.get('total_tokens', 0),
                            "cost_usd": self.calculate_cost(usage.get('total_tokens', 0)),
                            "api_time_s": api_time
                        }
                        
                        for validated_product in validation_result.get('validated_products', []):
                            if validated_product.get('valid', False):
                                original_product = products[validated_product['id']]
                                
                                # Create cleaned product
                                cleaned_product = {
                                    **original_product,  # Keep original fields
                                    "name": validated_product.get('cleaned_name', original_product.get('name')),
                                    "category": validated_product.get('category', original_product.get('category')),
                                    "unit": validated_product.get('unit', original_product.get('unit')),
                                    "validation": {
                                        "confidence": validated_product.get('confidence', 0.8),
                                        "issues": validated_product.get('issues', []),
                                        "cleaned": validated_product.get('cleaned_name') != original_product.get('name')
                                    }
                                }
                                
                                cleaned_products.append(cleaned_product)
                                validation_stats["valid_products"] += 1
                                
                                if validated_product.get('cleaned_name') != original_product.get('name'):
                                    validation_stats["cleaned_products"] += 1
                            else:
                                validation_stats["rejected_products"] += 1
                        
                        print(f"[INFO] ✅ AI Validation completed: {validation_stats['valid_products']}/{validation_stats['total_input']} products valid")
                        print(f"[INFO] 🧹 Cleaned {validation_stats['cleaned_products']} product names")
                        print(f"[INFO] ❌ Rejected {validation_stats['rejected_products']} invalid products")
                        cost_str = f"{validation_stats['cost_usd']:.4f}"
                        print(f"[INFO] 💰 Cost: ${cost_str} ({validation_stats['tokens_used']} tokens)")
                        
                        return cleaned_products, validation_stats
                        
                except json.JSONDecodeError as e:
                    print(f"[ERROR] Failed to parse AI validation response: {e}")
                    print(f"[DEBUG] Response content: {content[:500]}...")
                    
            else:
                print(f"[ERROR] AI validation API error: {response.status_code} - {response.text}")
                
        except Exception as e:
            print(f"[ERROR] AI validation failed: {e}")
        
        # Return original products if validation fails
        return products, {"tokens_used": 0, "cost_usd": 0.0, "validation_failed": True}
    
    def calculate_cost(self, tokens: int) -> float:
        """Calculate cost for GPT-4o-mini"""
        # GPT-4o-mini pricing: $0.00015 per 1K input tokens, $0.0006 per 1K output tokens
        # Assume 80% input, 20% output tokens
        input_tokens = int(tokens * 0.8)
        output_tokens = int(tokens * 0.2)
        
        input_cost = (input_tokens / 1000) * 0.00015
        output_cost = (output_tokens / 1000) * 0.0006
        
        return input_cost + output_cost

def main():
    if len(sys.argv) < 3:
        print("Usage: python ai_product_validator.py <products_json> <api_key> [supplier_name]")
        sys.exit(1)
    
    products_json = sys.argv[1]
    api_key = sys.argv[2]
    supplier_name = sys.argv[3] if len(sys.argv) > 3 else ""
    
    try:
        # Parse products from JSON string or file
        if products_json.startswith('[') or products_json.startswith('{'):
            products = json.loads(products_json)
        else:
            with open(products_json, 'r') as f:
                products = json.load(f)
        
        validator = AIProductValidator(api_key)
        validated_products, stats = validator.validate_products_batch(products, supplier_name)
        
        # Output results
        result = {
            "validated_products": validated_products,
            "validation_stats": stats
        }
        
        print("=== AI_VALIDATION_JSON_START ===")
        print(json.dumps(result, indent=2))
        print("=== AI_VALIDATION_JSON_END ===")
        
    except Exception as e:
        print(f"[ERROR] Validation failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()