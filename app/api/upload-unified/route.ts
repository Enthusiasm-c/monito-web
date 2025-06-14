import { NextRequest, NextResponse } from 'next/server';
import { unifiedGeminiService } from '../../services/core/UnifiedGeminiService';

/**
 * Unified Upload API Route
 * Replaces: /upload, /upload-ai, /upload-gemini, /upload-smart
 * 
 * Query parameters:
 * - strategy: 'auto' | 'single' | 'batch' | 'compact'
 * - model: 'gemini-2.0-flash-exp' | 'gemini-1.5-pro' | etc.
 * - maxProducts: number (for batch size estimation)
 */
export async function POST(request: NextRequest) {
  console.log('[UnifiedUpload] Processing upload request');
  
  try {
    // Parse query parameters
    const url = new URL(request.url);
    const strategy = url.searchParams.get('strategy') || 'auto';
    const model = url.searchParams.get('model') as any || 'gemini-2.0-flash-exp';
    const maxProducts = parseInt(url.searchParams.get('maxProducts') || '1000');
    const batchSize = parseInt(url.searchParams.get('batchSize') || '200');
    
    console.log('[UnifiedUpload] Strategy:', strategy, 'Model:', model, 'MaxProducts:', maxProducts);

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const supplierName = formData.get('supplierName') as string;

    // Validation
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // File size check (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Supported file types
    const supportedTypes = [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ];

    if (!supportedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    console.log(`[UnifiedUpload] Processing file: ${file.name} (${file.type}, ${file.size} bytes)`);

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Determine processing options based on strategy
    const processOptions = {
      model,
      maxProducts,
      batchSize,
      enableBatching: strategy === 'batch' || strategy === 'auto',
      includeMetadata: true
    };

    // Process with unified Gemini service
    const startTime = Date.now();
    const result = await unifiedGeminiService.processDocument(
      buffer,
      file.name,
      processOptions
    );
    const processingTime = Date.now() - startTime;

    // Enhance result with additional metadata
    const enhancedResult = {
      ...result,
      metadata: {
        ...result.metadata,
        processingTimeMs: processingTime,
        fileSize: file.size,
        fileName: file.name,
        fileType: file.type,
        strategy: strategy,
        supplierNameOverride: supplierName
      },
      performance: {
        processingTimeMs: processingTime,
        productsPerSecond: result.products.length / (processingTime / 1000),
        avgProductProcessingTime: processingTime / result.products.length
      }
    };

    console.log(`[UnifiedUpload] Success: ${result.products.length} products extracted in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      data: enhancedResult,
      stats: {
        productsExtracted: result.products.length,
        processingTimeMs: processingTime,
        strategy: strategy,
        model: model,
        batches: result.metadata?.totalBatches || 1
      }
    });

  } catch (error) {
    console.error('[UnifiedUpload] Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';

    return NextResponse.json(
      { 
        error: errorMessage,
        type: errorType,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'unified-upload',
    timestamp: new Date().toISOString(),
    supportedStrategies: ['auto', 'single', 'batch', 'compact'],
    supportedModels: [
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash', 
      'gemini-1.5-pro',
      'gemini-1.5-flash'
    ],
    supportedFileTypes: [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ]
  });
}