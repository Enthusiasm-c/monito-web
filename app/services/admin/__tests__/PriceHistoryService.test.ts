/**
 * Unit tests for PriceHistoryService
 */

// Mock Prisma before importing service
jest.mock('@prisma/client');

import { priceHistoryService } from '../PriceHistoryService';
import { PrismaClient } from '@prisma/client';

const mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;

// Mock console.error to avoid noise in test output
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('PriceHistoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleError.mockRestore();
  });

  describe('recordPriceChange', () => {
    it('should record a price change successfully', async () => {
      const mockPriceHistory = {
        id: 'history-1',
        priceId: 'price-1',
        productId: 'product-1',
        supplierId: 'supplier-1',
        changedFrom: 1000,
        changedTo: 1200,
        changePercentage: 20,
        changeReason: 'Market adjustment',
        changedAt: new Date(),
        changedById: 'user-1'
      };

      (mockPrisma.priceHistory.create as jest.Mock).mockResolvedValue(mockPriceHistory);

      const result = await priceHistoryService.recordPriceChange({
        priceId: 'price-1',
        productId: 'product-1',
        supplierId: 'supplier-1',
        changedFrom: 1000,
        changedTo: 1200,
        changeReason: 'Market adjustment',
        changedById: 'user-1'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPriceHistory);
      expect(mockPrisma.priceHistory.create).toHaveBeenCalledWith({
        data: {
          priceId: 'price-1',
          productId: 'product-1',
          supplierId: 'supplier-1',
          changedFrom: 1000,
          changedTo: 1200,
          changePercentage: 20,
          changeReason: 'Market adjustment',
          changedById: 'user-1'
        }
      });
    });

    it('should calculate negative percentage for price decrease', async () => {
      const mockPriceHistory = {
        id: 'history-1',
        priceId: 'price-1',
        productId: 'product-1',
        supplierId: 'supplier-1',
        changedFrom: 1200,
        changedTo: 1000,
        changePercentage: -16.67,
        changeReason: 'Price reduction',
        changedAt: new Date(),
        changedById: 'user-1'
      };

      (mockPrisma.priceHistory.create as jest.Mock).mockResolvedValue(mockPriceHistory);

      const result = await priceHistoryService.recordPriceChange({
        priceId: 'price-1',
        productId: 'product-1',
        supplierId: 'supplier-1',
        changedFrom: 1200,
        changedTo: 1000,
        changeReason: 'Price reduction',
        changedById: 'user-1'
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.priceHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          changePercentage: -16.67
        })
      });
    });

    it('should handle database errors gracefully', async () => {
      (mockPrisma.priceHistory.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await priceHistoryService.recordPriceChange({
        priceId: 'price-1',
        productId: 'product-1',
        supplierId: 'supplier-1',
        changedFrom: 1000,
        changedTo: 1200,
        changeReason: 'Test',
        changedById: 'user-1'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to record price change');
    });
  });

  describe('getProductHistory', () => {
    it('should fetch product price history with pagination', async () => {
      const mockHistory = [
        {
          id: 'history-1',
          changedFrom: 1000,
          changedTo: 1200,
          changePercentage: 20,
          changedAt: new Date('2024-01-01'),
          changeReason: 'Market adjustment'
        }
      ];

      (mockPrisma.priceHistory.findMany as jest.Mock).mockResolvedValue(mockHistory);
      (mockPrisma.priceHistory.count as jest.Mock).mockResolvedValue(1);

      const result = await priceHistoryService.getProductHistory('product-1', 1, 10);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        history: mockHistory,
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1
        }
      });
    });

    it('should handle empty history', async () => {
      (mockPrisma.priceHistory.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.priceHistory.count as jest.Mock).mockResolvedValue(0);

      const result = await priceHistoryService.getProductHistory('product-1', 1, 10);

      expect(result.success).toBe(true);
      expect(result.data?.history).toEqual([]);
      expect(result.data?.pagination.total).toBe(0);
    });
  });

  describe('getPriceTrends', () => {
    it('should calculate price trends correctly', async () => {
      const mockHistory = [
        { changedTo: 1200, changedAt: new Date('2024-01-03') },
        { changedTo: 1100, changedAt: new Date('2024-01-02') },
        { changedTo: 1000, changedAt: new Date('2024-01-01') }
      ];

      (mockPrisma.priceHistory.findMany as jest.Mock).mockResolvedValue(mockHistory);

      const result = await priceHistoryService.getPriceTrends('product-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        trend: 'increasing',
        currentPrice: 1200,
        averagePrice: 1100,
        minPrice: 1000,
        maxPrice: 1200,
        volatility: expect.any(Number),
        totalChanges: 3
      });
    });

    it('should handle decreasing trend', async () => {
      const mockHistory = [
        { changedTo: 800, changedAt: new Date('2024-01-03') },
        { changedTo: 900, changedAt: new Date('2024-01-02') },
        { changedTo: 1000, changedAt: new Date('2024-01-01') }
      ];

      (mockPrisma.priceHistory.findMany as jest.Mock).mockResolvedValue(mockHistory);

      const result = await priceHistoryService.getPriceTrends('product-1');

      expect(result.success).toBe(true);
      expect(result.data?.trend).toBe('decreasing');
    });

    it('should handle stable trend', async () => {
      const mockHistory = [
        { changedTo: 1000, changedAt: new Date('2024-01-03') },
        { changedTo: 1000, changedAt: new Date('2024-01-02') },
        { changedTo: 1000, changedAt: new Date('2024-01-01') }
      ];

      (mockPrisma.priceHistory.findMany as jest.Mock).mockResolvedValue(mockHistory);

      const result = await priceHistoryService.getPriceTrends('product-1');

      expect(result.success).toBe(true);
      expect(result.data?.trend).toBe('stable');
    });
  });

  describe('getSupplierPriceChanges', () => {
    it('should fetch supplier price changes with date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const mockChanges = [
        {
          id: 'history-1',
          product: { name: 'Product 1' },
          changedFrom: 1000,
          changedTo: 1200,
          changePercentage: 20,
          changedAt: new Date('2024-01-15')
        }
      ];

      (mockPrisma.priceHistory.findMany as jest.Mock).mockResolvedValue(mockChanges);

      const result = await priceHistoryService.getSupplierPriceChanges(
        'supplier-1',
        startDate,
        endDate
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockChanges);
      expect(mockPrisma.priceHistory.findMany).toHaveBeenCalledWith({
        where: {
          supplierId: 'supplier-1',
          changedAt: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          product: {
            select: {
              name: true,
              standardizedName: true,
              category: true
            }
          }
        },
        orderBy: {
          changedAt: 'desc'
        }
      });
    });
  });
});