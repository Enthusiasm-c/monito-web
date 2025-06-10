#!/usr/bin/env python3
"""
Test milk up PDF processing to see exact AI Vision results
"""

import os
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# Load environment
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    load_dotenv(env_path)

from async_pdf_image_extractor import AsyncPDFImageExtractor

async def test_milk_up():
    print("🥛 Testing milk up PDF with AI Vision...")
    
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("❌ No API key found")
        return
    
    pdf_url = "https://cdc1w79ssc4kg6xh.public.blob.vercel-storage.com/milk%20up-Sl6BQpFH8UALcApo2OWDxgKtyAEeaX.pdf"
    
    extractor = AsyncPDFImageExtractor(api_key)
    result = await extractor.process_pdf(pdf_url)
    
    print(f"\n📊 AI Vision Results:")
    print(f"   📄 Pages processed: {result.get('metrics', {}).get('pages_processed', 0)}")
    print(f"   🛍️ Products found: {result.get('metrics', {}).get('total_products', 0)}")
    print(f"   💰 Cost: ${result.get('metrics', {}).get('cost_usd', 0):.4f}")
    
    supplier = result.get('supplier', {})
    products = result.get('products', [])
    
    print(f"\n🏢 Supplier extracted:")
    print(f"   Name: {supplier.get('name', 'Not found')}")
    print(f"   Phone: {supplier.get('phone', 'Not found')}")
    
    print(f"\n🛍️ First 10 products extracted:")
    for i, product in enumerate(products[:10]):
        name = product.get('name', 'Unknown')
        price = product.get('price', 0)
        currency = product.get('currency', 'Unknown')
        unit = product.get('unit', 'Unknown')
        page = product.get('source_page', 0)
        
        print(f"   {i+1:2d}. \"{name}\" - {price:,} {currency} ({unit}) [Page {page}]")
    
    if len(products) > 10:
        print(f"   ... and {len(products) - 10} more products")
    
    # Check for bad products (Camelot-style errors)
    bad_products = [p for p in products if any(bad in p.get('name', '').upper() for bad in [
        'CONTACT SALES', 'PRICES ARE INCLUDED', 'VAT', 'PACKAGING', 'RECYCLABLE'
    ])]
    
    if bad_products:
        print(f"\n⚠️ Found {len(bad_products)} suspicious products:")
        for product in bad_products:
            print(f"   ❌ \"{product.get('name', '')}\"")
        print(f"   🚨 AI Vision results seem contaminated with Camelot errors!")
    else:
        print(f"\n✅ No suspicious products found - AI Vision results look clean!")
    
    # Check for correct products
    good_products = [p for p in products if any(good in p.get('name', '').upper() for good in [
        'YOGURT', 'CHEESE', 'MILK', 'KEFIR', 'RICOTTA', 'MASCARPONE'
    ])]
    
    print(f"\n🧀 Found {len(good_products)} dairy products (expected):")
    for product in good_products[:5]:
        name = product.get('name', 'Unknown')
        price = product.get('price', 0)
        currency = product.get('currency', 'Unknown')
        print(f"   ✅ \"{name}\" - {price:,} {currency}")

if __name__ == "__main__":
    asyncio.run(test_milk_up())