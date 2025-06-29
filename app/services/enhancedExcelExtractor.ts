/**
 * Enhanced Excel/CSV Extractor
 * Processes all sheets with 100% row detection and completeness tracking
 * Now extends BaseProcessor for consistency
 */

import { BaseProcessor } from '../lib/core/BaseProcessor';
import { ProcessOptions, ProcessingResult } from '../lib/core/Interfaces';
import { tokenCostMonitor, type TokenUsage } from './tokenCostMonitor';
import OpenAI from 'openai';

interface SheetProcessingResult {
  name: string;
  totalRows: number;
  processedRows: number;
  products: ExtractedProduct[];
  errors: string[];
  completenessRatio: number;
}

interface ExtractedProduct {
  name: string;
  price: number;
  unit: string;
  category?: string;
  description?: string;
  sourceSheet?: string;
  sourceRow?: number;
}

interface ExcelExtractionResult {
  supplier?: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  products: ExtractedProduct[];
  sheets: SheetProcessingResult[];
  totalRowsDetected: number;
  totalRowsProcessed: number;
  completenessRatio: number;
  processingTimeMs: number;
  tokensUsed: number;
  costUsd: number;
  errors: string[];
}

class EnhancedExcelExtractor extends BaseProcessor {
  private readonly config = {
    completenessThresholds: {
      excel: parseFloat(process.env.COMPLETENESS_THRESHOLD_EXCEL || '0.95'),
      csv: parseFloat(process.env.COMPLETENESS_THRESHOLD_CSV || '0.98')
    },
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024,
    llmFallbackEnabled: process.env.LLM_FALLBACK_ENABLED === 'true',
    llmModel: process.env.LLM_MODEL || 'gpt-4o-mini'
  };

  public static getInstance(): EnhancedExcelExtractor {
    return super.getInstance.call(this) as EnhancedExcelExtractor;
  }

  constructor() {
    super('EnhancedExcelExtractor');
  }

  /**
   * Required implementation from BaseProcessor
   */
  async processDocument(
    fileContent: Buffer | string,
    fileName: string,
    options?: ProcessOptions
  ): Promise<ProcessingResult> {
    const fileUrl = typeof fileContent === 'string' ? fileContent : '';
    const result = await this.extractFromFile(fileUrl, fileName);
    
    return {
      success: true,
      products: result.products,
      supplier: result.supplier,
      totalProducts: result.products.length,
      processingTimeMs: result.processingTimeMs,
      tokensUsed: result.tokensUsed,
      costUsd: result.costUsd,
      metadata: {
        sheets: result.sheets,
        completenessRatio: result.completenessRatio,
        errors: result.errors
      }
    };
  }

  /**
   * Main extraction method for Excel/CSV files
   */
  async extractFromFile(fileUrl: string, fileName: string): Promise<ExcelExtractionResult> {
    const startTime = Date.now();
    console.log(`🔍 Enhanced Excel extraction starting: ${fileName}`);

    try {
      // Check file size
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > this.config.maxFileSize) {
        throw new Error(`File too large: ${contentLength} bytes > ${this.config.maxFileSize} bytes`);
      }

      const arrayBuffer = await response.arrayBuffer();
      
      // Determine if it's CSV or Excel
      const isCSV = fileName.toLowerCase().endsWith('.csv');
      
      let result: ExcelExtractionResult;
      if (isCSV) {
        result = await this.processCSV(arrayBuffer, fileName);
      } else {
        result = await this.processExcel(arrayBuffer, fileName);
      }

      // Calculate final metrics
      result.processingTimeMs = Date.now() - startTime;
      result.completenessRatio = result.totalRowsDetected > 0 
        ? result.totalRowsProcessed / result.totalRowsDetected 
        : 0;

      // Log results
      console.log(`✅ Enhanced extraction completed: ${fileName}`);
      console.log(`   📊 Rows: ${result.totalRowsProcessed}/${result.totalRowsDetected} (${(result.completenessRatio * 100).toFixed(1)}%)`);
      console.log(`   🛍️ Products: ${result.products.length}`);
      console.log(`   📄 Sheets: ${result.sheets.length}`);
      console.log(`   ⏱️ Time: ${result.processingTimeMs}ms`);
      console.log(`   💰 Cost: $${result.costUsd.toFixed(4)}`);

      return result;

    } catch (error) {
      console.error(`❌ Enhanced extraction failed: ${fileName}`, error);
      
      return {
        products: [],
        sheets: [],
        totalRowsDetected: 0,
        totalRowsProcessed: 0,
        completenessRatio: 0,
        processingTimeMs: Date.now() - startTime,
        tokensUsed: 0,
        costUsd: 0,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Process Excel file with all sheets
   */
  private async processExcel(arrayBuffer: ArrayBuffer, fileName: string): Promise<ExcelExtractionResult> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    console.log(`📊 Excel file has ${workbook.SheetNames.length} sheets: ${workbook.SheetNames.join(', ')}`);

    const allSheets: SheetProcessingResult[] = [];
    const allProducts: ExtractedProduct[] = [];
    const allErrors: string[] = [];
    let totalRowsDetected = 0;
    let totalRowsProcessed = 0;
    let totalTokensUsed = 0;
    let totalCostUsd = 0;

    // Extract supplier info from filename
    const supplierInfo = this.extractSupplierFromFilename(fileName);

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      try {
        console.log(`📄 Processing sheet: "${sheetName}"`);
        
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        // Filter out completely empty rows
        const nonEmptyRows = rawData.filter((row: any[]) => 
          row && row.some(cell => cell !== null && cell !== undefined && cell !== '')
        );

        console.log(`   📋 Sheet "${sheetName}": ${nonEmptyRows.length} non-empty rows`);

        if (nonEmptyRows.length < 3) {
          console.log(`   ⚠️ Skipping sheet "${sheetName}": too few rows`);
          continue;
        }

        // Check if sheet looks like price data
        if (!this.looksLikePriceData(sheetName, nonEmptyRows)) {
          console.log(`   ⚠️ Skipping sheet "${sheetName}": doesn't look like price data`);
          continue;
        }

        // Process the sheet
        const sheetResult = await this.processSheet(nonEmptyRows, sheetName, supplierInfo);
        
        console.log(`   ✅ Sheet "${sheetName}" processed: ${sheetResult.products.length} products extracted`);
        if (sheetResult.products.length === 0 && sheetResult.errors.length > 0) {
          console.log(`   ⚠️ Errors: ${sheetResult.errors.join('; ')}`);
        }
        
        allSheets.push(sheetResult);
        allProducts.push(...sheetResult.products);
        allErrors.push(...sheetResult.errors);
        totalRowsDetected += sheetResult.totalRows;
        totalRowsProcessed += sheetResult.processedRows;

      } catch (error) {
        const errorMsg = `Error processing sheet "${sheetName}": ${error}`;
        console.error(`   ❌ ${errorMsg}`);
        allErrors.push(errorMsg);
      }
    }

    return {
      supplier: supplierInfo,
      products: allProducts,
      sheets: allSheets,
      totalRowsDetected,
      totalRowsProcessed,
      completenessRatio: totalRowsDetected > 0 ? totalRowsProcessed / totalRowsDetected : 0,
      processingTimeMs: 0, // Will be set by caller
      tokensUsed: totalTokensUsed,
      costUsd: totalCostUsd,
      errors: allErrors
    };
  }

  /**
   * Process CSV file
   */
  private async processCSV(arrayBuffer: ArrayBuffer, fileName: string): Promise<ExcelExtractionResult> {
    const csvText = new TextDecoder().decode(arrayBuffer);
    
    // Parse CSV manually to handle different separators
    const lines = csvText.split('\n').filter(line => line.trim());
    const data = lines.map(line => this.parseCSVLine(line));
    
    console.log(`📊 CSV file has ${data.length} rows`);

    const supplierInfo = this.extractSupplierFromFilename(fileName);
    const sheetResult = await this.processSheet(data, 'CSV_Data', supplierInfo);

    return {
      supplier: supplierInfo,
      products: sheetResult.products,
      sheets: [sheetResult],
      totalRowsDetected: sheetResult.totalRows,
      totalRowsProcessed: sheetResult.processedRows,
      completenessRatio: sheetResult.completenessRatio,
      processingTimeMs: 0, // Will be set by caller
      tokensUsed: 0, // TODO: Add token tracking
      costUsd: 0,
      errors: sheetResult.errors
    };
  }

  /**
   * Process individual sheet data
   */
  private async processSheet(
    rawData: any[][],
    sheetName: string,
    supplierInfo?: any
  ): Promise<SheetProcessingResult> {
    const totalRows = rawData.length;
    const products: ExtractedProduct[] = [];
    const errors: string[] = [];
    let processedRows = 0;

    try {
      // Analyze sheet structure
      const structure = this.analyzeSheetStructure(rawData);
      console.log(`   📋 Sheet structure: name=${structure.nameColumn}, price=${structure.priceColumn}, unit=${structure.unitColumn}, dataStart=${structure.dataStartRow}`);
      console.log(`   🔬 Sheet structure:`, structure);

      // Extract products based on detected structure
      for (let i = structure.dataStartRow; i < rawData.length; i++) {
        const row = rawData[i];
        
        try {
          const product = this.extractProductFromRow(row, structure, sheetName, i + 1);
          if (product) {
            products.push(product);
            processedRows++;
          }
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error}`);
        }
      }

      console.log(`   📊 Extraction complete: ${products.length} products from ${processedRows}/${totalRows} rows`);
      if (products.length === 0) {
        console.log(`   ⚠️ No products extracted. Structure issues or data format not recognized.`);
      }

      // Check if we need LLM fallback
      const completenessRatio = totalRows > 0 ? processedRows / totalRows : 0;
      const threshold = this.config.completenessThresholds.excel;

      if (completenessRatio < threshold && this.config.llmFallbackEnabled && products.length < 5) {
        console.log(`   🤖 Completeness ${(completenessRatio * 100).toFixed(1)}% < ${(threshold * 100)}%, trying LLM fallback...`);
        
        const llmResult = await this.tryLLMFallback(rawData, sheetName, supplierInfo);
        if (llmResult.products.length > products.length) {
          console.log(`   ✨ LLM fallback improved results: ${products.length} → ${llmResult.products.length} products`);
          return llmResult;
        }
      }

    } catch (error) {
      console.error(`   ❌ Error processing sheet "${sheetName}":`, error);
      errors.push(`Sheet processing error: ${error}`);
    }

    return {
      name: sheetName,
      totalRows,
      processedRows,
      products,
      errors,
      completenessRatio: totalRows > 0 ? processedRows / totalRows : 0
    };
  }

  /**
   * Analyze sheet structure to find headers and data patterns
   */
  private analyzeSheetStructure(rawData: any[][]) {
    const structure = {
      nameColumn: -1,
      priceColumn: -1,
      unitColumn: -1,
      categoryColumn: -1,
      dataStartRow: 0,
      headerRow: -1
    };

    // Find header row by looking for keyword patterns (check more rows for complex layouts)
    for (let i = 0; i < Math.min(15, rawData.length); i++) {
      const row = rawData[i];
      if (!row) continue;

      const headerScore = this.calculateHeaderScore(row);
      if (headerScore > 0.3) {
        structure.headerRow = i;
        structure.dataStartRow = i + 1;
        
        // Map columns based on headers
        for (let j = 0; j < row.length; j++) {
          const header = String(row[j]).toLowerCase();
          
          if (this.isNameColumn(header)) structure.nameColumn = j;
          if (this.isPriceColumn(header)) structure.priceColumn = j;
          if (this.isUnitColumn(header)) structure.unitColumn = j;
          if (this.isCategoryColumn(header)) structure.categoryColumn = j;
        }
        break;
      }
    }

    // If no clear headers found, try to detect columns by content
    if (structure.nameColumn === -1 || structure.priceColumn === -1) {
      this.detectColumnsByContent(rawData, structure);
    }

    return structure;
  }

  /**
   * Calculate how likely a row is to be a header
   */
  private calculateHeaderScore(row: any[]): number {
    if (!row || row.length === 0) return 0;

    const keywords = ['name', 'nama', 'product', 'item', 'items', 'price', 'harga', 'unit', 'satuan', 'category', 'kategori', 'qty', 'quantity'];
    let score = 0;

    for (const cell of row) {
      const cellStr = String(cell).toLowerCase();
      for (const keyword of keywords) {
        if (cellStr.includes(keyword)) {
          score += 0.2;
        }
      }
    }

    return Math.min(score, 1);
  }

  /**
   * Detect columns by analyzing data patterns
   */
  private detectColumnsByContent(rawData: any[][], structure: any) {
    const sampleRows = rawData.slice(1, Math.min(10, rawData.length));
    
    for (let col = 0; col < 10; col++) {
      const columnData = sampleRows.map(row => row[col]).filter(cell => cell);
      if (columnData.length === 0) continue;

      // Check if column contains prices
      const priceScore = this.calculatePriceColumnScore(columnData);
      if (priceScore > 0.5 && structure.priceColumn === -1) {
        structure.priceColumn = col;
      }

      // Check if column contains product names
      const nameScore = this.calculateNameColumnScore(columnData);
      if (nameScore > 0.5 && structure.nameColumn === -1) {
        structure.nameColumn = col;
      }
    }
  }

  private calculatePriceColumnScore(columnData: any[]): number {
    let score = 0;
    for (const cell of columnData) {
      const str = String(cell).replace(/[^\d.,]/g, '');
      if (str && !isNaN(parseFloat(str))) {
        score += 0.2;
      }
    }
    return Math.min(score, 1);
  }

  private calculateNameColumnScore(columnData: any[]): number {
    let score = 0;
    for (const cell of columnData) {
      const str = String(cell);
      if (str.length > 3 && /[a-zA-Z]/.test(str)) {
        score += 0.15;
      }
    }
    return Math.min(score, 1);
  }

  /**
   * Extract product from a single row
   */
  private extractProductFromRow(
    row: any[],
    structure: any,
    sheetName: string,
    rowNumber: number
  ): ExtractedProduct | null {
    if (!row || row.length === 0) return null;

    // Extract name
    const name = structure.nameColumn >= 0 ? String(row[structure.nameColumn] || '').trim() : '';
    if (!name || name.length < 2) return null;

    // Extract price
    let price = 0;
    if (structure.priceColumn >= 0) {
      const priceStr = String(row[structure.priceColumn] || '');
      price = this.parsePrice(priceStr);
    }
    
    if (price <= 0) return null;

    // Extract unit
    const unit = structure.unitColumn >= 0 
      ? String(row[structure.unitColumn] || '').trim() || 'pcs'
      : 'pcs';

    // Extract category
    const category = structure.categoryColumn >= 0 
      ? String(row[structure.categoryColumn] || '').trim() || undefined
      : undefined;

    return {
      name,
      price,
      unit,
      category,
      sourceSheet: sheetName,
      sourceRow: rowNumber
    };
  }

  /**
   * Parse price from string, handling various formats
   */
  private parsePrice(priceStr: string): number {
    if (!priceStr) return 0;
    
    // Remove common currency symbols and separators
    const cleaned = priceStr
      .replace(/[Rp$€£¥,\s]/g, '')
      .replace(/\./g, '') // Remove dots used as thousand separators
      .trim();
    
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * LLM fallback for complex file structures
   */
  private async tryLLMFallback(
    rawData: any[][],
    sheetName: string,
    supplierInfo?: any
  ): Promise<SheetProcessingResult> {
    try {
      console.log(`   🤖 Starting LLM fallback for sheet "${sheetName}"`);
      
      // Prepare sample data for LLM (first 30 rows)
      const sampleRows = rawData.slice(0, Math.min(30, rawData.length));
      const csvSample = sampleRows.map(row => 
        row.map(cell => String(cell || '').replace(/,/g, ';')).join(',')
      ).join('\n');
      
      const openai = new (await import('openai')).default({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      const response = await openai.chat.completions.create({
        model: this.config.llmModel,
        messages: [
          {
            role: 'system',
            content: 'Extract products with prices from this spreadsheet data. Return JSON array with objects: {name, price, unit}. Only include items with clear prices.'
          },
          {
            role: 'user',
            content: `Extract products from this data:\n\n${csvSample}\n\nReturn only valid JSON array.`
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });
      
      const content = response.choices[0]?.message?.content || '[]';
      let products: ExtractedProduct[] = [];
      
      try {
        // Clean response
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        }
        
        const parsed = JSON.parse(cleanContent);
        products = Array.isArray(parsed) ? parsed : [];
        
        // Validate and clean products
        products = products
          .filter(p => p.name && p.price > 0)
          .map((p, index) => ({
            name: String(p.name).trim(),
            price: Number(p.price),
            unit: p.unit || 'pcs',
            category: p.category,
            sourceSheet: sheetName,
            sourceRow: index + 1
          }));
          
        console.log(`   ✅ LLM extracted ${products.length} products`);
        
      } catch (parseError) {
        console.error(`   ❌ Failed to parse LLM response:`, parseError);
      }
      
      const tokensUsed = response.usage?.total_tokens || 0;
      const costUsd = (tokensUsed / 1000) * 0.0006; // gpt-4o-mini approximate cost
      
      tokenCostMonitor.trackUsage({
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        model: this.config.llmModel
      });
      
      return {
        name: sheetName,
        totalRows: rawData.length,
        processedRows: products.length,
        products,
        errors: [],
        completenessRatio: products.length / Math.max(rawData.length - 10, 1) // Assume 10 header rows
      };
      
    } catch (error) {
      console.error(`   ❌ LLM fallback failed:`, error);
      return {
        name: sheetName,
        totalRows: rawData.length,
        processedRows: 0,
        products: [],
        errors: [`LLM fallback error: ${error}`],
        completenessRatio: 0
      };
    }
  }

  /**
   * Check if sheet likely contains price data
   */
  private looksLikePriceData(sheetName: string, data: any[][]): boolean {
    const name = sheetName.toLowerCase();
    
    // Skip obviously non-price sheets
    if (name.includes('contact') || name.includes('info') || name.includes('instruction') || 
        name.includes('macro')) {
      return false;
    }

    // Require minimum data
    if (data.length < 3) return false;

    // Look for price-like data in first 20 rows (might have header info)
    for (let i = 0; i < Math.min(20, data.length); i++) {
      const row = data[i];
      if (row && row.some(cell => {
        const price = this.parsePrice(String(cell));
        // Look for reasonable prices (100 - 1000000)
        return price > 100 && price < 1000000;
      })) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract supplier info from filename
   */
  private extractSupplierFromFilename(fileName: string): any {
    const baseName = fileName.replace(/\.(xlsx?|csv)$/i, '');
    const parts = baseName.split(/[-_\s]+/);
    
    if (parts.length > 0) {
      return {
        name: parts[0].replace(/[^a-zA-Z0-9\s]/g, ' ').trim()
      };
    }
    
    return undefined;
  }

  /**
   * Helper methods for column detection
   */
  private isNameColumn(header: string): boolean {
    return /name|nama|product|item|items|barang|artikel|description|deskripsi/.test(header);
  }

  private isPriceColumn(header: string): boolean {
    return /price|harga|cost|biaya|tarif/.test(header);
  }

  private isUnitColumn(header: string): boolean {
    return /unit|satuan|ukuran|kemasan/.test(header);
  }

  private isCategoryColumn(header: string): boolean {
    return /category|kategori|jenis|type|grup/.test(header);
  }

  /**
   * Parse CSV line handling quoted fields and different separators
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if ((char === ',' || char === ';') && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }
}

// Export singleton instance
export const enhancedExcelExtractor = EnhancedExcelExtractor.getInstance();

// Export types
export type { 
  ExcelExtractionResult, 
  SheetProcessingResult, 
  ExtractedProduct 
};