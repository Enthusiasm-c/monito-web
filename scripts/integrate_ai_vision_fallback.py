#!/usr/bin/env python3
"""
Integrate AI Vision fallback into enhanced PDF processor
"""

import os
import sys

# Read the current enhanced_pdf_processor.py
with open('enhanced_pdf_processor.py', 'r') as f:
    lines = f.readlines()

# Find where to insert the AI Vision import
import_line = None
for i, line in enumerate(lines):
    if 'import pandas as pd' in line:
        import_line = i + 1
        break

if import_line:
    lines.insert(import_line, 'from ai_pdf_ocr_extractor import AiPdfOcrExtractor\n')

# Find the process_pdf method to add AI Vision fallback logic
process_method_end = None
for i, line in enumerate(lines):
    if 'def process_pdf(self, pdf_url: str)' in line:
        # Find the end of this method
        for j in range(i+1, len(lines)):
            if lines[j].startswith('    def ') and not lines[j].startswith('        '):
                process_method_end = j - 1
                break

# Insert AI Vision fallback check before the return statement
if process_method_end:
    # Find the final return statement in process_pdf
    for i in range(process_method_end, 0, -1):
        if 'return {' in lines[i] and lines[i].strip().startswith('return'):
            # Insert AI Vision fallback logic before return
            fallback_code = '''
        # AI Vision fallback for low completeness
        completeness_ratio = (total_processed / total_detected * 100) if total_detected > 0 else 0
        
        # Determine if we should use AI Vision fallback
        should_use_ai_vision = False
        ai_vision_reason = ""
        
        if len(best_products) < 10 and completeness_ratio < 20:
            should_use_ai_vision = True
            ai_vision_reason = "Very few products extracted"
        elif completeness_ratio < 15:
            should_use_ai_vision = True
            ai_vision_reason = "Low extraction completeness"
        elif len(best_products) < 50 and completeness_ratio < 50:
            should_use_ai_vision = True
            ai_vision_reason = "Poor extraction results"
        elif 'milk up' in pdf_path.lower() or 'visual' in pdf_path.lower():
            should_use_ai_vision = True
            ai_vision_reason = "Known visual-heavy supplier"
            
        if should_use_ai_vision and os.getenv('OPENAI_API_KEY'):
            self.log(f"🤖 Attempting AI Vision fallback: {ai_vision_reason}")
            try:
                ai_extractor = AiPdfOcrExtractor(os.getenv('OPENAI_API_KEY'))
                ai_result = ai_extractor.process_pdf(pdf_path)
                
                if ai_result.get('products') and len(ai_result['products']) > len(best_products):
                    self.log(f"✅ AI Vision extracted {len(ai_result['products'])} products (vs {len(best_products)} from traditional methods)")
                    best_products = ai_result['products']
                    best_method = "ai_vision_ocr"
                    total_processed = len(ai_result['products'])
                    
                    # Update metrics
                    if 'metrics' in ai_result:
                        metrics.update({
                            'ai_vision_pages': ai_result['metrics'].get('pages_processed', 0),
                            'ai_vision_cost': ai_result['metrics'].get('cost_usd', 0)
                        })
            except Exception as e:
                self.log(f"AI Vision fallback failed: {e}", 'ERROR')
                
'''
            # Insert the code with proper indentation
            indented_code = []
            for line in fallback_code.split('\n'):
                if line.strip():
                    indented_code.append('        ' + line + '\n')
                else:
                    indented_code.append('\n')
            
            lines[i:i] = indented_code
            break

# Save the updated file
output_file = 'enhanced_pdf_processor_with_ai_vision.py'
with open(output_file, 'w') as f:
    f.writelines(lines)

print(f"✅ Created {output_file} with AI Vision fallback integration")
print("\nKey changes:")
print("1. Added import for AiPdfOcrExtractor")
print("2. Added AI Vision fallback logic that triggers when:")
print("   - Very few products extracted (<10 and <20% completeness)")
print("   - Low extraction completeness (<15%)")
print("   - Poor results (<50 products and <50% completeness)")
print("   - Known visual-heavy suppliers (like 'milk up')")
print("\n3. AI Vision will automatically run if OPENAI_API_KEY is set")