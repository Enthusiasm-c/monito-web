/**
 * API for managing supplier prices - bulk operations
 * DELETE /api/admin/suppliers/[id]/prices - Delete all prices for a supplier
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { bulkOperationsService } from '@/app/services/admin/BulkOperationsService';

const prisma = new PrismaClient();

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, name: true }
    });

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

  } catch (error) {
    console.error('Error in DELETE /api/admin/suppliers/[id]/prices:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
      prisma.price.findMany({
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
      prisma.price.count({ where: whereClause })
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

  } catch (error) {
    console.error('Error in GET /api/admin/suppliers/[id]/prices:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}