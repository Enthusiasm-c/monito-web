/**
 * API for bulk operations
 * POST /api/admin/bulk-operations - Perform bulk operations (update/delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { bulkOperationsService } from '@/app/services/admin/BulkOperationsService';

interface BulkOperationRequest {
  operation: 'update_prices' | 'update_products' | 'update_suppliers' | 'delete_products';
  data: any[];
  userId?: string;
  reason?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: BulkOperationRequest = await request.json();
    
    const { operation, data, userId, reason } = body;

    if (!operation || !data || !Array.isArray(data)) {
      return NextResponse.json(
        { error: 'Missing required fields: operation, data (array)' },
        { status: 400 }
      );
    }

    if (data.length === 0) {
      return NextResponse.json(
        { error: 'Data array cannot be empty' },
        { status: 400 }
      );
    }

    // TODO: Add authentication check
    // const session = await getServerSession();
    // if (!session || !['admin', 'manager'].includes(session.user.role)) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const performingUserId = userId || 'temp-admin-user';

    let result;

    switch (operation) {
      case 'update_prices':
        result = await bulkOperationsService.bulkUpdatePrices(data, performingUserId);
        break;
        
      case 'update_products':
        result = await bulkOperationsService.bulkUpdateProducts(data, performingUserId);
        break;
        
      case 'update_suppliers':
        result = await bulkOperationsService.bulkUpdateSuppliers(data, performingUserId);
        break;
        
      case 'delete_products':
        const productIds = data.map(item => typeof item === 'string' ? item : item.id);
        result = await bulkOperationsService.bulkDeleteProducts(
          productIds, 
          performingUserId, 
          reason
        );
        break;
        
      default:
        return NextResponse.json(
          { error: `Unsupported operation: ${operation}` },
          { status: 400 }
        );
    }

    if (!result.success && result.updatedCount === 0 && result.deletedCount === 0) {
      return NextResponse.json(
        { 
          error: 'Operation failed',
          details: 'failedUpdates' in result ? result.failedUpdates : result.errors
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Bulk ${operation} completed`,
      data: result
    });

  } catch (error) {
    console.error('Error in POST /api/admin/bulk-operations:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') as '24h' | '7d' | '30d' || '24h';

    const stats = await bulkOperationsService.getOperationStats(timeframe);

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error in GET /api/admin/bulk-operations:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}