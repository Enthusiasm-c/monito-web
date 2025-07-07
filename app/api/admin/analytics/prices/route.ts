/**
 * API for price analytics
 * GET /api/admin/analytics/prices - Get price analytics and market data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { priceAnalyticsService } from '@/app/services/admin/PriceAnalyticsService';
import { z } from 'zod';

const analyticsQuerySchema = z.object({
  type: z.enum(['product', 'market', 'comparison']),
  productId: z.string().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).default('50')
});

export async function GET(request: NextRequest) {
  try {
    // Note: Authentication removed for public price analytics access

    const { searchParams } = new URL(request.url);
    const queryParams = {
      type: searchParams.get('type'),
      productId: searchParams.get('productId'),
      limit: searchParams.get('limit') || '50'
    };

    // Validate query parameters
    let validatedParams;
    try {
      validatedParams = analyticsQuerySchema.parse(queryParams);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({
          error: 'Invalid query parameters',
          details: error.errors
        }, { status: 400 });
      }
      throw error;
    }

    const { type, productId, limit } = validatedParams;

    switch (type) {
      case 'product':
        if (!productId) {
          return NextResponse.json({
            error: 'Product ID is required for product analytics'
          }, { status: 400 });
        }

        const productResult = await priceAnalyticsService.getProductPriceAnalytics(productId);
        return NextResponse.json(productResult);

      case 'market':
        const marketResult = await priceAnalyticsService.getMarketAnalytics(limit);
        return NextResponse.json(marketResult);

      case 'comparison':
        if (!productId) {
          return NextResponse.json({
            error: 'Product ID is required for price comparison'
          }, { status: 400 });
        }

        const comparisonResult = await priceAnalyticsService.getProductPriceComparison(productId);
        return NextResponse.json(comparisonResult);

      default:
        return NextResponse.json({
          error: 'Invalid analytics type. Must be "product", "market", or "comparison"'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in GET /api/admin/analytics/prices:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}