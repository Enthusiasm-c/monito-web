"""
Document classification and type detection
Implements Task 2: Auto document type recognition with MIME + hash
"""

import hashlib
import magic
from enum import Enum
from pathlib import Path
from typing import Dict, Any, Optional
import structlog

logger = structlog.get_logger(__name__)


class DocumentType(Enum):
    """Document type enumeration for classification"""
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


class DocumentClassifier:
    """Automatic document type detection with MIME and hash calculation"""
    
    def __init__(self):
        self.mime_detector = magic.Magic(mime=True)
        self.logger = logger.bind(component="document_classifier")
    
    def classify_document(self, file_path: Path) -> Dict[str, Any]:
        """
        Classify document and calculate hash
        
        Args:
            file_path: Path to the document file
            
        Returns:
            Dict containing classification results
        """
        self.logger.info("Starting document classification", file_path=str(file_path))
        
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # Calculate file hash
        file_hash = self._calculate_file_hash(file_path)
        
        # Detect MIME type
        mime_type = self._detect_mime_type(file_path)
        
        # Determine document type
        doc_type = self._determine_document_type(file_path, mime_type)
        
        # Get file metadata
        metadata = self._get_file_metadata(file_path)
        
        result = {
            "file_path": str(file_path),
            "file_hash": file_hash,
            "mime_type": mime_type,
            "document_type": doc_type,
            "metadata": metadata
        }
        
        self.logger.info("Document classification completed", 
                        file_hash=file_hash,
                        mime_type=mime_type,
                        document_type=doc_type.value)
        
        return result
    
    def _calculate_file_hash(self, file_path: Path) -> str:
        """Calculate SHA-256 hash of the file"""
        sha256_hash = hashlib.sha256()
        
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        
        return sha256_hash.hexdigest()
    
    def _detect_mime_type(self, file_path: Path) -> str:
        """Detect MIME type using python-magic"""
        try:
            mime_type = self.mime_detector.from_file(str(file_path))
            return mime_type
        except Exception as e:
            self.logger.warning("MIME detection failed", error=str(e))
            # Fallback to extension-based detection
            return self._fallback_mime_detection(file_path)
    
    def _fallback_mime_detection(self, file_path: Path) -> str:
        """Fallback MIME detection based on file extension"""
        extension_map = {
            ".pdf": "application/pdf",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".xls": "application/vnd.ms-excel",
            ".csv": "text/csv",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".tiff": "image/tiff",
            ".bmp": "image/bmp"
        }
        
        suffix = file_path.suffix.lower()
        return extension_map.get(suffix, "application/octet-stream")
    
    def _determine_document_type(self, file_path: Path, mime_type: str) -> DocumentType:
        """Determine specific document type based on MIME and content analysis"""
        
        if mime_type == "application/pdf":
            return self._classify_pdf(file_path)
        elif mime_type in ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                          "application/vnd.ms-excel"]:
            return self._classify_excel(file_path)
        elif mime_type == "text/csv":
            return self._classify_csv(file_path)
        elif mime_type.startswith("image/"):
            return self._classify_image(file_path)
        else:
            return DocumentType.UNKNOWN
    
    def _classify_pdf(self, file_path: Path) -> DocumentType:
        """Classify PDF document type"""
        try:
            import fitz  # PyMuPDF
            
            doc = fitz.open(file_path)
            
            # Check if PDF has text layer
            total_chars = 0
            total_pages = len(doc)
            
            for page in doc:
                text = page.get_text()
                total_chars += len(text.strip())
            
            doc.close()
            
            if total_chars < total_pages * 50:  # Very little text per page
                return DocumentType.PDF_SCANNED
            elif self._has_structured_tables(file_path):
                return DocumentType.PDF_STRUCTURED
            else:
                return DocumentType.PDF_IMAGE
                
        except Exception as e:
            self.logger.warning("PDF classification failed", error=str(e))
            return DocumentType.PDF_STRUCTURED  # Default assumption
    
    def _classify_excel(self, file_path: Path) -> DocumentType:
        """Classify Excel document type"""
        try:
            import openpyxl
            
            workbook = openpyxl.load_workbook(file_path, read_only=True)
            sheet_count = len(workbook.worksheets)
            workbook.close()
            
            if sheet_count > 1:
                return DocumentType.EXCEL_MULTI
            else:
                return DocumentType.EXCEL_SINGLE
                
        except Exception as e:
            self.logger.warning("Excel classification failed", error=str(e))
            return DocumentType.EXCEL_SINGLE  # Default assumption
    
    def _classify_csv(self, file_path: Path) -> DocumentType:
        """Classify CSV document type"""
        try:
            import pandas as pd
            
            # Sample first few rows to determine complexity
            df = pd.read_csv(file_path, nrows=100)
            
            # Simple heuristic: complex if many columns or mixed data types
            if len(df.columns) > 10 or len(df) > 1000:
                return DocumentType.CSV_COMPLEX
            else:
                return DocumentType.CSV_SIMPLE
                
        except Exception as e:
            self.logger.warning("CSV classification failed", error=str(e))
            return DocumentType.CSV_SIMPLE  # Default assumption
    
    def _classify_image(self, file_path: Path) -> DocumentType:
        """Classify image document type"""
        # Simple heuristic based on filename
        filename = file_path.name.lower()
        
        if any(keyword in filename for keyword in ["menu", "restaurant", "cafe"]):
            return DocumentType.IMAGE_MENU
        elif any(keyword in filename for keyword in ["catalog", "wholesale", "price"]):
            return DocumentType.IMAGE_CATALOG
        else:
            return DocumentType.IMAGE_MENU  # Default assumption
    
    def _has_structured_tables(self, file_path: Path) -> bool:
        """Check if PDF has structured tables using camelot"""
        try:
            import camelot
            
            # Try to detect tables in first page
            tables = camelot.read_pdf(str(file_path), pages="1", flavor="lattice")
            
            return len(tables) > 0
            
        except Exception:
            # If camelot fails, assume no structured tables
            return False
    
    def _get_file_metadata(self, file_path: Path) -> Dict[str, Any]:
        """Get file metadata"""
        stat = file_path.stat()
        
        return {
            "file_size": stat.st_size,
            "file_name": file_path.name,
            "file_extension": file_path.suffix,
            "modified_time": stat.st_mtime,
            "created_time": stat.st_ctime
        }
    
    def get_upload_status(self, classification_result: Dict[str, Any]) -> str:
        """Determine initial upload status based on classification"""
        doc_type = classification_result["document_type"]
        file_size = classification_result["metadata"]["file_size"]
        
        # Large files or complex documents start as PENDING
        if file_size > 10 * 1024 * 1024:  # 10MB
            return "PENDING_LARGE"
        elif doc_type in [DocumentType.PDF_SCANNED, DocumentType.IMAGE_MENU, DocumentType.IMAGE_CATALOG]:
            return "PENDING_OCR"
        else:
            return "PENDING"


# Example usage and testing function
def test_document_classifier():
    """Test function for document classifier"""
    classifier = DocumentClassifier()
    
    # Test with sample files (when available)
    test_files = [
        Path("fixtures/pdf/sample_structured.pdf"),
        Path("fixtures/excel/sample_multi_sheet.xlsx"),
        Path("fixtures/csv/sample_simple.csv"),
        Path("fixtures/images/sample_menu.jpg")
    ]
    
    for file_path in test_files:
        if file_path.exists():
            try:
                result = classifier.classify_document(file_path)
                print(f"File: {file_path.name}")
                print(f"Type: {result['document_type'].value}")
                print(f"MIME: {result['mime_type']}")
                print(f"Hash: {result['file_hash'][:16]}...")
                print(f"Status: {classifier.get_upload_status(result)}")
                print("-" * 50)
            except Exception as e:
                print(f"Error processing {file_path}: {e}")


if __name__ == "__main__":
    test_document_classifier()