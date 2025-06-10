#!/usr/bin/env python3
"""
Product Normalizer with Fuzzy Matching
Implements Task 8: Product normalization with fuzzy matching

Features:
- Fuzzy string matching with rapidfuzz for product name deduplication
- Unit normalization and conversion with pint
- Price normalization across different formats
- Supplier name standardization
- Category consolidation and hierarchy
- Confidence scoring for matches
- Bulk processing optimization
"""

import sys
import os
import json
import time
import re
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Set
import logging
from collections import defaultdict, Counter

# rapidfuzz for fuzzy string matching
try:
    from rapidfuzz import fuzz, process
    RAPIDFUZZ_AVAILABLE = True
except ImportError:
    print("[WARNING] rapidfuzz not available, fuzzy matching disabled", file=sys.stderr)
    RAPIDFUZZ_AVAILABLE = False

# pint for unit handling and conversion
try:
    import pint
    from pint import UnitRegistry
    PINT_AVAILABLE = True
except ImportError:
    print("[WARNING] pint not available, unit normalization limited", file=sys.stderr)
    PINT_AVAILABLE = False

# pandas for data manipulation
try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    print("[WARNING] pandas not available, limited data processing", file=sys.stderr)
    PANDAS_AVAILABLE = False


class ProductNormalizer:
    """Product normalizer with fuzzy matching capabilities"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        
        # Fuzzy matching configuration
        self.name_similarity_threshold = self.config.get('name_similarity_threshold', 85)
        self.supplier_similarity_threshold = self.config.get('supplier_similarity_threshold', 90)
        self.category_similarity_threshold = self.config.get('category_similarity_threshold', 80)
        
        # Normalization options
        self.normalize_units = self.config.get('normalize_units', True)
        self.normalize_prices = self.config.get('normalize_prices', True)
        self.merge_similar_products = self.config.get('merge_similar_products', True)
        self.standardize_suppliers = self.config.get('standardize_suppliers', True)
        
        # Performance settings
        self.batch_size = self.config.get('batch_size', 100)
        self.use_preprocessing = self.config.get('use_preprocessing', True)
        
        # Initialize unit registry
        if PINT_AVAILABLE:
            self.ureg = UnitRegistry()
            self._setup_custom_units()
        else:
            self.ureg = None
        
        # Initialize caches for performance
        self._name_cache = {}
        self._unit_cache = {}
        self._supplier_cache = {}
        
        print(f"[INFO] Product Normalizer initialized", file=sys.stderr)
        print(f"[INFO] rapidfuzz: {'✓' if RAPIDFUZZ_AVAILABLE else '✗'}", file=sys.stderr)
        print(f"[INFO] pint: {'✓' if PINT_AVAILABLE else '✗'}", file=sys.stderr)
        print(f"[INFO] pandas: {'✓' if PANDAS_AVAILABLE else '✗'}", file=sys.stderr)
    
    def normalize_products(self, products: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Normalize and deduplicate products using fuzzy matching
        
        Args:
            products: List of product dictionaries
            
        Returns:
            Dict containing normalized products and processing metadata
        """
        start_time = time.time()
        
        print(f"[INFO] Starting product normalization for {len(products)} products", file=sys.stderr)
        
        result = {
            "normalized_products": [],
            "duplicates_found": [],
            "metadata": {
                "input_products": len(products),
                "output_products": 0,
                "duplicates_merged": 0,
                "units_normalized": 0,
                "prices_normalized": 0,
                "suppliers_standardized": 0,
                "processing_time_ms": 0
            },
            "normalization_stats": {
                "name_normalizations": 0,
                "unit_conversions": 0,
                "price_standardizations": 0,
                "category_consolidations": 0,
                "confidence_scores": []
            },
            "success": False,
            "error": None
        }
        
        try:
            if not products:
                result["success"] = True
                return result
            
            # Step 1: Individual product normalization
            normalized_products = []
            for product in products:
                normalized_product = self._normalize_single_product(product)
                normalized_products.append(normalized_product)
            
            # Step 2: Find and merge duplicates
            if self.merge_similar_products:
                deduplicated_products, duplicates = self._find_and_merge_duplicates(normalized_products)
                result["duplicates_found"] = duplicates
                result["metadata"]["duplicates_merged"] = len(duplicates)
            else:
                deduplicated_products = normalized_products
                result["duplicates_found"] = []
            
            # Step 3: Standardize suppliers
            if self.standardize_suppliers:
                deduplicated_products = self._standardize_suppliers(deduplicated_products)
            
            # Step 4: Final quality scoring
            final_products = []
            for product in deduplicated_products:
                quality_score = self._calculate_quality_score(product)
                product["quality_score"] = quality_score
                final_products.append(product)
            
            # Calculate statistics
            stats = self._calculate_normalization_stats(products, final_products)
            
            result["normalized_products"] = final_products
            result["metadata"]["output_products"] = len(final_products)
            result["metadata"].update(stats["metadata"])
            result["normalization_stats"].update(stats["normalization_stats"])
            result["success"] = True
            
            print(f"[INFO] Product normalization completed: {len(final_products)} products, "
                  f"{result['metadata']['duplicates_merged']} duplicates merged", file=sys.stderr)
            
        except Exception as e:
            result["error"] = str(e)
            result["success"] = False
            print(f"[ERROR] Product normalization failed: {e}", file=sys.stderr)
        
        finally:
            result["metadata"]["processing_time_ms"] = int((time.time() - start_time) * 1000)
        
        return result
    
    def _normalize_single_product(self, product: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize a single product"""
        
        normalized = product.copy()
        
        # Normalize product name
        if "name" in normalized and normalized["name"]:
            normalized["name"] = self._normalize_product_name(normalized["name"])
            normalized["name_normalized"] = True
        
        # Normalize unit
        if "unit" in normalized and normalized["unit"]:
            normalized_unit, confidence = self._normalize_unit(normalized["unit"])
            normalized["unit"] = normalized_unit
            normalized["unit_confidence"] = confidence
            normalized["unit_normalized"] = True
        
        # Normalize price
        if "price" in normalized:
            normalized_price = self._normalize_price(normalized.get("price"), normalized.get("price_text"))
            if normalized_price is not None:
                normalized["price"] = normalized_price
                normalized["price_normalized"] = True
        
        # Normalize category
        if "category" in normalized and normalized["category"]:
            normalized["category"] = self._normalize_category(normalized["category"])
            normalized["category_normalized"] = True
        
        # Normalize supplier name
        if "supplier" in normalized and normalized["supplier"]:
            normalized["supplier"] = self._normalize_supplier_name(normalized["supplier"])
            normalized["supplier_normalized"] = True
        
        # Add normalization metadata
        normalized["_normalization_applied"] = time.time()
        normalized["_original_data"] = {
            "name": product.get("name"),
            "unit": product.get("unit"),
            "price": product.get("price"),
            "category": product.get("category"),
            "supplier": product.get("supplier")
        }
        
        return normalized
    
    def _normalize_product_name(self, name: str) -> str:
        """Normalize product name"""
        
        if name in self._name_cache:
            return self._name_cache[name]
        
        # Basic cleaning
        normalized = name.strip()
        
        # Remove excessive whitespace
        normalized = re.sub(r'\s+', ' ', normalized)
        
        # Remove common prefixes/suffixes
        prefixes_to_remove = [
            r'^(item|product|barang)[\s:]+',
            r'^no[\.\s]*\d+[\.\s]*',
            r'^\d+[\.\)]\s*'
        ]
        
        for prefix in prefixes_to_remove:
            normalized = re.sub(prefix, '', normalized, flags=re.IGNORECASE).strip()
        
        # Standardize common terms
        standardizations = {
            r'\b(kg|kilo|kilogram)\b': 'kg',
            r'\b(gr|gram|grams)\b': 'g',
            r'\b(ltr|litre|liter)\b': 'liter',
            r'\b(pcs|pc|piece|pieces)\b': 'piece',
            r'\b(btl|bottle|bottles)\b': 'bottle',
            r'\b(pak|pack|package)\b': 'pack',
            r'\b(box|boxes)\b': 'box'
        }
        
        for pattern, replacement in standardizations.items():
            normalized = re.sub(pattern, replacement, normalized, flags=re.IGNORECASE)
        
        # Capitalize properly
        normalized = self._smart_capitalize(normalized)
        
        self._name_cache[name] = normalized
        return normalized
    
    def _smart_capitalize(self, text: str) -> str:
        """Smart capitalization for product names"""
        
        # Words that should stay lowercase
        lowercase_words = {'and', 'or', 'with', 'for', 'of', 'in', 'on', 'at', 'to', 'from'}
        
        words = text.split()
        capitalized_words = []
        
        for i, word in enumerate(words):
            if i == 0 or word.lower() not in lowercase_words:
                capitalized_words.append(word.capitalize())
            else:
                capitalized_words.append(word.lower())
        
        return ' '.join(capitalized_words)
    
    def _normalize_unit(self, unit: str) -> Tuple[str, float]:
        """Normalize unit with confidence score"""
        
        if unit in self._unit_cache:
            return self._unit_cache[unit]
        
        original_unit = unit.strip().lower()
        confidence = 1.0
        
        # Direct mappings for common units
        unit_mappings = {
            'kilogram': 'kg',
            'kilo': 'kg',
            'kilos': 'kg',
            'kilogramme': 'kg',
            'gram': 'g',
            'grams': 'g',
            'gramme': 'g',
            'liter': 'liter',
            'litre': 'liter',
            'litres': 'liter',
            'liters': 'liter',
            'milliliter': 'ml',
            'millilitre': 'ml',
            'piece': 'piece',
            'pieces': 'piece',
            'pcs': 'piece',
            'pc': 'piece',
            'unit': 'unit',
            'units': 'unit',
            'bottle': 'bottle',
            'bottles': 'bottle',
            'btl': 'bottle',
            'can': 'can',
            'cans': 'can',
            'pack': 'pack',
            'packs': 'pack',
            'package': 'pack',
            'box': 'box',
            'boxes': 'box',
            'dozen': 'dozen',
            'doz': 'dozen'
        }
        
        # Check direct mapping first
        if original_unit in unit_mappings:
            normalized = unit_mappings[original_unit]
        else:
            # Try fuzzy matching with known units
            if RAPIDFUZZ_AVAILABLE:
                matches = process.extract(original_unit, list(unit_mappings.keys()), limit=1, scorer=fuzz.ratio)
                if matches and matches[0][1] >= 80:  # 80% similarity threshold
                    normalized = unit_mappings[matches[0][0]]
                    confidence = matches[0][1] / 100.0
                else:
                    normalized = original_unit
                    confidence = 0.5
            else:
                normalized = original_unit
                confidence = 0.5
        
        # Use pint for unit validation if available
        if PINT_AVAILABLE and self.ureg:
            try:
                # Try to parse the unit with pint
                parsed_unit = self.ureg.parse_expression(normalized)
                # If successful, use pint's canonical form
                normalized = str(parsed_unit.units)
                confidence = min(confidence, 0.9)  # Slightly reduce confidence for pint parsing
            except:
                # If pint can't parse it, keep our normalized version
                pass
        
        result = (normalized, confidence)
        self._unit_cache[unit] = result
        return result
    
    def _normalize_price(self, price: Any, price_text: Optional[str] = None) -> Optional[float]:
        """Normalize price to a standard numeric format"""
        
        if price is not None and isinstance(price, (int, float)):
            return float(price)
        
        # Try to extract from price_text if price is None
        if price is None and price_text:
            price = price_text
        
        if not price:
            return None
        
        # Convert to string for processing
        price_str = str(price).strip()
        
        # Remove currency symbols and common prefixes
        price_str = re.sub(r'[Rp\$€£¥₹]', '', price_str)
        price_str = re.sub(r'(idr|usd|eur|gbp|jpy|inr)', '', price_str, flags=re.IGNORECASE)
        
        # Remove thousands separators (commas, dots in certain positions)
        # Handle Indonesian format: 15.000,50 or 15,000.50
        if ',' in price_str and '.' in price_str:
            # Determine which is decimal separator
            comma_pos = price_str.rfind(',')
            dot_pos = price_str.rfind('.')
            
            if comma_pos > dot_pos:
                # Comma is decimal separator (European format)
                price_str = price_str.replace('.', '').replace(',', '.')
            else:
                # Dot is decimal separator (US format)
                price_str = price_str.replace(',', '')
        elif ',' in price_str:
            # Only comma - could be thousands separator or decimal
            comma_pos = price_str.rfind(',')
            after_comma = price_str[comma_pos + 1:]
            if len(after_comma) <= 2 and after_comma.isdigit():
                # Likely decimal separator
                price_str = price_str.replace(',', '.')
            else:
                # Likely thousands separator
                price_str = price_str.replace(',', '')
        
        # Remove any remaining non-numeric characters except decimal point
        price_str = re.sub(r'[^\d.]', '', price_str)
        
        try:
            return float(price_str)
        except ValueError:
            return None
    
    def _normalize_category(self, category: str) -> str:
        """Normalize product category"""
        
        # Basic cleaning
        normalized = category.strip().title()
        
        # Category standardizations
        category_mappings = {
            'Food & Beverage': ['food', 'beverage', 'drink', 'makanan', 'minuman'],
            'Vegetables': ['vegetable', 'veggie', 'sayur', 'sayuran'],
            'Fruits': ['fruit', 'buah', 'buahan'],
            'Meat & Seafood': ['meat', 'seafood', 'fish', 'daging', 'ikan'],
            'Dairy': ['dairy', 'milk', 'cheese', 'susu', 'keju'],
            'Cleaning': ['cleaning', 'detergent', 'soap', 'pembersih', 'sabun'],
            'Office Supplies': ['office', 'supplies', 'stationery', 'alat tulis'],
            'Electronics': ['electronic', 'gadget', 'elektronik']
        }
        
        # Check for fuzzy matches
        if RAPIDFUZZ_AVAILABLE:
            for standard_category, keywords in category_mappings.items():
                for keyword in keywords:
                    if fuzz.partial_ratio(normalized.lower(), keyword.lower()) >= 70:
                        return standard_category
        
        return normalized
    
    def _normalize_supplier_name(self, supplier: str) -> str:
        """Normalize supplier name"""
        
        if supplier in self._supplier_cache:
            return self._supplier_cache[supplier]
        
        # Basic cleaning
        normalized = supplier.strip()
        
        # Remove common suffixes
        suffixes_to_remove = [
            r'\s*(co\.?|ltd\.?|inc\.?|corp\.?|llc)\.?\s*$',
            r'\s*(pt\.?|cv\.?|ud\.?)\s*$',
            r'\s*(company|corporation|limited)\s*$'
        ]
        
        for suffix in suffixes_to_remove:
            normalized = re.sub(suffix, '', normalized, flags=re.IGNORECASE).strip()
        
        # Standardize format
        normalized = normalized.title()
        
        self._supplier_cache[supplier] = normalized
        return normalized
    
    def _find_and_merge_duplicates(self, products: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Find and merge duplicate products using fuzzy matching"""
        
        if not RAPIDFUZZ_AVAILABLE:
            print("[WARNING] rapidfuzz not available, skipping duplicate detection", file=sys.stderr)
            return products, []
        
        print(f"[INFO] Finding duplicates among {len(products)} products", file=sys.stderr)
        
        # Build name index for efficiency
        name_to_products = defaultdict(list)
        for i, product in enumerate(products):
            name = product.get("name", "").lower()
            name_to_products[name].append((i, product))
        
        # Track processed products and duplicates
        processed_indices = set()
        deduplicated_products = []
        duplicates_found = []
        
        for i, product in enumerate(products):
            if i in processed_indices:
                continue
            
            # Find similar products
            similar_products = self._find_similar_products(product, products, i, processed_indices)
            
            if similar_products:
                # Merge similar products
                merged_product = self._merge_products([product] + similar_products)
                deduplicated_products.append(merged_product)
                
                # Mark similar products as processed
                for similar_product in similar_products:
                    for j, p in enumerate(products):
                        if p is similar_product:
                            processed_indices.add(j)
                            duplicates_found.append({
                                "original_index": j,
                                "merged_into": len(deduplicated_products) - 1,
                                "similarity_score": self._calculate_similarity(product, similar_product),
                                "product": similar_product
                            })
            else:
                # No duplicates found
                deduplicated_products.append(product)
            
            processed_indices.add(i)
        
        print(f"[INFO] Found {len(duplicates_found)} duplicates, "
              f"reduced from {len(products)} to {len(deduplicated_products)} products", file=sys.stderr)
        
        return deduplicated_products, duplicates_found
    
    def _find_similar_products(self, target_product: Dict[str, Any], all_products: List[Dict[str, Any]], 
                              target_index: int, processed_indices: Set[int]) -> List[Dict[str, Any]]:
        """Find products similar to the target product"""
        
        similar_products = []
        target_name = target_product.get("name", "").lower()
        
        for i, product in enumerate(all_products):
            if i == target_index or i in processed_indices:
                continue
            
            similarity_score = self._calculate_similarity(target_product, product)
            
            if similarity_score >= (self.name_similarity_threshold / 100.0):
                similar_products.append(product)
        
        return similar_products
    
    def _calculate_similarity(self, product1: Dict[str, Any], product2: Dict[str, Any]) -> float:
        """Calculate similarity score between two products"""
        
        if not RAPIDFUZZ_AVAILABLE:
            return 0.0
        
        # Name similarity (highest weight)
        name1 = product1.get("name", "").lower()
        name2 = product2.get("name", "").lower()
        name_score = fuzz.ratio(name1, name2) / 100.0
        
        # Unit similarity
        unit1 = product1.get("unit", "").lower()
        unit2 = product2.get("unit", "").lower()
        if unit1 and unit2:
            unit_score = fuzz.ratio(unit1, unit2) / 100.0
        else:
            unit_score = 0.5 if unit1 == unit2 else 0.0
        
        # Category similarity
        cat1 = product1.get("category", "").lower()
        cat2 = product2.get("category", "").lower()
        if cat1 and cat2:
            cat_score = fuzz.ratio(cat1, cat2) / 100.0
        else:
            cat_score = 0.5 if cat1 == cat2 else 0.0
        
        # Supplier similarity
        sup1 = product1.get("supplier", "").lower()
        sup2 = product2.get("supplier", "").lower()
        if sup1 and sup2:
            sup_score = fuzz.ratio(sup1, sup2) / 100.0
        else:
            sup_score = 0.5 if sup1 == sup2 else 0.0
        
        # Weighted combination
        total_score = (
            name_score * 0.6 +      # Name is most important
            unit_score * 0.2 +      # Unit is quite important
            cat_score * 0.1 +       # Category helps
            sup_score * 0.1         # Supplier helps
        )
        
        return total_score
    
    def _merge_products(self, products: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Merge multiple similar products into one"""
        
        if len(products) == 1:
            return products[0]
        
        # Use the product with highest confidence as base
        base_product = max(products, key=lambda p: p.get("confidence", 0.0))
        merged_product = base_product.copy()
        
        # Collect all values for averaging/choosing best
        prices = [p.get("price") for p in products if p.get("price") is not None]
        suppliers = [p.get("supplier") for p in products if p.get("supplier")]
        categories = [p.get("category") for p in products if p.get("category")]
        
        # Use average price if multiple prices
        if len(prices) > 1:
            merged_product["price"] = sum(prices) / len(prices)
            merged_product["price_range"] = {"min": min(prices), "max": max(prices)}
        
        # Use most common supplier
        if suppliers:
            supplier_counts = Counter(suppliers)
            merged_product["supplier"] = supplier_counts.most_common(1)[0][0]
        
        # Use most common category
        if categories:
            category_counts = Counter(categories)
            merged_product["category"] = category_counts.most_common(1)[0][0]
        
        # Add merge metadata
        merged_product["_merged_from"] = len(products)
        merged_product["_merged_products"] = [p.get("name", "") for p in products]
        merged_product["_merge_confidence"] = sum(p.get("confidence", 0.0) for p in products) / len(products)
        
        return merged_product
    
    def _standardize_suppliers(self, products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Standardize supplier names across all products"""
        
        if not RAPIDFUZZ_AVAILABLE:
            return products
        
        # Collect all unique suppliers
        suppliers = set()
        for product in products:
            supplier = product.get("supplier")
            if supplier:
                suppliers.add(supplier.strip())
        
        if not suppliers:
            return products
        
        # Find similar supplier names
        supplier_groups = self._group_similar_suppliers(list(suppliers))
        
        # Create mapping from old names to standardized names
        supplier_mapping = {}
        for group in supplier_groups:
            # Use the most common name in the group as standard
            standard_name = max(group, key=len)  # Use longest name as it's often most complete
            for supplier in group:
                supplier_mapping[supplier] = standard_name
        
        # Apply standardization
        standardized_products = []
        for product in products:
            standardized_product = product.copy()
            supplier = product.get("supplier")
            if supplier and supplier in supplier_mapping:
                standardized_product["supplier"] = supplier_mapping[supplier]
                standardized_product["supplier_standardized"] = True
            standardized_products.append(standardized_product)
        
        return standardized_products
    
    def _group_similar_suppliers(self, suppliers: List[str]) -> List[List[str]]:
        """Group similar supplier names together"""
        
        groups = []
        used_suppliers = set()
        
        for supplier in suppliers:
            if supplier in used_suppliers:
                continue
            
            # Find similar suppliers
            similar_group = [supplier]
            used_suppliers.add(supplier)
            
            for other_supplier in suppliers:
                if other_supplier in used_suppliers:
                    continue
                
                if fuzz.ratio(supplier.lower(), other_supplier.lower()) >= self.supplier_similarity_threshold:
                    similar_group.append(other_supplier)
                    used_suppliers.add(other_supplier)
            
            groups.append(similar_group)
        
        return groups
    
    def _calculate_quality_score(self, product: Dict[str, Any]) -> float:
        """Calculate quality score for a product"""
        
        score = 0.0
        
        # Name quality (30%)
        name = product.get("name", "")
        if name and len(name.strip()) > 3:
            score += 0.3
            if len(name.strip()) > 10:
                score += 0.1  # Bonus for detailed names
        
        # Price availability (25%)
        if product.get("price") is not None:
            score += 0.25
        
        # Unit availability (20%)
        if product.get("unit"):
            score += 0.2
            if product.get("unit_confidence", 0) > 0.8:
                score += 0.05  # Bonus for high unit confidence
        
        # Category availability (15%)
        if product.get("category"):
            score += 0.15
        
        # Supplier availability (10%)
        if product.get("supplier"):
            score += 0.1
        
        # Confidence bonus
        confidence = product.get("confidence", 0.0)
        score += confidence * 0.1  # Up to 10% bonus
        
        return min(1.0, score)
    
    def _calculate_normalization_stats(self, original_products: List[Dict[str, Any]], 
                                     normalized_products: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate normalization statistics"""
        
        metadata = {
            "units_normalized": sum(1 for p in normalized_products if p.get("unit_normalized")),
            "prices_normalized": sum(1 for p in normalized_products if p.get("price_normalized")),
            "suppliers_standardized": sum(1 for p in normalized_products if p.get("supplier_standardized"))
        }
        
        normalization_stats = {
            "name_normalizations": sum(1 for p in normalized_products if p.get("name_normalized")),
            "unit_conversions": sum(1 for p in normalized_products if p.get("unit_normalized")),
            "price_standardizations": sum(1 for p in normalized_products if p.get("price_normalized")),
            "category_consolidations": sum(1 for p in normalized_products if p.get("category_normalized")),
            "confidence_scores": [p.get("quality_score", 0.0) for p in normalized_products]
        }
        
        return {
            "metadata": metadata,
            "normalization_stats": normalization_stats
        }
    
    def _setup_custom_units(self):
        """Setup custom units for Indonesian context"""
        
        if not self.ureg:
            return
        
        try:
            # Define custom units common in Indonesian markets
            self.ureg.define('ikat = 1 * bundle')  # Bundle (common for vegetables)
            self.ureg.define('papan = 1 * board')  # Board (for wood products)
            self.ureg.define('lembar = 1 * sheet') # Sheet (for paper products)
            self.ureg.define('butir = 1 * grain')  # Grain (for small items)
            self.ureg.define('ekor = 1 * piece')   # For animals/fish
            
        except Exception as e:
            print(f"[WARNING] Failed to setup custom units: {e}", file=sys.stderr)


def main():
    """CLI interface for product normalization"""
    
    if len(sys.argv) < 2:
        print("Usage: python product_normalizer.py <products_json> [output_json]", file=sys.stderr)
        sys.exit(1)
    
    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)
    
    # Configuration from environment
    config = {
        "name_similarity_threshold": int(os.getenv("NAME_SIMILARITY_THRESHOLD", "85")),
        "supplier_similarity_threshold": int(os.getenv("SUPPLIER_SIMILARITY_THRESHOLD", "90")),
        "normalize_units": os.getenv("NORMALIZE_UNITS", "true").lower() == "true",
        "merge_similar_products": os.getenv("MERGE_SIMILAR_PRODUCTS", "true").lower() == "true",
        "batch_size": int(os.getenv("BATCH_SIZE", "100"))
    }
    
    try:
        # Load products data
        with open(input_path, 'r', encoding='utf-8') as f:
            input_data = json.load(f)
        
        # Extract products from different input formats
        if isinstance(input_data, list):
            products = input_data
        elif "products" in input_data:
            products = input_data["products"]
        elif "normalized_products" in input_data:
            products = input_data["normalized_products"]
        else:
            raise ValueError("No products found in input data")
        
        # Normalize products
        normalizer = ProductNormalizer(config)
        result = normalizer.normalize_products(products)
        
        # Output result
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            print(f"[INFO] Results saved to {output_path}", file=sys.stderr)
        else:
            print(f"PRODUCT_NORMALIZATION_RESULT:{json.dumps(result)}")
        
        # Summary to stderr
        metadata = result["metadata"]
        stats = result["normalization_stats"]
        print(f"[SUMMARY] Products: {metadata['input_products']} → {metadata['output_products']}, "
              f"Duplicates: {metadata['duplicates_merged']}, "
              f"Units normalized: {metadata['units_normalized']}, "
              f"Time: {metadata['processing_time_ms']}ms", file=sys.stderr)
        
    except Exception as e:
        print(f"[ERROR] Product normalization failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()