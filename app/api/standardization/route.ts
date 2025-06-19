import { NextRequest, NextResponse } from 'next/server';
import { standardizeProducts } from '../../lib/utils/standardization';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { products } = body;

    if (!products || !Array.isArray(products)) {
      return NextResponse.json(
        { error: 'Products array is required' },
        { status: 400 }
      );
    }

    console.log(`🔧 Standardizing ${products.length} products with ChatGPT o3`);

    const startTime = Date.now();
    const results = await standardizeProducts(products);

    return NextResponse.json({
      success: true,
      result: {
        products: results,
        totalProcessed: results.length,
        tokensUsed: 0, // Token usage tracked internally
        processingTimeMs: Date.now() - startTime
      }
    });

  } catch (error) {
    console.error('Standardization API error:', error);
    return NextResponse.json(
      {
        error: 'Standardization failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'Product Standardization Service',
    description: 'Centralized product name and unit standardization using ChatGPT o3',
    features: [
      'Batch product standardization',
      'Indonesian to English translation',
      'Unit standardization',
      'Spelling correction',
      'Consistent naming conventions'
    ],
    model: 'ChatGPT o3 (gpt-4o)',
    endpoints: {
      'POST /api/standardization': 'Standardize batch of products',
      'GET /api/standardization': 'Service information'
    }
  });
}