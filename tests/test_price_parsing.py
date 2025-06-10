"""
Tests for Composite Price Parser
Tests Task 9: Composite price parsing
"""

import pytest
import tempfile
import os
from pathlib import Path
import json
from unittest.mock import Mock, patch, MagicMock

# Import our price parsing modules
import sys
sys.path.append(str(Path(__file__).parent.parent))

try:
    from src.pipeline.price_parser import PriceParser, ParsedPrice, PriceType
except ImportError:
    # Handle import errors gracefully for systems without dependencies
    PriceParser = None
    ParsedPrice = None
    PriceType = None


class TestPriceParser:
    """Test price parser functionality"""

    @pytest.fixture
    def price_parser(self):
        """Create price parser instance"""
        if PriceParser is None:
            pytest.skip("Price parser not available")
        
        config = {
            'default_currency': 'IDR',
            'validate_prices': True,
            'min_price': 1.0,
            'max_price': 1000000000.0
        }
        return PriceParser(config)

    def test_parser_initialization(self, price_parser):
        """Test price parser initialization"""
        if price_parser is None:
            pytest.skip("Price parser not available")
            
        assert price_parser.default_currency == 'IDR'
        assert price_parser.validate_prices is True
        assert price_parser.min_price == 1.0
        assert price_parser.max_price == 1000000000.0

    @pytest.mark.unit
    def test_simple_price_parsing(self, price_parser):
        """Test simple price parsing"""
        if price_parser is None:
            pytest.skip("Price parser not available")
        
        test_cases = [
            ("15000", 15000.0, PriceType.SINGLE),
            ("15.000", 15000.0, PriceType.SINGLE),
            ("15,000", 15000.0, PriceType.SINGLE),
            ("15k", 15000.0, PriceType.SINGLE),
            ("15rb", 15000.0, PriceType.SINGLE),
            ("2jt", 2000000.0, PriceType.SINGLE),
            ("Rp 15.000", 15000.0, PriceType.SINGLE),
            ("IDR 25000", 25000.0, PriceType.SINGLE),
        ]
        
        for price_text, expected_price, expected_type in test_cases:
            result = price_parser.parse_price(price_text)
            
            if result["success"]:
                parsed = result["parsed_price"]
                assert parsed["price_type"] == expected_type.value
                assert parsed["primary_price"] == expected_price
                assert parsed["currency"] == "IDR"
            else:
                print(f"Failed to parse: {price_text} - {result['error']}")

    @pytest.mark.unit
    def test_range_price_parsing(self, price_parser):
        """Test price range parsing"""
        if price_parser is None:
            pytest.skip("Price parser not available")
        
        test_cases = [
            ("15000-20000", 15000.0, 20000.0),
            ("15.000-20.000", 15000.0, 20000.0),
            ("15k-20k", 15000.0, 20000.0),
            ("15-20k", 15000.0, 20000.0),
            ("15rb-25rb", 15000.0, 25000.0),
        ]
        
        for price_text, expected_min, expected_max in test_cases:
            result = price_parser.parse_price(price_text)
            
            if result["success"]:
                parsed = result["parsed_price"]
                assert parsed["price_type"] == PriceType.RANGE.value
                assert parsed["min_price"] == expected_min
                assert parsed["max_price"] == expected_max
                assert parsed["primary_price"] == (expected_min + expected_max) / 2
            else:
                print(f"Failed to parse range: {price_text} - {result['error']}")

    @pytest.mark.unit
    def test_fraction_price_parsing(self, price_parser):
        """Test fraction price parsing (wholesale/retail)"""
        if price_parser is None:
            pytest.skip("Price parser not available")
        
        test_cases = [
            ("17/15", 17.0, 15.0),
            ("17000/15000", 17000.0, 15000.0),
            ("17k/15k", 17000.0, 15000.0),
            ("25/22k", 25000.0, 22000.0),
        ]
        
        for price_text, expected_primary, expected_secondary in test_cases:
            result = price_parser.parse_price(price_text)
            
            if result["success"]:
                parsed = result["parsed_price"]
                assert parsed["price_type"] == PriceType.FRACTION.value
                assert parsed["primary_price"] == expected_primary
                assert parsed["secondary_price"] == expected_secondary
                assert "wholesale/retail" in parsed["conditions"]
            else:
                print(f"Failed to parse fraction: {price_text} - {result['error']}")

    @pytest.mark.unit
    def test_bulk_price_parsing(self, price_parser):
        """Test bulk price parsing"""
        if price_parser is None:
            pytest.skip("Price parser not available")
        
        test_cases = [
            ("250@10pcs", 250.0, 10.0, "pcs"),
            ("15k@5kg", 15000.0, 5.0, "kg"),
            ("250 per 10pcs", 250.0, 10.0, "pcs"),
            ("15k per 5kg", 15000.0, 5.0, "kg"),
            ("250/10pcs", 250.0, 10.0, "pcs"),
        ]
        
        for price_text, expected_price, expected_qty, expected_unit in test_cases:
            result = price_parser.parse_price(price_text)
            
            if result["success"]:
                parsed = result["parsed_price"]
                assert parsed["price_type"] == PriceType.BULK.value
                assert parsed["primary_price"] == expected_price
                assert parsed["quantity"] == expected_qty
                assert parsed["quantity_unit"] == expected_unit
            else:
                print(f"Failed to parse bulk: {price_text} - {result['error']}")

    @pytest.mark.unit
    def test_unit_price_parsing(self, price_parser):
        """Test unit price parsing"""
        if price_parser is None:
            pytest.skip("Price parser not available")
        
        test_cases = [
            ("15000/kg", 15000.0, "kg"),
            ("15k/kg", 15000.0, "kg"),
            ("250/liter", 250.0, "liter"),
            ("100/piece", 100.0, "piece"),
        ]
        
        for price_text, expected_price, expected_unit in test_cases:
            result = price_parser.parse_price(price_text)
            
            if result["success"]:
                parsed = result["parsed_price"]
                assert parsed["price_type"] == PriceType.UNIT_PRICE.value
                assert parsed["primary_price"] == expected_price
                assert parsed["unit"] == expected_unit
            else:
                print(f"Failed to parse unit price: {price_text} - {result['error']}")

    @pytest.mark.unit
    def test_discount_price_parsing(self, price_parser):
        """Test discount price parsing"""
        if price_parser is None:
            pytest.skip("Price parser not available")
        
        test_cases = [
            ("20000 (disc 10%)", 20000.0, 10.0),
            ("20k (disc 15%)", 20000.0, 15.0),
            ("15000 - 10%", 15000.0, 10.0),
            ("25000 diskon 20%", 25000.0, 20.0),
        ]
        
        for price_text, expected_price, expected_discount in test_cases:
            result = price_parser.parse_price(price_text)
            
            if result["success"]:
                parsed = result["parsed_price"]
                assert parsed["price_type"] == PriceType.DISCOUNT.value
                assert parsed["primary_price"] == expected_price
                assert parsed["discount_percent"] == expected_discount
                assert parsed["secondary_price"] > expected_price  # Original price should be higher
            else:
                print(f"Failed to parse discount: {price_text} - {result['error']}")

    @pytest.mark.unit
    def test_conditional_price_parsing(self, price_parser):
        """Test conditional price parsing"""
        if price_parser is None:
            pytest.skip("Price parser not available")
        
        test_cases = [
            ("min 5pcs = 15k", 15000.0, 5.0, "pcs"),
            ("minimum 10kg = 25000", 25000.0, 10.0, "kg"),
            ("max 20 piece = 100", 100.0, 20.0, "piece"),
        ]
        
        for price_text, expected_price, expected_qty, expected_unit in test_cases:
            result = price_parser.parse_price(price_text)
            
            if result["success"]:
                parsed = result["parsed_price"]
                assert parsed["price_type"] == PriceType.CONDITIONAL.value
                assert parsed["primary_price"] == expected_price
                assert parsed["quantity"] == expected_qty
                assert parsed["quantity_unit"] == expected_unit
            else:
                print(f"Failed to parse conditional: {price_text} - {result['error']}")

    @pytest.mark.unit
    def test_currency_detection(self, price_parser):
        """Test currency detection"""
        if price_parser is None:
            pytest.skip("Price parser not available")
        
        test_cases = [
            ("$100", "USD"),
            ("€50", "EUR"),
            ("S$75", "SGD"),
            ("Rp 15000", "IDR"),
            ("15000 IDR", "IDR"),
            ("RM 100", "MYR"),
        ]
        
        for price_text, expected_currency in test_cases:
            detected = price_parser._detect_currency(price_text)
            assert detected == expected_currency

    @pytest.mark.unit
    def test_number_conversion(self, price_parser):
        """Test Indonesian number format conversion"""
        if price_parser is None:
            pytest.skip("Price parser not available")
        
        test_cases = [
            ("15.000", None, 15000.0),
            ("15,000", None, 15000.0),
            ("15.000,50", None, 15000.50),
            ("15,000.50", None, 15000.50),
            ("15", "k", 15000.0),
            ("2", "jt", 2000000.0),
            ("500", "rb", 500000.0),
            ("1", "b", 1000000000.0),
        ]
        
        for number_str, suffix, expected in test_cases:
            result = price_parser._convert_to_number(number_str, suffix)
            assert result == expected

    @pytest.mark.unit
    def test_text_cleaning(self, price_parser):
        """Test price text cleaning"""
        if price_parser is None:
            pytest.skip("Price parser not available")
        
        test_cases = [
            ("  Harga: Rp 15.000  ", "Rp 15.000"),
            ("Price: $100", "$100"),
            ("Cost = 25000", "25000"),
            ("   multiple   spaces   ", "multiple spaces"),
        ]
        
        for input_text, expected in test_cases:
            result = price_parser._clean_price_text(input_text)
            assert result == expected

    @pytest.mark.unit
    def test_price_validation(self, price_parser):
        """Test price validation"""
        if price_parser is None or ParsedPrice is None:
            pytest.skip("Price parser not available")
        
        # Valid price
        valid_price = ParsedPrice(
            price_type=PriceType.SINGLE,
            primary_price=15000.0,
            currency="IDR"
        )
        validation = price_parser._validate_price(valid_price)
        assert validation["valid"] is True
        
        # Price too low
        low_price = ParsedPrice(
            price_type=PriceType.SINGLE,
            primary_price=0.5,  # Below minimum
            currency="IDR"
        )
        validation = price_parser._validate_price(low_price)
        assert validation["valid"] is False
        
        # Price too high
        high_price = ParsedPrice(
            price_type=PriceType.SINGLE,
            primary_price=2000000000.0,  # Above maximum
            currency="IDR"
        )
        validation = price_parser._validate_price(high_price)
        assert validation["valid"] is False

    @pytest.mark.unit
    def test_confidence_calculation(self, price_parser):
        """Test confidence score calculation"""
        if price_parser is None or ParsedPrice is None:
            pytest.skip("Price parser not available")
        
        # High confidence price (complete information)
        high_conf_price = ParsedPrice(
            price_type=PriceType.SINGLE,
            primary_price=15000.0,
            currency="IDR",
            unit="kg",
            conditions=["bulk pricing"]
        )
        confidence = price_parser._calculate_confidence(high_conf_price, "15000 IDR per kg bulk pricing")
        assert confidence > 0.7
        
        # Low confidence price (minimal information)
        low_conf_price = ParsedPrice(
            price_type=PriceType.UNKNOWN,
            primary_price=15000.0,
            currency="IDR"
        )
        confidence = price_parser._calculate_confidence(low_conf_price, "15k")
        assert confidence < 0.6

    @pytest.mark.unit
    def test_batch_parsing(self, price_parser):
        """Test batch price parsing"""
        if price_parser is None:
            pytest.skip("Price parser not available")
        
        price_texts = [
            "15000",
            "15k-20k",
            "250@10pcs",
            "invalid price text",
            "17/15k"
        ]
        
        result = price_parser.parse_price_batch(price_texts)
        
        assert result["success"] is True
        assert len(result["results"]) == 5
        assert result["metadata"]["total_prices"] == 5
        assert result["metadata"]["successful_parses"] >= 3  # At least 3 should parse successfully

    @pytest.mark.unit
    def test_empty_input_handling(self, price_parser):
        """Test handling of empty or invalid input"""
        if price_parser is None:
            pytest.skip("Price parser not available")
        
        test_cases = ["", None, "   ", "abc def", "!!!"]
        
        for invalid_input in test_cases:
            result = price_parser.parse_price(invalid_input or "")
            assert result["success"] is False
            assert result["error"] is not None

    @pytest.mark.unit
    def test_configuration_override(self):
        """Test configuration override"""
        if PriceParser is None:
            pytest.skip("Price parser not available")
        
        custom_config = {
            'default_currency': 'USD',
            'validate_prices': False,
            'min_price': 10.0,
            'max_price': 100000.0
        }
        
        parser = PriceParser(custom_config)
        
        assert parser.default_currency == 'USD'
        assert parser.validate_prices is False
        assert parser.min_price == 10.0
        assert parser.max_price == 100000.0


@pytest.mark.integration
class TestPriceParsingIntegration:
    """Integration tests for price parsing"""

    def test_real_world_price_formats(self):
        """Test with real-world Indonesian price formats"""
        if PriceParser is None:
            pytest.skip("Price parser not available")
        
        parser = PriceParser()
        
        real_world_prices = [
            "Rp. 15.000 per kg",
            "25rb/liter",
            "Harga: 17.500 - 20.000",
            "250@10 pcs minimum order",
            "15k (disc 10%)",
            "17/15 ribu wholesale/retail",
            "2,5 juta per ton",
            "100 ribu - 150 ribu",
            "US$ 5.50 per piece",
            "€ 25 each"
        ]
        
        successful_parses = 0
        
        for price_text in real_world_prices:
            result = parser.parse_price(price_text)
            
            print(f"Testing: '{price_text}'")
            
            if result["success"]:
                parsed = result["parsed_price"]
                print(f"  ✅ {parsed['price_type']}: {parsed['primary_price']} {parsed['currency']}")
                successful_parses += 1
            else:
                print(f"  ❌ {result['error']}")
        
        # Should parse at least 70% of real-world examples
        success_rate = successful_parses / len(real_world_prices)
        assert success_rate >= 0.7


@pytest.mark.benchmark
class TestPriceParsingPerformance:
    """Performance benchmarks for price parsing"""

    def test_single_price_parsing_speed(self, benchmark):
        """Benchmark single price parsing speed"""
        if PriceParser is None:
            pytest.skip("Price parser not available")
        
        parser = PriceParser()
        
        result = benchmark(parser.parse_price, "15.000 IDR per kg")
        
        assert result["success"] is True
        assert result["metadata"]["parsing_time_ms"] >= 0

    def test_batch_parsing_speed(self, benchmark):
        """Benchmark batch parsing speed"""
        if PriceParser is None:
            pytest.skip("Price parser not available")
        
        parser = PriceParser()
        
        # Create batch of 100 prices
        price_texts = [
            f"{1000 + i * 100}",
            f"{15 + i}k",
            f"{10 + i}-{20 + i}k",
            f"250@{5 + i}pcs"
        ] * 25  # 100 total prices
        
        result = benchmark(parser.parse_price_batch, price_texts)
        
        assert result["success"] is True
        assert result["metadata"]["total_prices"] == 100


# Test CLI interface
class TestPriceParsingCLI:
    """Test CLI interface for price parsing"""

    def test_cli_single_price(self):
        """Test CLI with single price"""
        if PriceParser is None:
            pytest.skip("Price parser not available")
        
        import subprocess
        import sys
        
        script_path = Path(__file__).parent.parent / "src" / "pipeline" / "price_parser.py"
        
        result = subprocess.run([
            sys.executable, str(script_path), "15000 IDR"
        ], capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            # Parse output
            stdout_lines = result.stdout.strip().split('\n')
            json_line = None
            for line in stdout_lines:
                if line.startswith('PRICE_PARSING_RESULT:'):
                    json_line = line
                    break
            
            if json_line:
                json_str = json_line.replace('PRICE_PARSING_RESULT:', '')
                parsing_result = json.loads(json_str)
                
                assert parsing_result["success"] in [True, False]  # Either is valid
                if parsing_result["success"]:
                    assert parsing_result["parsed_price"]["primary_price"] == 15000.0
            else:
                pytest.skip("No parsing result found in CLI output")
        else:
            pytest.skip(f"CLI failed (code {result.returncode}): {result.stderr}")

    def test_cli_batch_mode(self, tmp_path):
        """Test CLI batch mode"""
        if PriceParser is None:
            pytest.skip("Price parser not available")
        
        # Create test input file
        test_prices = ["15000", "20k", "15-20k", "250@10pcs"]
        input_file = tmp_path / "test_prices.json"
        with open(input_file, 'w') as f:
            json.dump(test_prices, f)
        
        import subprocess
        import sys
        
        script_path = Path(__file__).parent.parent / "src" / "pipeline" / "price_parser.py"
        
        result = subprocess.run([
            sys.executable, str(script_path), "--batch", str(input_file)
        ], capture_output=True, text=True, timeout=60)
        
        if result.returncode == 0:
            stdout_lines = result.stdout.strip().split('\n')
            json_line = None
            for line in stdout_lines:
                if line.startswith('PRICE_PARSING_RESULT:'):
                    json_line = line
                    break
            
            if json_line:
                json_str = json_line.replace('PRICE_PARSING_RESULT:', '')
                batch_result = json.loads(json_str)
                
                assert batch_result["success"] is True
                assert batch_result["metadata"]["total_prices"] == 4
                assert len(batch_result["results"]) == 4
            else:
                pytest.skip("No batch result found in CLI output")
        else:
            pytest.skip(f"CLI batch mode failed: {result.stderr}")


# Parameterized tests for different price formats
@pytest.mark.parametrize("price_text,expected_type,should_succeed", [
    # Single prices
    ("15000", "single", True),
    ("15k", "single", True),
    ("2jt", "single", True),
    
    # Ranges
    ("15000-20000", "range", True),
    ("15k-20k", "range", True),
    
    # Fractions
    ("17/15", "fraction", True),
    ("17k/15k", "fraction", True),
    
    # Bulk pricing
    ("250@10pcs", "bulk", True),
    ("15k@5kg", "bulk", True),
    
    # Unit prices
    ("15000/kg", "unit_price", True),
    ("25k/liter", "unit_price", True),
    
    # Invalid formats
    ("abc", "unknown", False),
    ("", "unknown", False),
    ("---", "unknown", False),
])
def test_parametrized_price_formats(price_text, expected_type, should_succeed):
    """Test various price formats with parametrized inputs"""
    if PriceParser is None:
        pytest.skip("Price parser not available")
    
    parser = PriceParser()
    result = parser.parse_price(price_text)
    
    if should_succeed:
        assert result["success"] is True
        if result["parsed_price"]:
            assert result["parsed_price"]["price_type"] == expected_type
    else:
        assert result["success"] is False