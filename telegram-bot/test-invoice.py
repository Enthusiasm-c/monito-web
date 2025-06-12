"""Test script for invoice OCR functionality"""

import asyncio
import os
from PIL import Image, ImageDraw, ImageFont
from app.ocr.pipeline import OCRPipeline

async def create_test_invoice():
    """Create a simple test invoice image"""
    # Create a white image
    width, height = 800, 1000
    image = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(image)
    
    # Try to use a font, fallback to default if not available
    try:
        font_large = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 24)
        font_normal = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 18)
    except:
        font_large = ImageFont.load_default()
        font_normal = ImageFont.load_default()
    
    # Draw invoice header
    y_pos = 50
    draw.text((50, y_pos), "TOKO SEMBAKO JAYA", font=font_large, fill='black')
    y_pos += 40
    draw.text((50, y_pos), "Jl. Pasar Baru No. 123", font=font_normal, fill='black')
    y_pos += 30
    draw.text((50, y_pos), "Date: 15/01/2024", font=font_normal, fill='black')
    y_pos += 50
    
    # Draw table header
    draw.text((50, y_pos), "INVOICE", font=font_large, fill='black')
    y_pos += 50
    
    # Draw products
    products = [
        ("Beras Premium 5kg", "2", "65.000", "130.000"),
        ("Minyak Goreng 2L", "3", "32.000", "96.000"),
        ("Gula Pasir 1kg", "5", "14.000", "70.000"),
        ("Ayam Potong", "2 kg", "35.000", "70.000"),
        ("Telur Ayam", "1 kg", "28.000", "28.000")
    ]
    
    # Table headers
    draw.text((50, y_pos), "Product", font=font_normal, fill='black')
    draw.text((300, y_pos), "Qty", font=font_normal, fill='black')
    draw.text((400, y_pos), "Price", font=font_normal, fill='black')
    draw.text((500, y_pos), "Total", font=font_normal, fill='black')
    y_pos += 30
    
    # Draw line
    draw.line([(50, y_pos), (600, y_pos)], fill='black', width=2)
    y_pos += 20
    
    # Draw products
    for product, qty, price, total in products:
        draw.text((50, y_pos), product, font=font_normal, fill='black')
        draw.text((300, y_pos), qty, font=font_normal, fill='black')
        draw.text((400, y_pos), price, font=font_normal, fill='black')
        draw.text((500, y_pos), total, font=font_normal, fill='black')
        y_pos += 30
    
    # Draw total
    y_pos += 20
    draw.line([(50, y_pos), (600, y_pos)], fill='black', width=2)
    y_pos += 20
    draw.text((400, y_pos), "TOTAL:", font=font_large, fill='black')
    draw.text((500, y_pos), "394.000", font=font_large, fill='black')
    
    # Save test invoice
    image.save('test_invoice.jpg', 'JPEG', quality=95)
    print("✅ Created test invoice: test_invoice.jpg")
    
    return image

async def test_ocr():
    """Test OCR pipeline"""
    print("🧪 Testing OCR Pipeline...\n")
    
    # Create test invoice
    image = await create_test_invoice()
    
    # Initialize OCR pipeline
    ocr = OCRPipeline()
    
    # Process invoice
    print("📄 Processing invoice...")
    result = await ocr.process_invoice(image)
    
    if result.get('error'):
        print(f"❌ OCR Error: {result['error']}")
        return
    
    # Display results
    print("\n✅ OCR Results:")
    print(f"Supplier: {result.get('supplier_name', 'Not detected')}")
    print(f"Date: {result.get('date', 'Not detected')}")
    print(f"Processing time: {result.get('processing_time', 0):.2f}s")
    print(f"Confidence: {result.get('confidence', 0):.2f}")
    
    print(f"\nFound {len(result.get('products', []))} products:")
    for i, product in enumerate(result.get('products', []), 1):
        print(f"\n{i}. {product['name']}")
        print(f"   Quantity: {product.get('quantity', 1)} {product.get('unit', 'pcs')}")
        print(f"   Unit Price: Rp {product.get('unit_price', 0):,.0f}")
        print(f"   Total: Rp {product.get('total_price', 0):,.0f}")

async def test_real_invoice(image_path):
    """Test with a real invoice image"""
    print(f"🧪 Testing with real invoice: {image_path}\n")
    
    if not os.path.exists(image_path):
        print(f"❌ File not found: {image_path}")
        return
    
    # Load image
    image = Image.open(image_path)
    
    # Initialize OCR pipeline
    ocr = OCRPipeline()
    
    # Process invoice
    print("📄 Processing invoice...")
    result = await ocr.process_invoice(image)
    
    if result.get('error'):
        print(f"❌ OCR Error: {result['error']}")
        return
    
    # Display results
    print("\n✅ OCR Results:")
    print(f"Supplier: {result.get('supplier_name', 'Not detected')}")
    print(f"Date: {result.get('date', 'Not detected')}")
    
    print(f"\nFound {len(result.get('products', []))} products:")
    for product in result.get('products', []):
        print(f"- {product['name']} ({product.get('quantity', 1)} {product.get('unit', 'pcs')}): Rp {product.get('total_price', 0):,.0f}")

if __name__ == "__main__":
    import sys
    
    # Check if OpenAI API key is set
    if not os.getenv('OPENAI_API_KEY'):
        print("❌ Please set OPENAI_API_KEY environment variable")
        sys.exit(1)
    
    # Run test
    if len(sys.argv) > 1:
        # Test with provided image
        asyncio.run(test_real_invoice(sys.argv[1]))
    else:
        # Test with generated invoice
        asyncio.run(test_ocr())