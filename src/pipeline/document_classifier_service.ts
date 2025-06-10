/**
 * Document Classifier Service
 * TypeScript wrapper for Python document classifier
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export interface DocumentClassificationResult {
  file_path: string;
  file_hash: string;
  mime_type: string;
  document_type: string;
  metadata: {
    file_size: number;
    file_name: string;
    file_extension: string;
    modified_time: number;
    created_time: number;
  };
  processing_recommendation: {
    status: string;
    priority: 'high' | 'medium' | 'low';
    estimated_processing_time_s: number;
    requires_ocr: boolean;
    complexity: 'low' | 'medium' | 'high';
  };
}

export class DocumentClassifierService {
  private pythonScriptPath: string;

  constructor() {
    this.pythonScriptPath = path.join(__dirname, '..', '..', 'scripts', 'document_classifier_cli.py');
  }

  /**
   * Classify document using Python classifier
   */
  async classifyDocument(filePath: string): Promise<DocumentClassificationResult> {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [this.pythonScriptPath, filePath], {
        stdio: ['pipe', 'pipe', 'pipe']
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
        if (code === 0) {
          try {
            // Parse JSON output from Python script
            const lines = stdout.split('\n');
            const jsonLine = lines.find(line => line.startsWith('CLASSIFICATION_RESULT:'));
            
            if (!jsonLine) {
              reject(new Error('No classification result found in output'));
              return;
            }

            const jsonStr = jsonLine.replace('CLASSIFICATION_RESULT:', '');
            const result = JSON.parse(jsonStr);
            
            // Add processing recommendations
            const enhanced = this.addProcessingRecommendations(result);
            resolve(enhanced);
            
          } catch (error) {
            reject(new Error(`Failed to parse classification result: ${error}`));
          }
        } else {
          reject(new Error(`Python classification failed (code ${code}): ${stderr}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });
    });
  }

  /**
   * Add processing recommendations based on classification
   */
  private addProcessingRecommendations(
    classification: any
  ): DocumentClassificationResult {
    const docType = classification.document_type;
    const fileSize = classification.metadata.file_size;
    
    let recommendation = {
      status: 'pending',
      priority: 'medium' as 'high' | 'medium' | 'low',
      estimated_processing_time_s: 30,
      requires_ocr: false,
      complexity: 'medium' as 'low' | 'medium' | 'high'
    };

    // Determine recommendations based on document type
    switch (docType) {
      case 'pdf_structured':
        recommendation = {
          status: 'pending',
          priority: 'high',
          estimated_processing_time_s: 15,
          requires_ocr: false,
          complexity: 'low'
        };
        break;

      case 'pdf_scanned':
        recommendation = {
          status: 'pending_ocr',
          priority: 'medium',
          estimated_processing_time_s: 60,
          requires_ocr: true,
          complexity: 'high'
        };
        break;

      case 'pdf_image':
        recommendation = {
          status: 'pending_ocr',
          priority: 'medium',
          estimated_processing_time_s: 45,
          requires_ocr: true,
          complexity: 'high'
        };
        break;

      case 'excel_single':
        recommendation = {
          status: 'pending',
          priority: 'high',
          estimated_processing_time_s: 5,
          requires_ocr: false,
          complexity: 'low'
        };
        break;

      case 'excel_multi':
        recommendation = {
          status: 'pending',
          priority: 'medium',
          estimated_processing_time_s: 15,
          requires_ocr: false,
          complexity: 'medium'
        };
        break;

      case 'csv_simple':
        recommendation = {
          status: 'pending',
          priority: 'high',
          estimated_processing_time_s: 3,
          requires_ocr: false,
          complexity: 'low'
        };
        break;

      case 'csv_complex':
        recommendation = {
          status: 'pending',
          priority: 'medium',
          estimated_processing_time_s: 10,
          requires_ocr: false,
          complexity: 'medium'
        };
        break;

      case 'image_menu':
      case 'image_catalog':
        recommendation = {
          status: 'pending_ocr',
          priority: 'low',
          estimated_processing_time_s: 90,
          requires_ocr: true,
          complexity: 'high'
        };
        break;

      default:
        recommendation = {
          status: 'pending',
          priority: 'low',
          estimated_processing_time_s: 120,
          requires_ocr: false,
          complexity: 'high'
        };
    }

    // Adjust for file size
    if (fileSize > 50 * 1024 * 1024) { // 50MB
      recommendation.status = 'pending_large';
      recommendation.priority = 'low';
      recommendation.estimated_processing_time_s *= 3;
    } else if (fileSize > 10 * 1024 * 1024) { // 10MB
      recommendation.estimated_processing_time_s *= 1.5;
    }

    return {
      ...classification,
      processing_recommendation: recommendation
    };
  }

  /**
   * Get supported file types
   */
  getSupportedFileTypes(): string[] {
    return [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel', 
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'image/bmp'
    ];
  }

  /**
   * Validate file before classification
   */
  async validateFile(filePath: string): Promise<{
    valid: boolean;
    reason?: string;
    fileSize?: number;
  }> {
    try {
      const stats = await fs.stat(filePath);
      
      // Check file size (max 100MB)
      if (stats.size > 100 * 1024 * 1024) {
        return {
          valid: false,
          reason: 'File too large (max 100MB)',
          fileSize: stats.size
        };
      }

      // Check if file exists and is readable
      await fs.access(filePath, fs.constants.R_OK);

      return {
        valid: true,
        fileSize: stats.size
      };

    } catch (error) {
      return {
        valid: false,
        reason: `File access error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Classify multiple documents in batch
   */
  async classifyBatch(filePaths: string[]): Promise<DocumentClassificationResult[]> {
    const results = await Promise.allSettled(
      filePaths.map(filePath => this.classifyDocument(filePath))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // Return error result
        return {
          file_path: filePaths[index],
          file_hash: '',
          mime_type: 'application/octet-stream',
          document_type: 'unknown',
          metadata: {
            file_size: 0,
            file_name: path.basename(filePaths[index]),
            file_extension: path.extname(filePaths[index]),
            modified_time: 0,
            created_time: 0
          },
          processing_recommendation: {
            status: 'failed',
            priority: 'low',
            estimated_processing_time_s: 0,
            requires_ocr: false,
            complexity: 'high'
          }
        } as DocumentClassificationResult;
      }
    });
  }
}

// Export singleton instance
export const documentClassifierService = new DocumentClassifierService();