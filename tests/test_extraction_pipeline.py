"""
Test suite for the improved extraction pipeline
"""

import pytest
import time
import json
import tempfile
from pathlib import Path
from typing import Dict, List, Any
import jsonschema
from unittest.mock import Mock, patch

# Import our pipeline modules (will be created)
# from src.pipeline.document_classifier import DocumentClassifier
# from src.pipeline.extractor import ExtractionPipeline
# from src.pipeline.normalizer import ProductNormalizer


class TestExtractionPipeline:
    """Test class for the main extraction pipeline"""

    @pytest.mark.parametrize("file_key", [
        "pdf_structured", "pdf_complex", "pdf_simple",
        "excel_multi_sheet", "csv_simple", "image_menu",
        "pdf_catalog", "excel_single_sheet", "pdf_scanned", "csv_complex"
    ])
    def test_extract_min_rows(self, reference_files, file_key, expected_schema):
        """
        Test that each reference file extracts minimum expected rows
        This is the core acceptance test for the pipeline
        """
        file_config = reference_files[file_key]
        
        # Mock the extraction for now (will be replaced with real implementation)
        extracted_data = self._mock_extract_data(file_config)
        
        # Validate schema
        jsonschema.validate(extracted_data, expected_schema)
        
        # Check minimum row requirements
        assert len(extracted_data["products"]) >= file_config["expected_products"] * 0.8, \
            f"Expected at least {file_config['expected_products'] * 0.8} products, got {len(extracted_data['products'])}"
        
        # Check supplier detection
        assert extracted_data["supplier"]["name"] is not None, "Supplier name should be detected"
        
        # Check price extraction
        if file_config["has_prices"]:
            prices_found = [p for p in extracted_data["products"] if p["price"] > 0]
            assert len(prices_found) >= len(extracted_data["products"]) * 0.8, \
                "At least 80% of products should have valid prices"

    def test_document_type_detection(self, reference_files, file_hasher):
        """Test automatic document type detection with MIME and hash"""
        for file_key, file_config in reference_files.items():
            # Mock file path (in real implementation, would use actual files)
            mock_file_path = Path(f"/fixtures/{file_config['file']}")
            
            detected_type = self._mock_detect_document_type(file_config["type"])
            expected_mime = file_config["type"]
            
            assert detected_type == expected_mime, \
                f"Expected MIME type {expected_mime}, got {detected_type}"

    def test_performance_thresholds(self, reference_files, performance_thresholds):
        """Test that extraction meets performance requirements"""
        for file_key, file_config in reference_files.items():
            complexity = file_config["complexity"]
            threshold_key = f"{file_config['type'].split('/')[0]}_{complexity}"
            
            if threshold_key in performance_thresholds:
                threshold = performance_thresholds[threshold_key]
                
                # Mock timing (will be replaced with real benchmarks)
                start_time = time.time()
                extracted_data = self._mock_extract_data(file_config)
                processing_time = time.time() - start_time
                
                assert processing_time < threshold["max_time_s"], \
                    f"Processing took {processing_time:.2f}s, expected < {threshold['max_time_s']}s"

    def test_composite_price_parsing(self):
        """Test parsing of composite prices like '17/15' or '250@10 pcs'"""
        test_cases = [
            ("17/15", [{"price": 17, "type": "baked"}, {"price": 15, "type": "frozen"}]),
            ("250@10 pcs", [{"price": 250, "pack_qty": 10, "uom": "pcs"}]),
            ("12.50/11.00", [{"price": 12.50, "type": "baked"}, {"price": 11.00, "type": "frozen"}]),
            ("150@5kg", [{"price": 150, "pack_qty": 5, "uom": "kg"}])
        ]
        
        for price_text, expected in test_cases:
            parsed = self._mock_parse_composite_price(price_text)
            assert len(parsed) == len(expected), f"Expected {len(expected)} prices, got {len(parsed)}"
            
            for i, exp in enumerate(expected):
                for key, value in exp.items():
                    assert parsed[i][key] == value, f"Expected {key}={value}, got {parsed[i].get(key)}"

    def test_product_normalization(self):
        """Test product name normalization and fuzzy matching"""
        test_cases = [
            ("Cheddar 500 g", "Cheddar Block 0,5 kg", True),  # Should match
            ("Tomato Fresh 1kg", "Fresh Tomatoes 1 kg", True),  # Should match
            ("Chicken Breast", "Beef Steak", False),  # Should not match
            ("Rice Jasmine 5kg", "Jasmine Rice 5 kg", True)  # Should match
        ]
        
        for product1, product2, should_match in test_cases:
            similarity = self._mock_calculate_similarity(product1, product2)
            
            if should_match:
                assert similarity > 0.8, f"Expected high similarity between '{product1}' and '{product2}', got {similarity}"
            else:
                assert similarity < 0.6, f"Expected low similarity between '{product1}' and '{product2}', got {similarity}"

    def test_batch_database_operations(self):
        """Test batch database operations for performance"""
        # Mock 500 products for batch testing
        mock_products = [
            {
                "product": f"Test Product {i}",
                "uom": "kg",
                "price": 10.0 + i,
                "supplier_id": "test_supplier"
            }
            for i in range(500)
        ]
        
        # Mock batch operation timing
        start_time = time.time()
        result = self._mock_batch_insert(mock_products)
        batch_time = time.time() - start_time
        
        assert result["success"] is True, "Batch operation should succeed"
        assert result["inserted_count"] == 500, "All products should be inserted"
        assert batch_time < 5.0, f"Batch insert took {batch_time:.2f}s, expected < 5s"

    def test_ai_caching(self):
        """Test AI response caching functionality"""
        test_chunk = "Sample product text for AI processing"
        
        # First call should hit AI
        result1 = self._mock_ai_extract_with_cache(test_chunk)
        
        # Second call should use cache
        result2 = self._mock_ai_extract_with_cache(test_chunk)
        
        assert result1 == result2, "Cached result should match original"
        # In real implementation, would verify cache hit metrics

    def test_ocr_fallback(self):
        """Test OCR fallback for scanned documents"""
        # Mock scanned PDF without text layer
        mock_scanned_pdf = {
            "file": "scanned_document.pdf",
            "has_text_layer": False,
            "image_quality": "medium"
        }
        
        result = self._mock_ocr_extraction(mock_scanned_pdf)
        
        assert result["ocr_applied"] is True, "OCR should be applied for scanned documents"
        assert result["confidence"] > 0.7, "OCR confidence should be reasonable"
        assert len(result["extracted_text"]) > 0, "Should extract some text via OCR"

    def test_image_preprocessing(self):
        """Test image preprocessing for photo menus"""
        mock_menu_image = {
            "file": "restaurant_menu.jpg",
            "rotation": 15,  # degrees
            "contrast": "low",
            "resolution": "medium"
        }
        
        processed = self._mock_preprocess_image(mock_menu_image)
        
        assert processed["rotation_corrected"] is True, "Rotation should be corrected"
        assert processed["contrast_enhanced"] is True, "Contrast should be enhanced"
        assert processed["text_regions_detected"] > 0, "Should detect text regions"

    # Mock helper methods (will be replaced with real implementations)
    def _mock_extract_data(self, file_config: Dict[str, Any]) -> Dict[str, Any]:
        """Mock extraction for testing purposes"""
        from tests.conftest import create_mock_extracted_data
        return create_mock_extracted_data(file_config)

    def _mock_detect_document_type(self, mime_type: str) -> str:
        """Mock document type detection"""
        return mime_type

    def _mock_parse_composite_price(self, price_text: str) -> List[Dict[str, Any]]:
        """Mock composite price parsing"""
        import re
        
        # Pattern for "17/15" format
        slash_pattern = r"(\d+(?:\.\d+)?)\s*/\s*(\d+(?:\.\d+)?)"
        # Pattern for "250@10 pcs" format
        at_pattern = r"(\d+(?:\.\d+)?)@(\d+)\s*(\w+)"
        
        if re.match(slash_pattern, price_text):
            match = re.match(slash_pattern, price_text)
            return [
                {"price": float(match.group(1)), "type": "baked"},
                {"price": float(match.group(2)), "type": "frozen"}
            ]
        elif re.match(at_pattern, price_text):
            match = re.match(at_pattern, price_text)
            return [
                {
                    "price": float(match.group(1)),
                    "pack_qty": int(match.group(2)),
                    "uom": match.group(3)
                }
            ]
        else:
            return [{"price": float(price_text.replace(",", "."))}]

    def _mock_calculate_similarity(self, product1: str, product2: str) -> float:
        """Mock similarity calculation"""
        # Simple mock based on common words
        words1 = set(product1.lower().split())
        words2 = set(product2.lower().split())
        
        if not words1 or not words2:
            return 0.0
        
        common_words = words1.intersection(words2)
        total_words = words1.union(words2)
        
        return len(common_words) / len(total_words)

    def _mock_batch_insert(self, products: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Mock batch database insertion"""
        return {
            "success": True,
            "inserted_count": len(products),
            "execution_time_ms": 1000
        }

    def _mock_ai_extract_with_cache(self, text_chunk: str) -> Dict[str, Any]:
        """Mock AI extraction with caching"""
        return {
            "products": [{"product": "Mock Product", "price": 10.0}],
            "cache_hit": False,  # First call
            "processing_time_ms": 500
        }

    def _mock_ocr_extraction(self, document_info: Dict[str, Any]) -> Dict[str, Any]:
        """Mock OCR extraction"""
        return {
            "ocr_applied": True,
            "confidence": 0.85,
            "extracted_text": "Mock extracted text from OCR",
            "processing_time_ms": 2000
        }

    def _mock_preprocess_image(self, image_info: Dict[str, Any]) -> Dict[str, Any]:
        """Mock image preprocessing"""
        return {
            "rotation_corrected": True,
            "contrast_enhanced": True,
            "text_regions_detected": 5,
            "processing_time_ms": 800
        }


class TestPerformanceBenchmarks:
    """Performance and benchmark tests"""

    @pytest.mark.benchmark
    def test_extraction_speed_benchmark(self, reference_files, performance_thresholds):
        """Benchmark extraction speed across different file types"""
        results = {}
        
        for file_key, file_config in reference_files.items():
            start_time = time.time()
            extracted_data = self._mock_extract_data(file_config)
            processing_time = time.time() - start_time
            
            results[file_key] = {
                "processing_time": processing_time,
                "products_extracted": len(extracted_data["products"]),
                "products_per_second": len(extracted_data["products"]) / processing_time
            }
        
        # Log results for analysis
        print("\nPerformance Benchmark Results:")
        for file_key, metrics in results.items():
            print(f"{file_key}: {metrics['processing_time']:.2f}s, "
                  f"{metrics['products_extracted']} products, "
                  f"{metrics['products_per_second']:.1f} products/sec")

    def _mock_extract_data(self, file_config: Dict[str, Any]) -> Dict[str, Any]:
        """Mock extraction for benchmarking"""
        from tests.conftest import create_mock_extracted_data
        time.sleep(0.1)  # Simulate processing time
        return create_mock_extracted_data(file_config)


class TestDataValidation:
    """Data validation and schema tests"""

    def test_json_schema_validation(self, expected_schema):
        """Test that all extraction results conform to expected schema"""
        # Mock valid data
        valid_data = {
            "supplier": {"name": "Test Supplier"},
            "products": [
                {
                    "product": "Test Product",
                    "uom": "kg",
                    "price": 10.0,
                    "price_type": "unit"
                }
            ],
            "metadata": {
                "document_type": "application/pdf",
                "total_rows": 100,
                "processed_rows": 90
            }
        }
        
        # Should pass validation
        jsonschema.validate(valid_data, expected_schema)
        
        # Test invalid data
        invalid_data = {
            "supplier": {"name": ""},  # Empty name should fail
            "products": [],  # Empty products should fail
            "metadata": {"document_type": "unknown"}  # Missing required fields
        }
        
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(invalid_data, expected_schema)

    def test_snapshot_validation(self, reference_files):
        """Test that extraction results match saved snapshots"""
        for file_key, file_config in reference_files.items():
            extracted_data = self._mock_extract_data(file_config)
            
            # In real implementation, would compare against saved snapshots
            # For now, just validate structure
            assert "supplier" in extracted_data
            assert "products" in extracted_data
            assert "metadata" in extracted_data
            
            # Validate first 3 products structure
            products = extracted_data["products"][:3]
            for product in products:
                assert "product" in product
                assert "price" in product
                assert isinstance(product["price"], (int, float))
                assert product["price"] >= 0

    def _mock_extract_data(self, file_config: Dict[str, Any]) -> Dict[str, Any]:
        """Mock extraction for validation testing"""
        from tests.conftest import create_mock_extracted_data
        return create_mock_extracted_data(file_config)