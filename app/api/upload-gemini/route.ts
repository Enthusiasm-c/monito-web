import { NextRequest, NextResponse } from 'next/server';
import { geminiPipeline } from '@/app/services/gemini/GeminiPipeline';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

// Supported file types
const SUPPORTED_FILE_TYPES = {
  // Direct support by Gemini
  'application/pdf': { needsPreprocessing: false },
  'image/jpeg': { needsPreprocessing: false },
  'image/jpg': { needsPreprocessing: false },
  'image/png': { needsPreprocessing: false },
  'image/gif': { needsPreprocessing: false },
  'image/webp': { needsPreprocessing: false },
  
  // Needs preprocessing
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { needsPreprocessing: true }, // xlsx
  'application/vnd.ms-excel': { needsPreprocessing: true }, // xls
  'text/csv': { needsPreprocessing: true }, // csv
};

export async function POST(request: NextRequest) {
  console.log('[Upload-Gemini] Processing upload request');
  
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const model = formData.get('model') as string || 'gemini-2.0-flash-exp';
    const supplierId = formData.get('supplierId') as string | null;
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }
    
    // Process only the first file for now
    const file = files[0];
    
    // Validate file type
    const mimeType = file.type || 'application/octet-stream';
    if (!SUPPORTED_FILE_TYPES[mimeType as keyof typeof SUPPORTED_FILE_TYPES]) {
      return NextResponse.json(
        { 
          error: 'Unsupported file type',
          message: `File type ${mimeType} is not supported. Supported types: PDF, Images (JPG, PNG, GIF, WebP), Excel (XLSX, XLS), CSV`
        },
        { status: 400 }
      );
    }
    
    console.log(`[Upload-Gemini] Processing file: ${file.name}, type: ${mimeType}, size: ${file.size} bytes`);
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Process with Gemini pipeline
    const result = await geminiPipeline.processUpload(
      {
        originalName: file.name,
        buffer: buffer,
        mimeType: mimeType,
        size: file.size
      },
      {
        supplierId: supplierId || undefined,
        model: model as any,
        skipApproval: process.env.AUTO_APPROVAL_ENABLED === 'true'
      }
    );
    
    console.log(`[Upload-Gemini] Processing completed successfully:`, {
      uploadId: result.uploadId,
      products: result.stats.totalExtracted,
      processingTime: result.stats.processingTimeMs
    });
    
    // Return structured response
    return NextResponse.json({
      success: true,
      uploadId: result.uploadId,
      status: result.stats.errors > 0 ? 'partial' : 'completed',
      supplier: {
        id: result.supplierId,
        name: result.supplierName,
        isNew: result.isNewSupplier
      },
      stats: {
        totalExtracted: result.stats.totalExtracted,
        successfullyProcessed: result.stats.successfullyProcessed,
        newProducts: result.stats.newProducts,
        updatedProducts: result.stats.updatedProducts,
        errors: result.stats.errors,
        processingTimeMs: result.stats.processingTimeMs,
        estimatedCostUsd: result.stats.estimatedCostUsd
      },
      insights: result.insights,
      errors: result.errors
    });
    
  } catch (error) {
    console.error('[Upload-Gemini] Processing error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to process upload',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error : {}
      },
      { status: 500 }
    );
  }
}