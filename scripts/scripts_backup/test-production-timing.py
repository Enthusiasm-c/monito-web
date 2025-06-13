#!/usr/bin/env python3
"""
Test production timing by running the actual pdf_image_extractor.py
with detailed timing measurements
"""

import sys
import time
import subprocess
import os
from pathlib import Path
from dotenv import load_dotenv

def test_production_timing():
    print("🕐 Testing production AI Vision timing...")
    
    # Load environment
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
    
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("❌ OPENAI_API_KEY not found")
        return
    
    # Test with milk up PDF
    pdf_url = "https://cdc1w79ssc4kg6xh.public.blob.vercel-storage.com/milk%20up-RB2AKmAEQe0cBDWBdHPI8yULfxjE1C.pdf"
    script_path = Path(__file__).parent / 'pdf_image_extractor.py'
    
    print(f"📄 PDF URL: {pdf_url[:50]}...")
    print(f"🐍 Script: {script_path}")
    print(f"🔑 API Key: {'*' * 10}... (configured)")
    
    # Run the actual production script with timing
    start_time = time.time()
    
    try:
        print(f"\n🚀 Starting production script...")
        result = subprocess.run([
            'python3', str(script_path), pdf_url, api_key
        ], 
        capture_output=True, 
        text=True, 
        timeout=300  # 5 minute timeout
        )
        
        end_time = time.time()
        total_time = end_time - start_time
        
        print(f"✅ Production script completed in {total_time:.2f}s")
        print(f"📊 Exit code: {result.returncode}")
        
        # Analyze stdout for timing information
        stdout_lines = result.stdout.split('\n')
        stderr_lines = result.stderr.split('\n')
        
        print(f"\n📤 STDOUT Analysis:")
        page_times = {}
        current_page = None
        
        for line in stdout_lines:
            if '[INFO] 🔄 Processing page' in line:
                current_page = line.split('page ')[1].split('/')[0]
                page_times[current_page] = {'start': time.time()}
                print(f"   📄 {line.strip()}")
            elif '[INFO] ✅ Page' in line and 'chars' in line:
                page_num = line.split('Page ')[1].split(':')[0]
                chars = line.split(': ')[1].split(' chars')[0]
                print(f"   📊 {line.strip()}")
            elif '[INFO] 🤖 Sending page' in line:
                page_num = line.split('page ')[1].split(' ')[0]
                print(f"   🚀 {line.strip()}")
            elif '[INFO] ✅ Page' in line and 'Extracted' in line:
                products = line.split('Extracted ')[1].split(' products')[0]
                print(f"   🛍️ {line.strip()}")
            elif '[INFO] 📊 AI extraction completed' in line:
                print(f"   🎉 {line.strip()}")
            elif '[INFO]' in line:
                print(f"   ℹ️ {line.strip()}")
        
        print(f"\n📤 STDERR Analysis:")
        for line in stderr_lines:
            if line.strip():
                print(f"   ⚠️ {line.strip()}")
        
        # Look for timing patterns in output
        print(f"\n🔍 Timing Pattern Analysis:")
        
        # Count processing steps
        image_conversion_lines = [l for l in stdout_lines if '🔄 Processing page' in l]
        api_call_lines = [l for l in stdout_lines if '🤖 Sending page' in l]
        response_lines = [l for l in stdout_lines if '✅ Page' in l and 'Extracted' in l]
        
        print(f"   📊 Image conversions: {len(image_conversion_lines)}")
        print(f"   🌐 API calls: {len(api_call_lines)}")
        print(f"   📝 Responses: {len(response_lines)}")
        
        # Estimate time per step
        if len(api_call_lines) > 0:
            estimated_api_time = total_time / len(api_call_lines)
            print(f"   ⏱️ Estimated time per API call: {estimated_api_time:.2f}s")
        
        # Check for JSON markers
        if '=== AI_EXTRACTION_JSON_START ===' in result.stdout:
            print(f"   ✅ JSON extraction markers found")
            # Extract JSON section
            json_start = result.stdout.find('=== AI_EXTRACTION_JSON_START ===')
            json_end = result.stdout.find('=== AI_EXTRACTION_JSON_END ===')
            if json_start != -1 and json_end != -1:
                json_section = result.stdout[json_start:json_end]
                json_lines = len(json_section.split('\n'))
                print(f"   📊 JSON section: {json_lines} lines")
        else:
            print(f"   ❌ No JSON extraction markers found")
        
    except subprocess.TimeoutExpired:
        end_time = time.time()
        total_time = end_time - start_time
        print(f"⏰ Production script TIMEOUT after {total_time:.2f}s")
        
    except Exception as e:
        end_time = time.time()
        total_time = end_time - start_time
        print(f"❌ Production script error after {total_time:.2f}s: {e}")
    
    print(f"\n💡 Performance Analysis:")
    print(f"   🎯 Target: 10s per page")
    print(f"   📊 Current: {total_time/3:.2f}s per page (3 pages processed)")
    
    if total_time > 30:  # More than 10s per page
        print(f"   ⚠️ SLOW: Exceeds 10s per page target")
        print(f"   🔧 Recommendations:")
        print(f"      • Check network latency to OpenAI")
        print(f"      • Reduce image size further")
        print(f"      • Use JPEG instead of PNG")
        print(f"      • Shorten prompt")
    else:
        print(f"   ✅ GOOD: Within acceptable range")

if __name__ == "__main__":
    test_production_timing()