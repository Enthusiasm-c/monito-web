/**
 * Unit tests for BulkOperationsService
 */

import { bulkOperationsService } from '../BulkOperationsService';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
jest.mock('@prisma/client');
const mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;

// Mock console.error to avoid noise in test output
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('BulkOperationsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleError.mockRestore();
  });

  describe('deleteAllSupplierPrices', () => {
    it('should delete all supplier prices successfully', async () => {
      const mockPrices = [
        { id: 'price-1', productId: 'product-1', amount: 1000 },
        { id: 'price-2', productId: 'product-2', amount: 2000 }
      ];

      // Mock the transaction
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          price: {
            findMany: jest.fn().mockResolvedValue(mockPrices),
            deleteMany: jest.fn().mockResolvedValue({ count: 2 })
          },
          priceHistory: {
            deleteMany: jest.fn().mockResolvedValue({ count: 5 })
          }
        };
        return callback(mockTx);
      });

      const result = await bulkOperationsService.deleteAllSupplierPrices(
        'supplier-1',
        'user-1',
        'Testing bulk deletion'
      );

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
      expect(result.affectedProducts).toEqual(['product-1', 'product-2']);
      expect(result.operationId).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should handle case when no prices exist', async () => {
      // Mock the transaction
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          price: {
            findMany: jest.fn().mockResolvedValue([]),
            deleteMany: jest.fn().mockResolvedValue({ count: 0 })
          },
          priceHistory: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 })
          }
        };
        return callback(mockTx);
      });

      const result = await bulkOperationsService.deleteAllSupplierPrices(
        'supplier-1',
        'user-1'
      );

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
      expect(result.affectedProducts).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      (mockPrisma.$transaction as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await bulkOperationsService.deleteAllSupplierPrices(
        'supplier-1',
        'user-1'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['Failed to delete supplier prices: Database error']);
    });

    it('should validate required parameters', async () => {
      const result = await bulkOperationsService.deleteAllSupplierPrices(
        '',
        'user-1'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Supplier ID is required');
    });
  });

  describe('deleteSelectedProducts', () => {
    it('should delete selected products and their prices', async () => {
      const productIds = ['product-1', 'product-2'];
      const mockProducts = [
        { id: 'product-1', name: 'Product 1' },
        { id: 'product-2', name: 'Product 2' }
      ];

      // Mock the transaction
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          product: {
            findMany: jest.fn().mockResolvedValue(mockProducts),
            deleteMany: jest.fn().mockResolvedValue({ count: 2 })
          },
          price: {
            deleteMany: jest.fn().mockResolvedValue({ count: 5 })
          },
          priceHistory: {
            deleteMany: jest.fn().mockResolvedValue({ count: 10 })
          }
        };
        return callback(mockTx);
      });

      const result = await bulkOperationsService.deleteSelectedProducts(
        productIds,
        'user-1',
        'Cleaning up old products'
      );

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
      expect(result.affectedProducts).toEqual(productIds);
    });

    it('should handle empty product list', async () => {
      const result = await bulkOperationsService.deleteSelectedProducts(
        [],
        'user-1'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('At least one product ID is required');
    });

    it('should handle invalid product IDs', async () => {
      const productIds = ['invalid-id'];

      // Mock the transaction
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          product: {
            findMany: jest.fn().mockResolvedValue([]),
            deleteMany: jest.fn().mockResolvedValue({ count: 0 })
          },
          price: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 })
          },
          priceHistory: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 })
          }
        };
        return callback(mockTx);
      });

      const result = await bulkOperationsService.deleteSelectedProducts(
        productIds,
        'user-1'
      );

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
    });
  });

  describe('updatePricesInBulk', () => {
    it('should update prices in bulk successfully', async () => {
      const updates = [
        { id: 'price-1', field: 'amount', value: 1500 },
        { id: 'price-2', field: 'unit', value: 'kg' }
      ];

      const mockPrices = [
        { id: 'price-1', amount: 1000, productId: 'product-1', supplierId: 'supplier-1' },
        { id: 'price-2', unit: 'pieces', productId: 'product-2', supplierId: 'supplier-2' }
      ];

      // Mock the transaction
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          price: {
            findMany: jest.fn().mockResolvedValue(mockPrices),
            update: jest.fn().mockResolvedValue({})
          },
          priceHistory: {
            create: jest.fn().mockResolvedValue({})
          }
        };
        return callback(mockTx);
      });

      const result = await bulkOperationsService.updatePricesInBulk(
        updates,
        'user-1'
      );

      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(2);
      expect(result.operationId).toBeDefined();
    });

    it('should validate update data', async () => {
      const invalidUpdates = [
        { id: '', field: 'amount', value: 1500 }
      ];

      const result = await bulkOperationsService.updatePricesInBulk(
        invalidUpdates,
        'user-1'
      );

      expect(result.success).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should handle database errors during bulk update', async () => {
      const updates = [
        { id: 'price-1', field: 'amount', value: 1500 }
      ];

      (mockPrisma.$transaction as jest.Mock).mockRejectedValue(new Error('Update failed'));

      const result = await bulkOperationsService.updatePricesInBulk(
        updates,
        'user-1'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Failed to update prices in bulk: Update failed');
    });
  });

  describe('generateOperationId', () => {
    it('should generate unique operation IDs', () => {
      const id1 = bulkOperationsService.generateOperationId();
      const id2 = bulkOperationsService.generateOperationId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^bulk_\d{13}_[a-f0-9]{8}$/);
      expect(id2).toMatch(/^bulk_\d{13}_[a-f0-9]{8}$/);
    });
  });
});