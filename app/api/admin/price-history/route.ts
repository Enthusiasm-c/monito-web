/**
 * API for price history operations
 * GET /api/admin/price-history - Get price history with filters
 * POST /api/admin/price-history - Record a manual price change
 */

import { NextRequest, NextResponse } from 'next/server';
import { priceHistoryService } from '@/app/services/admin/PriceHistoryService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const productId = searchParams.get('productId');
    const supplierId = searchParams.get('supplierId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (!productId) {
      return NextResponse.json(
        { error: 'productId parameter is required' },
        { status: 400 }
      );
    }

    const options = {
      limit,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      includeSupplierInfo: true
    };

    let history;
    if (supplierId) {
      // Get history for specific product and supplier
      const allHistory = await priceHistoryService.getProductHistory(productId, options);
      history = allHistory.filter(h => h.supplier?.id === supplierId);
    } else {
      // Get history for product across all suppliers
      history = await priceHistoryService.getProductHistory(productId, options);
    }

    return NextResponse.json({
      success: true,
      data: {
        history: history.map(entry => ({
          id: entry.id,
          price: parseFloat(entry.price.toString()),
          unit: entry.unit,
          unitPrice: entry.unitPrice ? parseFloat(entry.unitPrice.toString()) : null,
          quantity: entry.quantity ? parseFloat(entry.quantity.toString()) : null,
          changedFrom: entry.changedFrom ? parseFloat(entry.changedFrom.toString()) : null,
          changePercentage: entry.changePercentage,
          changeReason: entry.changeReason,
          changedBy: entry.changedBy,
          notes: entry.notes,
          createdAt: entry.createdAt,
          supplier: entry.supplier,
          upload: entry.upload
        })),
        productId,
        supplierId,
        filters: { dateFrom, dateTo, limit }
      }
    });

  } catch (error) {
    console.error('Error in GET /api/admin/price-history:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      productId,
      supplierId,
      price,
      unit,
      unitPrice,
      quantity,
      changeReason = 'manual',
      changedBy,
      notes
    } = body;

    // Validate required fields
    if (!productId || !supplierId || price === undefined || !unit) {
      return NextResponse.json(
        { error: 'Missing required fields: productId, supplierId, price, unit' },
        { status: 400 }
      );
    }

    // TODO: Add authentication check
    // const session = await getServerSession();
    // if (!session || !['admin', 'manager'].includes(session.user.role)) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const performingUserId = changedBy || 'temp-admin-user';

    const historyEntry = await priceHistoryService.recordPriceChange({
      productId,
      supplierId,
      price: parseFloat(price),
      unit,
      unitPrice: unitPrice ? parseFloat(unitPrice) : undefined,
      quantity: quantity ? parseFloat(quantity) : undefined,
      changeReason,
      changedBy: performingUserId,
      notes
    });

    return NextResponse.json({
      success: true,
      message: 'Price change recorded successfully',
      data: {
        id: historyEntry.id,
        price: parseFloat(historyEntry.price.toString()),
        unit: historyEntry.unit,
        unitPrice: historyEntry.unitPrice ? parseFloat(historyEntry.unitPrice.toString()) : null,
        changePercentage: historyEntry.changePercentage,
        changeReason: historyEntry.changeReason,
        createdAt: historyEntry.createdAt
      }
    });

  } catch (error) {
    console.error('Error in POST /api/admin/price-history:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}