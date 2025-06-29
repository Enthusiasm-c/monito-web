/**
 * Database Service Layer
 * Standardizes database access patterns and eliminates direct Prisma usage in API routes
 */

import { prisma } from '../../lib/prisma';
import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError, DatabaseError } from '../utils/errors';

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface SearchParams {
  search?: string;
  category?: string;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
}

export class DatabaseService {
  private static instance: DatabaseService;

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Supplier operations
   */
  async getSuppliers(pagination?: PaginationParams) {
    try {
      const query: any = {
        include: {
          _count: {
            select: {
              prices: true,
              uploads: true
            }
          }
        },
        orderBy: {
          name: 'asc'
        }
      };

      if (pagination) {
        query.skip = pagination.offset;
        query.take = pagination.limit;
      }

      const [suppliers, total] = await Promise.all([
        prisma.supplier.findMany(query),
        pagination ? prisma.supplier.count() : Promise.resolve(0)
      ]);

      return pagination ? { suppliers, total } : { suppliers };
    } catch (error) {
      throw new DatabaseError('Failed to fetch suppliers', error);
    }
  }

  async createSupplier(data: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    contactInfo?: any;
  }) {
    try {
      return await prisma.supplier.create({ data });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictError('Supplier with this name already exists');
      }
      throw new DatabaseError('Failed to create supplier', error);
    }
  }

  async getSupplierById(id: string) {
    try {
      const supplier = await prisma.supplier.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              prices: true,
              uploads: true
            }
          }
        }
      });

      if (!supplier) {
        throw new NotFoundError('Supplier', id);
      }

      return supplier;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to fetch supplier', error);
    }
  }

  async updateSupplier(id: string, data: Partial<{
    name: string;
    email: string;
    phone: string;
    address: string;
    contactInfo: any;
  }>) {
    try {
      return await prisma.supplier.update({
        where: { id },
        data
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundError('Supplier', id);
      }
      if (error.code === 'P2002') {
        throw new ConflictError('Supplier with this name already exists');
      }
      throw new DatabaseError('Failed to update supplier', error);
    }
  }

  async deleteSupplier(id: string) {
    try {
      return await prisma.supplier.delete({
        where: { id }
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundError('Supplier', id);
      }
      throw new DatabaseError('Failed to delete supplier', error);
    }
  }

  /**
   * Product operations
   */
  async getProducts(search: SearchParams, pagination: PaginationParams) {
    try {
      // Build where clause
      const where: any = {};
      
      if (search.category && search.category !== 'All Categories') {
        where.category = search.category;
      }
      
      if (search.search) {
        where.OR = [
          { name: { contains: search.search, mode: 'insensitive' } },
          { standardizedName: { contains: search.search, mode: 'insensitive' } },
          { category: { contains: search.search, mode: 'insensitive' } },
          { 
            prices: {
              some: {
                supplier: {
                  name: { contains: search.search, mode: 'insensitive' }
                }
              }
            }
          }
        ];
      }

      // Build orderBy
      let orderBy: any = { standardizedName: 'asc' };
      
      switch (search.sortBy) {
        case 'name':
          orderBy = { standardizedName: search.sortOrder };
          break;
        case 'category':
          orderBy = { category: search.sortOrder };
          break;
        case 'unit':
          orderBy = { unit: search.sortOrder };
          break;
      }

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            prices: {
              include: {
                supplier: true
              },
              where: {
                validTo: null // Only current prices
              },
              orderBy: {
                amount: 'asc'
              }
            }
          },
          skip: pagination.offset,
          take: pagination.limit,
          orderBy
        }),
        prisma.product.count({ where })
      ]);

      return { products, total };
    } catch (error) {
      throw new DatabaseError('Failed to fetch products', error);
    }
  }

  async createProduct(data: {
    name: string;
    standardizedName?: string;
    category?: string;
    unit: string;
    standardizedUnit?: string;
    description?: string;
  }) {
    try {
      const productData = {
        ...data,
        standardizedName: data.standardizedName || data.name.toLowerCase().trim(),
        category: data.category || 'Other',
        standardizedUnit: data.standardizedUnit || data.unit.toLowerCase()
      };

      return await prisma.product.create({ data: productData });
    } catch (error) {
      throw new DatabaseError('Failed to create product', error);
    }
  }

  async getProductById(id: string) {
    try {
      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          prices: {
            include: {
              supplier: true
            }
          }
        }
      });

      if (!product) {
        throw new NotFoundError('Product', id);
      }

      return product;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to fetch product', error);
    }
  }

  /**
   * Price operations
   */
  async getRelatedPrices(standardizedName: string, standardizedUnit: string) {
    try {
      return await prisma.price.findMany({
        where: {
          product: {
            standardizedName,
            standardizedUnit
          },
          validTo: null
        },
        include: {
          supplier: true,
          product: {
            select: {
              rawName: true,
              name: true,
              id: true
            }
          }
        },
        orderBy: {
          amount: 'asc'
        }
      });
    } catch (error) {
      throw new DatabaseError('Failed to fetch related prices', error);
    }
  }

  /**
   * Upload operations
   */
  async createUpload(data: {
    fileName: string;
    fileUrl: string;
    fileSize: number;
    supplierId?: string;
    status: string;
    metadata?: any;
  }) {
    try {
      return await prisma.upload.create({ data });
    } catch (error) {
      throw new DatabaseError('Failed to create upload record', error);
    }
  }

  async updateUploadStatus(id: string, status: string, metadata?: any) {
    try {
      return await prisma.upload.update({
        where: { id },
        data: {
          status,
          metadata: metadata ? { ...metadata } : undefined,
          updatedAt: new Date()
        }
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundError('Upload', id);
      }
      throw new DatabaseError('Failed to update upload status', error);
    }
  }

  /**
   * Statistics and analytics
   */
  async getStats() {
    try {
      const [
        totalProducts,
        totalSuppliers,
        totalPrices,
        recentUploads
      ] = await Promise.all([
        prisma.product.count(),
        prisma.supplier.count(),
        prisma.price.count({ where: { validTo: null } }),
        prisma.upload.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        })
      ]);

      return {
        totalProducts,
        totalSuppliers,
        totalPrices,
        recentUploads
      };
    } catch (error) {
      throw new DatabaseError('Failed to fetch statistics', error);
    }
  }

  /**
   * Bulk operations
   */
  async bulkCreateProducts(products: any[]) {
    try {
      return await prisma.product.createMany({
        data: products,
        skipDuplicates: true
      });
    } catch (error) {
      throw new DatabaseError('Failed to bulk create products', error);
    }
  }

  async bulkCreatePrices(prices: any[]) {
    try {
      return await prisma.price.createMany({
        data: prices,
        skipDuplicates: true
      });
    } catch (error) {
      throw new DatabaseError('Failed to bulk create prices', error);
    }
  }

  /**
   * Transaction support
   */
  async executeTransaction<T>(
    operations: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    try {
      return await prisma.$transaction(operations);
    } catch (error) {
      throw new DatabaseError('Transaction failed', error);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1 as health`;
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const databaseService = DatabaseService.getInstance();