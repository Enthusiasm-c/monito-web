#!/usr/bin/env python3
"""
Debug AI fallback logic to understand why it's not working properly
"""

import sys
import os
from pathlib import Path
from dotenv import load_dotenv

def debug_ai_fallback():
    print("🔍 Debugging AI fallback logic...")
    
    # Load environment
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
        print(f"✅ Loaded environment from {env_path}")
    
    # Check environment variables
    print("\n📋 Environment Variables:")
    llm_fallback = os.getenv('LLM_FALLBACK_ENABLED')
    ai_vision = os.getenv('AI_VISION_ENABLED') 
    threshold = os.getenv('COMPLETENESS_THRESHOLD_PDF')
    
    print(f"   LLM_FALLBACK_ENABLED: {llm_fallback}")
    print(f"   AI_VISION_ENABLED: {ai_vision}")
    print(f"   COMPLETENESS_THRESHOLD_PDF: {threshold}")
    
    # Simulate the logic from enhancedPdfExtractor.ts
    print("\n🧮 Simulating fallback logic:")
    
    # Simulate Camelot results (from logs)
    total_rows_detected = 138
    total_rows_processed = 59
    products_found = 59
    
    completeness_ratio = total_rows_processed / total_rows_detected if total_rows_detected > 0 else 0
    threshold_value = float(threshold or '0.85')
    
    print(f"   📊 Total rows detected: {total_rows_detected}")
    print(f"   📊 Total rows processed: {total_rows_processed}")
    print(f"   📊 Products found: {products_found}")
    print(f"   📊 Completeness ratio: {completeness_ratio:.3f} ({completeness_ratio*100:.1f}%)")
    print(f"   📊 Threshold: {threshold_value} ({threshold_value*100:.0f}%)")
    
    # Check fallback conditions
    llm_enabled = llm_fallback == 'true'
    ai_enabled = ai_vision == 'true'
    no_products = products_found == 0
    low_completeness = completeness_ratio < threshold_value
    
    print(f"\n🔍 Fallback conditions:")
    print(f"   ✅ LLM fallback enabled: {llm_enabled}")
    print(f"   ✅ AI Vision enabled: {ai_enabled}")
    print(f"   {'✅' if no_products else '❌'} No products found: {no_products}")
    print(f"   {'✅' if low_completeness else '❌'} Low completeness: {low_completeness} ({completeness_ratio:.1%} < {threshold_value:.0%})")
    
    needs_fallback = llm_enabled and ai_enabled and (no_products or low_completeness)
    
    print(f"\n🎯 RESULT:")
    if needs_fallback:
        reason = "no products found" if no_products else f"low completeness ({completeness_ratio*100:.1f}% < {threshold_value*100:.0f}%)"
        print(f"   ✅ AI fallback SHOULD trigger: {reason}")
        print(f"   🤖 AI Vision should replace Camelot results")
    else:
        print(f"   ❌ AI fallback should NOT trigger")
        print(f"   📄 Traditional results will be used")
    
    print(f"\n💡 Expected behavior:")
    print(f"   📊 Camelot found {products_found} products with {completeness_ratio:.1%} completeness")
    print(f"   🤖 Since {completeness_ratio:.1%} < {threshold_value:.0%}, AI Vision should:")
    print(f"      1. Process all 6 pages of the PDF")
    print(f"      2. Extract correct products from images") 
    print(f"      3. REPLACE Camelot's 59 incorrect products")
    print(f"      4. Return clean, properly structured products")
    
    print(f"\n🚨 ISSUE ANALYSIS:")
    print(f"   The problem is likely that:")
    print(f"   1. AI Vision IS being called (we see the async logs)")
    print(f"   2. But the REPLACEMENT logic isn't working correctly")
    print(f"   3. We're still getting Camelot's bad results instead of AI's good results")
    print(f"   4. Check the mergeExtractionResults vs replaceWithAiResults logic")

if __name__ == "__main__":
    debug_ai_fallback()