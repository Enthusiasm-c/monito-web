/**
 * PDF Text Service
 * TypeScript wrapper for Python PDF text extractor with OCR fallback
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export interface PDFTextExtractionResult {
  file_path: string;
  extraction_methods: string[];
  text_content: string;
  page_texts: string[];
  metadata: {
    total_pages: number;
    text_layer_quality: 'none' | 'poor' | 'fair' | 'good' | 'unknown';
    ocr_applied: boolean;
    processing_time_ms: number;
    file_size_bytes: number;
    total_characters?: number;
    avg_chars_per_page?: number;
    pages_with_text?: number;
  };
  success: boolean;
  error?: string;
}

export interface PDFTextConfig {
  minTextCharsPerPage?: number;
  ocrTimeout?: number;
  forceOcr?: boolean;
  deskewEnabled?: boolean;
  contrastEnhancement?: boolean;
}

export class PDFTextService {
  private pythonScriptPath: string;
  private defaultConfig: PDFTextConfig;

  constructor(config?: PDFTextConfig) {
    this.pythonScriptPath = path.join(__dirname, 'pdf_text_extractor.py');
    this.defaultConfig = {
      minTextCharsPerPage: 50,
      ocrTimeout: 300, // 5 minutes
      forceOcr: false,
      deskewEnabled: true,
      contrastEnhancement: true,
      ...config
    };
  }

  /**
   * Extract text from PDF with OCR fallback
   */
  async extractTextFromPDF(
    filePath: string, 
    config?: PDFTextConfig
  ): Promise<PDFTextExtractionResult> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    
    console.log(`📄 Extracting text from PDF: ${path.basename(filePath)}`);
    
    // Validate file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new Error(`PDF file not found: ${filePath}`);
    }

    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        MIN_TEXT_CHARS_PER_PAGE: mergedConfig.minTextCharsPerPage?.toString(),
        OCR_TIMEOUT: mergedConfig.ocrTimeout?.toString(),
        FORCE_OCR: mergedConfig.forceOcr ? 'true' : 'false',
        DESKEW_ENABLED: mergedConfig.deskewEnabled ? 'true' : 'false',
        CONTRAST_ENHANCEMENT: mergedConfig.contrastEnhancement ? 'true' : 'false'
      };

      const pythonProcess = spawn('python3', [this.pythonScriptPath, filePath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        // Log stderr for debugging
        if (stderr) {
          console.log('📄 PDF Extraction Log:', stderr.split('\n').filter(line => 
            line.includes('[INFO]') || line.includes('[SUMMARY]')
          ).join('\n'));
        }

        if (code === 0) {
          try {
            // Parse JSON output from Python script
            const lines = stdout.split('\n');
            const jsonLine = lines.find(line => line.startsWith('PDF_TEXT_EXTRACTION_RESULT:'));
            
            if (!jsonLine) {
              reject(new Error('No extraction result found in output'));
              return;
            }

            const jsonStr = jsonLine.replace('PDF_TEXT_EXTRACTION_RESULT:', '');
            const result = JSON.parse(jsonStr) as PDFTextExtractionResult;
            
            console.log(`✅ PDF text extracted: ${result.metadata.total_pages} pages, ` +
                       `${result.metadata.total_characters || 0} chars, ` +
                       `OCR: ${result.metadata.ocr_applied ? 'Yes' : 'No'}`);
            
            resolve(result);
            
          } catch (error) {
            reject(new Error(`Failed to parse extraction result: ${error}`));
          }
        } else {
          const errorMessage = stderr || 'Unknown error';
          reject(new Error(`PDF text extraction failed (code ${code}): ${errorMessage}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });

      // Set timeout for the entire process
      const timeout = setTimeout(() => {
        pythonProcess.kill('SIGTERM');
        reject(new Error(`PDF extraction timeout after ${mergedConfig.ocrTimeout}s`));
      }, (mergedConfig.ocrTimeout || 300) * 1000);

      pythonProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Extract text from multiple PDFs in batch
   */
  async extractTextFromPDFBatch(
    filePaths: string[],
    config?: PDFTextConfig
  ): Promise<PDFTextExtractionResult[]> {
    console.log(`📄 Batch extracting text from ${filePaths.length} PDFs`);
    
    const results = await Promise.allSettled(
      filePaths.map(filePath => this.extractTextFromPDF(filePath, config))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`❌ Failed to extract text from ${filePaths[index]}: ${result.reason}`);
        
        // Return error result
        return {
          file_path: filePaths[index],
          extraction_methods: [],
          text_content: '',
          page_texts: [],
          metadata: {
            total_pages: 0,
            text_layer_quality: 'unknown' as const,
            ocr_applied: false,
            processing_time_ms: 0,
            file_size_bytes: 0
          },
          success: false,
          error: result.reason.message || String(result.reason)
        };
      }
    });
  }

  /**
   * Analyze PDF text layer quality without full extraction
   */
  async analyzePDFTextLayer(filePath: string): Promise<{
    hasTextLayer: boolean;
    quality: 'none' | 'poor' | 'fair' | 'good';
    recommendsOCR: boolean;
    totalPages: number;
    estimatedProcessingTime: number;
  }> {
    // Quick analysis by extracting just metadata
    const result = await this.extractTextFromPDF(filePath, {
      forceOcr: false, // Don't run OCR for quick analysis
      ocrTimeout: 30   // Short timeout
    });

    const quality = result.metadata.text_layer_quality;
    const hasTextLayer = quality !== 'none';
    const recommendsOCR = quality === 'none' || quality === 'poor';
    
    // Estimate processing time based on pages and quality
    let estimatedTime = result.metadata.total_pages * 2; // Base 2s per page
    
    if (recommendsOCR) {
      estimatedTime += result.metadata.total_pages * 15; // Add 15s per page for OCR
    }

    return {
      hasTextLayer,
      quality,
      recommendsOCR,
      totalPages: result.metadata.total_pages,
      estimatedProcessingTime: estimatedTime
    };
  }

  /**
   * Check system requirements for PDF processing
   */
  async checkSystemRequirements(): Promise<{
    pymupdf: boolean;
    tesseract: boolean;
    ocrmypdf: boolean;
    pil: boolean;
    opencv: boolean;
    recommendations: string[];
  }> {
    const requirements = {
      pymupdf: false,
      tesseract: false,
      ocrmypdf: false,
      pil: false,
      opencv: false,
      recommendations: [] as string[]
    };

    try {
      // Check by running the Python script with a test
      const testResult = await new Promise<string>((resolve, reject) => {
        const pythonProcess = spawn('python3', ['-c', `
import sys
try:
    import fitz
    print("pymupdf:true")
except ImportError:
    print("pymupdf:false")

try:
    from PIL import Image
    print("pil:true")
except ImportError:
    print("pil:false")

try:
    import cv2
    print("opencv:true")
except ImportError:
    print("opencv:false")

import subprocess
try:
    subprocess.run(["tesseract", "--version"], capture_output=True, check=True)
    print("tesseract:true")
except:
    print("tesseract:false")

try:
    subprocess.run(["ocrmypdf", "--version"], capture_output=True, check=True)
    print("ocrmypdf:true")
except:
    print("ocrmypdf:false")
        `], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        pythonProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        pythonProcess.on('close', (code) => {
          if (code === 0) {
            resolve(output);
          } else {
            reject(new Error('Requirements check failed'));
          }
        });
      });

      // Parse results
      const lines = testResult.split('\n');
      for (const line of lines) {
        const [pkg, available] = line.split(':');
        if (pkg && available) {
          (requirements as any)[pkg] = available === 'true';
        }
      }

      // Generate recommendations
      if (!requirements.pymupdf) {
        requirements.recommendations.push('Install PyMuPDF: pip install PyMuPDF');
      }
      if (!requirements.tesseract) {
        requirements.recommendations.push('Install Tesseract: brew install tesseract (macOS) or apt-get install tesseract-ocr (Ubuntu)');
      }
      if (!requirements.ocrmypdf) {
        requirements.recommendations.push('Install ocrmypdf: pip install ocrmypdf');
      }
      if (!requirements.pil) {
        requirements.recommendations.push('Install Pillow: pip install Pillow');
      }
      if (!requirements.opencv) {
        requirements.recommendations.push('Install OpenCV: pip install opencv-python (optional, for deskewing)');
      }

    } catch (error) {
      console.error('Failed to check system requirements:', error);
    }

    return requirements;
  }

  /**
   * Get processing statistics for monitoring
   */
  getProcessingStats(): {
    totalProcessed: number;
    averageProcessingTime: number;
    ocrUsageRate: number;
    successRate: number;
  } {
    // This would be implemented with actual usage tracking
    // For now, return placeholder values
    return {
      totalProcessed: 0,
      averageProcessingTime: 0,
      ocrUsageRate: 0,
      successRate: 1.0
    };
  }
}

// Export singleton instance
export const pdfTextService = new PDFTextService();