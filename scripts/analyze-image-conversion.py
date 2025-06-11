#!/usr/bin/env python3
"""
Analyze PDF to Image conversion process
Shows detailed metrics about image size, resolution, and compression
"""

import sys
import os
import requests
import base64
import tempfile
from io import BytesIO
from pathlib import Path

try:
    import fitz  # PyMuPDF
    from PIL import Image
    from dotenv import load_dotenv
except ImportError as e:
    print(f"ERROR: Missing dependency: {e}")
    sys.exit(1)

def analyze_pdf_to_images():
    print("🔍 Analyzing PDF to Image conversion process...")
    
    # Load environment
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
    
    # Test with milk up PDF
    pdf_url = "https://cdc1w79ssc4kg6xh.public.blob.vercel-storage.com/milk%20up-RB2AKmAEQe0cBDWBdHPI8yULfxjE1C.pdf"
    
    print(f"📄 PDF URL: {pdf_url[:50]}...")
    
    # Download PDF
    try:
        response = requests.get(pdf_url, timeout=30)
        response.raise_for_status()
        pdf_size = len(response.content)
        print(f"📦 Original PDF size: {pdf_size:,} bytes ({pdf_size/1024/1024:.2f} MB)")
    except Exception as e:
        print(f"❌ Failed to download PDF: {e}")
        return
    
    # Save to temporary file
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
        tmp_file.write(response.content)
        pdf_path = tmp_file.name
    
    try:
        # Open PDF
        doc = fitz.open(pdf_path)
        total_pages = len(doc)
        print(f"📄 Total pages: {total_pages}")
        
        # Test different DPI settings
        dpi_settings = [72, 100, 120, 150]
        max_width_settings = [512, 768, 1000, 1200]
        
        for dpi in dpi_settings:
            print(f"\n🔧 Testing DPI: {dpi}")
            
            for max_width in max_width_settings:
                print(f"  📏 Max width: {max_width}px")
                
                # Process first page only for analysis
                page = doc.load_page(0)
                
                # Convert page to image
                mat = fitz.Matrix(dpi/72, dpi/72)
                pix = page.get_pixmap(matrix=mat)
                
                # Get original image dimensions
                original_width = pix.width
                original_height = pix.height
                original_size_mb = len(pix.tobytes("png")) / 1024 / 1024
                
                print(f"    🖼️ Original: {original_width}x{original_height} ({original_size_mb:.2f} MB)")
                
                # Convert to PIL Image
                img_data = pix.tobytes("png")
                img = Image.open(BytesIO(img_data))
                
                # Resize if needed
                if img.width > max_width:
                    ratio = max_width / img.width
                    new_height = int(img.height * ratio)
                    img_resized = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
                else:
                    img_resized = img
                
                # Convert to base64 with optimization
                buffer = BytesIO()
                img_resized.save(buffer, format="PNG", optimize=True)
                png_size = len(buffer.getvalue())
                
                # Try JPEG for comparison
                buffer_jpg = BytesIO()
                img_resized_rgb = img_resized.convert('RGB')
                img_resized_rgb.save(buffer_jpg, format="JPEG", quality=85, optimize=True)
                jpg_size = len(buffer_jpg.getvalue())
                
                # Base64 encoding overhead
                img_base64 = base64.b64encode(buffer.getvalue()).decode()
                base64_size = len(img_base64)
                
                print(f"    📐 Resized: {img_resized.width}x{img_resized.height}")
                print(f"    💾 PNG: {png_size:,} bytes ({png_size/1024:.1f} KB)")
                print(f"    💾 JPEG: {jpg_size:,} bytes ({jpg_size/1024:.1f} KB)")
                print(f"    🔤 Base64: {base64_size:,} chars ({base64_size/1024:.1f} KB)")
                print(f"    🏷️ Compression: {original_size_mb*1024/png_size*1024:.1f}x smaller")
                
                if max_width == 512:  # Current setting
                    print(f"    ⭐ CURRENT SETTINGS ⭐")
        
        # Analyze current script settings
        print(f"\n📋 Current script analysis:")
        print(f"🔧 DPI: 100 (reduced from 120 for speed)")
        print(f"📏 Max width: 512px (reduced from 1000px for speed)")
        print(f"🎯 Detail level: 'low' (for faster processing)")
        print(f"📄 Page limit: 3 (reduced from 8 for stability)")
        
        # Calculate total size for all pages
        print(f"\n📊 Estimated total size for 3 pages:")
        estimated_total = (base64_size * 3) / 1024 / 1024
        print(f"💾 Total base64 payload: ~{estimated_total:.1f} MB")
        
        # Token estimation
        # Rough estimate: ~765 tokens per image for "low" detail
        tokens_per_image = 765
        total_tokens_images = tokens_per_image * 3
        prompt_tokens = 400  # Estimated prompt size
        total_input_tokens = total_tokens_images + prompt_tokens
        
        print(f"🎯 Estimated tokens:")
        print(f"   Images: {total_tokens_images:,} tokens")
        print(f"   Prompt: {prompt_tokens:,} tokens")
        print(f"   Total input: {total_input_tokens:,} tokens")
        
        # Cost estimation (GPT-o3 pricing)
        input_cost = (total_input_tokens / 1000) * 0.005
        output_cost = (500 / 1000) * 0.015  # Estimated 500 output tokens
        total_cost = input_cost + output_cost
        
        print(f"💰 Estimated cost per attempt:")
        print(f"   Input: ${input_cost:.4f}")
        print(f"   Output: ${output_cost:.4f}")
        print(f"   Total: ${total_cost:.4f}")
        
    finally:
        doc.close()
        os.unlink(pdf_path)

if __name__ == "__main__":
    analyze_pdf_to_images()