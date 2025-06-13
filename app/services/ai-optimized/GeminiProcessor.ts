import { z } from 'zod';
import { ExtractedData, ExtractedDataSchema } from './UnifiedAIProcessor';

interface ProcessOptions {
  maxProducts?: number;
  model?: 'gemini-2.0-flash-exp' | 'gemini-2.0-flash' | 'gemini-1.5-pro' | 'gemini-1.5-flash';
  includeMetadata?: boolean;
  preferredLanguage?: string;
}

export class GeminiProcessor {
  private apiKey: string;
  private defaultModel = 'gemini-2.0-flash-exp'; // Newest and fastest model
  private apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor() {
    this.apiKey = process.env.GOOGLE_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('GOOGLE_API_KEY not found in environment variables');
    }
  }

  /**
   * Process document with Gemini - supports direct PDF upload!
   */
  async processDocument(
    content: string | Buffer,
    fileName: string,
    options: ProcessOptions = {}
  ): Promise<ExtractedData> {
    const model = options.model || this.defaultModel;
    
    try {
      // Gemini can handle PDFs directly!
      if (fileName.toLowerCase().endsWith('.pdf') && Buffer.isBuffer(content)) {
        return await this.processWithGemini(content, fileName, model, options, 'application/pdf');
      } else if (this.isImageFile(fileName) && Buffer.isBuffer(content)) {
        const mimeType = this.getMimeType(fileName);
        return await this.processWithGemini(content, fileName, model, options, mimeType);
      } else {
        // Text content
        return await this.processTextWithGemini(
          typeof content === 'string' ? content : content.toString(),
          fileName,
          model,
          options
        );
      }
    } catch (error) {
      console.error('Error processing document with Gemini:', error);
      throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process binary files (PDF, images) with Gemini
   */
  private async processWithGemini(
    fileBuffer: Buffer,
    fileName: string,
    model: string,
    options: ProcessOptions,
    mimeType: string
  ): Promise<ExtractedData> {
    const base64Data = fileBuffer.toString('base64');
    const prompt = this.buildExtractionPrompt(options);

    console.log(`Processing ${fileName} with Gemini ${model}...`);
    console.log(`File type: ${mimeType}, Size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt + `\n\nIMPORTANT: Respond ONLY with valid JSON, no markdown formatting. Ensure every product has a confidence score.`
            },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        topP: 0.95,
        topK: 40
      }
    };

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

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    
    if (!result.candidates || !result.candidates[0]?.content?.parts?.[0]?.text) {
      throw new Error('No response content from Gemini');
    }

    const content = result.candidates[0].content.parts[0].text;
    console.log('Gemini response received, length:', content.length);
    
    // Clean response if wrapped in markdown
    let cleanContent = content;
    if (content.includes('```json')) {
      cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }
    
    // Parse and validate
    let rawData = JSON.parse(cleanContent);
    
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
    
    const validated = ExtractedDataSchema.parse(rawData);
    return this.enhanceExtractedData(validated, fileName);
  }

  /**
   * Process text documents with Gemini
   */
  private async processTextWithGemini(
    text: string,
    fileName: string,
    model: string,
    options: ProcessOptions
  ): Promise<ExtractedData> {
    const prompt = this.buildExtractionPrompt(options);

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `${prompt}\n\nDocument content:\n${text.substring(0, 15000)}\n\nIMPORTANT: Respond ONLY with valid JSON, no markdown formatting.`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096
      }
    };

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

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.candidates[0].content.parts[0].text;
    
    const rawData = JSON.parse(content);
    const validated = ExtractedDataSchema.parse(rawData);
    return this.enhanceExtractedData(validated, fileName);
  }

  /**
   * Build extraction prompt
   */
  private buildExtractionPrompt(options: ProcessOptions): string {
    const maxProducts = options.maxProducts || 1000;
    const language = options.preferredLanguage || 'English';

    return `You are analyzing a document. Extract all product information from this document.

IMPORTANT: This might be a price list, catalog, invoice or order form. Look for:
- Tables with products and prices
- Lists of items with costs
- Any product names with associated numbers

Extract the following information and return as JSON:
{
  "documentType": "price_list" | "invoice" | "catalog" | "order" | "unknown",
  "supplierName": "Company name from document",
  "supplierContact": {
    "email": "email if found",
    "phone": "phone if found", 
    "address": "address if found"
  },
  "products": [
    {
      "name": "Product name in ${language}",
      "price": numeric_value,
      "unit": "kg|pcs|l|ml|g|pack|box|etc",
      "category": "category if visible",
      "confidence": 0.0-1.0
    }
  ],
  "extractionQuality": 0.0-1.0,
  "metadata": {
    "totalPages": number,
    "language": "detected language",
    "currency": "detected currency"
  }
}

Rules:
- Extract up to ${maxProducts} products
- Include ALL products you can see, even if price is unclear
- If you see a table, extract EVERY row that looks like a product
- Convert all prices to numbers (remove currency symbols)
- If unit is not clear, use "pcs" as default
- Set confidence based on clarity of information
- For multi-page PDFs, process ALL pages

Focus on extracting as many products as possible from the document.`;
  }

  /**
   * Enhance extracted data with metadata
   */
  private enhanceExtractedData(data: ExtractedData, fileName: string): ExtractedData {
    return {
      ...data,
      metadata: {
        ...data.metadata,
        dateExtracted: new Date().toISOString(),
        currency: data.metadata?.currency || 'IDR',
        processor: 'gemini'
      }
    };
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
export const geminiProcessor = new GeminiProcessor();