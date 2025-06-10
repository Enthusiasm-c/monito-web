/**
 * Image Preprocessing Service
 * TypeScript wrapper for Python image preprocessor with menu OCR optimization
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export interface ImagePreprocessingResult {
  input_path: string;
  output_path: string | null;
  preprocessing_applied: string[];
  metadata: {
    original_size: [number, number] | null;
    processed_size: [number, number] | null;
    file_size_bytes: number;
    processing_time_ms: number;
    quality_score: number;
    final_quality_score?: number;
    ocr_confidence?: string;
    recommendations: string[];
  };
  success: boolean;
  error?: string;
}

export interface ImagePreprocessingConfig {
  claheEnabled?: boolean;
  deskewEnabled?: boolean;
  noiseReduction?: boolean;
  contrastEnhancement?: boolean;
  textRegionDetection?: boolean;
  outputDpi?: number;
  maxWidth?: number;
}

export class ImagePreprocessingService {
  private pythonScriptPath: string;
  private defaultConfig: ImagePreprocessingConfig;

  constructor(config?: ImagePreprocessingConfig) {
    this.pythonScriptPath = path.join(__dirname, 'image_preprocessor.py');
    this.defaultConfig = {
      claheEnabled: true,
      deskewEnabled: true,
      noiseReduction: true,
      contrastEnhancement: true,
      textRegionDetection: true,
      outputDpi: 300,
      maxWidth: 2400,
      ...config
    };
  }

  /**
   * Preprocess image for optimal OCR results
   */
  async preprocessImage(
    imagePath: string,
    outputPath?: string,
    config?: ImagePreprocessingConfig
  ): Promise<ImagePreprocessingResult> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    
    console.log(`🖼️ Preprocessing image: ${path.basename(imagePath)}`);
    
    // Validate file exists
    try {
      await fs.access(imagePath);
    } catch (error) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        CLAHE_ENABLED: mergedConfig.claheEnabled ? 'true' : 'false',
        DESKEW_ENABLED: mergedConfig.deskewEnabled ? 'true' : 'false',
        NOISE_REDUCTION: mergedConfig.noiseReduction ? 'true' : 'false',
        CONTRAST_ENHANCEMENT: mergedConfig.contrastEnhancement ? 'true' : 'false',
        TEXT_REGION_DETECTION: mergedConfig.textRegionDetection ? 'true' : 'false',
        OUTPUT_DPI: mergedConfig.outputDpi?.toString(),
        MAX_WIDTH: mergedConfig.maxWidth?.toString()
      };

      const args = [this.pythonScriptPath, imagePath];
      if (outputPath) {
        args.push(outputPath);
      }

      const pythonProcess = spawn('python3', args, {
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
        // Log processing info
        if (stderr) {
          console.log('🖼️ Image Processing Log:', stderr.split('\n').filter(line => 
            line.includes('[INFO]') || line.includes('[SUMMARY]')
          ).join('\n'));
        }

        if (code === 0) {
          try {
            // Parse JSON output from Python script
            const lines = stdout.split('\n');
            const jsonLine = lines.find(line => line.startsWith('IMAGE_PREPROCESSING_RESULT:'));
            
            if (!jsonLine) {
              reject(new Error('No preprocessing result found in output'));
              return;
            }

            const jsonStr = jsonLine.replace('IMAGE_PREPROCESSING_RESULT:', '');
            const result = JSON.parse(jsonStr) as ImagePreprocessingResult;
            
            console.log(`✅ Image preprocessed: ${result.preprocessing_applied.length} steps, ` +
                       `quality: ${result.metadata.quality_score?.toFixed(2) || 'unknown'}, ` +
                       `${result.metadata.processing_time_ms}ms`);
            
            resolve(result);
            
          } catch (error) {
            reject(new Error(`Failed to parse preprocessing result: ${error}`));
          }
        } else {
          const errorMessage = stderr || 'Unknown error';
          reject(new Error(`Image preprocessing failed (code ${code}): ${errorMessage}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });

      // Set timeout for the process
      const timeout = setTimeout(() => {
        pythonProcess.kill('SIGTERM');
        reject(new Error('Image preprocessing timeout after 60s'));
      }, 60000);

      pythonProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Preprocess multiple images in batch
   */
  async preprocessImageBatch(
    imagePaths: string[],
    outputDir?: string,
    config?: ImagePreprocessingConfig
  ): Promise<ImagePreprocessingResult[]> {
    console.log(`🖼️ Batch preprocessing ${imagePaths.length} images`);
    
    const results = await Promise.allSettled(
      imagePaths.map(async (imagePath, index) => {
        const outputPath = outputDir 
          ? path.join(outputDir, `processed_${index}_${path.parse(imagePath).name}.png`)
          : undefined;
        
        return this.preprocessImage(imagePath, outputPath, config);
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`❌ Failed to preprocess ${imagePaths[index]}: ${result.reason}`);
        
        // Return error result
        return {
          input_path: imagePaths[index],
          output_path: null,
          preprocessing_applied: [],
          metadata: {
            original_size: null,
            processed_size: null,
            file_size_bytes: 0,
            processing_time_ms: 0,
            quality_score: 0,
            recommendations: []
          },
          success: false,
          error: result.reason.message || String(result.reason)
        };
      }
    });
  }

  /**
   * Analyze image quality without full preprocessing
   */
  async analyzeImageQuality(imagePath: string): Promise<{
    qualityScore: number;
    issues: string[];
    recommendations: string[];
    estimatedProcessingTime: number;
    requiresPreprocessing: boolean;
  }> {
    // Run preprocessing with minimal config to get quality assessment
    const result = await this.preprocessImage(imagePath, undefined, {
      claheEnabled: false,
      deskewEnabled: false,
      noiseReduction: false,
      contrastEnhancement: false,
      textRegionDetection: false
    });

    const estimatedTime = 2000; // Base 2s
    let additionalTime = 0;

    // Estimate additional time based on recommendations
    const recommendations = result.metadata.recommendations;
    if (recommendations.some(r => r.includes('CLAHE'))) additionalTime += 1000;
    if (recommendations.some(r => r.includes('contrast'))) additionalTime += 500;
    if (recommendations.some(r => r.includes('noise'))) additionalTime += 1500;

    return {
      qualityScore: result.metadata.quality_score,
      issues: recommendations.map(r => r.toLowerCase()),
      recommendations: result.metadata.recommendations,
      estimatedProcessingTime: estimatedTime + additionalTime,
      requiresPreprocessing: result.metadata.quality_score < 0.7
    };
  }

  /**
   * Check system requirements for image processing
   */
  async checkSystemRequirements(): Promise<{
    pil: boolean;
    opencv: boolean;
    pytesseract: boolean;
    tesseract: boolean;
    recommendations: string[];
  }> {
    const requirements = {
      pil: false,
      opencv: false,
      pytesseract: false,
      tesseract: false,
      recommendations: [] as string[]
    };

    try {
      // Check by running the Python script with a test
      const testResult = await new Promise<string>((resolve, reject) => {
        const pythonProcess = spawn('python3', ['-c', `
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

try:
    import pytesseract
    print("pytesseract:true")
except ImportError:
    print("pytesseract:false")

import subprocess
try:
    subprocess.run(["tesseract", "--version"], capture_output=True, check=True)
    print("tesseract:true")
except:
    print("tesseract:false")
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
      if (!requirements.pil) {
        requirements.recommendations.push('Install Pillow: pip install Pillow');
      }
      if (!requirements.opencv) {
        requirements.recommendations.push('Install OpenCV: pip install opencv-python (for advanced preprocessing)');
      }
      if (!requirements.pytesseract) {
        requirements.recommendations.push('Install pytesseract: pip install pytesseract (for OCR quality assessment)');
      }
      if (!requirements.tesseract) {
        requirements.recommendations.push('Install Tesseract: brew install tesseract (macOS) or apt-get install tesseract-ocr (Ubuntu)');
      }

    } catch (error) {
      console.error('Failed to check system requirements:', error);
    }

    return requirements;
  }

  /**
   * Get optimal configuration for different image types
   */
  getOptimalConfig(imageType: 'menu_photo' | 'document_scan' | 'catalog_page' | 'general'): ImagePreprocessingConfig {
    const configs = {
      menu_photo: {
        claheEnabled: true,
        deskewEnabled: true,
        noiseReduction: true,
        contrastEnhancement: true,
        textRegionDetection: true,
        outputDpi: 300,
        maxWidth: 2400
      },
      document_scan: {
        claheEnabled: false,
        deskewEnabled: true,
        noiseReduction: false,
        contrastEnhancement: true,
        textRegionDetection: true,
        outputDpi: 300,
        maxWidth: 3000
      },
      catalog_page: {
        claheEnabled: true,
        deskewEnabled: false,
        noiseReduction: false,
        contrastEnhancement: true,
        textRegionDetection: true,
        outputDpi: 300,
        maxWidth: 2800
      },
      general: {
        claheEnabled: true,
        deskewEnabled: true,
        noiseReduction: true,
        contrastEnhancement: true,
        textRegionDetection: true,
        outputDpi: 300,
        maxWidth: 2400
      }
    };

    return configs[imageType];
  }
}

// Export singleton instance
export const imagePreprocessingService = new ImagePreprocessingService();