"""
Tests for Document Classification System
Tests Task 2: Auto document type recognition with MIME + hash
"""

import pytest
import tempfile
import os
from pathlib import Path
import json
import hashlib
from unittest.mock import Mock, patch

# Import our classification modules
import sys
sys.path.append(str(Path(__file__).parent.parent))

from scripts.document_classifier_cli import DocumentClassifier, DocumentType


class TestDocumentClassifier:
    """Test the core document classifier functionality"""

    @pytest.fixture
    def classifier(self):
        """Create classifier instance"""
        return DocumentClassifier()

    @pytest.fixture
    def sample_pdf_content(self):
        """Sample PDF content for testing"""
        # Minimal PDF content
        return b"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(Hello World) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000015 00000 n 
0000000074 00000 n 
0000000131 00000 n 
0000000225 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
318
%%EOF"""

    @pytest.fixture
    def sample_csv_content(self):
        """Sample CSV content for testing"""
        return """Product Name,Unit,Price,Category
Tomatoes,kg,12.50,Vegetables
Chicken Breast,kg,55.00,Meat
Jasmine Rice,kg,30.00,Grains
Cheddar Cheese,kg,95.00,Dairy
"""

    def test_file_hash_calculation(self, classifier, tmp_path):
        """Test file hash calculation"""
        # Create test file
        test_file = tmp_path / "test.txt"
        test_content = b"Hello, World!"
        test_file.write_bytes(test_content)
        
        # Calculate hash
        file_hash = classifier._calculate_file_hash(test_file)
        
        # Verify hash is correct SHA-256
        expected_hash = hashlib.sha256(test_content).hexdigest()
        assert file_hash == expected_hash
        assert len(file_hash) == 64  # SHA-256 is 64 hex characters

    def test_mime_detection_pdf(self, classifier, tmp_path, sample_pdf_content):
        """Test MIME detection for PDF files"""
        pdf_file = tmp_path / "test.pdf"
        pdf_file.write_bytes(sample_pdf_content)
        
        mime_type = classifier._detect_mime_type(pdf_file)
        assert mime_type == "application/pdf"

    def test_mime_detection_csv(self, classifier, tmp_path, sample_csv_content):
        """Test MIME detection for CSV files"""
        csv_file = tmp_path / "test.csv"
        csv_file.write_text(sample_csv_content)
        
        mime_type = classifier._detect_mime_type(csv_file)
        assert mime_type == "text/csv"

    def test_fallback_mime_detection(self, classifier, tmp_path):
        """Test fallback MIME detection based on extensions"""
        # Test various extensions
        test_cases = [
            ("test.pdf", "application/pdf"),
            ("test.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            ("test.csv", "text/csv"),
            ("test.jpg", "image/jpeg"),
            ("test.unknown", "application/octet-stream")
        ]
        
        for filename, expected_mime in test_cases:
            test_file = tmp_path / filename
            test_file.write_text("dummy content")
            
            mime_type = classifier._fallback_mime_detection(test_file)
            assert mime_type == expected_mime

    def test_pdf_classification_structured(self, classifier, tmp_path, sample_pdf_content):
        """Test PDF classification - structured"""
        pdf_file = tmp_path / "structured.pdf"
        pdf_file.write_bytes(sample_pdf_content)
        
        # Mock structured table detection
        with patch.object(classifier, '_has_structured_tables', return_value=True):
            doc_type = classifier._classify_pdf(pdf_file)
            assert doc_type == DocumentType.PDF_STRUCTURED

    def test_csv_classification_simple(self, classifier, tmp_path):
        """Test CSV classification - simple"""
        csv_content = "name,price\nApple,1.50\nBanana,0.80\n"
        csv_file = tmp_path / "simple.csv"
        csv_file.write_text(csv_content)
        
        doc_type = classifier._classify_csv(csv_file)
        assert doc_type == DocumentType.CSV_SIMPLE

    def test_csv_classification_complex(self, classifier, tmp_path):
        """Test CSV classification - complex"""
        # Create CSV with many columns
        columns = ["col" + str(i) for i in range(15)]  # 15 columns
        csv_content = ",".join(columns) + "\n"
        
        # Add many rows
        for i in range(50):
            row_data = [f"data{i}_{j}" for j in range(15)]
            csv_content += ",".join(row_data) + "\n"
        
        csv_file = tmp_path / "complex.csv"
        csv_file.write_text(csv_content)
        
        doc_type = classifier._classify_csv(csv_file)
        assert doc_type == DocumentType.CSV_COMPLEX

    def test_image_classification_menu(self, classifier, tmp_path):
        """Test image classification - menu"""
        image_file = tmp_path / "restaurant_menu.jpg"
        image_file.write_bytes(b"fake_image_data")
        
        doc_type = classifier._classify_image(image_file)
        assert doc_type == DocumentType.IMAGE_MENU

    def test_image_classification_catalog(self, classifier, tmp_path):
        """Test image classification - catalog"""
        image_file = tmp_path / "wholesale_catalog.jpg"
        image_file.write_bytes(b"fake_image_data")
        
        doc_type = classifier._classify_image(image_file)
        assert doc_type == DocumentType.IMAGE_CATALOG

    def test_full_classification_workflow(self, classifier, tmp_path, sample_csv_content):
        """Test complete classification workflow"""
        csv_file = tmp_path / "test_products.csv"
        csv_file.write_text(sample_csv_content)
        
        result = classifier.classify_document(csv_file)
        
        # Verify result structure
        assert "file_path" in result
        assert "file_hash" in result
        assert "mime_type" in result
        assert "document_type" in result
        assert "metadata" in result
        
        # Verify specific values
        assert result["file_path"] == str(csv_file)
        assert result["mime_type"] == "text/csv"
        assert result["document_type"] == "csv_simple"
        assert len(result["file_hash"]) == 64  # SHA-256
        
        # Verify metadata
        metadata = result["metadata"]
        assert metadata["file_name"] == "test_products.csv"
        assert metadata["file_extension"] == ".csv"
        assert metadata["file_size"] > 0

    def test_file_not_found_error(self, classifier):
        """Test error handling for non-existent files"""
        non_existent_file = Path("/path/that/does/not/exist.pdf")
        
        with pytest.raises(FileNotFoundError):
            classifier.classify_document(non_existent_file)

    def test_metadata_extraction(self, classifier, tmp_path):
        """Test file metadata extraction"""
        test_file = tmp_path / "metadata_test.txt"
        test_content = "Test content for metadata"
        test_file.write_text(test_content)
        
        metadata = classifier._get_file_metadata(test_file)
        
        assert metadata["file_name"] == "metadata_test.txt"
        assert metadata["file_extension"] == ".txt"
        assert metadata["file_size"] == len(test_content)
        assert "modified_time" in metadata
        assert "created_time" in metadata


class TestDocumentClassifierCLI:
    """Test the CLI interface"""

    def test_cli_with_valid_file(self, tmp_path, sample_csv_content):
        """Test CLI with valid CSV file"""
        csv_file = tmp_path / "cli_test.csv"
        csv_file.write_text(sample_csv_content)
        
        # Import and run the main function
        import subprocess
        import sys
        
        script_path = Path(__file__).parent.parent / "scripts" / "document_classifier_cli.py"
        
        result = subprocess.run([
            sys.executable, str(script_path), str(csv_file)
        ], capture_output=True, text=True)
        
        assert result.returncode == 0
        
        # Parse output
        stdout_lines = result.stdout.strip().split('\n')
        classification_line = None
        for line in stdout_lines:
            if line.startswith('CLASSIFICATION_RESULT:'):
                classification_line = line
                break
        
        assert classification_line is not None
        
        # Parse JSON result
        json_str = classification_line.replace('CLASSIFICATION_RESULT:', '')
        classification = json.loads(json_str)
        
        assert classification["document_type"] == "csv_simple"
        assert classification["mime_type"] == "text/csv"

    def test_cli_with_missing_file(self):
        """Test CLI with non-existent file"""
        import subprocess
        import sys
        
        script_path = Path(__file__).parent.parent / "scripts" / "document_classifier_cli.py"
        
        result = subprocess.run([
            sys.executable, str(script_path), "/path/that/does/not/exist.pdf"
        ], capture_output=True, text=True)
        
        assert result.returncode == 1
        assert "File not found" in result.stderr

    def test_cli_without_arguments(self):
        """Test CLI without required arguments"""
        import subprocess
        import sys
        
        script_path = Path(__file__).parent.parent / "scripts" / "document_classifier_cli.py"
        
        result = subprocess.run([
            sys.executable, str(script_path)
        ], capture_output=True, text=True)
        
        assert result.returncode == 1
        assert "Usage:" in result.stderr


@pytest.mark.integration
class TestDocumentTypeIntegration:
    """Integration tests for document type detection"""

    def test_fixture_files_classification(self, fixtures_dir):
        """Test classification of actual fixture files"""
        classifier = DocumentClassifier()
        
        # Test CSV files from fixtures
        csv_files = [
            fixtures_dir / "csv" / "basic_price_list.csv",
            fixtures_dir / "csv" / "detailed_inventory.csv"
        ]
        
        for csv_file in csv_files:
            if csv_file.exists():
                result = classifier.classify_document(csv_file)
                
                assert result["mime_type"] == "text/csv"
                assert result["document_type"] in ["csv_simple", "csv_complex"]
                assert len(result["file_hash"]) == 64
                assert result["metadata"]["file_size"] > 0
                
                print(f"✅ {csv_file.name}: {result['document_type']}")

    def test_hash_consistency(self, fixtures_dir):
        """Test that file hashes are consistent across multiple runs"""
        classifier = DocumentClassifier()
        
        test_file = fixtures_dir / "csv" / "basic_price_list.csv"
        if not test_file.exists():
            pytest.skip(f"Test file not found: {test_file}")
        
        # Calculate hash multiple times
        hashes = []
        for _ in range(3):
            result = classifier.classify_document(test_file)
            hashes.append(result["file_hash"])
        
        # All hashes should be identical
        assert len(set(hashes)) == 1, "File hash should be consistent"

    def test_duplicate_detection_scenario(self, fixtures_dir):
        """Test scenario for duplicate file detection"""
        classifier = DocumentClassifier()
        
        test_file = fixtures_dir / "csv" / "basic_price_list.csv"
        if not test_file.exists():
            pytest.skip(f"Test file not found: {test_file}")
        
        # Classify same file multiple times
        results = []
        for _ in range(2):
            result = classifier.classify_document(test_file)
            results.append(result)
        
        # Hashes should be identical (indicating duplicate)
        assert results[0]["file_hash"] == results[1]["file_hash"]
        assert results[0]["document_type"] == results[1]["document_type"]


@pytest.mark.benchmark
class TestDocumentClassificationPerformance:
    """Performance benchmarks for document classification"""

    def test_classification_speed_small_csv(self, benchmark, tmp_path):
        """Benchmark classification speed for small CSV files"""
        csv_content = "name,price\n" + "\n".join([f"Product {i},{i*1.5}" for i in range(100)])
        csv_file = tmp_path / "small.csv"
        csv_file.write_text(csv_content)
        
        classifier = DocumentClassifier()
        
        result = benchmark(classifier.classify_document, csv_file)
        assert result["document_type"] == "csv_simple"

    def test_classification_speed_large_csv(self, benchmark, tmp_path):
        """Benchmark classification speed for large CSV files"""
        # Create larger CSV (1000 rows, 10 columns)
        headers = ["col" + str(i) for i in range(10)]
        csv_content = ",".join(headers) + "\n"
        
        for i in range(1000):
            row = [f"data{i}_{j}" for j in range(10)]
            csv_content += ",".join(row) + "\n"
        
        csv_file = tmp_path / "large.csv"
        csv_file.write_text(csv_content)
        
        classifier = DocumentClassifier()
        
        result = benchmark(classifier.classify_document, csv_file)
        assert result["document_type"] == "csv_complex"

    def test_hash_calculation_speed(self, benchmark, tmp_path):
        """Benchmark hash calculation speed"""
        # Create 1MB test file
        large_content = "A" * (1024 * 1024)  # 1MB of 'A' characters
        large_file = tmp_path / "large_file.txt"
        large_file.write_text(large_content)
        
        classifier = DocumentClassifier()
        
        file_hash = benchmark(classifier._calculate_file_hash, large_file)
        assert len(file_hash) == 64  # SHA-256 length


# Test data validation
@pytest.mark.parametrize("document_type,expected_complexity", [
    ("pdf_structured", "low"),
    ("pdf_scanned", "high"), 
    ("excel_single", "low"),
    ("excel_multi", "medium"),
    ("csv_simple", "low"),
    ("csv_complex", "medium"),
    ("image_menu", "high")
])
def test_processing_recommendations(document_type, expected_complexity):
    """Test processing recommendations for different document types"""
    from src.pipeline.document_classifier_service import DocumentClassifierService
    
    service = DocumentClassifierService()
    
    # Mock classification result
    mock_classification = {
        "document_type": document_type,
        "metadata": {"file_size": 1024 * 1024}  # 1MB
    }
    
    result = service._add_processing_recommendations(mock_classification)
    
    assert "processing_recommendation" in result
    recommendation = result["processing_recommendation"]
    
    assert recommendation["complexity"] == expected_complexity
    assert "estimated_processing_time_s" in recommendation
    assert "priority" in recommendation
    assert "requires_ocr" in recommendation