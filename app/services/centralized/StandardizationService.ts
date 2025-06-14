/**
 * Centralized Product Standardization Service
 * Uses ChatGPT o3 for all product name and unit standardization
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface StandardizationRequest {
  products: Array<{
    rawName: string;
    rawUnit?: string;
    category?: string;
  }>;
}

export interface StandardizedProduct {
  originalName: string;
  standardizedName: string;
  originalUnit: string;
  standardizedUnit: string;
  confidence: number;
}

export interface StandardizationResult {
  products: StandardizedProduct[];
  totalProcessed: number;
  tokensUsed: number;
  processingTimeMs: number;
}

class StandardizationService {
  private static instance: StandardizationService;

  public static getInstance(): StandardizationService {
    if (!StandardizationService.instance) {
      StandardizationService.instance = new StandardizationService();
    }
    return StandardizationService.instance;
  }

  /**
   * Standardize products using ChatGPT o3
   */
  async standardizeProducts(request: StandardizationRequest): Promise<StandardizationResult> {
    const startTime = Date.now();
    
    if (!request.products || request.products.length === 0) {
      return {
        products: [],
        totalProcessed: 0,
        tokensUsed: 0,
        processingTimeMs: Date.now() - startTime
      };
    }

    console.log(`🤖 Starting ChatGPT o3 standardization for ${request.products.length} products`);

    try {
      // Create structured prompt for batch processing
      const prompt = this.buildStandardizationPrompt(request.products);
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a product standardization expert. Your task is to:
1. Standardize product names to English, singular form, with main noun first
2. Standardize units to common formats (kg, g, l, ml, pcs, pack, etc.)
3. Return a JSON array with exact structure requested
4. Be consistent across similar products`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from ChatGPT o3');
      }

      // Parse JSON response
      const standardizedProducts = this.parseStandardizationResponse(content, request.products);
      
      const tokensUsed = response.usage?.total_tokens || 0;
      const processingTime = Date.now() - startTime;

      console.log(`✅ ChatGPT o3 standardization completed: ${standardizedProducts.length} products in ${processingTime}ms, ${tokensUsed} tokens`);

      return {
        products: standardizedProducts,
        totalProcessed: standardizedProducts.length,
        tokensUsed,
        processingTimeMs: processingTime
      };

    } catch (error) {
      console.error('❌ ChatGPT o3 standardization failed:', error);
      throw new Error(`Standardization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build standardization prompt for ChatGPT o3
   */
  private buildStandardizationPrompt(products: Array<{rawName: string; rawUnit?: string; category?: string}>): string {
    const productList = products.map((product, index) => {
      return `${index + 1}. Name: "${product.rawName}", Unit: "${product.rawUnit || 'unknown'}", Category: "${product.category || 'unknown'}"`;
    }).join('\n');

    return `Standardize these products to English with consistent naming and units:

${productList}

RULES:
1. Product names: 
   - Convert to English (telur→egg, ayam→chicken, beras→rice)
   - Use singular form (tomatoes→tomato, potatoes→potato)
   - Main noun FIRST, then descriptors (tomato cherry, onion red, chicken breast)
   - Remove brand names and supplier-specific terms
   - Fix spelling errors (zukini→zucchini, brocoli→broccoli)

2. Units:
   - Standardize to: kg, g, l, ml, pcs, pack, box, bottle, can, bunch
   - Convert Indonesian units: sisir→bunch, butir→pcs, lembar→sheet
   - Use consistent abbreviations

3. Return ONLY a JSON array with this exact structure:
[
  {
    "originalName": "original product name",
    "standardizedName": "standardized name",
    "originalUnit": "original unit",
    "standardizedUnit": "standardized unit",
    "confidence": 0.95
  }
]

Examples:
- "Telur Ayam Grade A" → "egg chicken"
- "Beras Jasmine Premium" → "rice jasmine"
- "Tomat Cherry Segar" → "tomato cherry"
- "Bawang Merah" → "onion red"

Return ONLY the JSON array, no other text:`;
  }

  /**
   * Parse ChatGPT o3 response and create standardized products
   */
  private parseStandardizationResponse(
    content: string, 
    originalProducts: Array<{rawName: string; rawUnit?: string; category?: string}>
  ): StandardizedProduct[] {
    try {
      // Clean JSON from potential markdown formatting
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsedResults = JSON.parse(cleanContent);
      
      if (!Array.isArray(parsedResults)) {
        throw new Error('Response is not an array');
      }

      // Map results back to original products
      const standardizedProducts: StandardizedProduct[] = [];
      
      for (let i = 0; i < originalProducts.length; i++) {
        const original = originalProducts[i];
        const standardized = parsedResults[i];
        
        if (!standardized) {
          console.warn(`⚠️ No standardization result for product ${i + 1}: ${original.rawName}`);
          continue;
        }

        standardizedProducts.push({
          originalName: original.rawName,
          standardizedName: standardized.standardizedName || original.rawName.toLowerCase(),
          originalUnit: original.rawUnit || 'pcs',
          standardizedUnit: standardized.standardizedUnit || 'pcs',
          confidence: standardized.confidence || 0.8
        });
      }

      return standardizedProducts;

    } catch (error) {
      console.error('❌ Failed to parse ChatGPT o3 response:', error);
      console.error('Raw response:', content);
      
      // Return fallback standardization (basic cleanup only)
      return originalProducts.map(product => ({
        originalName: product.rawName,
        standardizedName: product.rawName.toLowerCase().trim(),
        originalUnit: product.rawUnit || 'pcs',
        standardizedUnit: this.basicUnitStandardization(product.rawUnit || 'pcs'),
        confidence: 0.3 // Low confidence for fallback
      }));
    }
  }

  /**
   * Basic unit standardization as absolute fallback
   */
  private basicUnitStandardization(unit: string): string {
    const unitMap: Record<string, string> = {
      'kg': 'kg', 'kilogram': 'kg', 'kilo': 'kg',
      'g': 'g', 'gram': 'g', 'gr': 'g',
      'l': 'l', 'liter': 'l', 'litre': 'l',
      'ml': 'ml', 'milliliter': 'ml',
      'pcs': 'pcs', 'piece': 'pcs', 'pieces': 'pcs', 'pc': 'pcs',
      'pack': 'pack', 'package': 'pack',
      'box': 'box', 'bottle': 'bottle', 'can': 'can',
      'sisir': 'bunch', 'ikat': 'bunch', 'bunch': 'bunch',
      'butir': 'pcs', 'buah': 'pcs', 'lembar': 'sheet'
    };

    const normalized = unit.toLowerCase().trim();
    return unitMap[normalized] || 'pcs';
  }

  /**
   * Standardize single product (convenience method)
   */
  async standardizeSingleProduct(
    rawName: string, 
    rawUnit?: string, 
    category?: string
  ): Promise<StandardizedProduct> {
    const result = await this.standardizeProducts({
      products: [{ rawName, rawUnit, category }]
    });
    
    if (result.products.length === 0) {
      throw new Error('Failed to standardize product');
    }
    
    return result.products[0];
  }
}

// Export singleton instance
export const standardizationService = StandardizationService.getInstance();