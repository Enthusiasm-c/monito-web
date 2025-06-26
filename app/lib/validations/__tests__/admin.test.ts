/**
 * Unit tests for admin validation schemas
 */

import {
  productFieldUpdateSchema,
  priceFieldUpdateSchema,
  supplierUpdateSchema,
  userCreateSchema,
  changePasswordSchema,
  validateRequest,
  createValidationErrorResponse
} from '../admin';
import { z } from 'zod';

describe('Admin Validation Schemas', () => {
  describe('productFieldUpdateSchema', () => {
    it('should validate correct product field updates', () => {
      const validData = { field: 'name', value: 'New Product Name' };
      const result = productFieldUpdateSchema.safeParse(validData);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it('should reject invalid fields', () => {
      const invalidData = { field: 'invalidField', value: 'Some value' };
      const result = productFieldUpdateSchema.safeParse(invalidData);
      
      expect(result.success).toBe(false);
    });

    it('should reject empty values', () => {
      const invalidData = { field: 'name', value: '' };
      const result = productFieldUpdateSchema.safeParse(invalidData);
      
      expect(result.success).toBe(false);
    });

    it('should accept all valid fields', () => {
      const validFields = ['name', 'standardizedName', 'category', 'unit', 'description'];
      
      validFields.forEach(field => {
        const data = { field, value: 'Test value' };
        const result = productFieldUpdateSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('priceFieldUpdateSchema', () => {
    it('should validate string values for unit field', () => {
      const validData = { field: 'unit', value: 'kg' };
      const result = priceFieldUpdateSchema.safeParse(validData);
      
      expect(result.success).toBe(true);
    });

    it('should validate numeric values for amount field', () => {
      const validData = { field: 'amount', value: 1500.50 };
      const result = priceFieldUpdateSchema.safeParse(validData);
      
      expect(result.success).toBe(true);
    });

    it('should reject negative prices', () => {
      const invalidData = { field: 'amount', value: -100 };
      const result = priceFieldUpdateSchema.safeParse(invalidData);
      
      expect(result.success).toBe(false);
    });

    it('should reject invalid field names', () => {
      const invalidData = { field: 'invalidField', value: 100 };
      const result = priceFieldUpdateSchema.safeParse(invalidData);
      
      expect(result.success).toBe(false);
    });
  });

  describe('supplierUpdateSchema', () => {
    it('should validate complete supplier data', () => {
      const validData = {
        name: 'Test Supplier',
        email: 'test@supplier.com',
        phone: '+62123456789',
        address: '123 Test Street',
        contactInfo: 'Contact Person: John Doe'
      };
      
      const result = supplierUpdateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept partial supplier data', () => {
      const partialData = {
        name: 'Test Supplier'
      };
      
      const result = supplierUpdateSchema.safeParse(partialData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email formats', () => {
      const invalidData = {
        name: 'Test Supplier',
        email: 'invalid-email'
      };
      
      const result = supplierUpdateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject short supplier names', () => {
      const invalidData = {
        name: 'A'
      };
      
      const result = supplierUpdateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid phone formats', () => {
      const invalidData = {
        name: 'Test Supplier',
        phone: '123'
      };
      
      const result = supplierUpdateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept valid phone formats', () => {
      const validPhones = [
        '+62123456789',
        '0812-3456-7890',
        '(021) 123-4567',
        '+1 (555) 123-4567'
      ];

      validPhones.forEach(phone => {
        const data = { name: 'Test Supplier', phone };
        const result = supplierUpdateSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('userCreateSchema', () => {
    it('should validate complete user data', () => {
      const validData = {
        email: 'user@example.com',
        name: 'Test User',
        password: 'securePassword123',
        role: 'manager' as const,
        isActive: true
      };
      
      const result = userCreateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should set default isActive to true', () => {
      const dataWithoutIsActive = {
        email: 'user@example.com',
        name: 'Test User',
        password: 'securePassword123',
        role: 'admin' as const
      };
      
      const result = userCreateSchema.safeParse(dataWithoutIsActive);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(true);
      }
    });

    it('should reject short passwords', () => {
      const invalidData = {
        email: 'user@example.com',
        name: 'Test User',
        password: '123',
        role: 'admin' as const
      };
      
      const result = userCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid roles', () => {
      const invalidData = {
        email: 'user@example.com',
        name: 'Test User',
        password: 'securePassword123',
        role: 'invalidRole'
      };
      
      const result = userCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept all valid roles', () => {
      const validRoles = ['admin', 'manager', 'viewer'] as const;
      
      validRoles.forEach(role => {
        const data = {
          email: 'user@example.com',
          name: 'Test User',
          password: 'securePassword123',
          role
        };
        const result = userCreateSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('changePasswordSchema', () => {
    it('should validate matching passwords', () => {
      const validData = {
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword123',
        confirmPassword: 'newPassword123'
      };
      
      const result = changePasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject mismatched passwords', () => {
      const invalidData = {
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword123',
        confirmPassword: 'differentPassword123'
      };
      
      const result = changePasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('confirmPassword');
        expect(result.error.errors[0].message).toBe("Passwords don't match");
      }
    });

    it('should reject short new passwords', () => {
      const invalidData = {
        currentPassword: 'oldPassword123',
        newPassword: '123',
        confirmPassword: '123'
      };
      
      const result = changePasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('validateRequest helper', () => {
    it('should return parsed data for valid input', () => {
      const schema = z.object({ name: z.string() });
      const validData = { name: 'Test' };
      
      const result = validateRequest(schema, validData);
      expect(result).toEqual(validData);
    });

    it('should throw error for invalid input', () => {
      const schema = z.object({ name: z.string() });
      const invalidData = { name: 123 };
      
      expect(() => validateRequest(schema, invalidData)).toThrow('Validation error');
    });
  });

  describe('createValidationErrorResponse helper', () => {
    it('should create formatted error response', () => {
      const schema = z.object({ 
        name: z.string().min(2),
        email: z.string().email()
      });
      
      const invalidData = { name: 'A', email: 'invalid' };
      const result = schema.safeParse(invalidData);
      
      if (!result.success) {
        const errorResponse = createValidationErrorResponse(result.error);
        
        expect(errorResponse.error).toBe('Validation failed');
        expect(errorResponse.details).toHaveLength(2);
        expect(errorResponse.details[0]).toHaveProperty('field');
        expect(errorResponse.details[0]).toHaveProperty('message');
        expect(errorResponse.details[0]).toHaveProperty('code');
      }
    });
  });
});