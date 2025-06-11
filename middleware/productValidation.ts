/**
 * Product Validation Middleware
 * Prevents creation of invalid products (without prices or suppliers)
 */

import { PrismaClient } from '@prisma/client';

export interface ProductValidationRule {
  requirePrice: boolean;
  requireSupplier: boolean;
  requireValidName: boolean;
  minPrice: number;
  autoCleanup: boolean;
}

export const defaultValidationRules: ProductValidationRule = {
  requirePrice: true,
  requireSupplier: true, 
  requireValidName: true,
  minPrice: 0.01,
  autoCleanup: true
};

export class ProductValidator {
  private prisma: PrismaClient;
  private rules: ProductValidationRule;
  
  constructor(prisma: PrismaClient, rules: ProductValidationRule = defaultValidationRules) {
    this.prisma = prisma;
    this.rules = rules;
  }
  
  /**
   * Validate product data before creation
   */
  validateProductData(productData: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check name validity
    if (this.rules.requireValidName) {
      if (!productData.name || typeof productData.name !== 'string' || productData.name.trim().length === 0) {
        errors.push('Product name is required and cannot be empty');
      }
      
      if (!productData.standardizedName || productData.standardizedName.trim().length === 0) {
        errors.push('Standardized product name is required');
      }
    }
    
    // Check unit validity
    if (!productData.unit || productData.unit.trim().length === 0) {
      errors.push('Product unit is required');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate price data before creation
   */
  validatePriceData(priceData: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check price amount
    if (this.rules.requirePrice) {
      if (!priceData.amount || isNaN(priceData.amount) || priceData.amount <= this.rules.minPrice) {
        errors.push(`Price amount must be greater than ${this.rules.minPrice}`);
      }
    }
    
    // Check supplier
    if (this.rules.requireSupplier) {
      if (!priceData.supplierId || priceData.supplierId.trim().length === 0) {
        errors.push('Supplier ID is required');
      }
    }
    
    // Check product
    if (!priceData.productId || priceData.productId.trim().length === 0) {
      errors.push('Product ID is required');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Create product with validation
   */
  async createValidatedProduct(productData: any, priceData?: any) {
    // Validate product
    const productValidation = this.validateProductData(productData);
    if (!productValidation.valid) {
      throw new Error(`Product validation failed: ${productValidation.errors.join(', ')}`);
    }
    
    // Create product
    const product = await this.prisma.product.create({
      data: {
        name: productData.name.trim(),
        rawName: productData.rawName?.trim() || productData.name.trim(),
        standardizedName: productData.standardizedName.trim(),
        category: productData.category?.trim(),
        unit: productData.unit.trim(),
        standardizedUnit: productData.standardizedUnit?.trim() || productData.unit.trim(),
        description: productData.description?.trim()
      }
    });
    
    // Create price if provided
    if (priceData) {
      const priceValidation = this.validatePriceData({
        ...priceData,
        productId: product.id
      });
      
      if (!priceValidation.valid) {
        // Delete the product if price validation fails
        await this.prisma.product.delete({ where: { id: product.id } });
        throw new Error(`Price validation failed: ${priceValidation.errors.join(', ')}`);
      }
      
      await this.prisma.price.create({
        data: {
          amount: priceData.amount,
          unit: priceData.unit || product.unit,
          supplierId: priceData.supplierId,
          productId: product.id,
          uploadId: priceData.uploadId
        }
      });
    } else if (this.rules.requirePrice) {
      // Delete the product if price is required but not provided
      await this.prisma.product.delete({ where: { id: product.id } });
      throw new Error('Price is required but not provided');
    }
    
    return product;
  }
  
  /**
   * Cleanup orphan products (no prices)
   */
  async cleanupOrphanProducts(): Promise<{ deletedProducts: number; deletedSuppliers: number }> {
    if (!this.rules.autoCleanup) {
      return { deletedProducts: 0, deletedSuppliers: 0 };
    }
    
    // Find products without prices
    const orphanProducts = await this.prisma.product.findMany({
      where: {
        prices: {
          none: {}
        }
      },
      select: { id: true }
    });
    
    let deletedProducts = 0;
    if (orphanProducts.length > 0) {
      const productIds = orphanProducts.map(p => p.id);
      const deleted = await this.prisma.product.deleteMany({
        where: { id: { in: productIds } }
      });
      deletedProducts = deleted.count;
    }
    
    // Find suppliers without prices or uploads
    const emptySuppliers = await this.prisma.supplier.findMany({
      where: {
        AND: [
          { prices: { none: {} } },
          { uploads: { none: {} } }
        ]
      },
      select: { id: true }
    });
    
    let deletedSuppliers = 0;
    if (emptySuppliers.length > 0) {
      const supplierIds = emptySuppliers.map(s => s.id);
      const deleted = await prisma.supplier.deleteMany({
        where: { id: { in: supplierIds } }
      });
      deletedSuppliers = deleted.count;
    }
    
    return { deletedProducts, deletedSuppliers };
  }
  
  /**
   * Validate existing database and fix issues
   */
  async validateAndFixDatabase(): Promise<{
    fixedProducts: number;
    deletedProducts: number;
    deletedPrices: number;
  }> {
    let fixedProducts = 0;
    let deletedProducts = 0;
    let deletedPrices = 0;
    
    // Fix empty product names
    const productsWithEmptyNames = await this.prisma.product.findMany({
      where: {
        OR: [
          { name: { in: ['', ' '] } },
          { standardizedName: { in: ['', ' '] } }
        ]
      }
    });
    
    for (const product of productsWithEmptyNames) {
      if (product.rawName && product.rawName.trim().length > 0) {
        // Fix using rawName
        await this.prisma.product.update({
          where: { id: product.id },
          data: {
            name: product.rawName.trim(),
            standardizedName: product.rawName.toLowerCase().trim()
          }
        });
        fixedProducts++;
      } else {
        // Delete if cannot be fixed
        await this.prisma.product.delete({ where: { id: product.id } });
        deletedProducts++;
      }
    }
    
    // Delete invalid prices
    const invalidPrices = await this.prisma.price.deleteMany({
      where: {
        amount: { lte: 0 }
      }
    });
    deletedPrices = invalidPrices.count;
    
    return { fixedProducts, deletedProducts, deletedPrices };
  }
}

// Export singleton instance
export const createProductValidator = (prisma: PrismaClient, rules?: ProductValidationRule) => {
  return new ProductValidator(prisma, rules);
};