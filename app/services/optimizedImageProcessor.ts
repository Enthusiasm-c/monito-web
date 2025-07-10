/**
 * Optimized Image Processor
 * Handles image-based price lists with performance optimizations
 */

import sharp from 'sharp';
import OpenAI from 'openai';
import { tokenCostMonitor } from './tokenCostMonitor';

interface ImageProcessingResult {
  supplier?: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  products: Array<{
    name: string;
    price: number;
    unit: string;
    category?: string;
    description?: string;
  }>;
  totalRowsDetected: number;
  totalRowsProcessed: number;
  processingTimeMs: number;
  tokensUsed: number;
  costUsd: number;
  errors: string[];
  optimizations: {
    originalSize: number;
    optimizedSize: number;
    compressionRatio: number;
    preprocessingMs: number;
  };
}

import { BaseProcessor } from '../../lib/core/BaseProcessor';

export class OptimizedImageProcessor extends BaseProcessor {
  private openai: OpenAI;
  
  private readonly config = {
    maxImageWidth: 2048,      // Max width for Vision API
    maxImageHeight: 2048,     // Max height for Vision API
    jpegQuality: 85,          // JPEG compression quality
    maxFileSize: 20 * 1024 * 1024, // 20MB max
    enableTextEnhancement: true,
    enableParallelProcessing: true,
    chunksForLargeImages: 4,  // Split large images into chunks
  };

  public static getInstance(): OptimizedImageProcessor { // BaseProcessor
    return super.getInstance() as OptimizedImageProcessor;
  }

  constructor() {
    super('OptimizedImageProcessor');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Process image with optimizations
   */
  async processDocument(fileContent: Buffer | string, fileName:string, options?: any): Promise<ImageProcessingResult> {
    const imageUrl = typeof fileContent === 'string' ? fileContent : `data:image/jpeg;base64,${fileContent.toString('base64')}`;
    const uploadId = options?.uploadId;
    const startTime = Date.now();
    const errors: string[] = [];
    let preprocessingTime = 0;
    
    try {
      console.log(`🖼️ Processing image with optimizations: ${fileName}`);
      
      // Download image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      
      const originalBuffer = Buffer.from(await response.arrayBuffer());
      const originalSize = originalBuffer.length;
      
      console.log(`📊 Original image size: ${(originalSize / 1024 / 1024).toFixed(2)}MB`);
      
      // Preprocess image
      const preprocessStart = Date.now();
      const optimizedBuffer = await this.preprocessImage(originalBuffer);
      preprocessingTime = Date.now() - preprocessStart;
      
      const optimizedSize = optimizedBuffer.length;
      const compressionRatio = originalSize / optimizedSize;
      
      console.log(`✨ Optimized image size: ${(optimizedSize / 1024 / 1024).toFixed(2)}MB (${compressionRatio.toFixed(2)}x compression)`);
      
      // Convert to base64 for API
      const base64Image = optimizedBuffer.toString('base64');
      const dataUrl = `data:image/jpeg;base64,${base64Image}`;
      
      // Check if image needs to be split for better processing
      const metadata = await sharp(optimizedBuffer).metadata();
      const needsChunking = (metadata.width || 0) > 3000 || (metadata.height || 0) > 3000;
      
      let extractedData;
      
      if (needsChunking && this.config.enableParallelProcessing) {
        console.log(`📋 Large image detected, using chunked processing`);
        extractedData = await this.processLargeImage(optimizedBuffer, metadata);
      } else {
        extractedData = await this.processWithVisionAPI(dataUrl);
      }
      
      // Calculate metrics
      const processingTimeMs = Date.now() - startTime;
      
      return {
        supplier: extractedData.supplier,
        products: extractedData.products || [],
        totalRowsDetected: extractedData.products?.length || 0,
        totalRowsProcessed: extractedData.products?.length || 0,
        processingTimeMs,
        tokensUsed: extractedData.tokensUsed || 0,
        costUsd: extractedData.costUsd || 0,
        errors,
        optimizations: {
          originalSize,
          optimizedSize,
          compressionRatio,
          preprocessingMs: preprocessingTime
        }
      };
      
    } catch (error) {
      console.error(`❌ Optimized image processing failed:`, error);
      errors.push(error instanceof Error ? error.message : String(error));
      
      return {
        products: [],
        totalRowsDetected: 0,
        totalRowsProcessed: 0,
        processingTimeMs: Date.now() - startTime,
        tokensUsed: 0,
        costUsd: 0,
        errors,
        optimizations: {
          originalSize: 0,
          optimizedSize: 0,
          compressionRatio: 0,
          preprocessingMs: preprocessingTime
        }
      };
    }
  }

  /**
   * Preprocess image for optimal Vision API performance
   */
  private async preprocessImage(buffer: Buffer): Promise<Buffer> {
    try {
      let pipeline = sharp(buffer);
      
      // Get metadata
      const metadata = await pipeline.metadata();
      
      // Resize if too large
      if ((metadata.width || 0) > this.config.maxImageWidth || 
          (metadata.height || 0) > this.config.maxImageHeight) {
        pipeline = pipeline.resize(this.config.maxImageWidth, this.config.maxImageHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }
      
      // Enhance text readability if enabled
      if (this.config.enableTextEnhancement) {
        pipeline = pipeline
          .normalize() // Normalize brightness and contrast
          .sharpen()   // Sharpen text
          .modulate({
            brightness: 1.1,  // Slightly increase brightness
            saturation: 0.8   // Reduce saturation for better text contrast
          });
      }
      
      // Convert to JPEG with optimization
      const optimized = await pipeline
        .jpeg({
          quality: this.config.jpegQuality,
          progressive: true,
          optimizeScans: true,
          mozjpeg: true  // Use mozjpeg encoder for better compression
        })
        .toBuffer();
      
      return optimized;
      
    } catch (error) {
      console.warn(`⚠️ Image preprocessing failed, using original:`, error);
      return buffer;
    }
  }

  /**
   * Process image with Vision API
   */
  private async processWithVisionAPI(dataUrl: string): Promise<any> {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content: "You are a precise data extraction assistant. Extract supplier and product information from price lists with high accuracy."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this price list image and extract all visible information.

Return a JSON object with this exact structure:
{
  "supplier": {
    "name": "company name from header/logo",
    "email": "email if visible",
    "phone": "phone if visible",
    "address": "address if visible"
  },
  "products": [
    {
      "name": "exact product name",
      "price": numeric_price_value,
      "unit": "unit (kg/gr/ltr/pcs/pack)",
      "category": "inferred category",
      "description": "any additional details"
    }
  ]
}

Important instructions:
- Extract ALL visible products, even if the list is long
- For Indonesian prices, handle dots as thousand separators (e.g., 100.000 = 100000)
- Standardize units: kilogram→kg, gram→gr, liter→ltr, pieces→pcs
- Infer logical categories (dairy, meat, vegetables, etc.)
- Include any product codes or SKUs in the description
- If price has multiple values (e.g., wholesale/retail), use the first one
- Return ONLY valid JSON, no explanations`
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
                detail: "high" // Use high detail for better accuracy
              }
            }
          ]
        }
      ],
      temperature: 0.1, // Low temperature for consistency
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from Vision API');
    }

    // Clean and parse response
    let cleanContent = content.trim();
    cleanContent = cleanContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    
    const data = JSON.parse(cleanContent);
    
    // Track token usage
    const tokensUsed = response.usage?.total_tokens || 0;
    const costUsd = tokenCostMonitor.calculateCost(tokensUsed, 'gpt-4o-mini');
    
    return {
      ...data,
      tokensUsed,
      costUsd
    };
  }

  /**
   * Process large images by splitting into chunks
   */
  private async processLargeImage(buffer: Buffer, metadata: sharp.Metadata): Promise<any> {
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    
    // Determine grid size
    const cols = width > height ? 2 : 1;
    const rows = width > height ? 1 : 2;
    
    const chunkWidth = Math.ceil(width / cols);
    const chunkHeight = Math.ceil(height / rows);
    
    console.log(`📐 Splitting image into ${cols}x${rows} grid`);
    
    const chunks: Promise<any>[] = [];
    
    // Process each chunk
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const left = col * chunkWidth;
        const top = row * chunkHeight;
        
        const chunkPromise = (async () => {
          try {
            // Extract chunk
            const chunkBuffer = await sharp(buffer)
              .extract({
                left: Math.min(left, width - 1),
                top: Math.min(top, height - 1),
                width: Math.min(chunkWidth, width - left),
                height: Math.min(chunkHeight, height - top)
              })
              .jpeg({ quality: this.config.jpegQuality })
              .toBuffer();
            
            // Process chunk
            const base64Chunk = chunkBuffer.toString('base64');
            const dataUrl = `data:image/jpeg;base64,${base64Chunk}`;
            
            return await this.processWithVisionAPI(dataUrl);
          } catch (error) {
            console.warn(`⚠️ Chunk ${row},${col} processing failed:`, error);
            return { products: [] };
          }
        })();
        
        chunks.push(chunkPromise);
      }
    }
    
    // Wait for all chunks
    const results = await Promise.all(chunks);
    
    // Merge results
    const allProducts: any[] = [];
    let supplier = null;
    let totalTokens = 0;
    let totalCost = 0;
    
    for (const result of results) {
      if (result.supplier && !supplier) {
        supplier = result.supplier;
      }
      if (result.products) {
        allProducts.push(...result.products);
      }
      totalTokens += result.tokensUsed || 0;
      totalCost += result.costUsd || 0;
    }
    
    // Deduplicate products
    const uniqueProducts = this.deduplicateProducts(allProducts);
    
    console.log(`✅ Merged ${allProducts.length} products → ${uniqueProducts.length} unique`);
    
    return {
      supplier,
      products: uniqueProducts,
      tokensUsed: totalTokens,
      costUsd: totalCost
    };
  }

  /**
   * Deduplicate products based on name and price
   */
  private deduplicateProducts(products: any[]): any[] {
    const seen = new Map<string, any>();
    
    for (const product of products) {
      const key = `${product.name.toLowerCase().trim()}_${product.price}`;
      if (!seen.has(key)) {
        seen.set(key, product);
      }
    }
    
    return Array.from(seen.values());
  }
}

