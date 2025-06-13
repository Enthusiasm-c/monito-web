import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

interface CreatePriceInput {
  amount: number;
  currency?: string;
  productId: string;
  uploadId: string;
  validFrom?: Date;
}

interface UpdatePriceInput {
  supplierId: string;
  productId: string;
  amount: number;
  currency?: string;
  uploadId: string;
}

/**
 * Service for handling price operations with proper transaction support
 */
export class PriceService {
  /**
   * Create a new price record
   */
  static async createPrice(data: CreatePriceInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    
    return await client.price.create({
      data: {
        amount: data.amount,
        currency: data.currency || 'IDR',
        productId: data.productId,
        uploadId: data.uploadId,
        validFrom: data.validFrom || new Date(),
      },
    });
  }
  
  /**
   * Update price for a product from a specific supplier
   * This ensures only one active price exists at a time
   */
  static async updateProductPrice(data: UpdatePriceInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    
    // Execute in a transaction to ensure consistency
    const executeUpdate = async (transactionClient: Prisma.TransactionClient) => {
      // First, check if product belongs to the supplier
      const product = await transactionClient.product.findFirst({
        where: {
          id: data.productId,
          supplierId: data.supplierId,
        },
      });
      
      if (!product) {
        throw new Error(`Product ${data.productId} not found for supplier ${data.supplierId}`);
      }
      
      // Get all current prices for this product
      const currentPrices = await transactionClient.price.findMany({
        where: {
          productId: data.productId,
          validTo: null,
        },
      });
      
      // Mark all current prices as expired
      if (currentPrices.length > 0) {
        await transactionClient.price.updateMany({
          where: {
            productId: data.productId,
            validTo: null,
          },
          data: {
            validTo: new Date(),
          },
        });
      }
      
      // Create new price record
      const newPrice = await transactionClient.price.create({
        data: {
          amount: data.amount,
          currency: data.currency || 'IDR',
          productId: data.productId,
          uploadId: data.uploadId,
          validFrom: new Date(),
        },
      });
      
      return newPrice;
    };
    
    // If transaction client provided, use it; otherwise create new transaction
    if (tx) {
      return await executeUpdate(tx);
    } else {
      return await prisma.$transaction(executeUpdate);
    }
  }
  
  /**
   * Bulk update prices for multiple products
   */
  static async bulkUpdatePrices(
    supplierId: string,
    products: Array<{
      productId: string;
      amount: number;
      currency?: string;
    }>,
    uploadId: string,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    
    const executeUpdate = async (transactionClient: Prisma.TransactionClient) => {
      const results = [];
      
      for (const product of products) {
        try {
          const price = await this.updateProductPrice(
            {
              supplierId,
              productId: product.productId,
              amount: product.amount,
              currency: product.currency,
              uploadId,
            },
            transactionClient
          );
          results.push({ success: true, productId: product.productId, price });
        } catch (error) {
          results.push({ 
            success: false, 
            productId: product.productId, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }
      
      return results;
    };
    
    if (tx) {
      return await executeUpdate(tx);
    } else {
      return await prisma.$transaction(executeUpdate, {
        timeout: 30000, // 30 second timeout for bulk operations
      });
    }
  }
  
  /**
   * Get current price for a product
   */
  static async getCurrentPrice(productId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    
    return await client.price.findFirst({
      where: {
        productId,
        validTo: null,
      },
      orderBy: {
        validFrom: 'desc',
      },
    });
  }
  
  /**
   * Get price history for a product
   */
  static async getPriceHistory(
    productId: string,
    options?: {
      limit?: number;
      includeExpired?: boolean;
    },
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    
    const where: Prisma.PriceWhereInput = {
      productId,
    };
    
    if (!options?.includeExpired) {
      where.validTo = null;
    }
    
    return await client.price.findMany({
      where,
      orderBy: {
        validFrom: 'desc',
      },
      take: options?.limit,
      include: {
        upload: {
          select: {
            fileName: true,
            createdAt: true,
          },
        },
      },
    });
  }
  
  /**
   * Clean up duplicate active prices (maintenance function)
   */
  static async cleanupDuplicatePrices(tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    
    const executeCleanup = async (transactionClient: Prisma.TransactionClient) => {
      // Find products with multiple active prices
      const productsWithDuplicates = await transactionClient.price.groupBy({
        by: ['productId'],
        where: {
          validTo: null,
        },
        _count: {
          id: true,
        },
        having: {
          id: {
            _count: {
              gt: 1,
            },
          },
        },
      });
      
      let cleanedCount = 0;
      
      for (const { productId } of productsWithDuplicates) {
        // Get all active prices for this product
        const activePrices = await transactionClient.price.findMany({
          where: {
            productId,
            validTo: null,
          },
          orderBy: {
            validFrom: 'desc',
          },
        });
        
        // Keep only the most recent, expire the rest
        if (activePrices.length > 1) {
          const [latest, ...older] = activePrices;
          
          await transactionClient.price.updateMany({
            where: {
              id: {
                in: older.map(p => p.id),
              },
            },
            data: {
              validTo: new Date(),
            },
          });
          
          cleanedCount += older.length;
        }
      }
      
      return {
        productsProcessed: productsWithDuplicates.length,
        pricesExpired: cleanedCount,
      };
    };
    
    if (tx) {
      return await executeCleanup(tx);
    } else {
      return await prisma.$transaction(executeCleanup);
    }
  }
}