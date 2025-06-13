import { z } from 'zod';

/**
 * Common validation schemas for the application
 */

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
});

// ID validation
export const idSchema = z.string().min(1, 'ID is required');

// File upload schema
export const fileUploadSchema = z.object({
  file: z.instanceof(File).refine(
    (file) => file.size <= 50 * 1024 * 1024, // 50MB
    'File size must be less than 50MB'
  ),
  supplierId: z.string().optional(),
  mode: z.enum(['smart', 'ai', 'debug', 'normal']).default('normal'),
  validationLevel: z.enum(['strict', 'normal', 'lenient']).default('normal'),
});

// Product schema
export const productSchema = z.object({
  name: z.string().min(1).max(500),
  unit: z.string().min(1).max(50),
  category: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  barcode: z.string().max(100).optional(),
  brand: z.string().max(200).optional(),
  supplierId: z.string().min(1),
});

// Price schema
export const priceSchema = z.object({
  amount: z.number().min(0).max(10000000),
  currency: z.string().length(3).default('IDR'),
  validFrom: z.date(),
  validTo: z.date().optional(),
  productId: z.string().min(1),
  uploadId: z.string().min(1),
});

// Supplier schema
export const supplierSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  isTemporary: z.boolean().default(false),
});

// Upload status schema
export const uploadStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'approved',
  'rejected'
]);

// Search/filter schema
export const searchSchema = z.object({
  query: z.string().min(1).max(200),
  category: z.string().optional(),
  supplierId: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sortBy: z.enum(['name', 'price', 'category', 'updatedAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
}).merge(paginationSchema);

// Batch operation schema
export const batchOperationSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(['approve', 'reject', 'delete', 'reprocess']),
  reason: z.string().max(500).optional(),
});

// Date range schema
export const dateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine(
  (data) => data.startDate <= data.endDate,
  'Start date must be before or equal to end date'
);

// Export schema
export const exportSchema = z.object({
  format: z.enum(['csv', 'xlsx', 'json']).default('csv'),
  includeHeaders: z.boolean().default(true),
  dateRange: dateRangeSchema.optional(),
  supplierIds: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
}).merge(paginationSchema);

// Stats query schema
export const statsQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month', 'year']).default('month'),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  groupBy: z.enum(['supplier', 'category', 'status']).optional(),
});

// Reprocess schema
export const reprocessSchema = z.object({
  uploadId: z.string().min(1),
  options: z.object({
    forceOCR: z.boolean().default(false),
    useAI: z.boolean().default(true),
    clearExisting: z.boolean().default(false),
  }).optional(),
});

// Token usage schema
export const tokenUsageSchema = z.object({
  model: z.string(),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  operation: z.string(),
  metadata: z.record(z.any()).optional(),
});

// Bot API schemas
export const botSearchSchema = z.object({
  query: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  fuzzy: z.boolean().default(true),
});

export const botPriceCompareSchema = z.object({
  productName: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

// Document classification schema
export const documentClassificationSchema = z.object({
  content: z.string().min(1).max(100000),
  filename: z.string().optional(),
  mimeType: z.string().optional(),
});

// Processing log query schema
export const processingLogQuerySchema = z.object({
  uploadId: z.string().optional(),
  level: z.enum(['info', 'warn', 'error']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).merge(paginationSchema);

// Cleanup schema
export const cleanupSchema = z.object({
  type: z.enum(['orphan-products', 'duplicate-prices', 'invalid-data']),
  dryRun: z.boolean().default(true),
  batchSize: z.number().int().min(1).max(1000).default(100),
});

/**
 * Helper function to validate data against a schema
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: result.error };
  }
}

/**
 * Helper to format validation errors for API responses
 */
export function formatValidationErrors(errors: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};
  
  errors.errors.forEach((error) => {
    const path = error.path.join('.');
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(error.message);
  });
  
  return formatted;
}