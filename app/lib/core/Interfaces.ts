/**
 * Unified Interfaces
 * Replaces 11+ duplicate interface definitions across the project
 */

import { z } from 'zod';

// =================== CORE TYPES ===================

export type FileType = 'pdf' | 'excel' | 'csv' | 'image' | 'text';
export type ProcessingStrategy = 'auto' | 'single' | 'batch' | 'compact';
export type DocumentType = 'price_list' | 'invoice' | 'catalog' | 'order' | 'unknown';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type GeminiModel = 
  | 'gemini-2.0-flash-exp' 
  | 'gemini-2.0-flash' 
  | 'gemini-1.5-pro' 
  | 'gemini-1.5-flash';

// =================== PROCESSING OPTIONS ===================

export interface ProcessOptions {
  // Core options
  maxProducts?: number;
  model?: GeminiModel;
  strategy?: ProcessingStrategy;
  
  // Batch processing
  batchSize?: number;
  enableBatching?: boolean;
  
  // Output options
  includeMetadata?: boolean;
  useCompactFormat?: boolean;
  
  // Language and localization
  preferredLanguage?: string;
  currency?: string;
  
  // Performance
  timeout?: number;
  retries?: number;
}

// =================== EXTRACTED DATA STRUCTURES ===================

export interface ExtractedProduct {
  name: string;
  price: number | null;
  unit: string | null;
  category: string | null;
  confidence: number;
  description?: string;
  sku?: string;
}

export interface CompactProduct {
  n: string;    // name
  p: number | null;    // price
  u: string | null;    // unit
  c: string | null;    // category
  s: number;    // confidence score
}

export interface SupplierInfo {
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website?: string | null;
  contactPerson?: string | null;
}

export interface ExtractionMetadata {
  dateExtracted: string;
  totalPages: number;
  language: string;
  currency: string;
  processor: string;
  model?: string;
  processingMethod?: 'single' | 'batch';
  totalBatches?: number;
  batchSize?: number;
  fileSize?: number;
  fileName?: string;
  fileType?: string;
}

// =================== PROCESSING RESULTS ===================

export interface ProcessingResult {
  documentType: DocumentType;
  supplierName?: string;
  supplier?: SupplierInfo;
  products: ExtractedProduct[];
  extractionQuality: number;
  metadata: ExtractionMetadata;
}

export interface ExtractedData extends ProcessingResult {
  supplierContact?: SupplierInfo; // Legacy compatibility
}

export interface BatchResult {
  batchNumber: number;
  products: ExtractedProduct[];
  startRow: number;
  endRow: number;
  processingTime: number;
  success: boolean;
  error?: string;
}

// =================== FILE PROCESSING ===================

export interface FileContent {
  type: 'binary' | 'text';
  content: string;
  mimeType?: string;
  size?: number;
}

export interface UploadedFile {
  name: string;
  size: number;
  type: string;
  content: Buffer | string;
  lastModified?: number;
}

export interface BatchData {
  data: any[][];
  startRow: number;
  endRow: number;
  batchNumber?: number;
}

// =================== API RESPONSES ===================

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    type: string;
    message: string;
    code?: string;
    timestamp: string;
  };
  metadata?: {
    processingTime?: number;
    timestamp: string;
  };
}

export interface UploadResponse extends APIResponse<ProcessingResult> {
  stats?: {
    productsExtracted: number;
    processingTimeMs: number;
    strategy: ProcessingStrategy;
    model: string;
    batches?: number;
  };
}

// =================== PROCESSING OPTIONS ===================

export interface ProcessingOptions extends ProcessOptions {
  // Legacy compatibility
  maxRetries?: number;
  enableAI?: boolean;
  aiModel?: string;
  
  // Database options
  autoSave?: boolean;
  skipDuplicates?: boolean;
  updateExisting?: boolean;
}

// =================== DATABASE MODELS ===================

export interface ProductRecord {
  id: string;
  name: string;
  standardizedName?: string;
  price: number;
  unit: string;
  standardizedUnit?: string;
  category?: string;
  supplierId: string;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierRecord {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadRecord {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  status: ProcessingStatus;
  supplierId?: string;
  productsCount: number;
  processingTime?: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// =================== STANDARDIZATION ===================

export interface StandardizationRequest {
  products: ExtractedProduct[];
  options?: {
    enableUnitStandardization?: boolean;
    enableNameStandardization?: boolean;
    enableCategoryStandardization?: boolean;
  };
}

export interface StandardizedProduct extends ExtractedProduct {
  standardizedName?: string;
  standardizedUnit?: string;
  standardizedCategory?: string;
  standardizationConfidence?: number;
}

export interface StandardizationResult {
  products: StandardizedProduct[];
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  processingTime: number;
}

// =================== VALIDATION SCHEMAS ===================

export const ProcessOptionsSchema = z.object({
  maxProducts: z.number().optional(),
  model: z.enum(['gemini-2.0-flash-exp', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash']).optional(),
  strategy: z.enum(['auto', 'single', 'batch', 'compact']).optional(),
  batchSize: z.number().min(50).max(500).optional(),
  enableBatching: z.boolean().optional(),
  includeMetadata: z.boolean().optional(),
  useCompactFormat: z.boolean().optional(),
  preferredLanguage: z.string().optional(),
  currency: z.string().optional(),
  timeout: z.number().optional(),
  retries: z.number().min(1).max(5).optional()
});

export const ExtractedProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().nullable(),
  unit: z.string().nullable(),
  category: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  description: z.string().optional(),
  sku: z.string().optional()
});

export const SupplierInfoSchema = z.object({
  name: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  website: z.string().url().nullable().optional(),
  contactPerson: z.string().nullable().optional()
});

export const ProcessingResultSchema = z.object({
  documentType: z.enum(['price_list', 'invoice', 'catalog', 'order', 'unknown']),
  supplierName: z.string().optional(),
  supplier: SupplierInfoSchema.optional(),
  products: z.array(ExtractedProductSchema),
  extractionQuality: z.number().min(0).max(1),
  metadata: z.object({
    dateExtracted: z.string(),
    totalPages: z.number(),
    language: z.string(),
    currency: z.string(),
    processor: z.string(),
    model: z.string().optional(),
    processingMethod: z.enum(['single', 'batch']).optional(),
    totalBatches: z.number().optional(),
    batchSize: z.number().optional()
  })
});

// =================== TYPE GUARDS ===================

export function isExtractedProduct(obj: any): obj is ExtractedProduct {
  return (
    typeof obj === 'object' &&
    typeof obj.name === 'string' &&
    (typeof obj.price === 'number' || obj.price === null) &&
    (typeof obj.unit === 'string' || obj.unit === null) &&
    (typeof obj.category === 'string' || obj.category === null) &&
    typeof obj.confidence === 'number'
  );
}

export function isProcessingResult(obj: any): obj is ProcessingResult {
  return (
    typeof obj === 'object' &&
    typeof obj.documentType === 'string' &&
    Array.isArray(obj.products) &&
    typeof obj.extractionQuality === 'number' &&
    typeof obj.metadata === 'object'
  );
}

export function isCompactProduct(obj: any): obj is CompactProduct {
  return (
    typeof obj === 'object' &&
    typeof obj.n === 'string' &&
    (typeof obj.p === 'number' || obj.p === null) &&
    (typeof obj.u === 'string' || obj.u === null) &&
    (typeof obj.c === 'string' || obj.c === null) &&
    typeof obj.s === 'number'
  );
}

// =================== UTILITY TYPES ===================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Legacy compatibility exports
export type { ExtractedData as LegacyExtractedData };
export type { ProcessingOptions as LegacyProcessingOptions };