#!/usr/bin/env python3
"""
Modified PDF to Images converter for local testing
"""

import sys
import json
import base64
import os
from io import BytesIO

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

def process_local_pdf(pdf_path: str, max_pages: int = 8) -> list:
    """Process local PDF file"""
    try:
        # Read the local PDF file
        with open(pdf_path, 'rb') as f:
            pdf_data = f.read()
        
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
        print(json.dumps({"success": False, "error": "Usage: python3 script.py <pdf_path> <max_pages>"}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    max_pages = int(sys.argv[2])
    
    # Remove file:// prefix if present
    if pdf_path.startswith('file://'):
        pdf_path = pdf_path[7:]
    
    if not os.path.exists(pdf_path):
        print(json.dumps({"success": False, "error": f"PDF file not found: {pdf_path}"}))
        sys.exit(1)
    
    try:
        images = process_local_pdf(pdf_path, max_pages)
        
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
