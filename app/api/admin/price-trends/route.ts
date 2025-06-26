/**
 * API for price trends and analytics
 * GET /api/admin/price-trends - Get price trends for products
 */

import { NextRequest, NextResponse } from 'next/server';
import { priceHistoryService } from '@/app/services/admin/PriceHistoryService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const productId = searchParams.get('productId');
    const supplierId = searchParams.get('supplierId');
    const period = searchParams.get('period') as '7d' | '30d' | '90d' | '1y' || '30d';

    if (!productId) {
      return NextResponse.json(
        { error: 'productId parameter is required' },
        { status: 400 }
      );
    }

    const trends = await priceHistoryService.getPriceTrends(
      productId,
      supplierId || undefined,
      period
    );

    return NextResponse.json({
      success: true,
      data: trends
    });

  } catch (error) {
    console.error('Error in GET /api/admin/price-trends:', error);
    
    if (error instanceof Error && error.message.includes('No price history found')) {
      return NextResponse.json(
        { 
          error: 'No data available',
          message: 'No price history found for the specified period'
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}