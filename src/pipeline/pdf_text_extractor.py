#!/usr/bin/env python3
"""
Advanced PDF Text Extractor with OCR Fallback
Implements Task 3: PDF text extraction with fallback OCR and deskewing
"""

import sys
import json
import tempfile
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import time
import os

# PyMuPDF for PDF text extraction
try:
    import fitz
    PYMUPDF_AVAILABLE = True
except ImportError:
    print("[WARNING] PyMuPDF not available, OCR-only mode", file=sys.stderr)
    PYMUPDF_AVAILABLE = False

# PIL for image processing
try:
    from PIL import Image, ImageEnhance, ImageOps
    PIL_AVAILABLE = True
except ImportError:
    print("[WARNING] PIL not available, reduced image processing", file=sys.stderr)
    PIL_AVAILABLE = False

# OpenCV for advanced image preprocessing
try:
    import cv2
    import numpy as np
    OPENCV_AVAILABLE = True
except ImportError:
    print("[WARNING] OpenCV not available, basic image processing only", file=sys.stderr)
    OPENCV_AVAILABLE = False


class PDFTextExtractor:
    """Advanced PDF text extractor with OCR fallback"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        
        # Default configuration
        self.min_text_chars_per_page = self.config.get('min_text_chars_per_page', 50)
        self.ocr_timeout = self.config.get('ocr_timeout', 300)  # 5 minutes
        self.force_ocr = self.config.get('force_ocr', False)
        self.deskew_enabled = self.config.get('deskew_enabled', True)
        self.contrast_enhancement = self.config.get('contrast_enhancement', True)
        
        print(f"[INFO] PDF Text Extractor initialized", file=sys.stderr)
        print(f"[INFO] PyMuPDF: {'✓' if PYMUPDF_AVAILABLE else '✗'}", file=sys.stderr)
        print(f"[INFO] PIL: {'✓' if PIL_AVAILABLE else '✗'}", file=sys.stderr)
        print(f"[INFO] OpenCV: {'✓' if OPENCV_AVAILABLE else '✗'}", file=sys.stderr)
    
    def extract_text_from_pdf(self, pdf_path: Path) -> Dict[str, Any]:
        """
        Extract text from PDF with OCR fallback
        
        Returns:
            Dict containing extracted text, metadata, and processing info
        """
        start_time = time.time()
        
        print(f"[INFO] Processing PDF: {pdf_path}", file=sys.stderr)
        
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")
        
        result = {
            "file_path": str(pdf_path),
            "extraction_methods": [],
            "text_content": "",
            "page_texts": [],
            "metadata": {
                "total_pages": 0,
                "text_layer_quality": "unknown",
                "ocr_applied": False,
                "processing_time_ms": 0,
                "file_size_bytes": pdf_path.stat().st_size
            },
            "success": False,
            "error": None
        }
        
        try:
            # Step 1: Analyze PDF text layer
            text_analysis = self._analyze_text_layer(pdf_path)
            result["metadata"].update(text_analysis)
            
            # Step 2: Determine extraction strategy
            extraction_strategy = self._determine_extraction_strategy(text_analysis)
            print(f"[INFO] Extraction strategy: {extraction_strategy}", file=sys.stderr)
            
            # Step 3: Extract text based on strategy
            if extraction_strategy == "text_layer":
                text_result = self._extract_text_layer(pdf_path)
                result["extraction_methods"].append("text_layer")
                
            elif extraction_strategy == "ocr_only":
                text_result = self._extract_with_ocr(pdf_path)
                result["extraction_methods"].append("ocr")
                result["metadata"]["ocr_applied"] = True
                
            elif extraction_strategy == "hybrid":
                # Try text layer first, then OCR for problematic pages
                text_result = self._extract_hybrid(pdf_path, text_analysis)
                result["extraction_methods"].extend(["text_layer", "ocr"])
                result["metadata"]["ocr_applied"] = True
            
            else:
                raise ValueError(f"Unknown extraction strategy: {extraction_strategy}")
            
            # Update result with extracted text
            result.update(text_result)
            result["success"] = True
            
            # Calculate final metrics
            total_chars = sum(len(page_text) for page_text in result["page_texts"])
            result["metadata"]["total_characters"] = total_chars
            result["metadata"]["avg_chars_per_page"] = (
                total_chars / result["metadata"]["total_pages"] 
                if result["metadata"]["total_pages"] > 0 else 0
            )
            
        except Exception as e:
            result["error"] = str(e)
            result["success"] = False
            print(f"[ERROR] PDF extraction failed: {e}", file=sys.stderr)
        
        finally:
            result["metadata"]["processing_time_ms"] = int((time.time() - start_time) * 1000)
        
        return result
    
    def _analyze_text_layer(self, pdf_path: Path) -> Dict[str, Any]:
        """Analyze PDF text layer quality"""
        
        if not PYMUPDF_AVAILABLE:
            return {
                "total_pages": 0,
                "text_layer_quality": "unknown",
                "pages_with_text": 0,
                "total_text_chars": 0,
                "avg_chars_per_page": 0
            }
        
        try:
            doc = fitz.open(pdf_path)
            total_pages = len(doc)
            total_chars = 0
            pages_with_text = 0
            page_char_counts = []
            
            for page_num in range(total_pages):
                page = doc[page_num]
                text = page.get_text().strip()
                char_count = len(text)
                
                total_chars += char_count
                page_char_counts.append(char_count)
                
                if char_count > self.min_text_chars_per_page:
                    pages_with_text += 1
            
            doc.close()
            
            # Determine text layer quality
            if total_chars == 0:
                quality = "none"
            elif pages_with_text / total_pages < 0.3:
                quality = "poor"
            elif total_chars / total_pages < self.min_text_chars_per_page:
                quality = "poor" 
            elif pages_with_text / total_pages > 0.8:
                quality = "good"
            else:
                quality = "fair"
            
            return {
                "total_pages": total_pages,
                "text_layer_quality": quality,
                "pages_with_text": pages_with_text,
                "total_text_chars": total_chars,
                "avg_chars_per_page": total_chars / total_pages if total_pages > 0 else 0,
                "page_char_counts": page_char_counts
            }
            
        except Exception as e:
            print(f"[WARNING] Text layer analysis failed: {e}", file=sys.stderr)
            return {
                "total_pages": 0,
                "text_layer_quality": "unknown",
                "pages_with_text": 0,
                "total_text_chars": 0,
                "avg_chars_per_page": 0
            }
    
    def _determine_extraction_strategy(self, text_analysis: Dict[str, Any]) -> str:
        """Determine the best extraction strategy"""
        
        if self.force_ocr:
            return "ocr_only"
        
        quality = text_analysis.get("text_layer_quality", "unknown")
        pages_with_text = text_analysis.get("pages_with_text", 0)
        total_pages = text_analysis.get("total_pages", 0)
        
        if quality == "none" or quality == "poor":
            return "ocr_only"
        elif quality == "good":
            return "text_layer"
        elif quality == "fair" and pages_with_text < total_pages * 0.7:
            return "hybrid"  # Use OCR for pages with little text
        else:
            return "text_layer"
    
    def _extract_text_layer(self, pdf_path: Path) -> Dict[str, Any]:
        """Extract text from PDF text layer"""
        
        if not PYMUPDF_AVAILABLE:
            raise RuntimeError("PyMuPDF not available for text layer extraction")
        
        doc = fitz.open(pdf_path)
        page_texts = []
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            page_texts.append(text)
        
        doc.close()
        
        return {
            "text_content": "\n\n".join(page_texts),
            "page_texts": page_texts
        }
    
    def _extract_with_ocr(self, pdf_path: Path) -> Dict[str, Any]:
        """Extract text using OCR with preprocessing"""
        
        print(f"[INFO] Starting OCR extraction for {pdf_path.name}", file=sys.stderr)
        
        # Check if ocrmypdf is available
        if not self._check_ocrmypdf():
            # Fallback to basic OCR if ocrmypdf not available
            return self._basic_ocr_extraction(pdf_path)
        
        # Use ocrmypdf for enhanced OCR
        return self._enhanced_ocr_extraction(pdf_path)
    
    def _enhanced_ocr_extraction(self, pdf_path: Path) -> Dict[str, Any]:
        """Enhanced OCR using ocrmypdf"""
        
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            ocr_output = temp_path / "ocr_output.pdf"
            
            try:
                # Run ocrmypdf with deskewing and force OCR
                cmd = [
                    "ocrmypdf",
                    "--force-ocr",  # Force OCR even if text layer exists
                    "--clean",      # Clean document before OCR
                    "--optimize", "1",  # Light optimization
                    "--output-type", "pdf",
                    str(pdf_path),
                    str(ocr_output)
                ]
                
                if self.deskew_enabled:
                    cmd.insert(-2, "--deskew")
                
                print(f"[INFO] Running OCR command: {' '.join(cmd[:5])}...", file=sys.stderr)
                
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=self.ocr_timeout
                )
                
                if result.returncode != 0:
                    print(f"[WARNING] ocrmypdf failed: {result.stderr}", file=sys.stderr)
                    return self._basic_ocr_extraction(pdf_path)
                
                # Extract text from OCR'd PDF
                if ocr_output.exists():
                    return self._extract_text_layer(ocr_output)
                else:
                    raise RuntimeError("OCR output file not created")
                
            except subprocess.TimeoutExpired:
                print(f"[ERROR] OCR timeout after {self.ocr_timeout}s", file=sys.stderr)
                raise RuntimeError(f"OCR timeout after {self.ocr_timeout}s")
            
            except Exception as e:
                print(f"[WARNING] Enhanced OCR failed: {e}", file=sys.stderr)
                return self._basic_ocr_extraction(pdf_path)
    
    def _basic_ocr_extraction(self, pdf_path: Path) -> Dict[str, Any]:
        """Basic OCR extraction using PDF to images + tesseract"""
        
        print(f"[INFO] Using basic OCR extraction", file=sys.stderr)
        
        # Convert PDF to images first
        images = self._pdf_to_images(pdf_path)
        
        page_texts = []
        for i, image_path in enumerate(images):
            try:
                # Preprocess image
                processed_image = self._preprocess_image_for_ocr(image_path)
                
                # Run tesseract
                text = self._run_tesseract(processed_image)
                page_texts.append(text)
                
                print(f"[INFO] OCR page {i+1}: {len(text)} characters", file=sys.stderr)
                
            except Exception as e:
                print(f"[WARNING] OCR failed for page {i+1}: {e}", file=sys.stderr)
                page_texts.append("")
            finally:
                # Cleanup temp image
                try:
                    image_path.unlink()
                except:
                    pass
        
        return {
            "text_content": "\n\n".join(page_texts),
            "page_texts": page_texts
        }
    
    def _extract_hybrid(self, pdf_path: Path, text_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Hybrid extraction: text layer for good pages, OCR for poor pages"""
        
        page_char_counts = text_analysis.get("page_char_counts", [])
        
        # Extract text layer first
        text_result = self._extract_text_layer(pdf_path)
        page_texts = text_result["page_texts"]
        
        # Identify pages that need OCR
        pages_needing_ocr = []
        for i, char_count in enumerate(page_char_counts):
            if char_count < self.min_text_chars_per_page:
                pages_needing_ocr.append(i)
        
        if pages_needing_ocr:
            print(f"[INFO] Applying OCR to {len(pages_needing_ocr)} pages", file=sys.stderr)
            
            # Convert problematic pages to images and OCR
            images = self._pdf_to_images(pdf_path, page_numbers=pages_needing_ocr)
            
            for page_num, image_path in zip(pages_needing_ocr, images):
                try:
                    processed_image = self._preprocess_image_for_ocr(image_path)
                    ocr_text = self._run_tesseract(processed_image)
                    
                    # Replace original text if OCR gives more content
                    if len(ocr_text) > len(page_texts[page_num]):
                        page_texts[page_num] = ocr_text
                        print(f"[INFO] Replaced page {page_num+1} with OCR text", file=sys.stderr)
                
                except Exception as e:
                    print(f"[WARNING] OCR failed for page {page_num+1}: {e}", file=sys.stderr)
                finally:
                    try:
                        image_path.unlink()
                    except:
                        pass
        
        return {
            "text_content": "\n\n".join(page_texts),
            "page_texts": page_texts
        }
    
    def _pdf_to_images(self, pdf_path: Path, page_numbers: Optional[List[int]] = None) -> List[Path]:
        """Convert PDF pages to images"""
        
        if not PYMUPDF_AVAILABLE:
            raise RuntimeError("PyMuPDF required for PDF to image conversion")
        
        images = []
        doc = fitz.open(pdf_path)
        
        pages_to_process = page_numbers if page_numbers else range(len(doc))
        
        for page_num in pages_to_process:
            try:
                page = doc[page_num]
                
                # Get page as image (150 DPI for good OCR quality)
                mat = fitz.Matrix(150/72, 150/72)  # 150 DPI
                pix = page.get_pixmap(matrix=mat)
                
                # Save to temporary file
                temp_image = Path(tempfile.mktemp(suffix=f"_page_{page_num}.png"))
                pix.save(str(temp_image))
                
                images.append(temp_image)
                
            except Exception as e:
                print(f"[WARNING] Failed to convert page {page_num} to image: {e}", file=sys.stderr)
        
        doc.close()
        return images
    
    def _preprocess_image_for_ocr(self, image_path: Path) -> Path:
        """Preprocess image for better OCR results"""
        
        if not PIL_AVAILABLE:
            return image_path  # Return original if PIL not available
        
        try:
            # Load image
            image = Image.open(image_path)
            
            # Convert to grayscale
            if image.mode != 'L':
                image = image.convert('L')
            
            # Enhance contrast if enabled
            if self.contrast_enhancement:
                enhancer = ImageEnhance.Contrast(image)
                image = enhancer.enhance(1.5)  # Increase contrast by 50%
            
            # Auto-orient and deskew if OpenCV available
            if OPENCV_AVAILABLE and self.deskew_enabled:
                image = self._deskew_image(image)
            
            # Save preprocessed image
            processed_path = image_path.with_suffix('.processed.png')
            image.save(processed_path)
            
            return processed_path
            
        except Exception as e:
            print(f"[WARNING] Image preprocessing failed: {e}", file=sys.stderr)
            return image_path
    
    def _deskew_image(self, pil_image: Image.Image) -> Image.Image:
        """Deskew image using OpenCV"""
        
        try:
            # Convert PIL to OpenCV format
            opencv_image = np.array(pil_image)
            
            # Find skew angle
            coords = np.column_stack(np.where(opencv_image > 0))
            angle = cv2.minAreaRect(coords)[-1]
            
            # Correct angle
            if angle < -45:
                angle = -(90 + angle)
            else:
                angle = -angle
            
            # Only correct if angle is significant
            if abs(angle) > 0.5:
                (h, w) = opencv_image.shape[:2]
                center = (w // 2, h // 2)
                M = cv2.getRotationMatrix2D(center, angle, 1.0)
                rotated = cv2.warpAffine(opencv_image, M, (w, h), 
                                       flags=cv2.INTER_CUBIC, 
                                       borderMode=cv2.BORDER_REPLICATE)
                
                # Convert back to PIL
                return Image.fromarray(rotated)
            
        except Exception as e:
            print(f"[WARNING] Deskewing failed: {e}", file=sys.stderr)
        
        return pil_image
    
    def _run_tesseract(self, image_path: Path) -> str:
        """Run Tesseract OCR on image"""
        
        try:
            cmd = [
                "tesseract",
                str(image_path),
                "stdout",
                "-l", "eng",  # English language
                "--oem", "3",  # Default OCR Engine Mode
                "--psm", "6"   # Assume uniform block of text
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60  # 1 minute timeout per page
            )
            
            if result.returncode == 0:
                return result.stdout.strip()
            else:
                print(f"[WARNING] Tesseract failed: {result.stderr}", file=sys.stderr)
                return ""
                
        except subprocess.TimeoutExpired:
            print(f"[WARNING] Tesseract timeout for {image_path}", file=sys.stderr)
            return ""
        except Exception as e:
            print(f"[WARNING] Tesseract error: {e}", file=sys.stderr)
            return ""
    
    def _check_ocrmypdf(self) -> bool:
        """Check if ocrmypdf is available"""
        try:
            result = subprocess.run(
                ["ocrmypdf", "--version"],
                capture_output=True,
                timeout=10
            )
            return result.returncode == 0
        except:
            return False


def main():
    """CLI interface for PDF text extraction"""
    
    if len(sys.argv) < 2:
        print("Usage: python pdf_text_extractor.py <pdf_path> [output_json]", file=sys.stderr)
        sys.exit(1)
    
    pdf_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    
    if not pdf_path.exists():
        print(f"Error: PDF file not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)
    
    # Configuration can be passed via environment variables
    config = {
        "min_text_chars_per_page": int(os.getenv("MIN_TEXT_CHARS_PER_PAGE", "50")),
        "ocr_timeout": int(os.getenv("OCR_TIMEOUT", "300")),
        "force_ocr": os.getenv("FORCE_OCR", "false").lower() == "true",
        "deskew_enabled": os.getenv("DESKEW_ENABLED", "true").lower() == "true",
        "contrast_enhancement": os.getenv("CONTRAST_ENHANCEMENT", "true").lower() == "true"
    }
    
    try:
        extractor = PDFTextExtractor(config)
        result = extractor.extract_text_from_pdf(pdf_path)
        
        # Output result
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            print(f"[INFO] Results saved to {output_path}", file=sys.stderr)
        else:
            print(f"PDF_TEXT_EXTRACTION_RESULT:{json.dumps(result)}")
        
        # Summary to stderr
        metadata = result["metadata"]
        print(f"[SUMMARY] Pages: {metadata['total_pages']}, "
              f"Text quality: {metadata['text_layer_quality']}, "
              f"OCR: {'Yes' if metadata['ocr_applied'] else 'No'}, "
              f"Time: {metadata['processing_time_ms']}ms", file=sys.stderr)
        
    except Exception as e:
        print(f"[ERROR] PDF text extraction failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()