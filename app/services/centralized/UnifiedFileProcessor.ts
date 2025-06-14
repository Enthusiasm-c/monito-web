/**
 * Unified File Processor
 * Uses new centralized services: Gemini Flash 2.0 for PDFs, ChatGPT o3 for standardization
 */

import { PrismaClient } from '@prisma/client';
import { put } from '@vercel/blob';
import { standardizationService } from './StandardizationService';
import { geminiPdfProcessor } from './GeminiPdfProcessor';
import { dataNormalizer } from '../dataNormalizer';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ProcessingResult {
  success: boolean;
  uploadId: string;
  supplierId: string;
  totalProductsExtracted: number;
  totalProductsStandardized: number;
  totalProductsStored: number;
  processingTimeMs: number;
  tokensUsed: number;
  status: 'completed' | 'failed' | 'pending_review';
  errors: string[];
  extractionMethod: 'gemini-pdf' | 'excel' | 'csv' | 'image';
  needsApproval?: boolean;
}

class UnifiedFileProcessor {
  private static instance: UnifiedFileProcessor;

  public static getInstance(): UnifiedFileProcessor {
    if (!UnifiedFileProcessor.instance) {
      UnifiedFileProcessor.instance = new UnifiedFileProcessor();
    }
    return UnifiedFileProcessor.instance;
  }

  /**
   * Main processing entry point
   */
  async processUpload(
    file: File,
    options: {
      supplierId?: string;
      autoApprove?: boolean;
    } = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    let totalTokensUsed = 0;
    const errors: string[] = [];

    try {
      console.log(`🚀 Starting unified processing: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

      // Upload file to blob storage
      const blob = await put(file.name, file, {
        access: 'public',
        addRandomSuffix: true,
      });

      // Determine supplier
      let finalSupplierId = options.supplierId;
      if (!finalSupplierId) {
        const tempSupplier = await this.createTempSupplier();
        finalSupplierId = tempSupplier.id;
      }

      // Create upload record
      const upload = await prisma.upload.create({
        data: {
          fileName: file.name,
          originalName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          url: blob.url,
          supplierId: finalSupplierId,
          status: 'processing',
          approvalStatus: options.autoApprove ? 'approved' : 'pending_review'
        }
      });

      console.log(`📁 Created upload record: ${upload.id}`);

      // Process based on file type
      const extractionResult = await this.extractDataFromFile(blob.url, file.name, file.type);
      totalTokensUsed += extractionResult.tokensUsed;

      if (extractionResult.products.length === 0) {
        throw new Error('No products extracted from file');
      }

      console.log(`📦 Extracted ${extractionResult.products.length} products`);

      // Standardize products using ChatGPT o3
      const standardizationResult = await standardizationService.standardizeProducts({
        products: extractionResult.products.map(p => ({
          rawName: p.name,
          rawUnit: p.unit,
          category: p.category
        }))
      });
      
      totalTokensUsed += standardizationResult.tokensUsed;
      console.log(`🔧 Standardized ${standardizationResult.products.length} products`);

      // Update supplier if detected from file
      if (extractionResult.supplier && !options.supplierId) {
        const detectedSupplier = await this.findOrCreateSupplier(extractionResult.supplier);
        finalSupplierId = detectedSupplier.id;
        
        await prisma.upload.update({
          where: { id: upload.id },
          data: { supplierId: finalSupplierId }
        });
      }

      // Store extracted data for review/approval
      await prisma.upload.update({
        where: { id: upload.id },
        data: {
          extractedData: {
            products: extractionResult.products,
            supplier: extractionResult.supplier,
            standardizedProducts: standardizationResult.products
          } as any,
          tokensUsed: totalTokensUsed,
          processingTimeMs: Date.now() - startTime
        }
      });

      let productsStored = 0;
      let finalStatus: 'completed' | 'pending_review' = 'pending_review';

      // Store products if auto-approved
      if (options.autoApprove) {
        productsStored = await this.storeStandardizedProducts(
          extractionResult.products,
          standardizationResult.products,
          finalSupplierId,
          upload.id
        );
        finalStatus = 'completed';
        
        await prisma.upload.update({
          where: { id: upload.id },
          data: { status: 'completed' }
        });
      }

      const processingTime = Date.now() - startTime;

      console.log(`✅ Processing completed: ${upload.id}, ${productsStored} products stored, ${processingTime}ms`);

      return {
        success: true,
        uploadId: upload.id,
        supplierId: finalSupplierId,
        totalProductsExtracted: extractionResult.products.length,
        totalProductsStandardized: standardizationResult.products.length,
        totalProductsStored: productsStored,
        processingTimeMs: processingTime,
        tokensUsed: totalTokensUsed,
        status: finalStatus,
        errors,
        extractionMethod: this.getExtractionMethod(file.type),
        needsApproval: !options.autoApprove
      };

    } catch (error) {
      console.error('❌ Unified processing failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);

      return {
        success: false,
        uploadId: '',
        supplierId: '',
        totalProductsExtracted: 0,
        totalProductsStandardized: 0,
        totalProductsStored: 0,
        processingTimeMs: Date.now() - startTime,
        tokensUsed: totalTokensUsed,
        status: 'failed',
        errors,
        extractionMethod: this.getExtractionMethod(file.type)
      };
    }
  }

  /**
   * Extract data from file based on type
   */
  private async extractDataFromFile(fileUrl: string, fileName: string, mimeType: string) {
    const lowerFileName = fileName.toLowerCase();
    const lowerMimeType = mimeType.toLowerCase();

    // PDF processing with Gemini Flash 2.0
    if (lowerMimeType.includes('pdf') || lowerFileName.endsWith('.pdf')) {
      return await geminiPdfProcessor.processPdf(fileUrl, fileName);
    }

    // Excel/CSV processing
    if (lowerMimeType.includes('excel') || lowerMimeType.includes('sheet') || 
        lowerMimeType.includes('csv') || lowerFileName.match(/\.(xlsx|xls|csv)$/)) {
      return await this.processExcelOrCsv(fileUrl, fileName);
    }

    // Image processing
    if (lowerMimeType.includes('image') || lowerFileName.match(/\.(jpg|jpeg|png|gif|bmp)$/)) {
      return await this.processImage(fileUrl, fileName);
    }

    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  /**
   * Process Excel/CSV files using ChatGPT o3
   */
  private async processExcelOrCsv(fileUrl: string, fileName: string) {
    console.log(`📊 Processing Excel/CSV with ChatGPT o3: ${fileName}`);

    try {
      // Download and convert file content to text
      const response = await fetch(fileUrl);
      const arrayBuffer = await response.arrayBuffer();

      let textContent = '';

      if (fileName.toLowerCase().endsWith('.csv')) {
        // Process CSV directly as text
        textContent = new TextDecoder().decode(arrayBuffer);
      } else {
        // Process Excel file
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        // Convert all sheets to text
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          textContent += `\n--- Sheet: ${sheetName} ---\n`;
          jsonData.forEach((row: any, index: number) => {
            if (Array.isArray(row) && row.length > 0) {
              textContent += `Row ${index + 1}: ${row.join(' | ')}\n`;
            }
          });
        }
      }

      // Limit text size
      if (textContent.length > 12000) {
        textContent = textContent.substring(0, 12000) + '\n... (truncated)';
      }

      // Extract with ChatGPT o3
      const prompt = `Extract supplier and product information from this ${fileName.endsWith('.csv') ? 'CSV' : 'Excel'} file content:

${textContent}

Return a JSON object with this structure:
{
  "supplier": {
    "name": "supplier name if found",
    "email": "email if found",
    "phone": "phone if found",
    "address": "address if found"
  },
  "products": [
    {
      "name": "product name",
      "price": numeric_price,
      "unit": "unit (kg, pcs, etc.)",
      "category": "category if obvious",
      "description": "additional details if any"
    }
  ]
}

Rules:
- Extract ALL products with clear prices
- Each row may contain multiple products in different columns
- Process entire content, don't stop early
- Clean product names and standardize units
- Only return valid JSON, no other text`;

      const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 4000
      });

      const content = aiResponse.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from ChatGPT o3');
      }

      // Parse response
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const extractedData = JSON.parse(cleanContent);
      const tokensUsed = aiResponse.usage?.total_tokens || 0;

      return {
        supplier: extractedData.supplier,
        products: extractedData.products || [],
        totalRowsDetected: extractedData.products?.length || 0,
        totalRowsProcessed: extractedData.products?.length || 0,
        completenessRatio: 1.0,
        processingTimeMs: 0,
        tokensUsed,
        errors: []
      };

    } catch (error) {
      console.error('❌ Excel/CSV processing failed:', error);
      return {
        products: [],
        totalRowsDetected: 0,
        totalRowsProcessed: 0,
        completenessRatio: 0,
        processingTimeMs: 0,
        tokensUsed: 0,
        errors: [error instanceof Error ? error.message : 'Processing failed']
      };
    }
  }

  /**
   * Process image files using ChatGPT o3 Vision
   */
  private async processImage(fileUrl: string, fileName: string) {
    console.log(`🖼️ Processing image with ChatGPT o3 Vision: ${fileName}`);

    try {
      const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this price list image and extract supplier and product information. Return a JSON object with:
{
  "supplier": {
    "name": "supplier name",
    "email": "email if found",
    "phone": "phone if found", 
    "address": "address if found"
  },
  "products": [
    {
      "name": "product name",
      "price": numeric_price,
      "unit": "unit (kg, pcs, etc.)",
      "category": "category if obvious",
      "description": "additional details"
    }
  ]
}

Rules:
- Extract supplier info from headers/logos
- Only include products with clear prices
- Clean product names and standardize units
- Return valid JSON only, no other text`
              },
              {
                type: 'image_url',
                image_url: { url: fileUrl }
              }
            ]
          }
        ],
        temperature: 0.1
      });

      const content = aiResponse.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from Vision API');
      }

      // Parse response
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const extractedData = JSON.parse(cleanContent);
      const tokensUsed = aiResponse.usage?.total_tokens || 0;

      return {
        supplier: extractedData.supplier,
        products: extractedData.products || [],
        totalRowsDetected: extractedData.products?.length || 0,
        totalRowsProcessed: extractedData.products?.length || 0,
        completenessRatio: 1.0,
        processingTimeMs: 0,
        tokensUsed,
        errors: []
      };

    } catch (error) {
      console.error('❌ Image processing failed:', error);
      return {
        products: [],
        totalRowsDetected: 0,
        totalRowsProcessed: 0,
        completenessRatio: 0,
        processingTimeMs: 0,
        tokensUsed: 0,
        errors: [error instanceof Error ? error.message : 'Processing failed']
      };
    }
  }

  /**
   * Store standardized products in database
   */
  private async storeStandardizedProducts(
    extractedProducts: any[],
    standardizedProducts: any[],
    supplierId: string,
    uploadId: string
  ): Promise<number> {
    let productsStored = 0;

    for (let i = 0; i < Math.min(extractedProducts.length, standardizedProducts.length); i++) {
      try {
        const extracted = extractedProducts[i];
        const standardized = standardizedProducts[i];

        // Normalize price
        const normalizedProduct = dataNormalizer.normalizeProduct(extracted);
        
        if (!normalizedProduct.price || normalizedProduct.price <= 0) {
          console.warn(`⚠️ Skipping product with invalid price: ${extracted.name}`);
          continue;
        }

        // Find or create product
        let product = await prisma.product.findFirst({
          where: {
            standardizedName: standardized.standardizedName,
            standardizedUnit: standardized.standardizedUnit
          }
        });

        if (!product) {
          product = await prisma.product.create({
            data: {
              rawName: extracted.name,
              name: normalizedProduct.name,
              standardizedName: standardized.standardizedName,
              category: extracted.category || 'Other',
              unit: normalizedProduct.unit,
              standardizedUnit: standardized.standardizedUnit,
              description: extracted.description
            }
          });
        }

        // Deactivate old prices
        await prisma.price.updateMany({
          where: {
            productId: product.id,
            supplierId: supplierId,
            validTo: null
          },
          data: { validTo: new Date() }
        });

        // Create new price
        await prisma.price.create({
          data: {
            amount: normalizedProduct.price,
            unit: normalizedProduct.unit,
            productId: product.id,
            supplierId: supplierId,
            uploadId: uploadId,
            validFrom: new Date()
          }
        });

        productsStored++;

      } catch (error) {
        console.error(`❌ Failed to store product ${i + 1}:`, error);
      }
    }

    return productsStored;
  }

  /**
   * Find or create supplier
   */
  private async findOrCreateSupplier(supplierData: any) {
    const existing = await prisma.supplier.findFirst({
      where: {
        name: {
          contains: supplierData.name,
          mode: 'insensitive'
        }
      }
    });

    if (existing) {
      return existing;
    }

    return await prisma.supplier.create({
      data: {
        name: supplierData.name,
        email: supplierData.email,
        phone: supplierData.phone,
        address: supplierData.address
      }
    });
  }

  /**
   * Create temporary supplier for processing
   */
  private async createTempSupplier() {
    return await prisma.supplier.upsert({
      where: { name: 'Temporary Processing' },
      update: {},
      create: {
        name: 'Temporary Processing',
        email: 'temp@processing.com'
      }
    });
  }

  /**
   * Get extraction method based on file type
   */
  private getExtractionMethod(mimeType: string): 'gemini-pdf' | 'excel' | 'csv' | 'image' {
    if (mimeType.includes('pdf')) return 'gemini-pdf';
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'excel';
    if (mimeType.includes('csv')) return 'csv';
    if (mimeType.includes('image')) return 'image';
    return 'excel'; // default
  }
}

// Export singleton instance
export const unifiedFileProcessor = UnifiedFileProcessor.getInstance();