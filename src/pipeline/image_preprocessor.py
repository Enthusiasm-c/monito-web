#!/usr/bin/env python3
"""
Advanced Image Preprocessor for Menu and Document OCR
Implements Task 4: Image preprocessing for photo menus readability

Features:
- CLAHE contrast enhancement for poor lighting
- Deskewing for tilted photos
- Noise reduction for camera photos
- Text region detection and enhancement
- Multi-resolution processing for different image sizes
- Tesseract optimization
"""

import sys
import os
import json
import tempfile
import time
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List
import logging

# PIL for basic image processing
try:
    from PIL import Image, ImageEnhance, ImageOps, ImageFilter
    PIL_AVAILABLE = True
except ImportError:
    print("[WARNING] PIL not available, image preprocessing disabled", file=sys.stderr)
    PIL_AVAILABLE = False

# OpenCV for advanced image processing
try:
    import cv2
    import numpy as np
    OPENCV_AVAILABLE = True
except ImportError:
    print("[WARNING] OpenCV not available, basic image processing only", file=sys.stderr)
    OPENCV_AVAILABLE = False

# Tesseract for OCR quality estimation
try:
    import pytesseract
    PYTESSERACT_AVAILABLE = True
except ImportError:
    print("[WARNING] pytesseract not available, no OCR quality estimation", file=sys.stderr)
    PYTESSERACT_AVAILABLE = False


class ImagePreprocessor:
    """Advanced image preprocessor for menu and document OCR"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        
        # Configuration parameters
        self.clahe_enabled = self.config.get('clahe_enabled', True)
        self.deskew_enabled = self.config.get('deskew_enabled', True)
        self.noise_reduction = self.config.get('noise_reduction', True)
        self.contrast_enhancement = self.config.get('contrast_enhancement', True)
        self.text_region_detection = self.config.get('text_region_detection', True)
        self.output_dpi = self.config.get('output_dpi', 300)  # 300 DPI for good OCR
        self.max_width = self.config.get('max_width', 2400)  # Max width to prevent huge images
        self.quality_threshold = self.config.get('quality_threshold', 0.6)
        
        print(f"[INFO] Image Preprocessor initialized", file=sys.stderr)
        print(f"[INFO] PIL: {'✓' if PIL_AVAILABLE else '✗'}", file=sys.stderr)
        print(f"[INFO] OpenCV: {'✓' if OPENCV_AVAILABLE else '✗'}", file=sys.stderr)
        print(f"[INFO] PyTesseract: {'✓' if PYTESSERACT_AVAILABLE else '✗'}", file=sys.stderr)
    
    def preprocess_image(self, image_path: Path, output_path: Optional[Path] = None) -> Dict[str, Any]:
        """
        Preprocess image for optimal OCR results
        
        Args:
            image_path: Path to input image
            output_path: Optional path for output image (temp if not provided)
            
        Returns:
            Dict containing processing results and metadata
        """
        start_time = time.time()
        
        print(f"[INFO] Preprocessing image: {image_path}", file=sys.stderr)
        
        if not image_path.exists():
            raise FileNotFoundError(f"Image file not found: {image_path}")
        
        if not PIL_AVAILABLE:
            raise RuntimeError("PIL required for image preprocessing")
        
        result = {
            "input_path": str(image_path),
            "output_path": None,
            "preprocessing_applied": [],
            "metadata": {
                "original_size": None,
                "processed_size": None,
                "file_size_bytes": image_path.stat().st_size,
                "processing_time_ms": 0,
                "quality_score": 0.0,
                "recommendations": []
            },
            "success": False,
            "error": None
        }
        
        try:
            # Step 1: Load and analyze input image
            original_image = Image.open(image_path)
            result["metadata"]["original_size"] = original_image.size
            
            print(f"[INFO] Original image: {original_image.size[0]}x{original_image.size[1]}, mode: {original_image.mode}", file=sys.stderr)
            
            # Step 2: Initial quality assessment
            quality_assessment = self._assess_image_quality(original_image)
            result["metadata"]["quality_score"] = quality_assessment["score"]
            result["metadata"]["recommendations"] = quality_assessment["recommendations"]
            
            # Step 3: Determine preprocessing strategy
            processing_strategy = self._determine_processing_strategy(original_image, quality_assessment)
            print(f"[INFO] Processing strategy: {processing_strategy}", file=sys.stderr)
            
            # Step 4: Apply preprocessing steps
            processed_image = original_image.copy()
            
            # Convert to RGB if necessary
            if processed_image.mode not in ['RGB', 'L']:
                processed_image = processed_image.convert('RGB')
                result["preprocessing_applied"].append("rgb_conversion")
            
            # Resize if too large
            if processed_image.size[0] > self.max_width:
                processed_image = self._smart_resize(processed_image)
                result["preprocessing_applied"].append("smart_resize")
            
            # Apply CLAHE for contrast enhancement
            if self.clahe_enabled and OPENCV_AVAILABLE and "low_contrast" in processing_strategy:
                processed_image = self._apply_clahe(processed_image)
                result["preprocessing_applied"].append("clahe")
            
            # Deskew if needed
            if self.deskew_enabled and OPENCV_AVAILABLE and "skewed" in processing_strategy:
                processed_image = self._deskew_image(processed_image)
                result["preprocessing_applied"].append("deskew")
            
            # Enhance contrast
            if self.contrast_enhancement and "enhance_contrast" in processing_strategy:
                processed_image = self._enhance_contrast(processed_image)
                result["preprocessing_applied"].append("contrast_enhancement")
            
            # Reduce noise
            if self.noise_reduction and "noisy" in processing_strategy:
                processed_image = self._reduce_noise(processed_image)
                result["preprocessing_applied"].append("noise_reduction")
            
            # Text region enhancement
            if self.text_region_detection and OPENCV_AVAILABLE and "enhance_text" in processing_strategy:
                processed_image = self._enhance_text_regions(processed_image)
                result["preprocessing_applied"].append("text_enhancement")
            
            # Final OCR optimization
            processed_image = self._optimize_for_ocr(processed_image)
            result["preprocessing_applied"].append("ocr_optimization")
            
            # Step 5: Save processed image
            if output_path is None:
                output_path = Path(tempfile.mktemp(suffix=".png"))
            
            # Save with optimal settings for OCR
            processed_image.save(output_path, "PNG", optimize=True, dpi=(self.output_dpi, self.output_dpi))
            
            result["output_path"] = str(output_path)
            result["metadata"]["processed_size"] = processed_image.size
            result["success"] = True
            
            # Step 6: Post-processing quality assessment
            final_quality = self._assess_ocr_readiness(processed_image)
            result["metadata"]["final_quality_score"] = final_quality["score"]
            result["metadata"]["ocr_confidence"] = final_quality["confidence"]
            
            print(f"[INFO] Preprocessing completed: {len(result['preprocessing_applied'])} steps applied", file=sys.stderr)
            
        except Exception as e:
            result["error"] = str(e)
            result["success"] = False
            print(f"[ERROR] Image preprocessing failed: {e}", file=sys.stderr)
        
        finally:
            result["metadata"]["processing_time_ms"] = int((time.time() - start_time) * 1000)
        
        return result
    
    def _assess_image_quality(self, image: Image.Image) -> Dict[str, Any]:
        """Assess image quality and identify issues"""
        
        assessment = {
            "score": 0.0,
            "issues": [],
            "recommendations": []
        }
        
        try:
            # Convert to grayscale for analysis
            if image.mode != 'L':
                gray_image = image.convert('L')
            else:
                gray_image = image
            
            # Convert to numpy for analysis
            if OPENCV_AVAILABLE:
                img_array = np.array(gray_image)
                
                # Check contrast
                contrast_score = img_array.std() / 255.0
                if contrast_score < 0.15:
                    assessment["issues"].append("low_contrast")
                    assessment["recommendations"].append("Apply CLAHE contrast enhancement")
                
                # Check brightness
                mean_brightness = img_array.mean() / 255.0
                if mean_brightness < 0.3:
                    assessment["issues"].append("too_dark")
                    assessment["recommendations"].append("Increase brightness")
                elif mean_brightness > 0.8:
                    assessment["issues"].append("too_bright")
                    assessment["recommendations"].append("Reduce brightness")
                
                # Check for blur
                laplacian_var = cv2.Laplacian(img_array, cv2.CV_64F).var()
                if laplacian_var < 100:
                    assessment["issues"].append("blurry")
                    assessment["recommendations"].append("Apply sharpening filter")
                
                # Check for noise
                noise_level = cv2.fastNlMeansDenoising(img_array).var()
                if noise_level > 1000:
                    assessment["issues"].append("noisy")
                    assessment["recommendations"].append("Apply noise reduction")
                
                # Calculate overall score
                assessment["score"] = min(1.0, (contrast_score + laplacian_var/1000 + 
                                              (1.0 - abs(mean_brightness - 0.5))) / 3.0)
            
            else:
                # Basic assessment without OpenCV
                # Check basic statistics
                extrema = gray_image.getextrema()
                range_val = extrema[1] - extrema[0]
                
                if range_val < 100:
                    assessment["issues"].append("low_contrast")
                    assessment["recommendations"].append("Enhance contrast")
                
                assessment["score"] = min(1.0, range_val / 255.0)
            
        except Exception as e:
            print(f"[WARNING] Image quality assessment failed: {e}", file=sys.stderr)
            assessment["score"] = 0.5  # Default neutral score
        
        return assessment
    
    def _determine_processing_strategy(self, image: Image.Image, quality_assessment: Dict[str, Any]) -> List[str]:
        """Determine which preprocessing steps to apply"""
        
        strategy = []
        issues = quality_assessment.get("issues", [])
        
        # Address identified issues
        if "low_contrast" in issues:
            strategy.append("low_contrast")
            strategy.append("enhance_contrast")
        
        if "too_dark" in issues or "too_bright" in issues:
            strategy.append("enhance_contrast")
        
        if "blurry" in issues:
            strategy.append("sharpen")
        
        if "noisy" in issues:
            strategy.append("noisy")
        
        # Check for skew (basic heuristic)
        if OPENCV_AVAILABLE:
            # More sophisticated skew detection would go here
            strategy.append("skewed")  # Apply deskewing by default for photos
        
        # Always enhance text regions for menu images
        strategy.append("enhance_text")
        
        return strategy
    
    def _smart_resize(self, image: Image.Image) -> Image.Image:
        """Intelligently resize image while preserving quality"""
        
        original_width, original_height = image.size
        
        if original_width <= self.max_width:
            return image
        
        # Calculate new dimensions
        ratio = self.max_width / original_width
        new_height = int(original_height * ratio)
        
        # Use high-quality resampling
        resized = image.resize((self.max_width, new_height), Image.Resampling.LANCZOS)
        
        print(f"[INFO] Resized from {original_width}x{original_height} to {self.max_width}x{new_height}", file=sys.stderr)
        
        return resized
    
    def _apply_clahe(self, image: Image.Image) -> Image.Image:
        """Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)"""
        
        try:
            # Convert PIL to OpenCV
            if image.mode != 'L':
                gray_image = image.convert('L')
            else:
                gray_image = image
            
            cv_image = np.array(gray_image)
            
            # Create CLAHE object
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(cv_image)
            
            # Convert back to PIL
            result_image = Image.fromarray(enhanced)
            
            # If original was color, blend with original
            if image.mode == 'RGB':
                # Convert enhanced grayscale back to RGB for blending
                enhanced_rgb = Image.merge('RGB', [result_image, result_image, result_image])
                # Blend 70% enhanced, 30% original
                result_image = Image.blend(image, enhanced_rgb, 0.7)
            
            print(f"[INFO] Applied CLAHE contrast enhancement", file=sys.stderr)
            return result_image
            
        except Exception as e:
            print(f"[WARNING] CLAHE failed: {e}", file=sys.stderr)
            return image
    
    def _deskew_image(self, image: Image.Image) -> Image.Image:
        """Deskew tilted image using OpenCV"""
        
        try:
            # Convert to grayscale for skew detection
            if image.mode != 'L':
                gray_image = image.convert('L')
            else:
                gray_image = image
            
            cv_image = np.array(gray_image)
            
            # Edge detection
            edges = cv2.Canny(cv_image, 50, 150, apertureSize=3)
            
            # Hough line detection
            lines = cv2.HoughLines(edges, 1, np.pi / 180, threshold=100)
            
            if lines is not None:
                # Calculate angles
                angles = []
                for rho, theta in lines[:10]:  # Use first 10 lines
                    angle = theta * 180 / np.pi
                    if angle < 45:
                        angles.append(angle)
                    elif angle > 135:
                        angles.append(angle - 180)
                
                if angles:
                    # Calculate median angle
                    median_angle = np.median(angles)
                    
                    # Only correct if angle is significant
                    if abs(median_angle) > 0.5:
                        # Get image center
                        (h, w) = cv_image.shape[:2]
                        center = (w // 2, h // 2)
                        
                        # Rotation matrix
                        M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
                        
                        # Apply rotation to original image
                        if image.mode == 'RGB':
                            cv_original = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
                            rotated = cv2.warpAffine(cv_original, M, (w, h),
                                                   flags=cv2.INTER_CUBIC,
                                                   borderMode=cv2.BORDER_REPLICATE)
                            rotated = cv2.cvtColor(rotated, cv2.COLOR_BGR2RGB)
                        else:
                            rotated = cv2.warpAffine(cv_image, M, (w, h),
                                                   flags=cv2.INTER_CUBIC,
                                                   borderMode=cv2.BORDER_REPLICATE)
                        
                        result_image = Image.fromarray(rotated)
                        print(f"[INFO] Deskewed by {median_angle:.1f} degrees", file=sys.stderr)
                        return result_image
            
        except Exception as e:
            print(f"[WARNING] Deskewing failed: {e}", file=sys.stderr)
        
        return image
    
    def _enhance_contrast(self, image: Image.Image) -> Image.Image:
        """Enhance image contrast using PIL"""
        
        try:
            enhancer = ImageEnhance.Contrast(image)
            enhanced = enhancer.enhance(1.3)  # 30% contrast increase
            
            print(f"[INFO] Enhanced contrast", file=sys.stderr)
            return enhanced
            
        except Exception as e:
            print(f"[WARNING] Contrast enhancement failed: {e}", file=sys.stderr)
            return image
    
    def _reduce_noise(self, image: Image.Image) -> Image.Image:
        """Reduce image noise"""
        
        try:
            if OPENCV_AVAILABLE:
                # Advanced denoising with OpenCV
                if image.mode == 'RGB':
                    cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
                    denoised = cv2.fastNlMeansDenoisingColored(cv_image, None, 10, 10, 7, 21)
                    denoised = cv2.cvtColor(denoised, cv2.COLOR_BGR2RGB)
                    result_image = Image.fromarray(denoised)
                else:
                    cv_image = np.array(image)
                    denoised = cv2.fastNlMeansDenoising(cv_image, None, 10, 7, 21)
                    result_image = Image.fromarray(denoised)
                
                print(f"[INFO] Applied OpenCV noise reduction", file=sys.stderr)
                return result_image
            
            else:
                # Basic noise reduction with PIL
                filtered = image.filter(ImageFilter.MedianFilter(size=3))
                print(f"[INFO] Applied basic noise reduction", file=sys.stderr)
                return filtered
                
        except Exception as e:
            print(f"[WARNING] Noise reduction failed: {e}", file=sys.stderr)
            return image
    
    def _enhance_text_regions(self, image: Image.Image) -> Image.Image:
        """Enhance text regions for better OCR"""
        
        try:
            if not OPENCV_AVAILABLE:
                return image
            
            # Convert to grayscale for text detection
            if image.mode != 'L':
                gray_image = image.convert('L')
            else:
                gray_image = image
            
            cv_image = np.array(gray_image)
            
            # Apply morphological operations to enhance text
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
            
            # Closing to connect text components
            closed = cv2.morphologyEx(cv_image, cv2.MORPH_CLOSE, kernel)
            
            # Sharpening filter
            kernel_sharp = np.array([[-1,-1,-1],
                                   [-1, 9,-1],
                                   [-1,-1,-1]])
            sharpened = cv2.filter2D(closed, -1, kernel_sharp)
            
            result_image = Image.fromarray(sharpened)
            
            # If original was color, blend with original
            if image.mode == 'RGB':
                enhanced_rgb = Image.merge('RGB', [result_image, result_image, result_image])
                result_image = Image.blend(image, enhanced_rgb, 0.6)
            
            print(f"[INFO] Enhanced text regions", file=sys.stderr)
            return result_image
            
        except Exception as e:
            print(f"[WARNING] Text enhancement failed: {e}", file=sys.stderr)
            return image
    
    def _optimize_for_ocr(self, image: Image.Image) -> Image.Image:
        """Final optimization for OCR"""
        
        try:
            # Convert to grayscale for OCR
            if image.mode != 'L':
                ocr_image = image.convert('L')
            else:
                ocr_image = image
            
            # Apply slight sharpening
            enhancer = ImageEnhance.Sharpness(ocr_image)
            sharpened = enhancer.enhance(1.1)
            
            # Auto-adjust levels
            sharpened = ImageOps.autocontrast(sharpened)
            
            print(f"[INFO] Applied OCR optimization", file=sys.stderr)
            return sharpened
            
        except Exception as e:
            print(f"[WARNING] OCR optimization failed: {e}", file=sys.stderr)
            return image
    
    def _assess_ocr_readiness(self, image: Image.Image) -> Dict[str, Any]:
        """Assess how ready the image is for OCR"""
        
        assessment = {
            "score": 0.0,
            "confidence": "unknown"
        }
        
        try:
            if PYTESSERACT_AVAILABLE:
                # Quick OCR test to assess readiness
                gray_image = image.convert('L') if image.mode != 'L' else image
                
                # Get OCR confidence
                data = pytesseract.image_to_data(gray_image, output_type=pytesseract.Output.DICT)
                confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
                
                if confidences:
                    avg_confidence = sum(confidences) / len(confidences)
                    assessment["score"] = avg_confidence / 100.0
                    
                    if avg_confidence > 80:
                        assessment["confidence"] = "high"
                    elif avg_confidence > 60:
                        assessment["confidence"] = "medium"
                    else:
                        assessment["confidence"] = "low"
                else:
                    assessment["confidence"] = "very_low"
            
            else:
                # Fallback assessment without pytesseract
                gray_image = image.convert('L') if image.mode != 'L' else image
                extrema = gray_image.getextrema()
                contrast_ratio = (extrema[1] - extrema[0]) / 255.0
                assessment["score"] = contrast_ratio
                assessment["confidence"] = "estimated"
        
        except Exception as e:
            print(f"[WARNING] OCR readiness assessment failed: {e}", file=sys.stderr)
        
        return assessment
    
    def batch_preprocess(self, image_paths: List[Path], output_dir: Optional[Path] = None) -> List[Dict[str, Any]]:
        """Preprocess multiple images"""
        
        print(f"[INFO] Batch preprocessing {len(image_paths)} images", file=sys.stderr)
        
        if output_dir:
            output_dir.mkdir(parents=True, exist_ok=True)
        
        results = []
        
        for i, image_path in enumerate(image_paths):
            try:
                if output_dir:
                    output_path = output_dir / f"processed_{image_path.stem}.png"
                else:
                    output_path = None
                
                result = self.preprocess_image(image_path, output_path)
                results.append(result)
                
                print(f"[INFO] Processed {i+1}/{len(image_paths)}: {image_path.name}", file=sys.stderr)
                
            except Exception as e:
                error_result = {
                    "input_path": str(image_path),
                    "success": False,
                    "error": str(e)
                }
                results.append(error_result)
                print(f"[ERROR] Failed to process {image_path.name}: {e}", file=sys.stderr)
        
        return results


def main():
    """CLI interface for image preprocessing"""
    
    if len(sys.argv) < 2:
        print("Usage: python image_preprocessor.py <image_path> [output_path]", file=sys.stderr)
        sys.exit(1)
    
    image_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    
    if not image_path.exists():
        print(f"Error: Image file not found: {image_path}", file=sys.stderr)
        sys.exit(1)
    
    # Configuration can be passed via environment variables
    config = {
        "clahe_enabled": os.getenv("CLAHE_ENABLED", "true").lower() == "true",
        "deskew_enabled": os.getenv("DESKEW_ENABLED", "true").lower() == "true",
        "noise_reduction": os.getenv("NOISE_REDUCTION", "true").lower() == "true",
        "contrast_enhancement": os.getenv("CONTRAST_ENHANCEMENT", "true").lower() == "true",
        "text_region_detection": os.getenv("TEXT_REGION_DETECTION", "true").lower() == "true",
        "output_dpi": int(os.getenv("OUTPUT_DPI", "300")),
        "max_width": int(os.getenv("MAX_WIDTH", "2400"))
    }
    
    try:
        preprocessor = ImagePreprocessor(config)
        result = preprocessor.preprocess_image(image_path, output_path)
        
        # Output result
        print(f"IMAGE_PREPROCESSING_RESULT:{json.dumps(result)}")
        
        # Summary to stderr
        metadata = result["metadata"]
        print(f"[SUMMARY] Quality: {metadata['quality_score']:.2f}, "
              f"Steps: {len(result['preprocessing_applied'])}, "
              f"Time: {metadata['processing_time_ms']}ms", file=sys.stderr)
        
    except Exception as e:
        print(f"[ERROR] Image preprocessing failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()