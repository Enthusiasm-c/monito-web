/**
 * Zod validation schemas for admin API endpoints
 */

import { z } from 'zod';

// Product validation schemas
export const productFieldUpdateSchema = z.object({
  field: z.enum(['name', 'standardizedName', 'category', 'unit', 'description']),
  value: z.string().min(1, 'Value cannot be empty')
});

export const productCreateSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters'),
  standardizedName: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  standardizedUnit: z.string().optional(),
  description: z.string().optional(),
  rawName: z.string().optional()
});

// Price validation schemas
export const priceFieldUpdateSchema = z.object({
  field: z.enum(['amount', 'unit', 'unitPrice']),
  value: z.union([
    z.string().min(1, 'Value cannot be empty'),
    z.number().positive('Price must be positive')
  ])
});

export const priceCreateSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  unit: z.string().min(1, 'Unit is required'),
  unitPrice: z.number().positive().optional(),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional().nullable(),
  productId: z.string().uuid('Invalid product ID'),
  supplierId: z.string().uuid('Invalid supplier ID')
});

// Supplier validation schemas
export const supplierUpdateSchema = z.object({
  name: z.string().min(2, 'Supplier name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email format').optional().nullable(),
  phone: z.string().regex(/^[\+]?[\d\s\-\(\)]{7,20}$/, 'Invalid phone number format').optional().nullable(),
  address: z.string().optional().nullable(),
  contactInfo: z.string().optional().nullable()
});

export const supplierCreateSchema = z.object({
  name: z.string().min(2, 'Supplier name must be at least 2 characters'),
  email: z.string().email('Invalid email format').optional().nullable(),
  phone: z.string().regex(/^[\+]?[\d\s\-\(\)]{7,20}$/, 'Invalid phone number format').optional().nullable(),
  address: z.string().optional().nullable(),
  contactInfo: z.string().optional().nullable()
});

// User validation schemas
export const userCreateSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'manager', 'viewer']),
  isActive: z.boolean().default(true)
});

export const userUpdateSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  role: z.enum(['admin', 'manager', 'viewer']).optional(),
  isActive: z.boolean().optional()
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Password confirmation is required')
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

// Bulk operations validation schemas
export const bulkDeleteSchema = z.object({
  reason: z.string().optional(),
  confirmText: z.literal('DELETE').optional()
});

// Pagination and search schemas
export const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0, 'Page must be positive').default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0 && n <= 100, 'Limit must be between 1 and 100').default('50'),
  search: z.string().optional().default('')
});

// Price history validation schemas
export const priceHistoryQuerySchema = z.object({
  productId: z.string().uuid('Invalid product ID').optional(),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  startDate: z.string().datetime('Invalid start date').optional(),
  endDate: z.string().datetime('Invalid end date').optional(),
  ...paginationSchema.shape
});

// File validation schemas
export const fileUploadSchema = z.object({
  file: z.instanceof(File, 'File is required'),
  supplierId: z.string().uuid('Invalid supplier ID')
});

// Generic validation helpers
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      throw new Error(`Validation error: ${message}`);
    }
    throw error;
  }
}

export function createValidationErrorResponse(error: z.ZodError) {
  return {
    error: 'Validation failed',
    details: error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }))
  };
}