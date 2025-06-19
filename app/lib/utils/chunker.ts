/**
 * Utility for chunking large product arrays for OpenAI API processing
 */

export interface ProductChunk {
  products: any[];
  chunkIndex: number;
  totalChunks: number;
}

/**
 * Split products array into manageable chunks for OpenAI processing
 * @param products Array of products to chunk
 * @param chunkSize Number of products per chunk (default: 50)
 * @returns Array of product chunks
 */
export function chunkProducts(products: any[], chunkSize: number = 50): ProductChunk[] {
  if (products.length === 0) {
    return [];
  }

  const chunks: ProductChunk[] = [];
  const totalChunks = Math.ceil(products.length / chunkSize);

  for (let i = 0; i < products.length; i += chunkSize) {
    const chunkProducts = products.slice(i, i + chunkSize);
    const chunkIndex = Math.floor(i / chunkSize);
    
    chunks.push({
      products: chunkProducts,
      chunkIndex,
      totalChunks
    });
  }

  console.log(`📊 Split ${products.length} products into ${totalChunks} chunks of max ${chunkSize} each`);
  
  return chunks;
}

/**
 * Estimate token count for products array (rough approximation)
 * @param products Array of products
 * @returns Estimated token count
 */
export function estimateTokens(products: any[]): number {
  // Rough estimation: ~120 tokens per product on average
  // Based on typical product structure: name + price + unit + category
  return products.length * 120;
}

/**
 * Get optimal chunk size based on token limits
 * @param products Array of products
 * @param maxTokens Maximum tokens per chunk (default: 6000 to leave room for completion)
 * @returns Optimal chunk size
 */
export function getOptimalChunkSize(products: any[], maxTokens: number = 6000): number {
  if (products.length === 0) return 50;
  
  const avgTokensPerProduct = estimateTokens(products) / products.length;
  const optimalSize = Math.floor(maxTokens / avgTokensPerProduct);
  
  // Ensure minimum of 10 and maximum of 100 products per chunk
  return Math.max(10, Math.min(100, optimalSize));
}