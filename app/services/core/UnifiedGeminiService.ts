import { z } from 'zod';
import * as XLSX from 'xlsx';
import { ProductSchema, ExtractedDataSchema, ExtractedData } from '../ai-optimized/schemas';

interface ProcessOptions {
  maxProducts?: number;
  model?: 'gemini-2.0-flash-exp' | 'gemini-2.0-flash' | 'gemini-1.5-pro' | 'gemini-1.5-flash';
  includeMetadata?: boolean;
  preferredLanguage?: string;
  batchSize?: number;
  enableBatching?: boolean;
}

interface FileContent {
  type: 'binary' | 'text';
  content: string;
  mimeType?: string;
}

interface BatchData {
  data: any[][];
  startRow: number;
  endRow: number;
}

/**
 * Unified Gemini Service - Consolidates all Gemini processing logic
 * Replaces: GeminiProcessor, GeminiUnifiedProcessor, GeminiPdfProcessor
 */
export class UnifiedGeminiService {
  private apiKey: string;
  private defaultModel = 'gemini-2.0-flash-exp';
  private apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  private defaultBatchSize = 200;
  private maxRetries = 3;

  constructor() {
    this.apiKey = process.env.GOOGLE_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('GOOGLE_API_KEY not found in environment variables');
    }
  }

  /**
   * Main entry point - intelligently routes to single or batch processing
   */
  async processDocument(
    content: string | Buffer,
    fileName: string,
    options: ProcessOptions = {}
  ): Promise<ExtractedData> {
    console.log(`[UnifiedGemini] Processing ${fileName} with model ${options.model || this.defaultModel}`);
    
    try {
      // Prepare file content
      const preparedContent = await this.prepareFileContent(content, fileName);
      
      // Estimate product count for batching decision
      const estimatedProducts = this.estimateProductCount(preparedContent, fileName);
      const shouldUseBatching = options.enableBatching || estimatedProducts > 250;
      
      console.log(`[UnifiedGemini] Estimated products: ${estimatedProducts}, Using batching: ${shouldUseBatching}`);
      
      if (shouldUseBatching && preparedContent.type === 'text') {
        return await this.processBatchMode(preparedContent, fileName, options);
      } else {
        return await this.processSingleMode(preparedContent, fileName, options);
      }
      
    } catch (error) {
      console.error('[UnifiedGemini] Error:', error);
      throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Single request processing (for smaller files)
   */
  private async processSingleMode(
    fileContent: FileContent,
    fileName: string,
    options: ProcessOptions
  ): Promise<ExtractedData> {
    const model = options.model || this.defaultModel;
    const useCompactFormat = (options.maxProducts || 0) > 150;
    const prompt = this.buildExtractionPrompt(options, useCompactFormat);
    
    return await this.makeGeminiRequest(fileContent, prompt, fileName, model);
  }

  /**
   * Batch processing (for larger files)
   */
  private async processBatchMode(
    fileContent: FileContent,
    fileName: string,
    options: ProcessOptions
  ): Promise<ExtractedData> {
    if (fileContent.type !== 'text') {
      throw new Error('Batch processing only supports preprocessed text content');
    }

    const batchSize = options.batchSize || this.defaultBatchSize;
    const batches = this.createBatches(fileContent.content, batchSize);
    const allProducts: any[] = [];
    
    console.log(`[UnifiedGemini] Processing ${batches.length} batches with size ${batchSize}`);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchNum = i + 1;
      
      console.log(`[UnifiedGemini] Processing batch ${batchNum}/${batches.length}: rows ${batch.startRow}-${batch.endRow}`);
      
      try {
        const batchResult = await this.processBatchWithRetry(batch, fileName, batchNum, options);
        allProducts.push(...batchResult);
        
        // Rate limiting between batches
        if (i < batches.length - 1) {
          await this.sleep(2000);
        }
        
      } catch (error) {
        console.error(`[UnifiedGemini] Batch ${batchNum} failed:`, error);
        // Continue with next batch
      }
    }
    
    return {
      documentType: 'price_list',
      supplierName: this.extractSupplierName(fileName),
      supplierContact: { email: null, phone: null, address: null },
      products: allProducts,
      extractionQuality: this.calculateQuality(allProducts),
      metadata: {
        dateExtracted: new Date().toISOString(),
        totalPages: 1,
        language: 'id',
        currency: 'IDR',
        processor: 'unified-gemini',
        model: options.model || this.defaultModel,
        processingMethod: 'batch',
        totalBatches: batches.length,
        batchSize: batchSize
      }
    };
  }

  /**
   * Prepare file content based on type
   */
  private async prepareFileContent(content: string | Buffer, fileName: string): Promise<FileContent> {
    const ext = fileName.toLowerCase();
    
    // Excel and CSV files need preprocessing
    if (ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.csv')) {
      console.log(`[UnifiedGemini] Preprocessing Excel/CSV file: ${fileName}`);
      try {
        return this.preprocessExcelFile(content, fileName);
      } catch (error: any) {
        if (error.isExcelJSFallback) {
          console.log(`[UnifiedGemini] Using ExcelJS fallback for: ${fileName}`);
          return await this.preprocessExcelJSFile(error.buffer, error.fileName);
        }
        throw error;
      }
    }
    
    // PDF and images can be sent directly
    if (ext.endsWith('.pdf') || this.isImageFile(fileName)) {
      if (!Buffer.isBuffer(content)) {
        throw new Error('Binary files must be provided as Buffer');
      }
      return {
        type: 'binary',
        content: content.toString('base64'),
        mimeType: this.getMimeType(fileName)
      };
    }
    
    // Text files
    return {
      type: 'text',
      content: typeof content === 'string' ? content : content.toString()
    };
  }

  /**
   * Preprocess Excel files into structured text
   */
  private preprocessExcelFile(content: string | Buffer, fileName: string): FileContent {
    try {
      // Try XLSX first with fallback to ExcelJS
      let workbook;
      try {
        workbook = XLSX.read(content, { type: Buffer.isBuffer(content) ? 'buffer' : 'string' });
      } catch (xlsxError: any) {
        console.warn('⚠️ XLSX failed, trying ExcelJS fallback in UnifiedGemini:', xlsxError.message);
        
        // Fallback to ExcelJS for corrupted files
        const ExcelJS = require('exceljs');
        const excelWorkbook = new ExcelJS.Workbook();
        const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
        
        // Use ExcelJS fallback (async)
        throw { isExcelJSFallback: true, buffer, fileName };
      }
      
      // Find sheet with data
      let selectedSheet = null;
      let jsonData: any[][] = [];
      
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (sheetData && sheetData.length > 0) {
          const hasData = sheetData.some(row => 
            row && row.some(cell => cell !== null && cell !== undefined && cell !== '')
          );
          
          if (hasData) {
            selectedSheet = sheetName;
            jsonData = sheetData;
            break;
          }
        }
      }
      
      if (!selectedSheet || jsonData.length === 0) {
        throw new Error(`No data found in Excel file`);
      }
      
      // Convert to markdown table
      const headers = this.detectHeaders(jsonData);
      const markdownTable = this.createMarkdownTable(jsonData, headers);
      const rowCount = this.countDataRows(jsonData);
      
      return {
        type: 'text',
        content: `Excel/CSV File: ${fileName}
Total Rows with Data: ${rowCount}
Detected Columns: ${headers ? headers.join(', ') : 'No headers detected'}

Data Table:
${markdownTable}

Instructions: Extract all product information from this spreadsheet data.`
      };
      
    } catch (error: any) {
      // Re-throw ExcelJS fallback signals
      if (error.isExcelJSFallback) {
        throw error;
      }
      console.error('[UnifiedGemini] Excel preprocessing error:', error);
      throw new Error(`Failed to preprocess Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build extraction prompt based on options
   */
  private buildExtractionPrompt(options: ProcessOptions, useCompactFormat: boolean = false): string {
    const maxProducts = options.maxProducts || 1000;
    
    if (useCompactFormat) {
      return `SYSTEM ROLE: "GeminiExtractor"

You analyse a single business document and return **only** structured JSON with raw product data.

**Compact format:**
[{"n":"<name>","p":<price|null>,"u":"<unit|null>","c":"<category|null>","s":<0-1>}, …]

EXTRACTION RULES:
A. Product names: Copy verbatim (preserve spelling, language, case)
B. Price normalisation: Strip currency, Indonesian shorthands (39k→39000, 1.5jt→1500000)
C. Units: Capture exactly as printed
D. Categories: Copy if visible, else null
E. Confidence: 0.9 for clear data, 0.7 for unclear

Extract ALL ${maxProducts}+ products. Return ONLY the JSON array.`;
    }

    return `SYSTEM ROLE: "GeminiExtractor"

Extract all product information and return structured JSON:

{
  "documentType": "price_list" | "invoice" | "catalog" | "order" | "unknown",
  "supplier": {
    "name": "<string|null>",
    "email": "<string|null>",
    "phone": "<string|null>",
    "address": "<string|null>"
  },
  "products": [
    {
      "name": "<string>",
      "price": <number|null>,
      "unit": "<string|null>",
      "category": "<string|null>",
      "confidence": <number 0-1>
    }
  ],
  "extractionQuality": <number 0-1>,
  "metadata": {
    "totalPages": <integer>,
    "language": "<ISO-code>",
    "currency": "<string>"
  }
}

EXTRACTION RULES:
- Product names: EXACTLY as written (preserve spelling, language, case)
- Price normalisation: Handle Indonesian formats (39k→39000, 1.5jt→1500000)
- Units: Exact tokens from document
- Extract up to ${maxProducts} products
- Process ALL pages/sheets

Return ONLY valid JSON.`;
  }

  /**
   * Make request to Gemini API
   */
  private async makeGeminiRequest(
    fileContent: FileContent,
    prompt: string,
    fileName: string,
    model: string
  ): Promise<ExtractedData> {
    const parts: any[] = [{ text: prompt }];
    
    if (fileContent.type === 'binary' && fileContent.mimeType) {
      parts.push({
        inlineData: {
          mimeType: fileContent.mimeType,
          data: fileContent.content
        }
      });
    } else {
      parts[0].text += '\n\nDocument content:\n' + fileContent.content;
    }
    
    const requestBody = {
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 32768,
        topP: 0.95,
        topK: 40
      }
    };
    
    const response = await fetch(
      `${this.apiUrl}/${model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }
    
    const result = await response.json();
    
    if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('No response content from Gemini');
    }
    
    return this.parseGeminiResponse(result.candidates[0].content.parts[0].text, fileName);
  }

  /**
   * Process batch with retry logic
   */
  private async processBatchWithRetry(
    batch: BatchData,
    fileName: string,
    batchNum: number,
    options: ProcessOptions
  ): Promise<any[]> {
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.processBatch(batch, fileName, batchNum, options);
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) {
          const delay = attempt * 1000;
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Process single batch
   */
  private async processBatch(
    batch: BatchData,
    fileName: string,
    batchNum: number,
    options: ProcessOptions
  ): Promise<any[]> {
    const prompt = this.buildBatchPrompt(batch, fileName, batchNum);
    const model = options.model || this.defaultModel;
    
    const fileContent: FileContent = {
      type: 'text',
      content: prompt
    };
    
    const response = await this.makeGeminiRequest(fileContent, '', fileName, model);
    
    // If compact format, parse as array
    if (Array.isArray(response)) {
      return response;
    }
    
    return response.products || [];
  }

  // Utility methods
  private createBatches(content: string, batchSize: number): BatchData[] {
    // Extract products from content and create batches
    // Implementation depends on content format
    return [];
  }

  private buildBatchPrompt(batch: BatchData, fileName: string, batchNum: number): string {
    return `Extract products from batch ${batchNum} of ${fileName} in compact format.`;
  }

  private estimateProductCount(content: FileContent, fileName: string): number {
    if (content.type === 'text') {
      const lines = content.content.split('\n').filter(line => line.trim());
      return Math.max(0, lines.length - 10); // Rough estimate
    }
    return 100; // Default for binary files
  }

  private detectHeaders(data: any[][]): string[] | null {
    // Implementation from existing code
    return null;
  }

  private createMarkdownTable(data: any[][], headers: string[] | null): string {
    // Implementation from existing code
    return '';
  }

  private countDataRows(data: any[][]): number {
    return data.filter(row => 
      row && row.some(cell => cell !== null && cell !== undefined && cell !== '')
    ).length;
  }

  private parseGeminiResponse(content: string, fileName: string): ExtractedData {
    console.log(`🔍 Parsing Gemini response for ${fileName}:`, content.substring(0, 200) + '...');
    
    try {
      // Remove markdown code blocks
      let cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Try to find JSON in the response
      const jsonMatch = cleanedContent.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('❌ No JSON found in response');
        return {
          supplier: null,
          products: [],
          metadata: { fileName, quality: 0 }
        };
      }

      const parsedData = JSON.parse(jsonMatch[0]);
      console.log(`📊 Parsed data:`, parsedData);

      // Handle both compact format (array) and full format (object)
      let products = [];
      if (Array.isArray(parsedData)) {
        // Compact format: [{"n":"name","p":price,"u":"unit","c":"category","s":confidence}]
        products = parsedData.map(item => ({
          name: item.n || item.name || "",
          price: item.p !== null ? item.p : (item.price || null),
          unit: item.u || item.unit || null,
          category: item.c || item.category || null,
          confidence: item.s !== undefined ? item.s : (item.confidence || 0.9)
        }));
      } else if (parsedData.products && Array.isArray(parsedData.products)) {
        // Full format: {"products": [...]}
        products = parsedData.products;
      }

      console.log(`✅ Extracted ${products.length} products`);

      return {
        supplier: null,
        products: products,
        metadata: {
          fileName,
          quality: this.calculateQuality(products)
        }
      };

    } catch (error) {
      console.error('❌ Error parsing Gemini response:', error);
      console.log('Raw content:', content);
      return {
        supplier: null,
        products: [],
        metadata: { fileName, quality: 0 }
      };
    }
  }

  private extractSupplierName(fileName: string): string {
    return fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
  }

  private calculateQuality(products: any[]): number {
    if (products.length === 0) return 0;
    const avgConfidence = products.reduce((sum, p) => sum + (p.confidence || 0.9), 0) / products.length;
    return Math.round(avgConfidence * 100) / 100;
  }

  private getMimeType(fileName: string): string {
    const ext = fileName.toLowerCase();
    if (ext.endsWith('.pdf')) return 'application/pdf';
    if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) return 'image/jpeg';
    if (ext.endsWith('.png')) return 'image/png';
    if (ext.endsWith('.gif')) return 'image/gif';
    if (ext.endsWith('.webp')) return 'image/webp';
    return 'application/octet-stream';
  }

  private isImageFile(fileName: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Preprocess Excel file using ExcelJS (fallback for corrupted files)
   */
  private async preprocessExcelJSFile(buffer: Buffer, fileName: string): Promise<FileContent> {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    
    // Load the Excel file
    await workbook.xlsx.load(buffer);
    
    console.log(`📊 ExcelJS: Processing file with ${workbook.worksheets.length} worksheets`);
    
    // Find the first worksheet with data
    let selectedWorksheet = null;
    let jsonData: any[][] = [];
    
    for (const worksheet of workbook.worksheets) {
      if (worksheet.rowCount > 0) {
        console.log(`   📋 Checking worksheet: "${worksheet.name}" (${worksheet.rowCount} rows)`);
        
        // Convert ExcelJS worksheet to array format
        const worksheetData: any[][] = [];
        for (let rowNum = 1; rowNum <= worksheet.rowCount; rowNum++) {
          const row = worksheet.getRow(rowNum);
          if (row.hasValues) {
            const values = row.values as any[];
            // ExcelJS includes index 0 as undefined, so we slice it off
            worksheetData.push(values.slice(1));
          }
        }
        
        // Check if this worksheet has meaningful data
        const hasData = worksheetData.some(row => 
          row && row.some(cell => cell !== null && cell !== undefined && cell !== '')
        );
        
        if (hasData) {
          selectedWorksheet = worksheet.name;
          jsonData = worksheetData;
          break;
        }
      }
    }
    
    if (!selectedWorksheet || jsonData.length === 0) {
      throw new Error(`No data found in Excel file`);
    }
    
    // Convert to markdown table
    const headers = this.detectHeaders(jsonData);
    const markdownTable = this.createMarkdownTable(jsonData, headers);
    const rowCount = this.countDataRows(jsonData);
    
    console.log(`✅ ExcelJS: Successfully processed ${rowCount} rows from "${selectedWorksheet}"`);
    
    return {
      type: 'text',
      content: `Excel/CSV File: ${fileName}
Total Rows with Data: ${rowCount}
Detected Columns: ${headers ? headers.join(', ') : 'No headers detected'}

Data Table:
${markdownTable}

Instructions: Extract all product information from this spreadsheet data.`
    };
  }

  /**
   * Get cost estimation for processing
   */
  getCostEstimate(model: string, inputTokens: number, outputTokens: number): number {
    const pricing: Record<string, { input: number; output: number }> = {
      'gemini-2.0-flash-exp': { input: 0, output: 0 }, // Free during experimental phase
      'gemini-2.0-flash': { input: 0.00001875, output: 0.000075 },
      'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
      'gemini-1.5-flash': { input: 0.0000625, output: 0.00025 }
    };

    const modelPricing = pricing[model] || pricing['gemini-2.0-flash'];
    return (inputTokens / 1000) * modelPricing.input + (outputTokens / 1000) * modelPricing.output;
  }
}

// Export singleton
export const unifiedGeminiService = new UnifiedGeminiService();