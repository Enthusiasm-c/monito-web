/**
 * Price analytics service for tracking price history and market analysis
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PricePoint {
  date: Date;
  price: number;
  supplierId: string;
  supplierName: string;
}

interface ProductPriceAnalytics {
  productId: string;
  productName: string;
  standardizedName: string;
  category: string;
  currentPrices: {
    supplierId: string;
    supplierName: string;
    price: number;
    lastUpdated: Date;
  }[];
  priceHistory: PricePoint[];
  averagePriceHistory: {
    date: Date;
    averagePrice: number;
    supplierCount: number;
    minPrice: number;
    maxPrice: number;
    priceSpread: number;
  }[];
  statistics: {
    currentAveragePrice: number;
    currentMinPrice: number;
    currentMaxPrice: number;
    priceSpread: number;
    supplierCount: number;
    totalPriceChanges: number;
    lastPriceChange: Date | null;
  };
}

interface MarketAnalytics {
  productId: string;
  productName: string;
  marketPosition: 'cheapest' | 'expensive' | 'average';
  priceCompetitiveness: number; // Percentage difference from market average
  suppliers: {
    supplierId: string;
    supplierName: string;
    price: number;
    marketShare: number; // Based on frequency of being cheapest
    priceRanking: number; // 1 = cheapest, etc.
  }[];
}

class PriceAnalyticsService {
  /**
   * Get comprehensive price analytics for a product
   */
  async getProductPriceAnalytics(productId: string): Promise<{
    success: boolean;
    data?: ProductPriceAnalytics;
    error?: string;
  }> {
    try {
      // Get product info
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          standardizedName: true,
          category: true
        }
      });

      if (!product) {
        return {
          success: false,
          error: 'Product not found'
        };
      }

      // Get current active prices
      const currentPrices = await prisma.price.findMany({
        where: {
          productId: productId,
          validTo: null
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          amount: 'asc'
        }
      });

      // Get price history for last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const priceHistory = await prisma.priceHistory.findMany({
        where: { 
          productId,
          createdAt: {
            gte: sixMonthsAgo
          }
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Transform current prices
      const currentPricesData = currentPrices.map(price => ({
        supplierId: price.supplierId,
        supplierName: price.supplier.name,
        price: parseFloat(price.amount.toString()),
        lastUpdated: price.updatedAt
      }));

      // Transform price history
      const priceHistoryData: PricePoint[] = priceHistory.map(history => ({
        date: history.createdAt,
        price: parseFloat(history.price.toString()),
        supplierId: history.supplierId,
        supplierName: history.supplier.name
      }));

      // Calculate average price history by grouping by date
      const averagePriceHistory = this.calculateAveragePriceHistory(priceHistoryData, currentPricesData);

      // Calculate statistics
      const prices = currentPricesData.map(p => p.price);
      const statistics = {
        currentAveragePrice: prices.length > 0 ? prices.reduce((sum, p) => sum + p, 0) / prices.length : 0,
        currentMinPrice: prices.length > 0 ? Math.min(...prices) : 0,
        currentMaxPrice: prices.length > 0 ? Math.max(...prices) : 0,
        priceSpread: prices.length > 0 ? Math.max(...prices) - Math.min(...prices) : 0,
        supplierCount: currentPricesData.length,
        totalPriceChanges: priceHistory.length,
        lastPriceChange: priceHistory.length > 0 ? priceHistory[0].createdAt : null
      };

      const analytics: ProductPriceAnalytics = {
        productId: product.id,
        productName: product.name,
        standardizedName: product.standardizedName,
        category: product.category || 'Other',
        currentPrices: currentPricesData,
        priceHistory: priceHistoryData,
        averagePriceHistory,
        statistics
      };

      return {
        success: true,
        data: analytics
      };

    } catch (error) {
      console.error('Error getting product price analytics:', error);
      return {
        success: false,
        error: `Failed to get price analytics: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get market analytics - compare prices across suppliers for same products
   */
  async getMarketAnalytics(limit: number = 50): Promise<{
    success: boolean;
    data?: MarketAnalytics[];
    error?: string;
  }> {
    try {
      // Get products that have multiple suppliers
      const productsWithMultipleSuppliers = await prisma.product.findMany({
        where: {
          prices: {
            some: {
              validTo: null
            }
          }
        },
        include: {
          prices: {
            where: {
              validTo: null
            },
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
        take: limit
      });

      // Filter to only products with multiple suppliers
      const multiSupplierProducts = productsWithMultipleSuppliers.filter(
        product => product.prices.length > 1
      );

      const marketAnalytics: MarketAnalytics[] = [];

      for (const product of multiSupplierProducts) {
        const prices = product.prices.map(price => ({
          supplierId: price.supplierId,
          supplierName: price.supplier.name,
          price: parseFloat(price.amount.toString())
        })).sort((a, b) => a.price - b.price);

        const averagePrice = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
        const minPrice = prices[0].price;
        const maxPrice = prices[prices.length - 1].price;

        // Calculate market share and competitiveness
        const suppliers = prices.map((priceData, index) => {
          const priceCompetitiveness = ((priceData.price - averagePrice) / averagePrice) * 100;
          
          return {
            supplierId: priceData.supplierId,
            supplierName: priceData.supplierName,
            price: priceData.price,
            marketShare: this.calculateMarketShare(priceData.price, minPrice, maxPrice),
            priceRanking: index + 1
          };
        });

        // Determine overall market position based on average
        let marketPosition: 'cheapest' | 'expensive' | 'average';
        const avgCompetitiveness = suppliers.reduce((sum, s) => sum + 
          ((s.price - averagePrice) / averagePrice) * 100, 0) / suppliers.length;
        
        if (avgCompetitiveness < -10) marketPosition = 'cheapest';
        else if (avgCompetitiveness > 10) marketPosition = 'expensive';
        else marketPosition = 'average';

        marketAnalytics.push({
          productId: product.id,
          productName: product.name,
          marketPosition,
          priceCompetitiveness: avgCompetitiveness,
          suppliers
        });
      }

      return {
        success: true,
        data: marketAnalytics
      };

    } catch (error) {
      console.error('Error getting market analytics:', error);
      return {
        success: false,
        error: `Failed to get market analytics: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get price comparison for specific product across suppliers
   */
  async getProductPriceComparison(productId: string): Promise<{
    success: boolean;
    data?: {
      productName: string;
      suppliers: {
        supplierId: string;
        supplierName: string;
        currentPrice: number;
        priceHistory: { date: Date; price: number }[];
        priceChange30Days: number;
        isLowest: boolean;
        isHighest: boolean;
      }[];
      marketStats: {
        averagePrice: number;
        priceSpread: number;
        supplierCount: number;
        lowestPrice: number;
        highestPrice: number;
      };
    };
    error?: string;
  }> {
    try {
      const result = await this.getProductPriceAnalytics(productId);
      
      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to get product analytics'
        };
      }

      const analytics = result.data;
      const prices = analytics.currentPrices.map(p => p.price);
      const lowestPrice = Math.min(...prices);
      const highestPrice = Math.max(...prices);

      // Get 30-day price history for each supplier
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const suppliers = await Promise.all(
        analytics.currentPrices.map(async (currentPrice) => {
          // Get price history for this supplier
          const supplierHistory = await prisma.priceHistory.findMany({
            where: {
              productId,
              supplierId: currentPrice.supplierId,
              changedAt: {
                gte: thirtyDaysAgo
              }
            },
            orderBy: {
              changedAt: 'asc'
            }
          });

          const priceHistory = supplierHistory.map(h => ({
            date: h.changedAt,
            price: h.changedTo
          }));

          // Calculate 30-day price change
          const oldestPrice = supplierHistory.length > 0 ? supplierHistory[0].changedTo : currentPrice.price;
          const priceChange30Days = ((currentPrice.price - oldestPrice) / oldestPrice) * 100;

          return {
            supplierId: currentPrice.supplierId,
            supplierName: currentPrice.supplierName,
            currentPrice: currentPrice.price,
            priceHistory,
            priceChange30Days,
            isLowest: currentPrice.price === lowestPrice,
            isHighest: currentPrice.price === highestPrice
          };
        })
      );

      return {
        success: true,
        data: {
          productName: analytics.productName,
          suppliers,
          marketStats: {
            averagePrice: analytics.statistics.currentAveragePrice,
            priceSpread: analytics.statistics.priceSpread,
            supplierCount: analytics.statistics.supplierCount,
            lowestPrice,
            highestPrice
          }
        }
      };

    } catch (error) {
      console.error('Error getting product price comparison:', error);
      return {
        success: false,
        error: `Failed to get price comparison: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Calculate average price history over time
   */
  private calculateAveragePriceHistory(
    priceHistory: PricePoint[], 
    currentPrices: any[]
  ): ProductPriceAnalytics['averagePriceHistory'] {
    // Group price changes by date (day)
    const dailyPrices = new Map<string, PricePoint[]>();

    priceHistory.forEach(point => {
      const dateKey = point.date.toISOString().split('T')[0];
      if (!dailyPrices.has(dateKey)) {
        dailyPrices.set(dateKey, []);
      }
      dailyPrices.get(dateKey)!.push(point);
    });

    // Add current prices as today's data
    const today = new Date().toISOString().split('T')[0];
    if (!dailyPrices.has(today) && currentPrices.length > 0) {
      dailyPrices.set(today, currentPrices.map(cp => ({
        date: new Date(),
        price: cp.price,
        supplierId: cp.supplierId,
        supplierName: cp.supplierName
      })));
    }

    // Calculate daily averages
    const averageHistory: ProductPriceAnalytics['averagePriceHistory'] = [];

    for (const [dateStr, prices] of dailyPrices.entries()) {
      const priceValues = prices.map(p => p.price);
      const averagePrice = priceValues.reduce((sum, p) => sum + p, 0) / priceValues.length;
      const minPrice = Math.min(...priceValues);
      const maxPrice = Math.max(...priceValues);

      averageHistory.push({
        date: new Date(dateStr),
        averagePrice: Math.round(averagePrice * 100) / 100,
        supplierCount: prices.length,
        minPrice,
        maxPrice,
        priceSpread: maxPrice - minPrice
      });
    }

    // Sort by date
    return averageHistory.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Calculate market share based on price competitiveness
   */
  private calculateMarketShare(price: number, minPrice: number, maxPrice: number): number {
    if (maxPrice === minPrice) return 100; // Only one supplier
    
    // Higher market share for lower prices
    const pricePosition = (maxPrice - price) / (maxPrice - minPrice);
    return Math.round(pricePosition * 100);
  }
}

export const priceAnalyticsService = new PriceAnalyticsService();