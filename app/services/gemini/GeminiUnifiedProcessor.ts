import { z } from 'zod';
import * as XLSX from 'xlsx';
import { ProductSchema, ExtractedDataSchema, ExtractedData } from '../ai-optimized/schemas';

interface ProcessOptions {
  maxProducts?: number;
  model?: 'gemini-2.0-flash-exp' | 'gemini-2.0-flash' | 'gemini-1.5-pro' | 'gemini-1.5-flash';
  includeMetadata?: boolean;
  preferredLanguage?: string;
}

interface FileContent {
  type: 'binary' | 'text';
  content: string;
  mimeType?: string;
}

export class GeminiUnifiedProcessor {
  private apiKey: string;
  private defaultModel = 'gemini-2.0-flash-exp'; // Free during experimental phase
  private apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor() {
    this.apiKey = process.env.GOOGLE_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('GOOGLE_API_KEY not found in environment variables');
    }
  }

  /**
   * Main entry point - processes any supported file type
   */
  async processDocument(
    content: string | Buffer,
    fileName: string,
    options: ProcessOptions = {}
  ): Promise<ExtractedData> {
    console.log(`[GeminiProcessor] Processing ${fileName} with model ${options.model || this.defaultModel}`);
    
    try {
      // Prepare file content based on type
      const preparedContent = await this.prepareFileContent(content, fileName);
      
      // Process with Gemini
      return await this.processWithGemini(preparedContent, fileName, options);
    } catch (error) {
      console.error('[GeminiProcessor] Error:', error);
      throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Prepare file content based on file type
   */
  private async prepareFileContent(content: string | Buffer, fileName: string): Promise<FileContent> {
    const ext = fileName.toLowerCase();
    
    // Excel and CSV files need preprocessing
    if (ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.csv')) {
      console.log(`[GeminiProcessor] Preprocessing Excel/CSV file: ${fileName}`);
      return this.preprocessExcelFile(content, fileName);
    }
    
    // PDF and images can be sent directly
    if (ext.endsWith('.pdf') || this.isImageFile(fileName)) {
      if (!Buffer.isBuffer(content)) {
        throw new Error('Binary files must be provided as Buffer');
      }
      console.log(`[GeminiProcessor] Direct processing for ${this.getMimeType(fileName)}`);
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
   * Preprocess Excel/CSV files into structured text
   */
  private preprocessExcelFile(content: string | Buffer, fileName: string): FileContent {
    try {
      console.log(`[GeminiProcessor] Reading Excel file: ${fileName}`);
      
      // Read workbook
      const workbook = XLSX.read(content, { type: Buffer.isBuffer(content) ? 'buffer' : 'string' });
      
      // Try all sheets to find one with data
      let selectedSheet = null;
      let jsonData: any[][] = [];
      
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (sheetData && sheetData.length > 0) {
          // Check if sheet has actual data (not just empty cells)
          const hasData = sheetData.some(row => 
            row && row.some(cell => cell !== null && cell !== undefined && cell !== '')
          );
          
          if (hasData) {
            selectedSheet = sheetName;
            jsonData = sheetData;
            console.log(`[GeminiProcessor] Using sheet: ${sheetName} with ${sheetData.length} rows`);
            break;
          }
        }
      }
      
      if (!selectedSheet || jsonData.length === 0) {
        throw new Error(`No data found in any sheet of Excel file`);
      }
      
      // Detect headers
      const headers = this.detectHeaders(jsonData);
      const dataStartIndex = headers ? 1 : 0;
      
      // Convert to markdown table format
      let markdownTable = '';
      
      if (headers) {
        // Add headers
        markdownTable += '| ' + headers.join(' | ') + ' |\n';
        markdownTable += '|' + headers.map(() => '---').join('|') + '|\n';
      }
      
      // Add data rows - filter out empty rows
      let rowCount = 0;
      for (let i = dataStartIndex; i < jsonData.length && rowCount < 1000; i++) {
        const row = jsonData[i];
        if (row && row.length > 0 && row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
          markdownTable += '| ' + row.map(cell => {
            const value = (cell || '').toString().trim();
            // Escape pipe characters in cell content
            return value.replace(/\|/g, '\\|');
          }).join(' | ') + ' |\n';
          rowCount++;
        }
      }
      
      // Create structured prompt
      const structuredContent = `
Excel/CSV File: ${fileName}
Total Rows with Data: ${rowCount}
Detected Columns: ${headers ? headers.join(', ') : 'No headers detected'}

Data Table:
${markdownTable}

Instructions: Extract all product information from this spreadsheet data. Look for:
- Product names/descriptions (may be in any column)
- Prices (may be in various formats like "150", "150.00", "Rp 150", etc.)
- Units (kg, pcs, l, pack, etc.)
- Categories if present
- Ignore empty rows and non-product data
- Return ONLY valid products with names and prices
`;
      
      return {
        type: 'text',
        content: structuredContent
      };
      
    } catch (error) {
      console.error('[GeminiProcessor] Excel preprocessing error:', error);
      throw new Error(`Failed to preprocess Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect headers in Excel data
   */
  private detectHeaders(data: any[][]): string[] | null {
    if (!data || data.length === 0) return null;
    
    // Try first few rows as potential headers
    for (let i = 0; i < Math.min(5, data.length); i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      // Check if row contains typical header values
      const headerKeywords = ['name', 'nama', 'product', 'produk', 'barang', 'item', 
                              'price', 'harga', 'cost', 'unit', 'satuan', 'qty', 
                              'category', 'kategori', 'description', 'keterangan', 
                              'sku', 'code', 'kode', 'no'];
      
      const cellsAsStrings = row.filter(cell => cell).map(cell => cell.toString().toLowerCase());
      const matchCount = cellsAsStrings.filter(cellStr => 
        headerKeywords.some(keyword => cellStr.includes(keyword))
      ).length;
      
      // If at least 2 cells match header keywords, consider this the header row
      if (matchCount >= 2) {
        console.log(`[GeminiProcessor] Headers detected at row ${i}: ${row.join(', ')}`);
        return row.map(cell => (cell || '').toString());
      }
    }
    
    return null;
  }

  /**
   * Process with Gemini API
   */
  private async processWithGemini(
    fileContent: FileContent,
    fileName: string,
    options: ProcessOptions
  ): Promise<ExtractedData> {
    const model = options.model || this.defaultModel;
    const prompt = this.buildExtractionPrompt(options);
    
    console.log(`[GeminiProcessor] Sending to Gemini API - Model: ${model}, Type: ${fileContent.type}`);
    
    // Build request body based on content type
    const parts: any[] = [{
      text: prompt + '\n\nIMPORTANT: Respond ONLY with valid JSON, no markdown formatting. Ensure every product has a confidence score.'
    }];
    
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
      contents: [{
        parts: parts
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 32768, // Increased for large documents
        topP: 0.95,
        topK: 40
      }
    };
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(
        `${this.apiUrl}/${model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        }
      );
      
      const processingTime = Date.now() - startTime;
      console.log(`[GeminiProcessor] Response received in ${processingTime}ms`);
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
      }
      
      const result = await response.json();
      
      if (!result.candidates || !result.candidates[0]?.content?.parts?.[0]?.text) {
        throw new Error('No response content from Gemini');
      }
      
      // Parse and validate response
      return this.parseGeminiResponse(result.candidates[0].content.parts[0].text, fileName);
      
    } catch (error) {
      console.error('[GeminiProcessor] API call failed:', error);
      throw error;
    }
  }

  /**
   * Parse and validate Gemini response
   */
  private parseGeminiResponse(content: string, fileName: string): ExtractedData {
    console.log('[GeminiProcessor] Parsing response, length:', content.length);
    
    // Check if response is in compact format
    const isCompactFormat = content.trim().startsWith('[{"n":') || content.includes('[{"n":');
    
    // Clean response
    let cleanContent = content;
    if (content.includes('```json')) {
      cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }
    
    // Handle compact format
    if (isCompactFormat) {
      return this.parseCompactResponse(cleanContent, fileName);
    }
    
    // Additional cleaning for common JSON issues
    cleanContent = cleanContent
      .replace(/,\s*}/g, '}')  // Remove trailing commas before }
      .replace(/,\s*]/g, ']')  // Remove trailing commas before ]
      .replace(/:\s*,/g, ': null,')  // Replace empty values with null
      .replace(/:\s*}/g, ': null}')  // Replace empty values at end with null
      .trim();
    
    try {
      const rawData = JSON.parse(cleanContent);
      
      // Fix common issues
      if (rawData.documentType === 'price list') {
        rawData.documentType = 'price_list';
      }
      
      // Ensure required fields
      if (!rawData.supplierContact) {
        rawData.supplierContact = {
          email: null,
          phone: null,
          address: null
        };
      }
      
      // Add default confidence if missing
      if (rawData.products && Array.isArray(rawData.products)) {
        rawData.products = rawData.products.map((p: any) => ({
          ...p,
          confidence: p.confidence || 0.8
        }));
      }
      
      // Validate with schema
      const validated = ExtractedDataSchema.parse(rawData);
      
      // Enhance with metadata
      return {
        ...validated,
        metadata: {
          ...validated.metadata,
          dateExtracted: new Date().toISOString(),
          currency: validated.metadata?.currency || 'IDR',
          processor: 'gemini',
          model: this.defaultModel
        }
      };
      
    } catch (error) {
      console.error('[GeminiProcessor] Parse error:', error);
      console.log('[GeminiProcessor] Failed content preview:', cleanContent.substring(0, 500));
      throw new Error(`Failed to parse Gemini response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build extraction prompt
   */
  private buildExtractionPrompt(options: ProcessOptions): string {
    const maxProducts = options.maxProducts || 1000;
    const language = options.preferredLanguage || 'English';
    
    // For large files, use compact format to avoid truncation
    const useCompactFormat = options.maxProducts && options.maxProducts > 150;

    if (useCompactFormat) {
      return `Extract product data. Return ONLY a JSON array with compact format:
[{"n":"name","p":price,"u":"unit","c":"category","s":0.9},...]

Rules:
- n=product name EXACTLY as written (preserve original case and spelling)
- p=price (number or null)
- u=unit EXACTLY as written (don't standardize)
- c=category or null
- s=confidence (0.9 default)
- NO spaces, NO formatting
- Extract ALL ${maxProducts}+ products
- DO NOT fix spelling or translate
- Return ONLY the array`;
    }

    return `You are analyzing a document. Extract all product information from this document.

IMPORTANT: This might be a price list, catalog, invoice, order form, or spreadsheet. Look for:
- Tables with products and prices
- Lists of items with costs
- Product names with associated numbers
- Spreadsheet rows with product data

Extract the following information and return as JSON:
{
  "documentType": "price_list" | "invoice" | "catalog" | "order" | "unknown",
  "supplierName": "Company name from document or filename",
  "supplierContact": {
    "email": "email if found or null",
    "phone": "phone if found or null", 
    "address": "address if found or null"
  },
  "products": [
    {
      "name": "Product name EXACTLY as written in document - DO NOT modify, translate, or fix spelling. The system will standardize it. Keep original language and spelling (e.g., if it says 'baby poteto' keep it as 'baby poteto', if it says 'pisang kepok' keep it as 'pisang kepok')",
      "price": numeric_value_or_null,
      "unit": "Standardized unit: pcs for pieces/items, kg for kilograms, g for grams, l for liters, ml for milliliters, etc. Default to 'pcs' if unclear",
      "category": "category if visible or null",
      "confidence": 0.0-1.0
    }
  ],
  "extractionQuality": 0.0-1.0,
  "metadata": {
    "totalPages": number_or_1,
    "language": "detected language",
    "currency": "detected currency or IDR"
  }
}

Rules:
- Extract up to ${maxProducts} products
- Include ALL products you can see, even if price is unclear (use null for missing prices)
- If you see a table or spreadsheet, extract EVERY row that looks like a product
- Convert all prices to numbers (remove currency symbols)
- If unit is not clear, use "pcs" as default
- Set confidence based on clarity of information
- For multi-page PDFs, process ALL pages
- For spreadsheets, process all visible data

CRITICAL Product Name Rules - DO NOT STANDARDIZE:
- Extract product names EXACTLY as written in the document
- DO NOT correct spelling (if it says "poteto" keep it as "poteto")
- DO NOT translate languages (if it says "pisang" keep it as "pisang")
- DO NOT reorder words or change case
- DO NOT remove duplicates - extract every line even if products repeat
- The system will handle all standardization, translation, and deduplication
- Your job is ONLY to extract the raw data as-is

Price Extraction Rules:
- Convert all prices to numeric values
- Handle Indonesian price notations:
  - "39k" or "39rb" = 39000
  - "1.5jt" or "1.5juta" = 1500000
  - "Rp 25.000" = 25000
  - "25,000" = 25000
- Remove all currency symbols and separators
- If price is unclear, use null

Unit Extraction:
- Extract the actual unit from the document
- Common Indonesian units: butir, buah, bungkus, dus, lembar, potong
- Include quantity if it's part of the unit (e.g., "250ml", "1kg")
- The system will standardize units automatically

Focus on extracting as many products as possible from the document with properly formatted names.`;
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(fileName: string): string {
    const ext = fileName.toLowerCase();
    if (ext.endsWith('.pdf')) return 'application/pdf';
    if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) return 'image/jpeg';
    if (ext.endsWith('.png')) return 'image/png';
    if (ext.endsWith('.gif')) return 'image/gif';
    if (ext.endsWith('.webp')) return 'image/webp';
    return 'application/octet-stream';
  }

  /**
   * Check if file is an image
   */
  private isImageFile(fileName: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
  }

  /**
   * Parse compact response format
   */
  private parseCompactResponse(content: string, fileName: string): ExtractedData {
    try {
      // Find array boundaries
      const start = content.indexOf('[');
      let end = content.lastIndexOf(']');
      
      if (start === -1) {
        throw new Error('No array found in response');
      }
      
      // If no closing bracket, try to fix truncation
      if (end === -1 || end < start) {
        console.log('[GeminiProcessor] Response appears truncated, attempting to fix...');
        // Find last complete object
        const lastCompleteObject = content.lastIndexOf('},');
        if (lastCompleteObject > start) {
          content = content.substring(start, lastCompleteObject + 1) + ']';
          end = content.length - 1;
        } else {
          throw new Error('Unable to fix truncated response');
        }
      } else {
        content = content.substring(start, end + 1);
      }
      
      // Parse compact array
      const compactProducts = JSON.parse(content);
      
      // Convert to standard format
      const products = compactProducts.map((p: any) => ({
        name: p.n || '',
        price: p.p,
        unit: p.u || 'pcs',
        category: p.c || null,
        confidence: p.s || 0.9
      }));
      
      console.log(`[GeminiProcessor] Successfully parsed ${products.length} products from compact format`);
      
      // Build full response
      return {
        documentType: 'price_list',
        supplierName: this.extractSupplierFromFilename(fileName),
        supplierContact: {
          email: null,
          phone: null,
          address: null
        },
        products: products,
        extractionQuality: 0.9,
        metadata: {
          dateExtracted: new Date().toISOString(),
          totalPages: 1,
          language: 'Indonesian',
          currency: 'IDR',
          processor: 'gemini',
          model: this.defaultModel
        }
      };
      
    } catch (error) {
      console.error('[GeminiProcessor] Compact parse error:', error);
      throw new Error(`Failed to parse compact response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Extract supplier name from filename
   */
  private extractSupplierFromFilename(fileName: string): string {
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    return baseName.split(/[_-]/).map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }

  /**
   * Get cost estimation for Gemini models
   */
  getCostEstimate(model: string, inputTokens: number, outputTokens: number): number {
    // Gemini pricing (approximate - check Google Cloud for latest)
    const pricing: Record<string, { input: number; output: number }> = {
      'gemini-2.0-flash-exp': { input: 0, output: 0 }, // Free during experimental phase
      'gemini-2.0-flash': { input: 0.00001875, output: 0.000075 }, // Per 1k tokens
      'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
      'gemini-1.5-flash': { input: 0.0000625, output: 0.00025 }
    };

    const modelPricing = pricing[model] || pricing['gemini-2.0-flash'];
    return (inputTokens / 1000) * modelPricing.input + (outputTokens / 1000) * modelPricing.output;
  }
}

// Export singleton
export const geminiUnifiedProcessor = new GeminiUnifiedProcessor();