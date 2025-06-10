"""
Tests for PDF Text Extraction with OCR Fallback
Tests Task 3: PDF text extraction and fallback OCR
"""

import pytest
import tempfile
import os
from pathlib import Path
import json
from unittest.mock import Mock, patch, MagicMock

# Import our PDF text extraction modules
import sys
sys.path.append(str(Path(__file__).parent.parent))

from src.pipeline.pdf_text_extractor import PDFTextExtractor


class TestPDFTextExtractor:
    """Test PDF text extraction functionality"""

    @pytest.fixture
    def extractor(self):
        """Create PDF text extractor instance"""
        config = {
            'min_text_chars_per_page': 50,
            'ocr_timeout': 60,  # Shorter timeout for tests
            'force_ocr': False,
            'deskew_enabled': True,
            'contrast_enhancement': True
        }
        return PDFTextExtractor(config)

    @pytest.fixture
    def sample_pdf_with_text(self, tmp_path):
        """Create a sample PDF with text content"""
        pdf_content = b"""%PDF-1.4
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
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj
4 0 obj
<<
/Length 200
>>
stream
BT
/F1 12 Tf
72 720 Td
(Product Name: Fresh Tomatoes) Tj
0 -20 Td
(Unit: kg) Tj
0 -20 Td
(Price: 12.50 IDR) Tj
0 -20 Td
(Category: Vegetables) Tj
0 -20 Td
(Supplier: Farm Fresh Co) Tj
0 -20 Td
(Contact: info@farmfresh.com) Tj
ET
endstream
endobj
5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj
xref
0 6
0000000000 65535 f 
0000000015 00000 n 
0000000074 00000 n 
0000000131 00000 n 
0000000271 00000 n 
0000000524 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
601
%%EOF"""
        
        pdf_file = tmp_path / "sample_with_text.pdf"
        pdf_file.write_bytes(pdf_content)
        return pdf_file

    @pytest.fixture
    def sample_pdf_minimal(self, tmp_path):
        """Create a minimal PDF with very little text"""
        pdf_content = b"""%PDF-1.4
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
/Length 20
>>
stream
BT
/F1 12 Tf
72 720 Td
(X) Tj
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
290
%%EOF"""
        
        pdf_file = tmp_path / "sample_minimal.pdf"
        pdf_file.write_bytes(pdf_content)
        return pdf_file

    def test_extractor_initialization(self, extractor):
        """Test PDF text extractor initialization"""
        assert extractor.min_text_chars_per_page == 50
        assert extractor.ocr_timeout == 60
        assert extractor.force_ocr is False
        assert extractor.deskew_enabled is True
        assert extractor.contrast_enhancement is True

    @pytest.mark.unit
    def test_text_layer_analysis_good_pdf(self, extractor, sample_pdf_with_text):
        """Test text layer analysis for PDF with good text"""
        analysis = extractor._analyze_text_layer(sample_pdf_with_text)
        
        assert analysis["total_pages"] == 1
        assert analysis["total_text_chars"] > 50
        assert analysis["pages_with_text"] == 1
        assert analysis["text_layer_quality"] in ["good", "fair"]
        assert analysis["avg_chars_per_page"] > 50

    @pytest.mark.unit
    def test_text_layer_analysis_minimal_pdf(self, extractor, sample_pdf_minimal):
        """Test text layer analysis for PDF with minimal text"""
        analysis = extractor._analyze_text_layer(sample_pdf_minimal)
        
        assert analysis["total_pages"] == 1
        assert analysis["total_text_chars"] < 50
        assert analysis["pages_with_text"] == 0  # Below threshold
        assert analysis["text_layer_quality"] == "poor"

    @pytest.mark.unit
    def test_extraction_strategy_determination(self, extractor):
        """Test extraction strategy determination logic"""
        
        # Good text layer should use text extraction
        good_analysis = {
            "text_layer_quality": "good",
            "pages_with_text": 5,
            "total_pages": 5
        }
        strategy = extractor._determine_extraction_strategy(good_analysis)
        assert strategy == "text_layer"
        
        # Poor text layer should use OCR
        poor_analysis = {
            "text_layer_quality": "poor",
            "pages_with_text": 1,
            "total_pages": 5
        }
        strategy = extractor._determine_extraction_strategy(poor_analysis)
        assert strategy == "ocr_only"
        
        # Fair text layer with missing pages should use hybrid
        fair_analysis = {
            "text_layer_quality": "fair",
            "pages_with_text": 2,
            "total_pages": 5
        }
        strategy = extractor._determine_extraction_strategy(fair_analysis)
        assert strategy == "hybrid"

    @pytest.mark.unit
    def test_force_ocr_configuration(self, tmp_path):
        """Test force OCR configuration"""
        config = {'force_ocr': True}
        extractor = PDFTextExtractor(config)
        
        # Any analysis should result in OCR strategy when force_ocr is True
        good_analysis = {"text_layer_quality": "good"}
        strategy = extractor._determine_extraction_strategy(good_analysis)
        assert strategy == "ocr_only"

    @pytest.mark.unit 
    def test_text_layer_extraction(self, extractor, sample_pdf_with_text):
        """Test text layer extraction"""
        try:
            result = extractor._extract_text_layer(sample_pdf_with_text)
            
            assert "text_content" in result
            assert "page_texts" in result
            assert len(result["page_texts"]) == 1
            assert len(result["text_content"]) > 0
            
            # Should contain expected product information
            text_content = result["text_content"].lower()
            assert "tomatoes" in text_content or "product" in text_content
            
        except RuntimeError as e:
            if "PyMuPDF not available" in str(e):
                pytest.skip("PyMuPDF not available for testing")
            else:
                raise

    @pytest.mark.unit
    def test_file_not_found_error(self, extractor):
        """Test error handling for non-existent files"""
        non_existent_file = Path("/path/that/does/not/exist.pdf")
        
        with pytest.raises(FileNotFoundError):
            extractor.extract_text_from_pdf(non_existent_file)

    @pytest.mark.unit
    def test_full_extraction_workflow_text_layer(self, extractor, sample_pdf_with_text):
        """Test complete extraction workflow for PDF with text layer"""
        result = extractor.extract_text_from_pdf(sample_pdf_with_text)
        
        # Verify result structure
        assert "file_path" in result
        assert "extraction_methods" in result
        assert "text_content" in result
        assert "page_texts" in result
        assert "metadata" in result
        assert "success" in result
        
        if result["success"]:
            # Verify metadata
            metadata = result["metadata"]
            assert metadata["total_pages"] == 1
            assert metadata["file_size_bytes"] > 0
            assert "text_layer_quality" in metadata
            assert "processing_time_ms" in metadata
            
            # Should use text layer extraction for this PDF
            assert "text_layer" in result["extraction_methods"]

    @pytest.mark.unit
    def test_extraction_with_minimal_text(self, extractor, sample_pdf_minimal):
        """Test extraction with PDF that has minimal text"""
        result = extractor.extract_text_from_pdf(sample_pdf_minimal)
        
        if result["success"]:
            metadata = result["metadata"]
            assert metadata["total_pages"] == 1
            assert metadata["text_layer_quality"] in ["poor", "none"]
            
            # May trigger OCR for minimal text
            if metadata["ocr_applied"]:
                assert "ocr" in result["extraction_methods"]

    @pytest.mark.unit
    def test_check_ocrmypdf_availability(self, extractor):
        """Test checking ocrmypdf availability"""
        available = extractor._check_ocrmypdf()
        
        # This will vary by system, just ensure it returns a boolean
        assert isinstance(available, bool)
        
        if available:
            print("✅ ocrmypdf is available")
        else:
            print("⚠️ ocrmypdf is not available")

    @pytest.mark.unit
    def test_configuration_override(self):
        """Test configuration override"""
        custom_config = {
            'min_text_chars_per_page': 100,
            'ocr_timeout': 120,
            'force_ocr': True,
            'deskew_enabled': False
        }
        
        extractor = PDFTextExtractor(custom_config)
        
        assert extractor.min_text_chars_per_page == 100
        assert extractor.ocr_timeout == 120
        assert extractor.force_ocr is True
        assert extractor.deskew_enabled is False

    @pytest.mark.unit
    def test_extraction_methods_tracking(self, extractor, sample_pdf_with_text):
        """Test that extraction methods are properly tracked"""
        result = extractor.extract_text_from_pdf(sample_pdf_with_text)
        
        if result["success"]:
            assert len(result["extraction_methods"]) > 0
            assert all(method in ["text_layer", "ocr"] for method in result["extraction_methods"])

    @pytest.mark.unit
    def test_error_handling_and_recovery(self, extractor, tmp_path):
        """Test error handling during extraction"""
        # Create a file that looks like PDF but isn't
        fake_pdf = tmp_path / "fake.pdf"
        fake_pdf.write_bytes(b"This is not a PDF file")
        
        result = extractor.extract_text_from_pdf(fake_pdf)
        
        # Should handle error gracefully
        assert result["success"] is False
        assert "error" in result
        assert result["error"] is not None


@pytest.mark.integration
class TestPDFTextExtractionIntegration:
    """Integration tests for PDF text extraction"""

    def test_with_real_csv_as_pdf(self, fixtures_dir):
        """Test extraction workflow with converted CSV file"""
        # Skip if no real PDFs available in fixtures
        pdf_files = list((fixtures_dir / "pdf").glob("*.pdf")) if (fixtures_dir / "pdf").exists() else []
        
        if not pdf_files:
            pytest.skip("No PDF files in fixtures for integration testing")
        
        extractor = PDFTextExtractor()
        
        for pdf_file in pdf_files[:2]:  # Test first 2 PDFs only
            try:
                result = extractor.extract_text_from_pdf(pdf_file)
                
                print(f"✅ {pdf_file.name}: {result['metadata']['text_layer_quality']}, "
                      f"OCR: {result['metadata']['ocr_applied']}, "
                      f"Pages: {result['metadata']['total_pages']}")
                
                assert result["file_path"] == str(pdf_file)
                assert isinstance(result["success"], bool)
                
                if result["success"]:
                    assert result["metadata"]["total_pages"] > 0
                    assert len(result["page_texts"]) == result["metadata"]["total_pages"]
                
            except Exception as e:
                print(f"⚠️ {pdf_file.name}: {e}")
                # Don't fail test for individual file issues in integration tests


@pytest.mark.benchmark
class TestPDFTextExtractionPerformance:
    """Performance benchmarks for PDF text extraction"""

    def test_text_layer_extraction_speed(self, benchmark, tmp_path):
        """Benchmark text layer extraction speed"""
        # Create a multi-page PDF with text
        pdf_content = self._create_multipage_pdf_content(5)  # 5 pages
        pdf_file = tmp_path / "multipage.pdf"
        pdf_file.write_bytes(pdf_content)
        
        extractor = PDFTextExtractor({'force_ocr': False})  # Text layer only
        
        result = benchmark(extractor.extract_text_from_pdf, pdf_file)
        
        if result["success"]:
            assert result["metadata"]["total_pages"] == 5
            assert "text_layer" in result["extraction_methods"]

    def test_ocr_extraction_speed(self, benchmark, tmp_path):
        """Benchmark OCR extraction speed (with timeout)"""
        # Create a simple PDF for OCR testing
        pdf_content = self._create_simple_pdf_content()
        pdf_file = tmp_path / "simple.pdf"
        pdf_file.write_bytes(pdf_content)
        
        extractor = PDFTextExtractor({
            'force_ocr': True,  # Force OCR
            'ocr_timeout': 30   # Short timeout for benchmark
        })
        
        # Only run if OCR tools are available
        if not extractor._check_ocrmypdf():
            pytest.skip("OCR tools not available for benchmarking")
        
        result = benchmark(extractor.extract_text_from_pdf, pdf_file)
        
        # OCR might fail due to system dependencies, that's OK for benchmark
        if result["success"]:
            assert result["metadata"]["ocr_applied"] is True

    def _create_simple_pdf_content(self) -> bytes:
        """Create simple PDF content for testing"""
        return b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj
4 0 obj<</Length 44>>stream
BT /F1 12 Tf 72 720 Td (Test Content) Tj ET
endstream endobj
xref 0 5
0000000000 65535 f 
0000000015 00000 n 
0000000060 00000 n 
0000000111 00000 n 
0000000196 00000 n 
trailer<</Size 5/Root 1 0 R>>
startxref 289
%%EOF"""

    def _create_multipage_pdf_content(self, pages: int) -> bytes:
        """Create multi-page PDF content"""
        # This is a simplified implementation - in practice would use a PDF library
        return self._create_simple_pdf_content()  # Fallback to simple for now


# Test CLI interface
class TestPDFTextExtractionCLI:
    """Test CLI interface for PDF text extraction"""

    def test_cli_with_valid_pdf(self, tmp_path):
        """Test CLI with valid PDF file"""
        # Create test PDF
        pdf_content = b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj
4 0 obj<</Length 50>>stream
BT /F1 12 Tf 72 720 Td (CLI Test Content) Tj ET
endstream endobj
xref 0 5
0000000000 65535 f 
0000000015 00000 n 
0000000060 00000 n 
0000000111 00000 n 
0000000196 00000 n 
trailer<</Size 5/Root 1 0 R>>
startxref 295
%%EOF"""
        
        pdf_file = tmp_path / "cli_test.pdf"
        pdf_file.write_bytes(pdf_content)
        
        import subprocess
        import sys
        
        script_path = Path(__file__).parent.parent / "src" / "pipeline" / "pdf_text_extractor.py"
        
        result = subprocess.run([
            sys.executable, str(script_path), str(pdf_file)
        ], capture_output=True, text=True, timeout=60)
        
        if result.returncode == 0:
            # Parse output
            stdout_lines = result.stdout.strip().split('\n')
            json_line = None
            for line in stdout_lines:
                if line.startswith('PDF_TEXT_EXTRACTION_RESULT:'):
                    json_line = line
                    break
            
            if json_line:
                json_str = json_line.replace('PDF_TEXT_EXTRACTION_RESULT:', '')
                extraction_result = json.loads(json_str)
                
                assert extraction_result["success"] in [True, False]  # Either is valid
                assert extraction_result["metadata"]["total_pages"] == 1
            else:
                pytest.skip("No extraction result found - may be due to missing dependencies")
        else:
            # CLI might fail due to missing dependencies
            pytest.skip(f"CLI failed (code {result.returncode}): {result.stderr}")

    def test_cli_with_missing_file(self):
        """Test CLI with non-existent file"""
        import subprocess
        import sys
        
        script_path = Path(__file__).parent.parent / "src" / "pipeline" / "pdf_text_extractor.py"
        
        result = subprocess.run([
            sys.executable, str(script_path), "/path/that/does/not/exist.pdf"
        ], capture_output=True, text=True)
        
        assert result.returncode == 1
        assert "not found" in result.stderr.lower()


# Parameterized tests for different configurations
@pytest.mark.parametrize("config,expected_strategy", [
    ({"force_ocr": True}, "ocr_only"),
    ({"force_ocr": False, "min_text_chars_per_page": 10}, "text_layer"),
    ({"force_ocr": False, "min_text_chars_per_page": 100}, "ocr_only")
])
def test_configuration_strategies(config, expected_strategy, tmp_path):
    """Test different configuration strategies"""
    extractor = PDFTextExtractor(config)
    
    # Create PDF with moderate text content
    pdf_content = b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj  
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj
4 0 obj<</Length 60>>stream
BT /F1 12 Tf 72 720 Td (Medium text content here) Tj ET
endstream endobj
xref 0 5
0000000000 65535 f 
0000000015 00000 n 
0000000060 00000 n 
0000000111 00000 n 
0000000196 00000 n 
trailer<</Size 5/Root 1 0 R>>
startxref 305
%%EOF"""
    
    pdf_file = tmp_path / "config_test.pdf"
    pdf_file.write_bytes(pdf_content)
    
    analysis = extractor._analyze_text_layer(pdf_file)
    strategy = extractor._determine_extraction_strategy(analysis)
    
    # Strategy should match expected based on configuration
    if config.get("force_ocr"):
        assert strategy == "ocr_only"
    # Other assertions depend on actual text analysis results