import { BaseFileProcessorStrategy, ProcessingOptions, ProcessingResult } from '../FileProcessorStrategy';
import * as XLSX from 'xlsx';
import { parsePrice, standardizeUnit, categorizeProduct } from '@/app/utils/common';

export class ExcelProcessorStrategy extends BaseFileProcessorStrategy {
  constructor() {
    super('ExcelProcessor');
  }
  
  canHandle(fileName: string, mimeType?: string): boolean {
    const extensions = ['.xlsx', '.xls', '.csv'];
    const mimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    
    const hasValidExtension = extensions.some(ext => fileName.toLowerCase().endsWith(ext));
    const hasValidMimeType = mimeType ? mimeTypes.includes(mimeType) : true;
    
    return hasValidExtension && hasValidMimeType;
  }
  
  async process(
    filePath: string,
    fileName: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const products: ProcessingResult['products'] = [];
    
    try {
      // Read the file
      const workbook = XLSX.readFile(filePath);
      
      // Process each sheet
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        
        if (data.length === 0) continue;
        
        // Detect headers
        const headers = this.detectHeaders(data);
        if (!headers) {
          errors.push(`Could not detect headers in sheet: ${sheetName}`);
          continue;
        }
        
        // Process rows
        const sheetProducts = this.processRows(data, headers, options);
        products.push(...sheetProducts);
        
        // Apply limit if specified
        if (options.maxProducts && products.length >= options.maxProducts) {
          products.splice(options.maxProducts);
          break;
        }
      }
      
      return this.createResult(products, errors, startTime);
    } catch (error) {
      errors.push(`Failed to process Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return this.createResult([], errors, startTime);
    }
  }
  
  private detectHeaders(data: any[][]): Record<string, number> | null {
    // Common header patterns
    const patterns = {
      name: /product|name|item|description|nama|produk|barang/i,
      price: /price|harga|cost|rate|tarif/i,
      unit: /unit|satuan|uom|qty|quantity|kemasan/i,
      category: /category|kategori|type|jenis/i,
      brand: /brand|merk|merek/i,
      barcode: /barcode|code|kode|sku/i,
    };
    
    // Check first few rows for headers
    for (let i = 0; i < Math.min(5, data.length); i++) {
      const row = data[i];
      if (!Array.isArray(row)) continue;
      
      const headers: Record<string, number> = {};
      let foundHeaders = false;
      
      row.forEach((cell, index) => {
        if (!cell) return;
        const cellStr = String(cell).trim();
        
        for (const [key, pattern] of Object.entries(patterns)) {
          if (pattern.test(cellStr)) {
            headers[key] = index;
            foundHeaders = true;
          }
        }
      });
      
      if (foundHeaders && headers.name !== undefined) {
        headers.headerRow = i;
        return headers;
      }
    }
    
    // Fallback: assume first row is headers if it contains text
    const firstRow = data[0];
    if (firstRow && firstRow.some(cell => isNaN(Number(cell)))) {
      const headers: Record<string, number> = {
        headerRow: 0,
      };
      
      // Try to map columns by position
      if (firstRow.length >= 2) {
        headers.name = 0;
        headers.price = 1;
        if (firstRow.length >= 3) headers.unit = 2;
        if (firstRow.length >= 4) headers.category = 3;
      }
      
      return headers;
    }
    
    return null;
  }
  
  private processRows(
    data: any[][],
    headers: Record<string, number>,
    options: ProcessingOptions
  ): ProcessingResult['products'] {
    const products: ProcessingResult['products'] = [];
    const startRow = (headers.headerRow || 0) + 1;
    
    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      if (!Array.isArray(row)) continue;
      
      // Skip empty rows
      if (row.every(cell => !cell || String(cell).trim() === '')) continue;
      
      const product = this.extractProduct(row, headers);
      
      if (product && this.validateProduct(product)) {
        // Apply validation level
        if (options.validationLevel === 'strict') {
          if (!product.category || !product.unit) continue;
        }
        
        products.push(product);
      }
    }
    
    return products;
  }
  
  private extractProduct(
    row: any[],
    headers: Record<string, number>
  ): ProcessingResult['products'][0] | null {
    try {
      // Extract name
      const name = headers.name !== undefined ? String(row[headers.name] || '').trim() : '';
      if (!name) return null;
      
      // Extract price
      const priceValue = headers.price !== undefined ? row[headers.price] : null;
      const price = parsePrice(priceValue);
      if (price === null || price < 0) return null;
      
      // Extract unit
      let unit = headers.unit !== undefined ? String(row[headers.unit] || '').trim() : 'PIECE';
      unit = standardizeUnit(unit);
      
      // Extract optional fields
      const category = headers.category !== undefined 
        ? String(row[headers.category] || '').trim() 
        : categorizeProduct(name, unit);
        
      const brand = headers.brand !== undefined 
        ? String(row[headers.brand] || '').trim() 
        : undefined;
        
      const barcode = headers.barcode !== undefined 
        ? String(row[headers.barcode] || '').trim() 
        : undefined;
      
      return {
        name,
        unit,
        price,
        category,
        brand: brand || undefined,
        barcode: barcode || undefined,
      };
    } catch (error) {
      return null;
    }
  }
}