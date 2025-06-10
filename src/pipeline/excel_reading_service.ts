/**
 * Excel Reading Service
 * TypeScript wrapper for Python unified Excel reader
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export interface ExcelSheetData {
  sheet_name: string;
  headers: string[];
  data: Array<Record<string, any> | any[]>;
  raw_data: any[][];
  row_count: number;
  col_count: number;
  cell_count: number;
  has_headers: boolean;
  visible_rows: number;
  visible_cols: number;
  total_rows: number;
  total_cols: number;
  data_range: string;
}

export interface ExcelReadingResult {
  file_path: string;
  sheets: Record<string, ExcelSheetData>;
  metadata: {
    total_sheets: number;
    processed_sheets: number;
    skipped_sheets: number;
    hidden_sheets: number;
    empty_sheets: number;
    file_format: string;
    file_size_bytes: number;
    processing_time_ms: number;
    total_rows: number;
    total_cells: number;
  };
  success: boolean;
  error?: string;
}

export interface ExcelSummary {
  file_path: string;
  file_format: string;
  file_size_bytes: number;
  sheets: Array<{
    name: string;
    hidden: boolean;
    estimated_rows: number;
    estimated_cols: number;
    estimated_cells: number;
  }>;
  error?: string;
}

export interface ExcelReadingConfig {
  includeHidden?: boolean;
  skipEmptySheets?: boolean;
  minRows?: number;
  minCols?: number;
  dataOnly?: boolean;
  normalizeHeaders?: boolean;
  maxSheets?: number;
}

export class ExcelReadingService {
  private pythonScriptPath: string;
  private defaultConfig: ExcelReadingConfig;

  constructor(config?: ExcelReadingConfig) {
    this.pythonScriptPath = path.join(__dirname, 'excel_reader.py');
    this.defaultConfig = {
      includeHidden: false,
      skipEmptySheets: true,
      minRows: 3,
      minCols: 2,
      dataOnly: true,
      normalizeHeaders: true,
      maxSheets: 50,
      ...config
    };
  }

  /**
   * Read Excel file with all sheets
   */
  async readExcelFile(
    filePath: string,
    config?: ExcelReadingConfig
  ): Promise<ExcelReadingResult> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    
    console.log(`📊 Reading Excel file: ${path.basename(filePath)}`);
    
    // Validate file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new Error(`Excel file not found: ${filePath}`);
    }

    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        INCLUDE_HIDDEN: mergedConfig.includeHidden ? 'true' : 'false',
        SKIP_EMPTY_SHEETS: mergedConfig.skipEmptySheets ? 'true' : 'false',
        MIN_ROWS: mergedConfig.minRows?.toString(),
        MIN_COLS: mergedConfig.minCols?.toString(),
        DATA_ONLY: mergedConfig.dataOnly ? 'true' : 'false',
        NORMALIZE_HEADERS: mergedConfig.normalizeHeaders ? 'true' : 'false'
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
        // Log processing info
        if (stderr) {
          console.log('📊 Excel Reading Log:', stderr.split('\n').filter(line => 
            line.includes('[INFO]') || line.includes('[SUMMARY]')
          ).join('\n'));
        }

        if (code === 0) {
          try {
            // Parse JSON output from Python script
            const lines = stdout.split('\n');
            const jsonLine = lines.find(line => line.startsWith('EXCEL_READING_RESULT:'));
            
            if (!jsonLine) {
              reject(new Error('No Excel reading result found in output'));
              return;
            }

            const jsonStr = jsonLine.replace('EXCEL_READING_RESULT:', '');
            const result = JSON.parse(jsonStr) as ExcelReadingResult;
            
            console.log(`✅ Excel file read: ${result.metadata.processed_sheets} sheets, ` +
                       `${result.metadata.total_rows} rows, ` +
                       `${result.metadata.processing_time_ms}ms`);
            
            resolve(result);
            
          } catch (error) {
            reject(new Error(`Failed to parse Excel reading result: ${error}`));
          }
        } else {
          const errorMessage = stderr || 'Unknown error';
          reject(new Error(`Excel reading failed (code ${code}): ${errorMessage}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });

      // Set timeout for the process
      const timeout = setTimeout(() => {
        pythonProcess.kill('SIGTERM');
        reject(new Error('Excel reading timeout after 120s'));
      }, 120000);

      pythonProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Get quick summary of Excel file without reading all data
   */
  async getExcelSummary(filePath: string): Promise<ExcelSummary> {
    console.log(`📊 Getting Excel summary: ${path.basename(filePath)}`);
    
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', ['-c', `
import sys
from pathlib import Path
sys.path.append('${path.dirname(this.pythonScriptPath)}')
from excel_reader import ExcelReader
import json

try:
    reader = ExcelReader()
    summary = reader.get_sheet_summary(Path('${filePath}'))
    print(f"EXCEL_SUMMARY_RESULT:{json.dumps(summary)}")
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
      `], {
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
            const lines = stdout.split('\n');
            const jsonLine = lines.find(line => line.startsWith('EXCEL_SUMMARY_RESULT:'));
            
            if (!jsonLine) {
              reject(new Error('No Excel summary result found'));
              return;
            }

            const jsonStr = jsonLine.replace('EXCEL_SUMMARY_RESULT:', '');
            const result = JSON.parse(jsonStr) as ExcelSummary;
            
            console.log(`✅ Excel summary: ${result.sheets.length} sheets, ` +
                       `${result.file_format} format`);
            
            resolve(result);
            
          } catch (error) {
            reject(new Error(`Failed to parse Excel summary: ${error}`));
          }
        } else {
          reject(new Error(`Excel summary failed: ${stderr}`));
        }
      });
    });
  }

  /**
   * Read specific sheets from Excel file
   */
  async readSpecificSheets(
    filePath: string,
    sheetNames: string[],
    config?: ExcelReadingConfig
  ): Promise<ExcelReadingResult> {
    // First get the full file data
    const fullResult = await this.readExcelFile(filePath, config);
    
    // Filter to only requested sheets
    const filteredSheets: Record<string, ExcelSheetData> = {};
    let filteredRows = 0;
    let filteredCells = 0;
    
    for (const sheetName of sheetNames) {
      if (fullResult.sheets[sheetName]) {
        filteredSheets[sheetName] = fullResult.sheets[sheetName];
        filteredRows += fullResult.sheets[sheetName].row_count;
        filteredCells += fullResult.sheets[sheetName].cell_count;
      }
    }
    
    return {
      ...fullResult,
      sheets: filteredSheets,
      metadata: {
        ...fullResult.metadata,
        processed_sheets: Object.keys(filteredSheets).length,
        total_rows: filteredRows,
        total_cells: filteredCells
      }
    };
  }

  /**
   * Get data from a specific sheet as structured records
   */
  async getSheetAsRecords(
    filePath: string,
    sheetName: string,
    config?: ExcelReadingConfig
  ): Promise<Record<string, any>[]> {
    const result = await this.readExcelFile(filePath, config);
    
    const sheet = result.sheets[sheetName];
    if (!sheet) {
      throw new Error(`Sheet '${sheetName}' not found in Excel file`);
    }
    
    // Return structured data (should already be records if headers were detected)
    if (sheet.has_headers && Array.isArray(sheet.data) && sheet.data.length > 0) {
      // Check if data is already in record format
      if (typeof sheet.data[0] === 'object' && !Array.isArray(sheet.data[0])) {
        return sheet.data as Record<string, any>[];
      }
    }
    
    // Fallback: convert raw data to records using headers
    const records: Record<string, any>[] = [];
    const headers = sheet.headers.length > 0 ? sheet.headers : 
                   Array.from({ length: sheet.col_count }, (_, i) => `column_${i + 1}`);
    
    for (const row of sheet.raw_data) {
      const record: Record<string, any> = {};
      for (let i = 0; i < headers.length && i < row.length; i++) {
        record[headers[i]] = row[i];
      }
      records.push(record);
    }
    
    return records;
  }

  /**
   * Convert Excel data to CSV format
   */
  async exportToCSV(
    filePath: string,
    outputDir: string,
    config?: ExcelReadingConfig
  ): Promise<string[]> {
    console.log(`📊 Converting Excel to CSV: ${path.basename(filePath)}`);
    
    const result = await this.readExcelFile(filePath, config);
    
    if (!result.success) {
      throw new Error(`Failed to read Excel file: ${result.error}`);
    }
    
    const csvFiles: string[] = [];
    
    for (const [sheetName, sheetData] of Object.entries(result.sheets)) {
      try {
        // Create CSV content
        const lines: string[] = [];
        
        // Add headers if available
        if (sheetData.has_headers && sheetData.headers.length > 0) {
          lines.push(sheetData.headers.map(h => this.escapeCsvValue(h)).join(','));
        }
        
        // Add data rows
        for (const row of sheetData.raw_data) {
          const csvRow = row.map(cell => this.escapeCsvValue(cell)).join(',');
          lines.push(csvRow);
        }
        
        // Write CSV file
        const safeName = sheetName.replace(/[^a-zA-Z0-9\-_]/g, '_');
        const csvPath = path.join(outputDir, `${safeName}.csv`);
        
        await fs.mkdir(path.dirname(csvPath), { recursive: true });
        await fs.writeFile(csvPath, lines.join('\n'), 'utf-8');
        
        csvFiles.push(csvPath);
        console.log(`✅ Exported sheet '${sheetName}' to ${csvPath}`);
        
      } catch (error) {
        console.error(`❌ Failed to export sheet '${sheetName}': ${error}`);
      }
    }
    
    return csvFiles;
  }

  /**
   * Check system requirements for Excel processing
   */
  async checkSystemRequirements(): Promise<{
    openpyxl: boolean;
    xlrd: boolean;
    pandas: boolean;
    recommendations: string[];
  }> {
    const requirements = {
      openpyxl: false,
      xlrd: false,
      pandas: false,
      recommendations: [] as string[]
    };

    try {
      const testResult = await new Promise<string>((resolve, reject) => {
        const pythonProcess = spawn('python3', ['-c', `
try:
    import openpyxl
    print("openpyxl:true")
except ImportError:
    print("openpyxl:false")

try:
    import xlrd
    print("xlrd:true")
except ImportError:
    print("xlrd:false")

try:
    import pandas
    print("pandas:true")
except ImportError:
    print("pandas:false")
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
      if (!requirements.openpyxl) {
        requirements.recommendations.push('Install openpyxl: pip install openpyxl (for .xlsx files)');
      }
      if (!requirements.xlrd) {
        requirements.recommendations.push('Install xlrd: pip install xlrd (for .xls files)');
      }
      if (!requirements.pandas) {
        requirements.recommendations.push('Install pandas: pip install pandas (for CSV export)');
      }

    } catch (error) {
      console.error('Failed to check system requirements:', error);
    }

    return requirements;
  }

  /**
   * Get optimal configuration for different Excel file types
   */
  getOptimalConfig(fileType: 'multi_sheet_catalog' | 'single_sheet_list' | 'complex_workbook' | 'general'): ExcelReadingConfig {
    const configs = {
      multi_sheet_catalog: {
        includeHidden: false,
        skipEmptySheets: true,
        minRows: 5,
        minCols: 3,
        normalizeHeaders: true,
        maxSheets: 20
      },
      single_sheet_list: {
        includeHidden: false,
        skipEmptySheets: true,
        minRows: 2,
        minCols: 2,
        normalizeHeaders: true,
        maxSheets: 5
      },
      complex_workbook: {
        includeHidden: true,
        skipEmptySheets: false,
        minRows: 1,
        minCols: 1,
        normalizeHeaders: false,
        maxSheets: 100
      },
      general: {
        includeHidden: false,
        skipEmptySheets: true,
        minRows: 3,
        minCols: 2,
        normalizeHeaders: true,
        maxSheets: 50
      }
    };

    return configs[fileType];
  }

  /**
   * Utility function to escape CSV values
   */
  private escapeCsvValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    const stringValue = String(value);
    
    // If the value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  }
}

// Export singleton instance
export const excelReadingService = new ExcelReadingService();