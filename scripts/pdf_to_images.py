#!/usr/bin/env python3
"""
Simple PDF to Images converter
Converts PDF pages to base64 encoded images for Gemini processing
"""

import sys
import json
import base64
import tempfile
import os
from io import BytesIO
import requests

try:
    import fitz  # PyMuPDF
except ImportError:
    print(json.dumps({"success": False, "error": "PyMuPDF not installed"}))
    sys.exit(1)

try:
    from PIL import Image
except ImportError:
    print(json.dumps({"success": False, "error": "Pillow not installed"}))
    sys.exit(1)

def download_pdf(url: str) -> bytes:
    """Download PDF from URL"""
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return response.content
    except Exception as e:
        raise Exception(f"Failed to download PDF: {e}")

def pdf_to_base64_images(pdf_data: bytes, max_pages: int = 8) -> list:
    """Convert PDF pages to base64 encoded images"""
    try:
        doc = fitz.open(stream=pdf_data, filetype="pdf")
        images = []
        
        for page_num in range(min(len(doc), max_pages)):
            page = doc[page_num]
            
            # Render page to image with good quality
            mat = fitz.Matrix(2.0, 2.0)  # 2x scaling for better quality
            pix = page.get_pixmap(matrix=mat)
            
            # Convert to PIL Image
            img_data = pix.tobytes("png")
            img = Image.open(BytesIO(img_data))
            
            # Optimize image size for API (max 1024x1024)
            if img.width > 1024 or img.height > 1024:
                img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
            
            # Convert to base64
            buffer = BytesIO()
            img.save(buffer, format='PNG', optimize=True)
            img_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            images.append(img_base64)
        
        doc.close()
        return images
        
    except Exception as e:
        raise Exception(f"Failed to convert PDF to images: {e}")

def main():
    if len(sys.argv) != 3:
        print(json.dumps({"success": False, "error": "Usage: python3 pdf_to_images.py <pdf_url> <max_pages>"}))
        sys.exit(1)
    
    pdf_url = sys.argv[1]
    max_pages = int(sys.argv[2])
    
    try:
        # Download PDF
        pdf_data = download_pdf(pdf_url)
        
        # Convert to images
        images = pdf_to_base64_images(pdf_data, max_pages)
        
        # Output result
        result = {
            "success": True,
            "images": images,
            "pages_processed": len(images),
            "max_pages": max_pages
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e),
            "images": []
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()