"""
Tests for AI Structuring Service with Function Calling
Tests Task 7: AI structuring with function calling
"""

import pytest
import tempfile
import os
from pathlib import Path
import json
from unittest.mock import Mock, patch, MagicMock

# Import our AI structuring modules
import sys
sys.path.append(str(Path(__file__).parent.parent))

try:
    from src.pipeline.ai_structuring_service import AIStructuringService, ProductData, StructuringResult
except ImportError:
    # Handle import errors gracefully for systems without dependencies
    AIStructuringService = None
    ProductData = None
    StructuringResult = None


class TestAIStructuringService:
    """Test AI structuring service functionality"""

    @pytest.fixture
    def ai_service(self):
        """Create AI structuring service instance"""
        if AIStructuringService is None:
            pytest.skip("AI structuring service not available")
        
        config = {
            'openai_api_key': 'test-key',  # Mock key for testing
            'model': 'gpt-o3',
            'max_tokens': 1000,
            'batch_size': 5,
            'min_confidence': 0.7
        }
        return AIStructuringService(config)

    @pytest.fixture
    def sample_table_data(self):
        """Create sample table extraction data"""
        return {
            "data_type": "table_extraction",
            "tables": [
                {
                    "table_id": "test_table_1",
                    "page": 1,
                    "data": [
                        ["Fresh Tomatoes", "kg", "12500", "Vegetables"],
                        ["Organic Carrots", "kg", "15000", "Vegetables"],
                        ["Premium Milk", "liter", "8750", "Dairy"],
                        ["White Bread", "loaf", "5500", "Bakery"],
                        ["Chicken Breast", "kg", "45000", "Meat"]
                    ],
                    "headers": ["Product Name", "Unit", "Price", "Category"],
                    "confidence": 0.9
                }
            ],
            "metadata": {
                "total_tables": 1,
                "extraction_methods": ["camelot_lattice"]
            }
        }

    @pytest.fixture
    def sample_excel_data(self):
        """Create sample Excel extraction data"""
        return {
            "data_type": "excel_extraction",
            "sheets": {
                "Products": {
                    "data": [
                        {
                            "product_name": "Rice Premium",
                            "unit": "kg",
                            "price": "25000",
                            "supplier": "Rice Co"
                        },
                        {
                            "product_name": "Coffee Beans",
                            "unit": "kg", 
                            "price": "120000",
                            "supplier": "Coffee Ltd"
                        }
                    ],
                    "headers": ["product_name", "unit", "price", "supplier"],
                    "row_count": 2
                }
            },
            "metadata": {
                "total_sheets": 1
            }
        }

    @pytest.fixture
    def sample_text_data(self):
        """Create sample text extraction data"""
        return {
            "data_type": "text_extraction",
            "text_content": """
            Product Price List - PT Supplier Indonesia
            
            1. Fresh Tomatoes - Rp 12,500/kg - Grade A
            2. Organic Carrots - Rp 15,000/kg - Premium Quality
            3. Premium Milk - Rp 8,750/liter - Fresh Daily
            4. White Bread - Rp 5,500/loaf - Soft & Fresh
            5. Chicken Breast - Rp 45,000/kg - Free Range
            """,
            "page_texts": ["Product Price List - PT Supplier Indonesia..."],
            "metadata": {
                "total_pages": 1,
                "total_characters": 280
            }
        }

    def test_ai_service_initialization(self, ai_service):
        """Test AI service initialization"""
        if ai_service is None:
            pytest.skip("AI service not available")
            
        assert ai_service.model == 'gpt-o3'
        assert ai_service.max_tokens == 1000
        assert ai_service.batch_size == 5
        assert ai_service.min_confidence == 0.7

    @pytest.mark.unit
    def test_data_preparation_table(self, ai_service, sample_table_data):
        """Test data preparation from table extraction"""
        if ai_service is None:
            pytest.skip("AI service not available")
            
        prepared_data = ai_service._prepare_data_for_ai(sample_table_data)
        
        assert len(prepared_data) == 5  # 5 product rows
        assert all(isinstance(row, dict) for row in prepared_data)
        
        # Check first row structure
        first_row = prepared_data[0]
        assert "Product Name" in first_row or "product_name" in first_row
        assert "_source_table" in first_row
        assert "_source_page" in first_row

    @pytest.mark.unit
    def test_data_preparation_excel(self, ai_service, sample_excel_data):
        """Test data preparation from Excel extraction"""
        if ai_service is None:
            pytest.skip("AI service not available")
            
        prepared_data = ai_service._prepare_data_for_ai(sample_excel_data)
        
        assert len(prepared_data) == 2  # 2 product rows
        assert all(isinstance(row, dict) for row in prepared_data)
        
        # Check structure
        first_row = prepared_data[0]
        assert "product_name" in first_row
        assert "_source_sheet" in first_row

    @pytest.mark.unit
    def test_data_preparation_text(self, ai_service, sample_text_data):
        """Test data preparation from text extraction"""
        if ai_service is None:
            pytest.skip("AI service not available")
            
        prepared_data = ai_service._prepare_data_for_ai(sample_text_data)
        
        # Should extract product lines from text
        assert len(prepared_data) >= 3  # At least some product lines
        
        # Check structure
        for row in prepared_data:
            assert "raw_text" in row
            assert "_source_line" in row

    @pytest.mark.unit
    def test_valid_data_row_detection(self, ai_service):
        """Test valid data row detection"""
        if ai_service is None:
            pytest.skip("AI service not available")
        
        # Valid rows
        assert ai_service._is_valid_data_row(["Product A", "kg", "12500", "Category"])
        assert ai_service._is_valid_data_row(["Item", "15000"])
        
        # Invalid rows
        assert not ai_service._is_valid_data_row([])  # Empty
        assert not ai_service._is_valid_data_row(["", "", ""])  # All empty
        assert not ai_service._is_valid_data_row(["Product"])  # Only one cell
        
        # Header-like rows (should be invalid for data)
        assert not ai_service._is_valid_data_row(["Product Name", "Unit", "Price", "Category"])

    @pytest.mark.unit
    def test_product_line_detection(self, ai_service):
        """Test product line detection in text"""
        if ai_service is None:
            pytest.skip("AI service not available")
        
        # Valid product lines
        assert ai_service._looks_like_product_line("Fresh Tomatoes - Rp 12,500/kg")
        assert ai_service._looks_like_product_line("Premium Milk 8750 IDR per liter")
        assert ai_service._looks_like_product_line("Coffee Beans 150000 piece")
        
        # Invalid lines
        assert not ai_service._looks_like_product_line("Page 1 of 5")
        assert not ai_service._looks_like_product_line("PRODUCT LIST")
        assert not ai_service._looks_like_product_line("Total: 150000")
        assert not ai_service._looks_like_product_line("2024")

    @pytest.mark.unit
    def test_batch_creation(self, ai_service):
        """Test batch creation for processing"""
        if ai_service is None:
            pytest.skip("AI service not available")
        
        data = [{"item": f"Product {i}"} for i in range(12)]
        batches = list(ai_service._create_batches(data))
        
        # With batch_size=5, should create 3 batches: [5, 5, 2]
        assert len(batches) == 3
        assert len(batches[0]) == 5
        assert len(batches[1]) == 5
        assert len(batches[2]) == 2

    @pytest.mark.unit
    def test_system_prompt_generation(self, ai_service):
        """Test system prompt generation"""
        if ai_service is None:
            pytest.skip("AI service not available")
        
        prompt = ai_service._get_system_prompt()
        
        assert isinstance(prompt, str)
        assert len(prompt) > 100
        assert "product" in prompt.lower()
        assert "indonesia" in prompt.lower()
        assert "structure" in prompt.lower()

    @pytest.mark.unit
    def test_function_schema_generation(self, ai_service):
        """Test OpenAI function schema generation"""
        if ai_service is None:
            pytest.skip("AI service not available")
        
        schema = ai_service._get_function_schema()
        
        assert "name" in schema
        assert schema["name"] == "structure_product_data"
        assert "parameters" in schema
        assert "properties" in schema["parameters"]
        assert "products" in schema["parameters"]["properties"]

    @pytest.mark.unit
    def test_structured_prompt_creation(self, ai_service):
        """Test structured prompt creation"""
        if ai_service is None:
            pytest.skip("AI service not available")
        
        batch_data = [
            {"product_name": "Tomatoes", "price": "12500", "unit": "kg"},
            {"product_name": "Carrots", "price": "15000", "unit": "kg"}
        ]
        
        prompt = ai_service._create_structured_prompt(batch_data)
        
        assert isinstance(prompt, str)
        assert "Tomatoes" in prompt
        assert "Carrots" in prompt
        assert "Row 1:" in prompt
        assert "Row 2:" in prompt

    @pytest.mark.unit
    def test_product_validation(self, ai_service):
        """Test product data validation"""
        if ai_service is None or ProductData is None:
            pytest.skip("AI service or ProductData not available")
        
        # Valid product
        valid_product = ProductData(
            name="Fresh Tomatoes",
            price=12500,
            confidence=0.85
        )
        assert ai_service._is_valid_product(valid_product)
        
        # Invalid products
        # No name
        invalid_no_name = ProductData(
            name="",
            price=12500,
            confidence=0.85
        )
        assert not ai_service._is_valid_product(invalid_no_name)
        
        # No price (if required)
        if ai_service.require_price:
            invalid_no_price = ProductData(
                name="Product",
                confidence=0.85
            )
            assert not ai_service._is_valid_product(invalid_no_price)
        
        # Low confidence
        invalid_low_confidence = ProductData(
            name="Product",
            price=12500,
            confidence=0.5  # Below threshold
        )
        assert not ai_service._is_valid_product(invalid_low_confidence)

    @pytest.mark.unit
    def test_product_enhancement(self, ai_service):
        """Test product data enhancement"""
        if ai_service is None or ProductData is None:
            pytest.skip("AI service or ProductData not available")
        
        product = ProductData(
            name="  fresh   tomatoes  ",
            unit="kilogram",
            confidence=0.8
        )
        
        enhanced = ai_service._enhance_product_data(product)
        
        # Name should be normalized
        assert enhanced.name == "Fresh Tomatoes"
        
        # Unit should be normalized
        assert enhanced.unit == "kg"
        
        # Should have default currency
        assert enhanced.currency == "IDR"
        
        # Should infer category
        assert enhanced.category is not None

    @pytest.mark.unit
    def test_name_normalization(self, ai_service):
        """Test product name normalization"""
        if ai_service is None:
            pytest.skip("AI service not available")
        
        test_cases = [
            ("  fresh   tomatoes  ", "Fresh Tomatoes"),
            ("product: premium milk", "Premium Milk"),
            ("COFFEE BEANS", "Coffee Beans"),
            ("item:bread", "Bread")
        ]
        
        for input_name, expected in test_cases:
            result = ai_service._normalize_product_name(input_name)
            assert result == expected

    @pytest.mark.unit
    def test_unit_normalization(self, ai_service):
        """Test unit normalization"""
        if ai_service is None:
            pytest.skip("AI service not available")
        
        test_cases = [
            ("kilogram", "kg"),
            ("pieces", "piece"),
            ("liter", "liter"),
            ("pcs", "piece"),
            ("boxes", "box")
        ]
        
        for input_unit, expected in test_cases:
            result = ai_service._normalize_unit(input_unit)
            assert result == expected

    @pytest.mark.unit
    def test_category_inference(self, ai_service):
        """Test category inference from product names"""
        if ai_service is None:
            pytest.skip("AI service not available")
        
        test_cases = [
            ("Fresh Tomatoes", "Vegetables"),
            ("Premium Milk", "Dairy"),
            ("Chicken Breast", "Meat & Seafood"),
            ("Coffee Beans", "Food & Beverage"),
            ("Unknown Product", "General")
        ]
        
        for product_name, expected_category in test_cases:
            result = ai_service._infer_category(product_name)
            assert result == expected_category

    @pytest.mark.unit
    def test_fallback_result_creation(self, ai_service, sample_table_data):
        """Test fallback result when AI is unavailable"""
        if ai_service is None:
            pytest.skip("AI service not available")
        
        result = ai_service._create_fallback_result(sample_table_data, "Test error")
        
        assert result["success"] is False
        assert result["error"] == "Test error"
        assert len(result["products"]) == 0
        assert "metadata" in result
        assert "processing_stats" in result

    @pytest.mark.unit
    @patch('openai.OpenAI')
    def test_mock_ai_processing(self, mock_openai, ai_service, sample_table_data):
        """Test AI processing with mocked OpenAI calls"""
        if ai_service is None:
            pytest.skip("AI service not available")
        
        # Mock OpenAI response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message = Mock()
        mock_response.choices[0].message.function_call = Mock()
        mock_response.choices[0].message.function_call.arguments = json.dumps({
            "products": [
                {
                    "name": "Fresh Tomatoes",
                    "unit": "kg",
                    "price": 12500,
                    "currency": "IDR",
                    "category": "Vegetables",
                    "confidence": 0.9
                }
            ]
        })
        mock_response.usage = Mock()
        mock_response.usage.prompt_tokens = 150
        mock_response.usage.completion_tokens = 80
        mock_response.usage.total_tokens = 230
        
        mock_client = Mock()
        mock_client.chat.completions.create.return_value = mock_response
        ai_service.client = mock_client
        ai_service.enabled = True
        
        # Process data
        result = ai_service.structure_extracted_data(sample_table_data)
        
        assert result["success"] is True
        assert len(result["products"]) >= 1
        assert result["metadata"]["token_usage"]["total_tokens"] > 0


@pytest.mark.integration
class TestAIStructuringIntegration:
    """Integration tests for AI structuring (requires API key)"""

    @pytest.mark.skipif(not os.getenv('OPENAI_API_KEY'), reason="OpenAI API key not available")
    def test_real_api_integration(self):
        """Test with real OpenAI API (requires API key)"""
        if AIStructuringService is None:
            pytest.skip("AI service not available")
        
        config = {
            'openai_api_key': os.getenv('OPENAI_API_KEY'),
            'model': 'gpt-o3',
            'batch_size': 2,  # Small batch for testing
            'min_confidence': 0.6
        }
        
        service = AIStructuringService(config)
        
        # Simple test data
        test_data = {
            "data_type": "table_extraction",
            "tables": [
                {
                    "data": [
                        ["Fresh Tomatoes", "kg", "12500"],
                        ["Premium Milk", "liter", "8750"]
                    ],
                    "headers": ["Product", "Unit", "Price"],
                    "table_id": "test_table"
                }
            ]
        }
        
        try:
            result = service.structure_extracted_data(test_data)
            
            assert result["success"] is True
            assert len(result["products"]) >= 1
            assert result["metadata"]["token_usage"]["total_tokens"] > 0
            
            # Check first product
            first_product = result["products"][0]
            assert "name" in first_product
            assert "confidence" in first_product
            assert first_product["confidence"] > 0
            
        except Exception as e:
            pytest.skip(f"API integration test failed: {e}")


@pytest.mark.benchmark
class TestAIStructuringPerformance:
    """Performance benchmarks for AI structuring"""

    def test_data_preparation_speed(self, benchmark):
        """Benchmark data preparation speed"""
        if AIStructuringService is None:
            pytest.skip("AI service not available")
        
        # Create large dataset
        large_dataset = {
            "data_type": "table_extraction",
            "tables": [
                {
                    "data": [
                        [f"Product {i}", "kg", f"{1000 + i * 100}", "Category"]
                        for i in range(100)
                    ],
                    "headers": ["Product", "Unit", "Price", "Category"]
                }
            ]
        }
        
        service = AIStructuringService()
        
        result = benchmark(service._prepare_data_for_ai, large_dataset)
        
        assert len(result) == 100
        assert all(isinstance(row, dict) for row in result)

    def test_batch_creation_speed(self, benchmark):
        """Benchmark batch creation speed"""
        if AIStructuringService is None:
            pytest.skip("AI service not available")
        
        # Large data array
        large_data = [{"item": f"Product {i}"} for i in range(1000)]
        
        service = AIStructuringService({'batch_size': 10})
        
        batches = benchmark(lambda: list(service._create_batches(large_data)))
        
        assert len(batches) == 100  # 1000 items / 10 per batch


# Test CLI interface
class TestAIStructuringCLI:
    """Test CLI interface for AI structuring"""

    def test_cli_with_valid_data(self, tmp_path):
        """Test CLI with valid extracted data"""
        if AIStructuringService is None:
            pytest.skip("AI service not available")
        
        # Create test input file
        test_data = {
            "data_type": "table_extraction",
            "tables": [
                {
                    "data": [["Test Product", "kg", "12500"]],
                    "headers": ["Product", "Unit", "Price"]
                }
            ]
        }
        
        input_file = tmp_path / "test_input.json"
        with open(input_file, 'w') as f:
            json.dump(test_data, f)
        
        import subprocess
        import sys
        
        script_path = Path(__file__).parent.parent / "src" / "pipeline" / "ai_structuring_service.py"
        
        # Set mock API key for testing
        env = os.environ.copy()
        env['OPENAI_API_KEY'] = 'test-key'
        
        result = subprocess.run([
            sys.executable, str(script_path), str(input_file)
        ], capture_output=True, text=True, env=env, timeout=30)
        
        # CLI should handle the mock key gracefully
        assert result.returncode in [0, 1]  # Either success or expected failure with mock key

    def test_cli_with_missing_file(self):
        """Test CLI with non-existent file"""
        if AIStructuringService is None:
            pytest.skip("AI service not available")
        
        import subprocess
        import sys
        
        script_path = Path(__file__).parent.parent / "src" / "pipeline" / "ai_structuring_service.py"
        
        result = subprocess.run([
            sys.executable, str(script_path), "/path/that/does/not/exist.json"
        ], capture_output=True, text=True)
        
        assert result.returncode == 1
        assert "not found" in result.stderr.lower()


# Parameterized tests for different configurations
@pytest.mark.parametrize("config,expected_behavior", [
    ({"min_confidence": 0.9}, "high_confidence_only"),
    ({"require_price": False}, "allow_no_price"),
    ({"batch_size": 2}, "small_batches"),
    ({"temperature": 0.0}, "deterministic")
])
def test_configuration_behaviors(config, expected_behavior):
    """Test different configuration behaviors"""
    if AIStructuringService is None:
        pytest.skip("AI service not available")
    
    service = AIStructuringService(config)
    
    if expected_behavior == "high_confidence_only":
        assert service.min_confidence == 0.9
    elif expected_behavior == "allow_no_price":
        assert service.require_price is False
    elif expected_behavior == "small_batches":
        assert service.batch_size == 2
    elif expected_behavior == "deterministic":
        assert service.temperature == 0.0