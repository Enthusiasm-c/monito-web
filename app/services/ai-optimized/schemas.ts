import { z } from 'zod';

// Schema для продукта
export const ProductSchema = z.object({
  name: z.string().describe('Product name in English, singular form'),
  price: z.number().nullable().describe('Numeric price value'),
  unit: z.string().describe('Standardized unit: kg, pcs, l, etc'),
  category: z.string().nullable().describe('Product category'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1')
});

// Schema для извлеченных данных
export const ExtractedDataSchema = z.object({
  documentType: z.enum(['price_list', 'invoice', 'catalog', 'order', 'unknown']),
  supplierName: z.string().nullable(),
  supplierContact: z.object({
    email: z.string().nullable(),
    phone: z.string().nullable(),
    address: z.string().nullable()
  }).nullable(),
  products: z.array(ProductSchema),
  extractionQuality: z.number().min(0).max(1).describe('Overall extraction quality 0-1'),
  metadata: z.object({
    totalPages: z.number().optional(),
    language: z.string().optional(),
    currency: z.string().optional(),
    dateExtracted: z.string().optional(),
    processor: z.string().optional(),
    model: z.string().optional()
  }).optional()
});

export type Product = z.infer<typeof ProductSchema>;
export type ExtractedData = z.infer<typeof ExtractedDataSchema>;