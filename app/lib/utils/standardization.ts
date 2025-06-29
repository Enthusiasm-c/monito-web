/**
 * AI-powered standardization using OpenAI o3-mini with chunking support
 */

import { chunkProducts, estimateTokens, type ProductChunk } from './chunker';

export interface StandardizedProduct {
  originalName: string;
  standardizedName: string;
  originalUnit: string | null;
  quantity: number | null;
  standardizedUnit: string | null;
  category: string;
  confidence: number;
}

/**
 * Process a single chunk of products through OpenAI o3-mini
 */
async function processProductChunk(
  products: any[], 
  chunkIndex: number, 
  totalChunks: number,
  retryAttempt: number = 0
): Promise<StandardizedProduct[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found in environment variables');
  }
  
  const estimatedTokens = estimateTokens(products);
  console.log(`🔄 Processing chunk ${chunkIndex + 1}/${totalChunks}: ${products.length} products (~${estimatedTokens} tokens)`);
  
  if (retryAttempt > 0) {
    console.log(`🔄 Retry attempt ${retryAttempt} for chunk ${chunkIndex + 1}`);
  }

  const systemPrompt = `You are "Monito-Normalizer"

You receive a JSON array of raw product rows extracted from Indonesian price lists, invoices, catalogues, etc.  
Your task is to return a new JSON array with every row normalised, so that all names are in clean English and all units follow a single canonical list.

NORMALISATION RULES:
A. **Name Translation Rules**  
   • Translate Indonesian → English using EXACT terms that exist in grocery databases.
   • Fix spelling / duplicated spaces.  
   • Format: "<Main noun> <Descriptor>", e.g. "Cheese Mozzarella", "Chicken Fillet Fresh". Remove brand names & packaging words.  
   • USE STANDARD GROCERY TERMS - avoid unusual combinations.

CRITICAL INDONESIAN → ENGLISH MAPPINGS (MAXIMUM ACCURACY REQUIRED):
• "daun bawang" → "Chives" (NEVER "Green Onion" or "Spring Onion")
• "bawang merah" → "Onion Red" 
• "bawang putih" → "Garlic"
• "bawang bombay" → "Onion Yellow"
• "wortel" → "Carrot"
• "kentang" → "Potato" 
• "tomat" → "Tomato"
• "selada" → "Lettuce"
• "kriting/keriting" → "Curly"
• "harum/harum manis" → "Sweet" (for fruits, NEVER "Fragrant")
• "mangga" → "Mango"
• "pisang" → "Banana"
• "apel" → "Apple"
• "jeruk" → "Orange"
• "ayam" → "Chicken"
• "daging sapi" → "Beef"
• "daging kambing" → "Goat"
• "ikan" → "Fish"
• "udang" → "Shrimp"
• "cumi" → "Squid"
• "sawi" → "Mustard Green"
• "kangkung" → "Water Spinach"
• "bayam" → "Spinach"
• "cabai/cabe" → "Chili"
• "lombok" → "Chili"
• "terong" → "Eggplant"
• "timun" → "Cucumber"
• "labu" → "Pumpkin"
• "jagung" → "Corn"
• "kacang" → "Bean"
• "tempe" → "Tempeh"
• "tahu" → "Tofu"

PREFERRED GROCERY TERMS:
• Green onions: "Chives" or "Spring Onion"
• Sweet fruits: use "Sweet" not "Fragrant"
• Curly vegetables: "Curly" not "Kriting"
• Local varieties: include "Local" when specified

B. **Units**  
   • Canonical list (lower-case): kg, g, l, ml, pcs, pack, box, bottle, can, bunch, sheet, sack.  
   • Indonesian ⇒ English mapping: sisir → bunch · butir → pcs · lembar → sheet · karung → sack.  
   • Accept dotted, spaced or mixed-case variants: "KG.", "Kg", "250 ML" → standardizedUnit:"ml", quantity:250.  
   • If unit token is k, K, ribu, rb, treat it as price suffix, not a measurement – set standardizedUnit and quantity to null.  
   • If unit unclear or absent → both fields null, confidence ≤ 80.

C. **Quantity**  
   • If unit string contains a leading number ("250ml", "1kg", "2 x 5kg"), extract the first numeric value as quantity.  
   • Otherwise null.

D. **Category list**  
   dairy, meat, seafood, vegetables, fruits, spices, grains, bakery, beverages, oils, sweeteners, condiments, disposables, other.

E. **Confidence (MAXIMUM ACCURACY MODE)**  
   100 perfect → Indonesian terms translated exactly per mapping, spelling obvious & unit clear;  
   95–99 high → standard grocery terms, minor formatting;  
   90–94 medium → slight ambiguity but core translation correct;  
   80–89 low → unit unclear but name translation confident;
   <80 uncertain → mark for manual review but return result.

   PRIORITY: Accuracy over speed. Use EXACT mappings listed above.

F. **General**  
   • Keep output order identical to input.  
   • Do not add or remove rows.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'o3-mini-2025-01-31',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: JSON.stringify(products)
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "normalize_products",
            schema: {
              type: "object",
              properties: {
                products: {
                  type: "array",
                  items: {
                    type: "object",
                    required: [
                      "originalName", "standardizedName",
                      "originalUnit", "quantity",
                      "standardizedUnit", "category", "confidence"
                    ],
                    properties: {
                      originalName: { type: "string" },
                      standardizedName: { type: "string" },
                      originalUnit: { type: ["string", "null"] },
                      quantity: { type: ["number", "null"] },
                      standardizedUnit: { type: ["string", "null"] },
                      category: { type: "string" },
                      confidence: { type: "integer", minimum: 0, maximum: 100 }
                    },
                    additionalProperties: false
                  }
                }
              },
              required: ["products"],
              additionalProperties: false
            },
            strict: true
          }
        },
        stream: false,
        max_completion_tokens: 16384
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error details:', errorText);
      console.error('❌ Products count sent:', products.length);
      console.error('❌ First product:', JSON.stringify(products[0], null, 2));
      throw new Error(`OpenAI API error: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    
    // Handle JSON schema response
    const content = result.choices?.[0]?.message?.content;
    
    if (content) {
      try {
        const response = JSON.parse(content);
        const standardizedProducts = response.products || response;
        console.log(`✅ Chunk ${chunkIndex + 1}/${totalChunks}: standardized ${standardizedProducts.length} products`);
        return standardizedProducts;
      } catch (parseError) {
        console.error(`❌ Failed to parse OpenAI response for chunk ${chunkIndex + 1}:`, content.substring(0, 500) + '...');
        
        // Retry with smaller chunk if this is first attempt and chunk is large
        if (retryAttempt === 0 && products.length > 25) {
          console.log(`🔄 Retrying chunk ${chunkIndex + 1} with smaller size...`);
          const halfSize = Math.floor(products.length / 2);
          const firstHalf = products.slice(0, halfSize);
          const secondHalf = products.slice(halfSize);
          
          const [firstResult, secondResult] = await Promise.all([
            processProductChunk(firstHalf, chunkIndex, totalChunks, retryAttempt + 1),
            processProductChunk(secondHalf, chunkIndex, totalChunks, retryAttempt + 1)
          ]);
          
          return [...firstResult, ...secondResult];
        }
        
        throw new Error(`Failed to parse standardization results for chunk ${chunkIndex + 1}`);
      }
    } else {
      throw new Error('No content returned from OpenAI API');
    }

  } catch (error) {
    console.error(`❌ Standardization error for chunk ${chunkIndex + 1}:`, error);
    throw error;
  }
}

/**
 * Standardize products using OpenAI o3-mini model with chunking
 */
export async function standardizeProducts(products: any[]): Promise<StandardizedProduct[]> {
  if (products.length === 0) {
    console.log('📊 No products to standardize');
    return [];
  }

  console.log(`🚀 Starting standardization of ${products.length} products`);
  
  // Split into chunks
  const chunks = chunkProducts(products, 50); // 50 products per chunk
  
  if (chunks.length === 1) {
    // Single chunk - process directly
    return await processProductChunk(chunks[0].products, 0, 1);
  }
  
  // Multiple chunks - process in parallel (max 3 concurrent)
  console.log(`🔄 Processing ${chunks.length} chunks in parallel...`);
  
  const results: StandardizedProduct[] = [];
  
  // Process chunks in batches of 3 to avoid rate limits
  for (let i = 0; i < chunks.length; i += 3) {
    const batchChunks = chunks.slice(i, i + 3);
    
    const batchPromises = batchChunks.map(chunk => 
      processProductChunk(chunk.products, chunk.chunkIndex, chunks.length)
    );
    
    const batchResults = await Promise.all(batchPromises);
    
    // Flatten and add to results
    for (const chunkResult of batchResults) {
      results.push(...chunkResult);
    }
    
    // Small delay between batches to be nice to the API
    if (i + 3 < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`✅ Completed standardization: ${results.length}/${products.length} products`);
  
  if (results.length !== products.length) {
    console.warn(`⚠️ Result count mismatch: expected ${products.length}, got ${results.length}`);
  }
  
  return results;
}

/**
 * Legacy function - only for price normalization now
 */
export function normalizePrice(price: string | number): number {
  if (typeof price === 'number') return price;
  if (!price) return 0;
  
  // Remove currency symbols and spaces
  let normalized = price.toString()
    .replace(/[Rp$€£¥₹,.\\s]/g, '')
    .trim();
  
  // Handle Indonesian notation (e.g., "39rb" -> 39000, "1.5jt" -> 1500000)
  if (normalized.match(/rb$/i)) {
    normalized = normalized.replace(/rb$/i, '000');
  } else if (normalized.match(/jt$/i)) {
    normalized = normalized.replace(/jt$/i, '000000');
  } else if (normalized.match(/juta$/i)) {
    normalized = normalized.replace(/juta$/i, '000000');
  } else if (normalized.match(/ribu$/i)) {
    normalized = normalized.replace(/ribu$/i, '000');
  }
  
  // Handle K notation (e.g., "39k" -> 39000)
  if (normalized.match(/k$/i)) {
    normalized = normalized.replace(/k$/i, '000');
  }
  
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Validate product data
 */
export function validateProduct(product: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!product.name || product.name.trim().length === 0) {
    errors.push('Product name is required');
  }
  
  if (!product.price || product.price <= 0) {
    errors.push('Valid price is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Extract supplier name from text (for AI responses)
 */
export function extractSupplierName(text: string, fileName?: string): string {
  // Try to extract from common patterns
  const patterns = [
    /(?:supplier|vendor|from|by):\\s*([^,\\n]+)/i,
    /(?:cv|pt|ud|tb)\\.\\s*([^,\\n]+)/i,
    /^([^-,\\n]+)(?:\\s*-|\\s*,)/
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  // Fallback to filename without extension
  if (fileName) {
    return fileName.replace(/\\.[^/.]+$/, '').trim();
  }
  
  return 'Unknown Supplier';
}