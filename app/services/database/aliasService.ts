import { normalize } from '../../lib/utils/product-normalizer';

import { prisma } from '../../../lib/prisma';

export interface ProductAlias {
  id: string;
  productId: string;
  alias: string;
  language?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Look up product by alias
 * Returns product ID if alias exists
 */
export async function aliasLookup(query: string): Promise<string | null> {
  const normalizedQuery = normalize(query);
  
  // First, try exact alias match
  const alias = await prisma.productAlias.findUnique({
    where: { alias: normalizedQuery },
    select: { productId: true }
  });
  
  if (alias) {
    return alias.productId;
  }
  
  // Try with original query as well
  if (query !== normalizedQuery) {
    const aliasOriginal = await prisma.productAlias.findUnique({
      where: { alias: query.toLowerCase() },
      select: { productId: true }
    });
    
    if (aliasOriginal) {
      return aliasOriginal.productId;
    }
  }
  
  return null;
}

/**
 * Create a new product alias
 */
export async function createAlias(
  productId: string,
  alias: string,
  language: string = 'en'
): Promise<ProductAlias> {
  // Normalize the alias
  const normalizedAlias = normalize(alias);
  
  return await prisma.productAlias.create({
    data: {
      productId,
      alias: normalizedAlias,
      language
    }
  });
}

/**
 * Get all aliases for a product
 */
export async function getProductAliases(productId: string): Promise<ProductAlias[]> {
  return await prisma.productAlias.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Delete an alias
 */
export async function deleteAlias(aliasId: string): Promise<void> {
  await prisma.productAlias.delete({
    where: { id: aliasId }
  });
}

/**
 * Bulk create aliases for initial setup
 */
export async function bulkCreateAliases(aliases: Array<{
  productId: string;
  alias: string;
  language?: string;
}>): Promise<number> {
  const created = await prisma.productAlias.createMany({
    data: aliases.map(a => ({
      productId: a.productId,
      alias: normalize(a.alias),
      language: a.language || 'en'
    })),
    skipDuplicates: true
  });
  
  return created.count;
}

/**
 * Search for products including alias matches
 */
export async function searchProductsWithAliases(query: string) {
  const normalizedQuery = normalize(query);
  
  // First check for exact alias match
  const productIdFromAlias = await aliasLookup(query);
  
  if (productIdFromAlias) {
    // Return the exact product matched by alias
    const product = await prisma.product.findUnique({
      where: { id: productIdFromAlias },
      include: {
        prices: {
          where: { validTo: null },
          include: {
            supplier: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
    
    return product ? [product] : [];
  }
  
  // Fallback to regular search
  return await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: normalizedQuery, mode: 'insensitive' } },
        { standardizedName: { contains: normalizedQuery, mode: 'insensitive' } },
        { rawName: { contains: normalizedQuery, mode: 'insensitive' } }
      ]
    },
    include: {
      prices: {
        where: { validTo: null },
        include: {
          supplier: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    },
    take: 20
  });
}