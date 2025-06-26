/**
 * Bulk Operations Service
 * Handles mass deletion, updates, and other bulk operations for admin
 */

import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { priceHistoryService, PriceChangeData } from './PriceHistoryService';

const prisma = new PrismaClient();

export interface DeleteResult {
  success: boolean;
  deletedCount: number;
  affectedProducts: string[];
  errors: string[];
  operationId: string;
  performedBy: string;
  timestamp: Date;
}

export interface PriceUpdate {
  id: string;
  productId?: string;
  supplierId?: string;
  price?: number;
  unit?: string;
  unitPrice?: number;
  notes?: string;
}

export interface UpdateResult {
  success: boolean;
  updatedCount: number;
  failedUpdates: {
    id: string;
    error: string;
  }[];
  operationId: string;
  performedBy: string;
  timestamp: Date;
}

export interface ProductUpdate {
  id: string;
  name?: string;
  standardizedName?: string;
  category?: string;
  unit?: string;
  standardizedUnit?: string;
  description?: string;
}

export interface SupplierUpdate {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  contactInfo?: string;
}

export class BulkOperationsService {
  /**
   * Delete all prices for a specific supplier
   */
  async deleteAllSupplierPrices(
    supplierId: string, 
    userId: string,
    reason?: string
  ): Promise<DeleteResult> {
    const operationId = `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();
    const errors: string[] = [];
    let deletedCount = 0;
    let affectedProducts: string[] = [];

    try {
      // Start transaction
      const result = await prisma.$transaction(async (tx) => {
        // Get all prices for this supplier first
        const prices = await tx.price.findMany({
          where: { supplierId },
          include: {
            product: {
              select: { id: true, name: true }
            }
          }
        });

        if (prices.length === 0) {
          return {
            success: true,
            deletedCount: 0,
            affectedProducts: [],
            errors: ['No prices found for this supplier'],
            operationId,
            performedBy: userId,
            timestamp
          };
        }

        affectedProducts = [...new Set(prices.map(p => p.productId))];

        // Record deletion in price history for each price
        for (const price of prices) {
          try {
            await priceHistoryService.recordPriceChange({
              productId: price.productId,
              supplierId: price.supplierId,
              price: parseFloat(price.amount.toString()),
              unit: price.unit,
              unitPrice: price.unitPrice ? parseFloat(price.unitPrice.toString()) : undefined,
              changeReason: 'manual',
              changedBy: userId,
              notes: `Bulk deletion: ${reason || 'Admin bulk delete operation'}`
            });
          } catch (error) {
            console.error(`Failed to record history for price ${price.id}:`, error);
            errors.push(`Failed to record history for price ${price.id}`);
          }
        }

        // Delete all prices
        const deleteResult = await tx.price.deleteMany({
          where: { supplierId }
        });

        deletedCount = deleteResult.count;

        // Log the operation
        console.log(`Bulk delete operation ${operationId}: Deleted ${deletedCount} prices for supplier ${supplierId} by user ${userId}`);

        return {
          success: true,
          deletedCount,
          affectedProducts,
          errors,
          operationId,
          performedBy: userId,
          timestamp
        };
      });

      return result;
    } catch (error) {
      console.error('Bulk delete operation failed:', error);
      return {
        success: false,
        deletedCount: 0,
        affectedProducts: [],
        errors: [`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        operationId,
        performedBy: userId,
        timestamp
      };
    }
  }

  /**
   * Delete specific products by IDs
   */
  async bulkDeleteProducts(
    productIds: string[], 
    userId: string,
    reason?: string
  ): Promise<DeleteResult> {
    const operationId = `del_prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();
    const errors: string[] = [];
    let deletedCount = 0;

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Check if products exist and get their associated prices
        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          include: {
            prices: true,
            _count: {
              select: {
                prices: true
              }
            }
          }
        });

        if (products.length === 0) {
          return {
            success: true,
            deletedCount: 0,
            affectedProducts: [],
            errors: ['No products found with the provided IDs'],
            operationId,
            performedBy: userId,
            timestamp
          };
        }

        // Record price history before deletion
        for (const product of products) {
          for (const price of product.prices) {
            try {
              await priceHistoryService.recordPriceChange({
                productId: price.productId,
                supplierId: price.supplierId,
                price: parseFloat(price.amount.toString()),
                unit: price.unit,
                unitPrice: price.unitPrice ? parseFloat(price.unitPrice.toString()) : undefined,
                changeReason: 'manual',
                changedBy: userId,
                notes: `Product deletion: ${reason || 'Admin bulk product delete'}`
              });
            } catch (error) {
              console.error(`Failed to record history for price ${price.id}:`, error);
              errors.push(`Failed to record history for price ${price.id}`);
            }
          }
        }

        // Delete products (cascading will handle related data)
        const deleteResult = await tx.product.deleteMany({
          where: { id: { in: productIds } }
        });

        deletedCount = deleteResult.count;

        return {
          success: true,
          deletedCount,
          affectedProducts: productIds,
          errors,
          operationId,
          performedBy: userId,
          timestamp
        };
      });

      return result;
    } catch (error) {
      console.error('Bulk product delete failed:', error);
      return {
        success: false,
        deletedCount: 0,
        affectedProducts: [],
        errors: [`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        operationId,
        performedBy: userId,
        timestamp
      };
    }
  }

  /**
   * Bulk update prices
   */
  async bulkUpdatePrices(
    updates: PriceUpdate[], 
    userId: string
  ): Promise<UpdateResult> {
    const operationId = `upd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();
    const failedUpdates: { id: string; error: string }[] = [];
    let updatedCount = 0;

    try {
      const result = await prisma.$transaction(async (tx) => {
        for (const update of updates) {
          try {
            // Get current price data
            const currentPrice = await tx.price.findUnique({
              where: { id: update.id }
            });

            if (!currentPrice) {
              failedUpdates.push({
                id: update.id,
                error: 'Price not found'
              });
              continue;
            }

            // Prepare update data
            const updateData: any = {};
            if (update.price !== undefined) updateData.amount = new Decimal(update.price);
            if (update.unit !== undefined) updateData.unit = update.unit;
            if (update.unitPrice !== undefined) updateData.unitPrice = new Decimal(update.unitPrice);

            // Update the price
            const updatedPrice = await tx.price.update({
              where: { id: update.id },
              data: updateData
            });

            // Record the change in history if price changed
            if (update.price !== undefined && update.price !== parseFloat(currentPrice.amount.toString())) {
              await priceHistoryService.recordPriceChange({
                productId: updatedPrice.productId,
                supplierId: updatedPrice.supplierId,
                price: update.price,
                unit: updatedPrice.unit,
                unitPrice: update.unitPrice,
                changeReason: 'manual',
                changedBy: userId,
                notes: update.notes || 'Bulk price update'
              });
            }

            updatedCount++;
          } catch (error) {
            failedUpdates.push({
              id: update.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        return {
          success: failedUpdates.length < updates.length,
          updatedCount,
          failedUpdates,
          operationId,
          performedBy: userId,
          timestamp
        };
      });

      return result;
    } catch (error) {
      console.error('Bulk price update failed:', error);
      return {
        success: false,
        updatedCount: 0,
        failedUpdates: updates.map(u => ({
          id: u.id,
          error: `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        })),
        operationId,
        performedBy: userId,
        timestamp
      };
    }
  }

  /**
   * Bulk update products
   */
  async bulkUpdateProducts(
    updates: ProductUpdate[], 
    userId: string
  ): Promise<UpdateResult> {
    const operationId = `upd_prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();
    const failedUpdates: { id: string; error: string }[] = [];
    let updatedCount = 0;

    try {
      const result = await prisma.$transaction(async (tx) => {
        for (const update of updates) {
          try {
            // Prepare update data
            const updateData: any = {};
            if (update.name !== undefined) updateData.name = update.name;
            if (update.standardizedName !== undefined) updateData.standardizedName = update.standardizedName;
            if (update.category !== undefined) updateData.category = update.category;
            if (update.unit !== undefined) updateData.unit = update.unit;
            if (update.standardizedUnit !== undefined) updateData.standardizedUnit = update.standardizedUnit;
            if (update.description !== undefined) updateData.description = update.description;

            // Update the product
            await tx.product.update({
              where: { id: update.id },
              data: updateData
            });

            updatedCount++;
          } catch (error) {
            failedUpdates.push({
              id: update.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        return {
          success: failedUpdates.length < updates.length,
          updatedCount,
          failedUpdates,
          operationId,
          performedBy: userId,
          timestamp
        };
      });

      return result;
    } catch (error) {
      console.error('Bulk product update failed:', error);
      return {
        success: false,
        updatedCount: 0,
        failedUpdates: updates.map(u => ({
          id: u.id,
          error: `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        })),
        operationId,
        performedBy: userId,
        timestamp
      };
    }
  }

  /**
   * Bulk update suppliers
   */
  async bulkUpdateSuppliers(
    updates: SupplierUpdate[], 
    userId: string
  ): Promise<UpdateResult> {
    const operationId = `upd_sup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();
    const failedUpdates: { id: string; error: string }[] = [];
    let updatedCount = 0;

    try {
      const result = await prisma.$transaction(async (tx) => {
        for (const update of updates) {
          try {
            // Prepare update data
            const updateData: any = {};
            if (update.name !== undefined) updateData.name = update.name;
            if (update.email !== undefined) updateData.email = update.email;
            if (update.phone !== undefined) updateData.phone = update.phone;
            if (update.address !== undefined) updateData.address = update.address;
            if (update.contactInfo !== undefined) updateData.contactInfo = update.contactInfo;

            // Update the supplier
            await tx.supplier.update({
              where: { id: update.id },
              data: updateData
            });

            updatedCount++;
          } catch (error) {
            failedUpdates.push({
              id: update.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        return {
          success: failedUpdates.length < updates.length,
          updatedCount,
          failedUpdates,
          operationId,
          performedBy: userId,
          timestamp
        };
      });

      return result;
    } catch (error) {
      console.error('Bulk supplier update failed:', error);
      return {
        success: false,
        updatedCount: 0,
        failedUpdates: updates.map(u => ({
          id: u.id,
          error: `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        })),
        operationId,
        performedBy: userId,
        timestamp
      };
    }
  }

  /**
   * Get operation statistics
   */
  async getOperationStats(timeframe: '24h' | '7d' | '30d' = '24h'): Promise<{
    totalOperations: number;
    deletions: number;
    updates: number;
    mostActiveUsers: { userId: string; operations: number }[];
    recentOperations: {
      operationId: string;
      type: string;
      count: number;
      performedBy: string;
      timestamp: Date;
    }[];
  }> {
    // This would typically be stored in a separate operations log table
    // For now, we'll return a placeholder structure
    return {
      totalOperations: 0,
      deletions: 0,
      updates: 0,
      mostActiveUsers: [],
      recentOperations: []
    };
  }
}

// Export singleton instance
export const bulkOperationsService = new BulkOperationsService();