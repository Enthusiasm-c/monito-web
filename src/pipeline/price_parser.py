#!/usr/bin/env python3
"""
Composite Price Parser
Implements Task 9: Composite price parsing

Features:
- Parse complex price formats (17/15, 250@10 pcs, 15-20k)
- Handle bulk pricing and quantity breaks
- Extract price ranges and conditional pricing
- Support Indonesian rupiah formats (15.000, 15rb, 15k)
- Multi-currency detection and normalization
- Price validation and confidence scoring
- Structured price output with metadata
"""

import sys
import os
import json
import time
import re
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union
import logging
from decimal import Decimal, InvalidOperation
from dataclasses import dataclass
from enum import Enum

# dateutil for date parsing (validity periods)
try:
    from dateutil import parser as date_parser
    DATEUTIL_AVAILABLE = True
except ImportError:
    print("[WARNING] dateutil not available, date parsing limited", file=sys.stderr)
    DATEUTIL_AVAILABLE = False


class PriceType(Enum):
    """Types of parsed prices"""
    SINGLE = "single"                    # 15000
    RANGE = "range"                      # 15000-20000
    BULK = "bulk"                        # 250@10pcs
    TIERED = "tiered"                    # <100=15k, >100=12k
    CONDITIONAL = "conditional"          # min 5pcs = 15k
    FRACTION = "fraction"                # 17/15 (often wholesale/retail)
    UNIT_PRICE = "unit_price"           # 15k/kg
    DISCOUNT = "discount"                # 20k (disc 10%)
    UNKNOWN = "unknown"


@dataclass
class ParsedPrice:
    """Structured price information"""
    price_type: PriceType
    primary_price: Optional[float] = None
    secondary_price: Optional[float] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    currency: str = "IDR"
    unit: Optional[str] = None
    quantity: Optional[float] = None
    quantity_unit: Optional[str] = None
    discount_percent: Optional[float] = None
    validity_period: Optional[str] = None
    conditions: List[str] = None
    confidence: float = 0.0
    original_text: str = ""
    
    def __post_init__(self):
        if self.conditions is None:
            self.conditions = []


class PriceParser:
    """Advanced parser for composite price formats"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        
        # Configuration
        self.default_currency = self.config.get('default_currency', 'IDR')
        self.validate_prices = self.config.get('validate_prices', True)
        self.min_price = self.config.get('min_price', 1.0)
        self.max_price = self.config.get('max_price', 1000000000.0)  # 1 billion max
        self.decimal_places = self.config.get('decimal_places', 2)
        
        # Pattern matching settings
        self.use_fuzzy_matching = self.config.get('use_fuzzy_matching', True)
        self.strict_validation = self.config.get('strict_validation', False)
        
        # Currency patterns
        self.currency_patterns = {
            'IDR': [r'rp\.?', r'idr', r'rupiah'],
            'USD': [r'\$', r'usd', r'dollar'],
            'EUR': [r'€', r'eur', r'euro'],
            'SGD': [r's\$', r'sgd'],
            'MYR': [r'rm', r'myr'],
        }
        
        # Indonesian number format patterns
        self.indo_number_patterns = [
            r'(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)',  # 15.000,50
            r'(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',  # 15,000.50
            r'(\d+)\.?([krb])\b',                  # 15k, 20rb
            r'(\d+)\.?([jt])\b',                   # 15jt (juta = million)
        ]
        
        print(f"[INFO] Price Parser initialized", file=sys.stderr)
        print(f"[INFO] Default currency: {self.default_currency}", file=sys.stderr)
        print(f"[INFO] Price validation: {'On' if self.validate_prices else 'Off'}", file=sys.stderr)
    
    def parse_price(self, price_text: str) -> Dict[str, Any]:
        """
        Parse composite price text into structured format
        
        Args:
            price_text: Raw price text to parse
            
        Returns:
            Dict containing parsed price information
        """
        start_time = time.time()
        
        if not price_text or not isinstance(price_text, str):
            return self._create_empty_result("Empty or invalid input")
        
        original_text = price_text.strip()
        print(f"[INFO] Parsing price: '{original_text}'", file=sys.stderr)
        
        result = {
            "parsed_price": None,
            "metadata": {
                "original_text": original_text,
                "parsing_time_ms": 0,
                "patterns_tried": [],
                "confidence_factors": {},
                "currency_detected": self.default_currency
            },
            "success": False,
            "error": None
        }
        
        try:
            # Step 1: Clean and normalize input
            cleaned_text = self._clean_price_text(original_text)
            
            # Step 2: Detect currency
            detected_currency = self._detect_currency(cleaned_text)
            result["metadata"]["currency_detected"] = detected_currency
            
            # Step 3: Try different parsing strategies
            parsed_price = self._try_parsing_strategies(cleaned_text, detected_currency)
            
            if parsed_price:
                # Step 4: Validate parsed price
                if self.validate_prices:
                    validation_result = self._validate_price(parsed_price)
                    if not validation_result["valid"]:
                        result["error"] = validation_result["error"]
                        return result
                
                # Step 5: Calculate confidence score
                parsed_price.confidence = self._calculate_confidence(parsed_price, original_text)
                
                result["parsed_price"] = self._price_to_dict(parsed_price)
                result["success"] = True
                
                print(f"[INFO] Price parsed successfully: {parsed_price.price_type.value}, "
                      f"confidence: {parsed_price.confidence:.2f}", file=sys.stderr)
            else:
                result["error"] = "No valid price pattern found"
        
        except Exception as e:
            result["error"] = str(e)
            print(f"[ERROR] Price parsing failed: {e}", file=sys.stderr)
        
        finally:
            result["metadata"]["parsing_time_ms"] = int((time.time() - start_time) * 1000)
        
        return result
    
    def parse_price_batch(self, price_texts: List[str]) -> Dict[str, Any]:
        """Parse multiple prices in batch"""
        
        start_time = time.time()
        
        results = []
        successful_parses = 0
        
        for i, price_text in enumerate(price_texts):
            try:
                result = self.parse_price(price_text)
                results.append(result)
                if result["success"]:
                    successful_parses += 1
            except Exception as e:
                results.append(self._create_empty_result(f"Parsing error: {e}"))
        
        return {
            "results": results,
            "metadata": {
                "total_prices": len(price_texts),
                "successful_parses": successful_parses,
                "success_rate": successful_parses / len(price_texts) if price_texts else 0,
                "processing_time_ms": int((time.time() - start_time) * 1000)
            },
            "success": True
        }
    
    def _clean_price_text(self, text: str) -> str:
        """Clean and normalize price text"""
        
        # Remove excessive whitespace
        cleaned = re.sub(r'\s+', ' ', text.strip())
        
        # Remove common prefixes
        prefixes = [r'^(harga|price|cost)[:=\s]*', r'^(rp\.?\s*)?']
        for prefix in prefixes:
            cleaned = re.sub(prefix, '', cleaned, flags=re.IGNORECASE)
        
        # Normalize separators
        cleaned = cleaned.replace('–', '-').replace('—', '-')  # En-dash, Em-dash to hyphen
        cleaned = cleaned.replace('×', 'x').replace('X', 'x')  # Multiplication signs
        
        return cleaned.strip()
    
    def _detect_currency(self, text: str) -> str:
        """Detect currency from text"""
        
        text_lower = text.lower()
        
        for currency, patterns in self.currency_patterns.items():
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    return currency
        
        return self.default_currency
    
    def _try_parsing_strategies(self, text: str, currency: str) -> Optional[ParsedPrice]:
        """Try different parsing strategies in order of specificity"""
        
        strategies = [
            self._parse_fraction_price,      # 17/15
            self._parse_bulk_price,          # 250@10pcs
            self._parse_range_price,         # 15000-20000
            self._parse_discount_price,      # 20k (disc 10%)
            self._parse_conditional_price,   # min 5pcs = 15k
            self._parse_unit_price,          # 15k/kg
            self._parse_tiered_price,        # <100=15k, >100=12k
            self._parse_single_price,        # 15000
        ]
        
        for strategy in strategies:
            try:
                parsed = strategy(text, currency)
                if parsed:
                    return parsed
            except Exception as e:
                print(f"[WARNING] Strategy {strategy.__name__} failed: {e}", file=sys.stderr)
        
        return None
    
    def _parse_single_price(self, text: str, currency: str) -> Optional[ParsedPrice]:
        """Parse simple single price"""
        
        # Indonesian formats
        patterns = [
            r'(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)',  # 15.000,50
            r'(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',  # 15,000.50
            r'(\d+\.?\d*)([krb])\b',               # 15k, 20rb
            r'(\d+\.?\d*)([jt])\b',                # 15jt (million)
            r'(\d+\.?\d*)',                        # Simple number
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text.lower())
            if match:
                try:
                    price_value = self._convert_to_number(match.group(1), match.group(2) if len(match.groups()) > 1 else None)
                    
                    if price_value and price_value > 0:
                        return ParsedPrice(
                            price_type=PriceType.SINGLE,
                            primary_price=price_value,
                            currency=currency,
                            original_text=text
                        )
                except Exception:
                    continue
        
        return None
    
    def _parse_range_price(self, text: str, currency: str) -> Optional[ParsedPrice]:
        """Parse price ranges like 15000-20000, 15-20k"""
        
        range_patterns = [
            r'(\d+(?:\.\d{3})*(?:,\d{2})?)\s*[-–—]\s*(\d+(?:\.\d{3})*(?:,\d{2})?)',  # 15.000-20.000
            r'(\d+(?:,\d{3})*(?:\.\d{2})?)\s*[-–—]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)',  # 15,000-20,000
            r'(\d+)\s*[-–—]\s*(\d+)\s*([krb])\b',                                      # 15-20k
            r'(\d+)([krb])\s*[-–—]\s*(\d+)([krb])\b',                                 # 15k-20k
        ]
        
        for pattern in range_patterns:
            match = re.search(pattern, text.lower())
            if match:
                try:
                    if len(match.groups()) == 2:
                        # Simple range
                        min_price = self._convert_to_number(match.group(1))
                        max_price = self._convert_to_number(match.group(2))
                    elif len(match.groups()) == 3:
                        # Range with shared suffix
                        min_price = self._convert_to_number(match.group(1), match.group(3))
                        max_price = self._convert_to_number(match.group(2), match.group(3))
                    elif len(match.groups()) == 4:
                        # Range with individual suffixes
                        min_price = self._convert_to_number(match.group(1), match.group(2))
                        max_price = self._convert_to_number(match.group(3), match.group(4))
                    else:
                        continue
                    
                    if min_price and max_price and min_price <= max_price:
                        return ParsedPrice(
                            price_type=PriceType.RANGE,
                            min_price=min_price,
                            max_price=max_price,
                            primary_price=(min_price + max_price) / 2,  # Average
                            currency=currency,
                            original_text=text
                        )
                except Exception:
                    continue
        
        return None
    
    def _parse_fraction_price(self, text: str, currency: str) -> Optional[ParsedPrice]:
        """Parse fraction prices like 17/15 (often wholesale/retail)"""
        
        fraction_patterns = [
            r'(\d+(?:\.\d{3})*(?:,\d{2})?)\s*/\s*(\d+(?:\.\d{3})*(?:,\d{2})?)',  # 17000/15000
            r'(\d+)\s*/\s*(\d+)\s*([krb])\b',                                      # 17/15k
            r'(\d+)([krb])\s*/\s*(\d+)([krb])\b',                                 # 17k/15k
        ]
        
        for pattern in fraction_patterns:
            match = re.search(pattern, text.lower())
            if match:
                try:
                    if len(match.groups()) == 2:
                        price1 = self._convert_to_number(match.group(1))
                        price2 = self._convert_to_number(match.group(2))
                    elif len(match.groups()) == 3:
                        price1 = self._convert_to_number(match.group(1), match.group(3))
                        price2 = self._convert_to_number(match.group(2), match.group(3))
                    elif len(match.groups()) == 4:
                        price1 = self._convert_to_number(match.group(1), match.group(2))
                        price2 = self._convert_to_number(match.group(3), match.group(4))
                    else:
                        continue
                    
                    if price1 and price2:
                        # Usually first price is wholesale, second is retail
                        return ParsedPrice(
                            price_type=PriceType.FRACTION,
                            primary_price=price1,  # Wholesale
                            secondary_price=price2,  # Retail
                            currency=currency,
                            conditions=["wholesale/retail"],
                            original_text=text
                        )
                except Exception:
                    continue
        
        return None
    
    def _parse_bulk_price(self, text: str, currency: str) -> Optional[ParsedPrice]:
        """Parse bulk pricing like 250@10pcs, 15k per 5kg"""
        
        bulk_patterns = [
            r'(\d+(?:\.\d{3})*(?:,\d{2})?)\s*@\s*(\d+)\s*(\w+)',           # 250@10pcs
            r'(\d+)([krb])\s*@\s*(\d+)\s*(\w+)',                           # 15k@5kg
            r'(\d+(?:\.\d{3})*(?:,\d{2})?)\s*per\s*(\d+)\s*(\w+)',        # 250 per 10pcs
            r'(\d+)([krb])\s*per\s*(\d+)\s*(\w+)',                         # 15k per 5kg
            r'(\d+(?:\.\d{3})*(?:,\d{2})?)\s*/\s*(\d+)\s*(\w+)',          # 250/10pcs
        ]
        
        for pattern in bulk_patterns:
            match = re.search(pattern, text.lower())
            if match:
                try:
                    if len(match.groups()) == 3:
                        price = self._convert_to_number(match.group(1))
                        quantity = float(match.group(2))
                        unit = match.group(3)
                    elif len(match.groups()) == 4:
                        price = self._convert_to_number(match.group(1), match.group(2))
                        quantity = float(match.group(3))
                        unit = match.group(4)
                    else:
                        continue
                    
                    if price and quantity > 0:
                        return ParsedPrice(
                            price_type=PriceType.BULK,
                            primary_price=price,
                            quantity=quantity,
                            quantity_unit=unit,
                            currency=currency,
                            conditions=[f"per {quantity} {unit}"],
                            original_text=text
                        )
                except Exception:
                    continue
        
        return None
    
    def _parse_unit_price(self, text: str, currency: str) -> Optional[ParsedPrice]:
        """Parse unit pricing like 15k/kg, 250/liter"""
        
        unit_patterns = [
            r'(\d+(?:\.\d{3})*(?:,\d{2})?)\s*/\s*(kg|liter|piece|pcs|gram|ml)',  # 15000/kg
            r'(\d+)([krb])\s*/\s*(kg|liter|piece|pcs|gram|ml)',                   # 15k/kg
        ]
        
        for pattern in unit_patterns:
            match = re.search(pattern, text.lower())
            if match:
                try:
                    if len(match.groups()) == 2:
                        price = self._convert_to_number(match.group(1))
                        unit = match.group(2)
                    elif len(match.groups()) == 3:
                        price = self._convert_to_number(match.group(1), match.group(2))
                        unit = match.group(3)
                    else:
                        continue
                    
                    if price:
                        return ParsedPrice(
                            price_type=PriceType.UNIT_PRICE,
                            primary_price=price,
                            unit=unit,
                            currency=currency,
                            conditions=[f"per {unit}"],
                            original_text=text
                        )
                except Exception:
                    continue
        
        return None
    
    def _parse_discount_price(self, text: str, currency: str) -> Optional[ParsedPrice]:
        """Parse prices with discounts like 20k (disc 10%), 15000 - 10%"""
        
        discount_patterns = [
            r'(\d+(?:\.\d{3})*(?:,\d{2})?)\s*(?:\(.*disc.*(\d+)%.*\)|\-\s*(\d+)%)',  # 20000 (disc 10%)
            r'(\d+)([krb])\s*(?:\(.*disc.*(\d+)%.*\)|\-\s*(\d+)%)',                   # 20k (disc 10%)
            r'(\d+(?:\.\d{3})*(?:,\d{2})?)\s*(?:diskon|discount)\s*(\d+)%',          # 20000 diskon 10%
        ]
        
        for pattern in discount_patterns:
            match = re.search(pattern, text.lower())
            if match:
                try:
                    groups = match.groups()
                    if len(groups) >= 2:
                        if groups[1] and groups[1] in ['k', 'r', 'b']:
                            # Has suffix
                            price = self._convert_to_number(groups[0], groups[1])
                            # Find discount percentage
                            discount = next((float(g) for g in groups[2:] if g and g.isdigit()), None)
                        else:
                            # No suffix
                            price = self._convert_to_number(groups[0])
                            discount = next((float(g) for g in groups[1:] if g and g.isdigit()), None)
                        
                        if price and discount:
                            original_price = price / (1 - discount / 100)
                            return ParsedPrice(
                                price_type=PriceType.DISCOUNT,
                                primary_price=price,  # Discounted price
                                secondary_price=original_price,  # Original price
                                discount_percent=discount,
                                currency=currency,
                                conditions=[f"{discount}% discount"],
                                original_text=text
                            )
                except Exception:
                    continue
        
        return None
    
    def _parse_conditional_price(self, text: str, currency: str) -> Optional[ParsedPrice]:
        """Parse conditional pricing like 'min 5pcs = 15k'"""
        
        conditional_patterns = [
            r'(?:min|minimum)\s*(\d+)\s*(\w+)\s*[=:]\s*(\d+)([krb])?',  # min 5pcs = 15k
            r'(?:max|maximum)\s*(\d+)\s*(\w+)\s*[=:]\s*(\d+)([krb])?',  # max 10kg = 25k
            r'(\d+)\s*(\w+)\s*(?:or\s*more|keatas|\+)\s*[=:]\s*(\d+)([krb])?',  # 5pcs or more = 15k
        ]
        
        for pattern in conditional_patterns:
            match = re.search(pattern, text.lower())
            if match:
                try:
                    quantity = float(match.group(1))
                    unit = match.group(2)
                    price = self._convert_to_number(match.group(3), match.group(4))
                    
                    if price and quantity > 0:
                        condition = f"min {quantity} {unit}" if "min" in pattern else f"qty {quantity} {unit}"
                        
                        return ParsedPrice(
                            price_type=PriceType.CONDITIONAL,
                            primary_price=price,
                            quantity=quantity,
                            quantity_unit=unit,
                            currency=currency,
                            conditions=[condition],
                            original_text=text
                        )
                except Exception:
                    continue
        
        return None
    
    def _parse_tiered_price(self, text: str, currency: str) -> Optional[ParsedPrice]:
        """Parse tiered pricing like '<100=15k, >100=12k'"""
        
        # This is more complex and might need multiple passes
        # For now, return None to indicate not implemented
        return None
    
    def _convert_to_number(self, number_str: str, suffix: Optional[str] = None) -> Optional[float]:
        """Convert string number to float, handling Indonesian formats"""
        
        if not number_str:
            return None
        
        try:
            # Remove any remaining non-numeric characters except decimal separators
            cleaned = re.sub(r'[^\d.,]', '', number_str)
            
            # Handle Indonesian thousand separators
            if ',' in cleaned and '.' in cleaned:
                # Determine which is decimal separator
                comma_pos = cleaned.rfind(',')
                dot_pos = cleaned.rfind('.')
                
                if comma_pos > dot_pos:
                    # Comma is decimal separator (European format)
                    cleaned = cleaned.replace('.', '').replace(',', '.')
                else:
                    # Dot is decimal separator (US format)
                    cleaned = cleaned.replace(',', '')
            elif ',' in cleaned:
                # Only comma - could be thousands separator or decimal
                comma_pos = cleaned.rfind(',')
                after_comma = cleaned[comma_pos + 1:]
                if len(after_comma) <= 2 and after_comma.isdigit():
                    # Likely decimal separator
                    cleaned = cleaned.replace(',', '.')
                else:
                    # Likely thousands separator
                    cleaned = cleaned.replace(',', '')
            
            number = float(cleaned)
            
            # Apply suffix multiplier
            if suffix:
                suffix_lower = suffix.lower()
                if suffix_lower in ['k']:
                    number *= 1000
                elif suffix_lower in ['r', 'rb']:  # ribu
                    number *= 1000
                elif suffix_lower in ['j', 'jt']:  # juta
                    number *= 1000000
                elif suffix_lower in ['m']:  # million
                    number *= 1000000
                elif suffix_lower in ['b']:  # billion
                    number *= 1000000000
            
            return number
            
        except (ValueError, InvalidOperation):
            return None
    
    def _validate_price(self, price: ParsedPrice) -> Dict[str, Any]:
        """Validate parsed price"""
        
        prices_to_check = []
        if price.primary_price is not None:
            prices_to_check.append(price.primary_price)
        if price.secondary_price is not None:
            prices_to_check.append(price.secondary_price)
        if price.min_price is not None:
            prices_to_check.append(price.min_price)
        if price.max_price is not None:
            prices_to_check.append(price.max_price)
        
        for price_val in prices_to_check:
            if price_val < self.min_price:
                return {"valid": False, "error": f"Price {price_val} below minimum {self.min_price}"}
            if price_val > self.max_price:
                return {"valid": False, "error": f"Price {price_val} above maximum {self.max_price}"}
        
        # Check price relationships
        if price.min_price is not None and price.max_price is not None:
            if price.min_price > price.max_price:
                return {"valid": False, "error": "Minimum price greater than maximum price"}
        
        return {"valid": True}
    
    def _calculate_confidence(self, price: ParsedPrice, original_text: str) -> float:
        """Calculate confidence score for parsed price"""
        
        confidence = 0.5  # Base confidence
        
        # Price type confidence
        type_confidence = {
            PriceType.SINGLE: 0.9,
            PriceType.RANGE: 0.8,
            PriceType.BULK: 0.85,
            PriceType.FRACTION: 0.8,
            PriceType.UNIT_PRICE: 0.85,
            PriceType.DISCOUNT: 0.75,
            PriceType.CONDITIONAL: 0.7,
            PriceType.TIERED: 0.6,
        }
        confidence *= type_confidence.get(price.price_type, 0.5)
        
        # Currency detection confidence
        if price.currency != self.default_currency:
            confidence += 0.1  # Bonus for explicit currency detection
        
        # Completeness confidence
        completeness_score = 0.0
        if price.primary_price is not None:
            completeness_score += 0.4
        if price.currency:
            completeness_score += 0.2
        if price.unit:
            completeness_score += 0.2
        if price.conditions:
            completeness_score += 0.2
        
        confidence += completeness_score * 0.2
        
        # Text quality confidence
        if len(original_text) > 5:
            confidence += 0.05
        if any(char.isdigit() for char in original_text):
            confidence += 0.05
        
        return min(1.0, confidence)
    
    def _price_to_dict(self, price: ParsedPrice) -> Dict[str, Any]:
        """Convert ParsedPrice to dictionary"""
        
        return {
            "price_type": price.price_type.value,
            "primary_price": price.primary_price,
            "secondary_price": price.secondary_price,
            "min_price": price.min_price,
            "max_price": price.max_price,
            "currency": price.currency,
            "unit": price.unit,
            "quantity": price.quantity,
            "quantity_unit": price.quantity_unit,
            "discount_percent": price.discount_percent,
            "validity_period": price.validity_period,
            "conditions": price.conditions,
            "confidence": price.confidence,
            "original_text": price.original_text
        }
    
    def _create_empty_result(self, error_message: str) -> Dict[str, Any]:
        """Create empty result with error"""
        
        return {
            "parsed_price": None,
            "metadata": {
                "original_text": "",
                "parsing_time_ms": 0,
                "patterns_tried": [],
                "confidence_factors": {},
                "currency_detected": self.default_currency
            },
            "success": False,
            "error": error_message
        }


def main():
    """CLI interface for price parsing"""
    
    if len(sys.argv) < 2:
        print("Usage: python price_parser.py <price_text> [output_json]", file=sys.stderr)
        print("       python price_parser.py --batch <prices_json> [output_json]", file=sys.stderr)
        sys.exit(1)
    
    # Configuration from environment
    config = {
        "default_currency": os.getenv("DEFAULT_CURRENCY", "IDR"),
        "validate_prices": os.getenv("VALIDATE_PRICES", "true").lower() == "true",
        "min_price": float(os.getenv("MIN_PRICE", "1.0")),
        "max_price": float(os.getenv("MAX_PRICE", "1000000000.0"))
    }
    
    parser = PriceParser(config)
    
    try:
        if sys.argv[1] == "--batch":
            # Batch mode
            if len(sys.argv) < 3:
                print("Error: Batch mode requires input file", file=sys.stderr)
                sys.exit(1)
            
            input_path = Path(sys.argv[2])
            output_path = Path(sys.argv[3]) if len(sys.argv) > 3 else None
            
            with open(input_path, 'r', encoding='utf-8') as f:
                input_data = json.load(f)
            
            if isinstance(input_data, list):
                price_texts = input_data
            else:
                price_texts = input_data.get("prices", [])
            
            result = parser.parse_price_batch(price_texts)
            
        else:
            # Single price mode
            price_text = sys.argv[1]
            output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else None
            
            result = parser.parse_price(price_text)
        
        # Output result
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            print(f"[INFO] Results saved to {output_path}", file=sys.stderr)
        else:
            print(f"PRICE_PARSING_RESULT:{json.dumps(result)}")
        
        # Summary to stderr
        if "results" in result:  # Batch mode
            metadata = result["metadata"]
            print(f"[SUMMARY] Batch: {metadata['total_prices']} prices, "
                  f"Success rate: {metadata['success_rate']:.1%}, "
                  f"Time: {metadata['processing_time_ms']}ms", file=sys.stderr)
        else:  # Single mode
            if result["success"]:
                parsed = result["parsed_price"]
                print(f"[SUMMARY] Type: {parsed['price_type']}, "
                      f"Price: {parsed['primary_price']}, "
                      f"Confidence: {parsed['confidence']:.2f}", file=sys.stderr)
            else:
                print(f"[SUMMARY] Failed: {result['error']}", file=sys.stderr)
        
    except Exception as e:
        print(f"[ERROR] Price parsing failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()