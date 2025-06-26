/**
 * Price History Service
 * Manages price change tracking and history operations
 */

import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

export interface PriceChangeData {
  productId: string;
  supplierId: string;
  price: number;
  unit: string;
  unitPrice?: number;
  quantity?: number;
  changeReason: 'upload' | 'manual' | 'api' | 'initial';
  changedBy?: string;
  uploadId?: string;
  notes?: string;
}

export interface HistoryOptions {
  limit?: number;
  dateFrom?: Date;
  dateTo?: Date;
  includeSupplierInfo?: boolean;
}

export interface PriceHistoryEntry {
  id: string;
  price: Decimal;
  unit: string;
  unitPrice?: Decimal;
  quantity?: Decimal;
  changedFrom?: Decimal;
  changePercentage?: number;
  changeReason: string;
  changedBy?: string;
  notes?: string;
  createdAt: Date;
  supplier?: {
    id: string;
    name: string;
  };
  upload?: {
    id: string;
    originalName: string;
  };
}

export interface TrendData {
  productId: string;
  supplierId: string;
  period: string;
  dataPoints: {
    date: Date;
    price: number;
    unitPrice?: number;
    changePercentage?: number;
  }[];
  summary: {
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
    totalChanges: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    volatility: number; // Standard deviation
  };
}

export interface ChangeReport {
  supplierId: string;
  period: {
    from: Date;
    to: Date;
  };
  totalChanges: number;
  priceIncreases: number;
  priceDecreases: number;
  averageChangePercentage: number;
  mostVolatileProducts: {
    productId: string;
    productName: string;
    changes: number;
    volatility: number;
  }[];
  recentChanges: PriceHistoryEntry[];
}

export class PriceHistoryService {
  /**
   * Record a price change in history
   */
  async recordPriceChange(data: PriceChangeData): Promise<PriceHistoryEntry> {
    try {
      // Get the previous price for this product/supplier combination
      const previousPrice = await this.getLatestPrice(data.productId, data.supplierId);
      
      // Calculate change percentage if there's a previous price
      let changePercentage: number | undefined;
      if (previousPrice && previousPrice !== data.price) {
        changePercentage = ((data.price - previousPrice) / previousPrice) * 100;
      }

      const historyEntry = await prisma.priceHistory.create({
        data: {
          productId: data.productId,
          supplierId: data.supplierId,
          price: new Decimal(data.price),
          unit: data.unit,
          unitPrice: data.unitPrice ? new Decimal(data.unitPrice) : undefined,
          quantity: data.quantity ? new Decimal(data.quantity) : undefined,
          changedFrom: previousPrice ? new Decimal(previousPrice) : undefined,
          changePercentage,
          changeReason: data.changeReason,
          changedBy: data.changedBy,
          uploadId: data.uploadId,
          notes: data.notes,
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true
            }
          },
          upload: {
            select: {
              id: true,
              originalName: true
            }
          }
        }
      });

      return historyEntry as PriceHistoryEntry;
    } catch (error) {
      console.error('Error recording price change:', error);
      throw new Error(`Failed to record price change: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get price history for a specific product
   */
  async getProductHistory(
    productId: string, 
    options: HistoryOptions = {}
  ): Promise<PriceHistoryEntry[]> {
    try {
      const { limit = 50, dateFrom, dateTo, includeSupplierInfo = true } = options;

      const whereClause: any = {
        productId
      };

      if (dateFrom || dateTo) {
        whereClause.createdAt = {};
        if (dateFrom) whereClause.createdAt.gte = dateFrom;
        if (dateTo) whereClause.createdAt.lte = dateTo;
      }

      const history = await prisma.priceHistory.findMany({
        where: whereClause,
        include: includeSupplierInfo ? {
          supplier: {
            select: {
              id: true,
              name: true
            }
          },
          upload: {
            select: {
              id: true,
              originalName: true
            }
          }
        } : undefined,
        orderBy: {
          createdAt: 'desc'
        },
        take: limit
      });

      return history as PriceHistoryEntry[];
    } catch (error) {
      console.error('Error fetching product history:', error);
      throw new Error(`Failed to fetch product history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get price trends for a specific product and supplier
   */
  async getPriceTrends(
    productId: string, 
    supplierId?: string,
    period: '7d' | '30d' | '90d' | '1y' = '30d'
  ): Promise<TrendData> {
    try {
      const periodDays = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365
      }[period];

      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - periodDays);

      const whereClause: any = {
        productId,
        createdAt: {
          gte: dateFrom
        }
      };

      if (supplierId) {
        whereClause.supplierId = supplierId;
      }

      const history = await prisma.priceHistory.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'asc'
        },
        select: {
          createdAt: true,
          price: true,
          unitPrice: true,
          changePercentage: true,
          supplierId: true
        }
      });

      if (history.length === 0) {
        throw new Error('No price history found for the specified period');
      }

      // Convert to data points
      const dataPoints = history.map(entry => ({
        date: entry.createdAt,
        price: parseFloat(entry.price.toString()),
        unitPrice: entry.unitPrice ? parseFloat(entry.unitPrice.toString()) : undefined,
        changePercentage: entry.changePercentage || undefined
      }));

      // Calculate summary statistics
      const prices = dataPoints.map(dp => dp.price);
      const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      // Calculate volatility (standard deviation)
      const variance = prices.reduce((sum, price) => sum + Math.pow(price - averagePrice, 2), 0) / prices.length;
      const volatility = Math.sqrt(variance);

      // Determine trend
      const firstPrice = prices[0];
      const lastPrice = prices[prices.length - 1];
      const overallChange = ((lastPrice - firstPrice) / firstPrice) * 100;
      
      let trend: 'increasing' | 'decreasing' | 'stable';
      if (Math.abs(overallChange) < 5) {
        trend = 'stable';
      } else if (overallChange > 0) {
        trend = 'increasing';
      } else {
        trend = 'decreasing';
      }

      return {
        productId,
        supplierId: supplierId || 'all',
        period,
        dataPoints,
        summary: {
          averagePrice,
          minPrice,
          maxPrice,
          totalChanges: history.length,
          trend,
          volatility: parseFloat(volatility.toFixed(2))
        }
      };
    } catch (error) {
      console.error('Error calculating price trends:', error);
      throw new Error(`Failed to calculate price trends: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get supplier price change report
   */
  async getSupplierPriceChanges(
    supplierId: string,
    period: '7d' | '30d' | '90d' = '30d'
  ): Promise<ChangeReport> {
    try {
      const periodDays = {
        '7d': 7,
        '30d': 30,
        '90d': 90
      }[period];

      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - periodDays);
      const dateTo = new Date();

      const changes = await prisma.priceHistory.findMany({
        where: {
          supplierId,
          createdAt: {
            gte: dateFrom,
            lte: dateTo
          },
          changePercentage: {
            not: null
          }
        },
        include: {
          product: {
            select: {
              id: true,
              name: true
            }
          },
          supplier: {
            select: {
              id: true,
              name: true
            }
          },
          upload: {
            select: {
              id: true,
              originalName: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const totalChanges = changes.length;
      const priceIncreases = changes.filter(c => (c.changePercentage || 0) > 0).length;
      const priceDecreases = changes.filter(c => (c.changePercentage || 0) < 0).length;
      
      const averageChangePercentage = totalChanges > 0 
        ? changes.reduce((sum, c) => sum + (c.changePercentage || 0), 0) / totalChanges
        : 0;

      // Calculate most volatile products
      const productVolatility = new Map<string, { name: string; changes: number; percentages: number[] }>();
      
      changes.forEach(change => {
        if (!change.product) return;
        
        const key = change.product.id;
        if (!productVolatility.has(key)) {
          productVolatility.set(key, {
            name: change.product.name,
            changes: 0,
            percentages: []
          });
        }
        
        const data = productVolatility.get(key)!;
        data.changes += 1;
        if (change.changePercentage) {
          data.percentages.push(change.changePercentage);
        }
      });

      const mostVolatileProducts = Array.from(productVolatility.entries())
        .map(([productId, data]) => ({
          productId,
          productName: data.name,
          changes: data.changes,
          volatility: data.percentages.length > 0 
            ? Math.sqrt(data.percentages.reduce((sum, p) => sum + p * p, 0) / data.percentages.length)
            : 0
        }))
        .sort((a, b) => b.volatility - a.volatility)
        .slice(0, 10);

      return {
        supplierId,
        period: { from: dateFrom, to: dateTo },
        totalChanges,
        priceIncreases,
        priceDecreases,
        averageChangePercentage: parseFloat(averageChangePercentage.toFixed(2)),
        mostVolatileProducts,
        recentChanges: changes.slice(0, 20) as PriceHistoryEntry[]
      };
    } catch (error) {
      console.error('Error generating supplier change report:', error);
      throw new Error(`Failed to generate supplier change report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get latest price for a product from a supplier
   */
  private async getLatestPrice(productId: string, supplierId: string): Promise<number | null> {
    try {
      const latestPrice = await prisma.price.findFirst({
        where: {
          productId,
          supplierId,
          validTo: null // Current active price
        },
        select: {
          amount: true
        }
      });

      return latestPrice ? parseFloat(latestPrice.amount.toString()) : null;
    } catch (error) {
      console.error('Error fetching latest price:', error);
      return null;
    }
  }

  /**
   * Migrate existing prices to history (one-time operation)
   */
  async migrateExistingPricesToHistory(): Promise<{ migrated: number; errors: number }> {
    try {
      console.log('Starting price history migration...');
      
      const prices = await prisma.price.findMany({
        include: {
          product: true,
          supplier: true,
          upload: true
        }
      });

      let migrated = 0;
      let errors = 0;

      for (const price of prices) {
        try {
          await this.recordPriceChange({
            productId: price.productId,
            supplierId: price.supplierId,
            price: parseFloat(price.amount.toString()),
            unit: price.unit,
            unitPrice: price.unitPrice ? parseFloat(price.unitPrice.toString()) : undefined,
            changeReason: 'initial',
            uploadId: price.uploadId || undefined,
            notes: 'Migrated from existing price data'
          });
          migrated++;
        } catch (error) {
          console.error(`Error migrating price ${price.id}:`, error);
          errors++;
        }
      }

      console.log(`Migration completed: ${migrated} migrated, ${errors} errors`);
      return { migrated, errors };
    } catch (error) {
      console.error('Error during migration:', error);
      throw new Error(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const priceHistoryService = new PriceHistoryService();