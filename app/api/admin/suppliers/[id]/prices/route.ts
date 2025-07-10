/**
 * API for managing supplier prices - bulk operations
 * DELETE /api/admin/suppliers/[id]/prices - Delete all prices for a supplier
 */

import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../../../services/DatabaseService';
import { asyncHandler } from '../../../../../utils/errors';

export const DELETE = asyncHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
    const supplierId = params.id;
    
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !['admin', 'manager'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can perform bulk deletions
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin role required for bulk deletion' }, { status: 403 });
    }

    // Get request body for additional parameters
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    const performingUserId = session.user.id;

    // Validate supplier exists
    const supplier = await databaseService.getSupplierById(supplierId);

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Perform bulk deletion
    const result = await bulkOperationsService.deleteAllSupplierPrices(
      supplierId,
      performingUserId,
      reason
    );

    if (!result.success) {
      return NextResponse.json(
        { 
          error: 'Deletion failed',
          details: result.errors
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} prices for supplier ${supplier.name}`,
      data: {
        deletedCount: result.deletedCount,
        affectedProducts: result.affectedProducts,
        operationId: result.operationId,
        timestamp: result.timestamp
      }
    });

  });

export const GET = asyncHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
    const supplierId = params.id;
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    
    const skip = (page - 1) * limit;

    // Get prices for this supplier with pagination
    const whereClause: any = {
      supplierId
    };

    if (search) {
      whereClause.product = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { standardizedName: { contains: search, mode: 'insensitive' } }
        ]
      };
    }

    const [prices, total] = await Promise.all([
      databaseService.getPrices({
        where: whereClause,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              standardizedName: true,
              category: true,
              unit: true,
              standardizedUnit: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      databaseService.getPricesCount({ where: whereClause })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        prices: prices.map(price => ({
          id: price.id,
          amount: parseFloat(price.amount.toString()),
          unit: price.unit,
          unitPrice: price.unitPrice ? parseFloat(price.unitPrice.toString()) : null,
          validFrom: price.validFrom,
          validTo: price.validTo,
          createdAt: price.createdAt,
          product: price.product
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  });