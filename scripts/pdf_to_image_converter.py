#!/usr/bin/env python3
"""
Simple PDF to Image converter for AI processing
"""
import sys
import json
import base64
import os
from io import BytesIO

try:
    import fitz  # PyMuPDF
except ImportError:
    print("ERROR: PyMuPDF not installed. Install with: pip install PyMuPDF", file=sys.stderr)
    sys.exit(1)

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow not installed. Install with: pip install Pillow", file=sys.stderr)
    sys.exit(1)

def pdf_to_image_base64(pdf_path, dpi=120, max_pages=6, max_width=1200):
    """Convert PDF pages to base64 PNG images with optimization"""
    try:
        doc = fitz.open(pdf_path)
        if len(doc) == 0:
            raise ValueError("PDF has no pages")
        
        images = []
        total_pages = min(len(doc), max_pages)
        
        # Convert each page
        for page_num in range(total_pages):
            page = doc[page_num]
            
            # ОПТИМИЗАЦИЯ: Используем меньший DPI для быстрой обработки
            mat = fitz.Matrix(dpi/72, dpi/72)
            pix = page.get_pixmap(matrix=mat)
            
            # Convert to PIL Image
            img_data = pix.tobytes("png")
            img = Image.open(BytesIO(img_data))
            
            # ОПТИМИЗАЦИЯ: Изменяем размер если изображение слишком большое
            if img.width > max_width:
                ratio = max_width / img.width
                new_width = int(img.width * ratio)
                new_height = int(img.height * ratio)
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # ОПТИМИЗАЦИЯ: Конвертируем в RGB если есть альфа-канал
            if img.mode == 'RGBA':
                rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                rgb_img.paste(img, mask=img.split()[3])
                img = rgb_img
            
            # Convert to base64 with JPEG compression for smaller size
            buffered = BytesIO()
            img.save(buffered, format="JPEG", quality=85, optimize=True)
            img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
            images.append(img_base64)
        
        # Get metadata before closing
        page_count = len(doc)
        width = img.width if images else 0
        height = img.height if images else 0
        
        doc.close()
        
        return {
            "images": images,
            "page_count": page_count,
            "total_converted": len(images),
            "width": width,
            "height": height
        }
        
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 pdf_to_image_converter.py <pdf_path> [--output-format base64] [--single-page]")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    if not os.path.exists(pdf_path):
        print(f"ERROR: File not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)
    
    result = pdf_to_image_base64(pdf_path)
    
    # Output as JSON
    print(json.dumps(result))

if __name__ == "__main__":
    main()