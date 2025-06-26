/**
 * Prisma Middleware for automatic price history tracking
 */

import { PrismaClient } from '@prisma/client';
import { priceHistoryService } from '@/app/services/admin/PriceHistoryService';

export function addPriceHistoryMiddleware(prisma: PrismaClient) {
  prisma.$use(async (params, next) => {
    // Only handle Price model operations
    if (params.model !== 'Price') {
      return next(params);
    }

    // Handle CREATE operations
    if (params.action === 'create') {
      const result = await next(params);
      
      try {
        // Record new price in history
        await priceHistoryService.recordPriceChange({
          productId: result.productId,
          supplierId: result.supplierId,
          price: parseFloat(result.amount.toString()),
          unit: result.unit,
          unitPrice: result.unitPrice ? parseFloat(result.unitPrice.toString()) : undefined,
          changeReason: 'api',
          uploadId: result.uploadId || undefined,
          notes: 'New price created via API'
        });
      } catch (error) {
        console.error('Failed to record price history for new price:', error);
        // Don't fail the main operation if history recording fails
      }
      
      return result;
    }

    // Handle UPDATE operations
    if (params.action === 'update') {
      // Get the current price before update
      const currentPrice = await prisma.price.findUnique({
        where: params.args.where,
        select: {
          id: true,
          productId: true,
          supplierId: true,
          amount: true,
          unit: true,
          unitPrice: true
        }
      });

      const result = await next(params);

      // Only record history if price actually changed
      if (currentPrice && params.args.data.amount !== undefined) {
        const newAmount = parseFloat(result.amount.toString());
        const oldAmount = parseFloat(currentPrice.amount.toString());

        if (newAmount !== oldAmount) {
          try {
            await priceHistoryService.recordPriceChange({
              productId: result.productId,
              supplierId: result.supplierId,
              price: newAmount,
              unit: result.unit,
              unitPrice: result.unitPrice ? parseFloat(result.unitPrice.toString()) : undefined,
              changeReason: 'api',
              notes: 'Price updated via API'
            });
          } catch (error) {
            console.error('Failed to record price history for updated price:', error);
            // Don't fail the main operation if history recording fails
          }
        }
      }

      return result;
    }

    // Handle CREATEMANY operations
    if (params.action === 'createMany') {
      const result = await next(params);
      
      // For bulk creates, we'll record history in the upload process
      // This middleware handles individual API calls
      
      return result;
    }

    // For all other operations, just proceed
    return next(params);
  });
}

export function addBulkOperationLogging(prisma: PrismaClient) {
  prisma.$use(async (params, next) => {
    const startTime = Date.now();
    
    try {
      const result = await next(params);
      const duration = Date.now() - startTime;
      
      // Log slow operations (>1 second)
      if (duration > 1000) {
        console.warn(`Slow Prisma operation: ${params.model}.${params.action} took ${duration}ms`);
      }
      
      // Log bulk operations
      if (params.action === 'deleteMany' || params.action === 'updateMany' || params.action === 'createMany') {
        console.log(`Bulk operation: ${params.model}.${params.action} completed in ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Prisma operation failed: ${params.model}.${params.action} after ${duration}ms`, error);
      throw error;
    }
  });
}