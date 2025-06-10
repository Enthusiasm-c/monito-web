"""
Pytest configuration and fixtures for extraction pipeline testing
"""

import pytest
import os
import hashlib
from pathlib import Path
from typing import Dict, List, Any
import json

# Test data directory
FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"
TEST_FILES_DIR = Path(__file__).parent.parent / "test-files"

@pytest.fixture
def fixtures_dir():
    """Get fixtures directory path"""
    return FIXTURES_DIR

@pytest.fixture
def test_files_dir():
    """Get test files directory path"""
    return TEST_FILES_DIR

@pytest.fixture
def reference_files():
    """Load reference files configuration"""
    return {
        "pdf_structured": {
            "file": "PRICE QUOTATATION FOR EGGSTRA CAFE.pdf",
            "type": "application/pdf",
            "expected_min_rows": 150,
            "expected_products": 140,
            "supplier_name": "CHEESE",
            "has_prices": True,
            "complexity": "medium"
        },
        "pdf_complex": {
            "file": "milk up.pdf", 
            "type": "application/pdf",
            "expected_min_rows": 200,
            "expected_products": 180,
            "supplier_name": "MILK UP",
            "has_prices": True,
            "complexity": "high"
        },
        "pdf_simple": {
            "file": "bali sustainable seafood.pdf",
            "type": "application/pdf", 
            "expected_min_rows": 80,
            "expected_products": 70,
            "supplier_name": "BALI SUSTAINABLE SEAFOOD",
            "has_prices": True,
            "complexity": "low"
        },
        "excel_multi_sheet": {
            "file": "FreshFarms_PriceList.xlsx",
            "type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "expected_min_rows": 100,
            "expected_products": 90,
            "supplier_name": "Fresh Farms",
            "has_prices": True,
            "complexity": "medium"
        },
        "csv_simple": {
            "file": "FreshFarms_PriceList.csv",
            "type": "text/csv",
            "expected_min_rows": 50,
            "expected_products": 45,
            "supplier_name": "Fresh Farms",
            "has_prices": True,
            "complexity": "low"
        },
        "image_menu": {
            "file": "restaurant_menu.jpg",
            "type": "image/jpeg",
            "expected_min_rows": 30,
            "expected_products": 25,
            "supplier_name": "Restaurant Menu",
            "has_prices": True,
            "complexity": "high"
        },
        "pdf_catalog": {
            "file": "wholesale_catalog.pdf",
            "type": "application/pdf",
            "expected_min_rows": 300,
            "expected_products": 280,
            "supplier_name": "Wholesale Catalog",
            "has_prices": True,
            "complexity": "high"
        },
        "excel_single_sheet": {
            "file": "simple_price_list.xlsx",
            "type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "expected_min_rows": 40,
            "expected_products": 35,
            "supplier_name": "Simple Supplier",
            "has_prices": True,
            "complexity": "low"
        },
        "pdf_scanned": {
            "file": "scanned_price_list.pdf",
            "type": "application/pdf",
            "expected_min_rows": 60,
            "expected_products": 50,
            "supplier_name": "Scanned Supplier",
            "has_prices": True,
            "complexity": "high"
        },
        "csv_complex": {
            "file": "complex_inventory.csv",
            "type": "text/csv",
            "expected_min_rows": 200,
            "expected_products": 180,
            "supplier_name": "Complex Inventory",
            "has_prices": True,
            "complexity": "medium"
        }
    }

@pytest.fixture
def expected_schema():
    """Expected JSON schema for extracted data"""
    return {
        "type": "object",
        "required": ["supplier", "products", "metadata"],
        "properties": {
            "supplier": {
                "type": "object",
                "required": ["name"],
                "properties": {
                    "name": {"type": "string"},
                    "email": {"type": ["string", "null"]},
                    "phone": {"type": ["string", "null"]},
                    "address": {"type": ["string", "null"]}
                }
            },
            "products": {
                "type": "array",
                "minItems": 1,
                "items": {
                    "type": "object",
                    "required": ["product", "uom", "price"],
                    "properties": {
                        "product": {"type": "string", "minLength": 2},
                        "uom": {"type": "string"},
                        "size": {"type": ["string", "number", "null"]},
                        "pack_qty": {"type": ["number", "null"]},
                        "price": {"type": "number", "minimum": 0},
                        "price_type": {"type": "string", "enum": ["unit", "bulk", "wholesale", "retail"]}
                    }
                }
            },
            "metadata": {
                "type": "object",
                "required": ["document_type", "total_rows", "processed_rows"],
                "properties": {
                    "document_type": {"type": "string"},
                    "file_hash": {"type": "string"},
                    "total_rows": {"type": "integer", "minimum": 0},
                    "processed_rows": {"type": "integer", "minimum": 0},
                    "extraction_method": {"type": "string"},
                    "processing_time_ms": {"type": "number", "minimum": 0}
                }
            }
        }
    }

@pytest.fixture
def file_hasher():
    """Utility function to calculate file hashes"""
    def _hash_file(file_path: Path) -> str:
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()
    return _hash_file

@pytest.fixture
def performance_thresholds():
    """Performance thresholds for different file types"""
    return {
        "pdf_simple": {"max_time_s": 15, "min_accuracy": 0.90},
        "pdf_medium": {"max_time_s": 30, "min_accuracy": 0.85},
        "pdf_complex": {"max_time_s": 60, "min_accuracy": 0.80},
        "excel_simple": {"max_time_s": 5, "min_accuracy": 0.95},
        "excel_complex": {"max_time_s": 15, "min_accuracy": 0.90},
        "csv_simple": {"max_time_s": 3, "min_accuracy": 0.98},
        "csv_complex": {"max_time_s": 10, "min_accuracy": 0.95},
        "image_simple": {"max_time_s": 20, "min_accuracy": 0.75},
        "image_complex": {"max_time_s": 45, "min_accuracy": 0.70}
    }

@pytest.fixture
def document_types():
    """Document type enumeration"""
    from enum import Enum
    
    class DocumentType(Enum):
        PDF_STRUCTURED = "pdf_structured"
        PDF_SCANNED = "pdf_scanned"
        PDF_IMAGE = "pdf_image"
        EXCEL_SINGLE = "excel_single"
        EXCEL_MULTI = "excel_multi"
        CSV_SIMPLE = "csv_simple"
        CSV_COMPLEX = "csv_complex"
        IMAGE_MENU = "image_menu"
        IMAGE_CATALOG = "image_catalog"
        UNKNOWN = "unknown"
    
    return DocumentType

# Test helper functions
def create_mock_extracted_data(reference_file: Dict[str, Any]) -> Dict[str, Any]:
    """Create mock extracted data for testing"""
    return {
        "supplier": {
            "name": reference_file["supplier_name"],
            "email": None,
            "phone": None,
            "address": None
        },
        "products": [
            {
                "product": f"Test Product {i+1}",
                "uom": "kg",
                "size": "1",
                "pack_qty": 1,
                "price": 10.0 + i,
                "price_type": "unit"
            }
            for i in range(min(5, reference_file["expected_products"]))
        ],
        "metadata": {
            "document_type": reference_file["type"],
            "file_hash": "test_hash",
            "total_rows": reference_file["expected_min_rows"],
            "processed_rows": reference_file["expected_products"],
            "extraction_method": "test",
            "processing_time_ms": 1000
        }
    }