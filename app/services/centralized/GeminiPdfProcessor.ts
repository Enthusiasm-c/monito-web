/**
 * Gemini Flash 2.0 PDF Processor
 * Direct PDF processing without preprocessing using Gemini Flash 2.0
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export interface ExtractedProduct {
  name: string;
  price: number;
  unit: string;
  category?: string;
  description?: string;
}

export interface ExtractedSupplier {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface GeminiPdfResult {
  supplier?: ExtractedSupplier;
  products: ExtractedProduct[];
  totalRowsDetected: number;
  totalRowsProcessed: number;
  completenessRatio: number;
  processingTimeMs: number;
  tokensUsed: number;
  errors: string[];
}

class GeminiPdfProcessor {
  private static instance: GeminiPdfProcessor;
  private model: any;

  public static getInstance(): GeminiPdfProcessor {
    if (!GeminiPdfProcessor.instance) {
      GeminiPdfProcessor.instance = new GeminiPdfProcessor();
    }
    return GeminiPdfProcessor.instance;
  }

  constructor() {
    this.model = genai.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.1,
        topP: 1,
        topK: 32,
        maxOutputTokens: 8192,
      }
    });
  }

  /**
   * Process PDF file directly with Gemini Flash 2.0
   */
  async processPdf(fileUrl: string, fileName: string): Promise<GeminiPdfResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      console.log(`🚀 Starting Gemini Flash 2.0 PDF processing: ${fileName}`);

      // Download PDF file
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Convert to base64 for Gemini
      const base64Data = Buffer.from(uint8Array).toString('base64');

      // Create file part for Gemini
      const filePart = {
        inlineData: {
          data: base64Data,
          mimeType: 'application/pdf'
        }
      };

      // Create structured prompt for product extraction
      const prompt = this.buildExtractionPrompt(fileName);

      console.log(`📤 Sending PDF to Gemini Flash 2.0 (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB)`);

      // Process with Gemini Flash 2.0
      const result = await this.model.generateContent([prompt, filePart]);
      const responseText = result.response.text();

      console.log(`📥 Received response from Gemini Flash 2.0 (${responseText.length} characters)`);

      // Parse response
      const extractedData = this.parseGeminiResponse(responseText);

      // Calculate metrics
      const processingTime = Date.now() - startTime;
      const tokensUsed = this.estimateTokenUsage(responseText);

      console.log(`✅ Gemini Flash 2.0 processing completed: ${extractedData.products.length} products in ${processingTime}ms`);

      return {
        supplier: extractedData.supplier,
        products: extractedData.products,
        totalRowsDetected: extractedData.products.length,
        totalRowsProcessed: extractedData.products.length,
        completenessRatio: 1.0, // Assuming complete extraction
        processingTimeMs: processingTime,
        tokensUsed,
        errors
      };

    } catch (error) {
      console.error('❌ Gemini Flash 2.0 PDF processing failed:', error);
      errors.push(error instanceof Error ? error.message : 'Unknown error');

      return {
        products: [],
        totalRowsDetected: 0,
        totalRowsProcessed: 0,
        completenessRatio: 0,
        processingTimeMs: Date.now() - startTime,
        tokensUsed: 0,
        errors
      };
    }
  }

  /**
   * Build extraction prompt for Gemini
   */
  private buildExtractionPrompt(fileName: string): string {
    return `You are an expert at extracting product information from PDF price lists and catalogs.

Analyze this PDF document "${fileName}" and extract ALL products with their pricing information.

This document may contain:
- Text-based product lists with tables
- Product photos with names and prices
- Mixed content with both text and images
- Multiple pages with different content types

CRITICAL REQUIREMENTS:
1. Extract ALL products from the entire document
2. Each row/entry may contain MULTIPLE products in different columns
3. Process ALL pages - don't stop after finding some products
4. Look for products in both text lists AND product photos
5. For product photos, read any visible text for names and prices

Return a JSON object with this EXACT structure:
{
  "supplier": {
    "name": "supplier company name (if found)",
    "email": "email address (if found)",
    "phone": "phone number (if found)",
    "address": "address (if found)"
  },
  "products": [
    {
      "name": "product name",
      "price": numeric_price_only,
      "unit": "unit of measurement (kg, pcs, l, etc.)",
      "category": "product category (if obvious)",
      "description": "additional details (if any)"
    }
  ]
}

EXTRACTION RULES:
- Extract supplier info from headers, letterheads, or contact sections
- Only include products with clear numeric prices
- Clean up product names (remove extra spaces, standardize formatting)
- Standardize units to common formats (kg not kilograms, pcs not pieces)
- Infer categories when obvious (vegetables, meat, dairy, etc.)
- If no supplier info found, omit the supplier field
- If price is not clear, focus on extracting the product name
- Process the ENTIRE document - don't stop early

Return ONLY the JSON object, no other text:`;
  }

  /**
   * Parse Gemini response and extract data
   */
  private parseGeminiResponse(responseText: string): {
    supplier?: ExtractedSupplier;
    products: ExtractedProduct[];
  } {
    try {
      // Clean response text
      let cleanContent = responseText.trim();
      
      // Remove markdown code blocks if present
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Parse JSON
      const parsed = JSON.parse(cleanContent);

      // Validate structure
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid response structure');
      }

      const products: ExtractedProduct[] = [];
      
      if (Array.isArray(parsed.products)) {
        for (const product of parsed.products) {
          if (product && typeof product === 'object' && product.name && typeof product.price === 'number') {
            products.push({
              name: String(product.name).trim(),
              price: Number(product.price),
              unit: String(product.unit || 'pcs').trim(),
              category: product.category ? String(product.category).trim() : undefined,
              description: product.description ? String(product.description).trim() : undefined
            });
          }
        }
      }

      let supplier: ExtractedSupplier | undefined;
      if (parsed.supplier && typeof parsed.supplier === 'object' && parsed.supplier.name) {
        supplier = {
          name: String(parsed.supplier.name).trim(),
          email: parsed.supplier.email ? String(parsed.supplier.email).trim() : undefined,
          phone: parsed.supplier.phone ? String(parsed.supplier.phone).trim() : undefined,
          address: parsed.supplier.address ? String(parsed.supplier.address).trim() : undefined
        };
      }

      console.log(`📊 Parsed Gemini response: ${products.length} products, supplier: ${supplier?.name || 'not found'}`);

      return { supplier, products };

    } catch (error) {
      console.error('❌ Failed to parse Gemini response:', error);
      console.error('Raw response:', responseText.substring(0, 500) + '...');
      
      return { products: [] };
    }
  }

  /**
   * Estimate token usage (rough approximation)
   */
  private estimateTokenUsage(responseText: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(responseText.length / 4);
  }
}

// Export singleton instance
export const geminiPdfProcessor = GeminiPdfProcessor.getInstance();