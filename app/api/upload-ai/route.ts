import { NextRequest, NextResponse } from 'next/server';
import { unifiedAIPipeline } from '@/app/services/ai-optimized/UnifiedAIPipeline';

export const maxDuration = 60; // 60 seconds timeout

export async function POST(request: NextRequest) {
  console.log('🚀 Starting AI-optimized upload processing');

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const supplierId = formData.get('supplierId') as string | null;
    const autoApprove = formData.get('autoApprove') === 'true';
    const model = formData.get('model') as 'o3' | 'o3-mini' | 'gpt-4.1-mini' | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process with unified AI pipeline
    const result = await unifiedAIPipeline.processUpload(
      {
        buffer,
        originalName: file.name,
        mimeType: file.type,
        size: file.size
      },
      {
        supplierId: supplierId || undefined,
        autoApprove,
        model: model || undefined
      }
    );

    console.log('✅ AI processing completed:', {
      uploadId: result.uploadId,
      status: result.status,
      products: result.stats.totalExtracted,
      processingTime: `${(result.stats.processingTimeMs / 1000).toFixed(2)}s`,
      cost: `$${result.stats.estimatedCostUsd.toFixed(4)}`
    });

    return NextResponse.json({
      success: true,
      uploadId: result.uploadId,
      status: result.status,
      supplier: result.supplier,
      stats: result.stats,
      insights: result.insights
    });

  } catch (error) {
    console.error('❌ AI upload processing error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to process upload',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}

// GET endpoint for checking AI service status
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'AI-optimized upload processor',
    features: [
      'Unified document processing',
      'Batch normalization',
      'Semantic product matching',
      'Intelligent caching',
      'Multi-model support'
    ],
    models: {
      default: 'o3-mini',
      available: ['o3', 'o3-mini', 'gpt-4.1-mini']
    }
  });
}