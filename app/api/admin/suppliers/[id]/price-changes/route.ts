/**
 * API for supplier price change reports
 * GET /api/admin/suppliers/[id]/price-changes - Get price change report for a supplier
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { priceHistoryService } from '@/app/services/admin/PriceHistoryService';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supplierId = params.id;
    const { searchParams } = new URL(request.url);
    
    const period = searchParams.get('period') as '7d' | '30d' | '90d' || '30d';

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

    const report = await priceHistoryService.getSupplierPriceChanges(
      supplierId,
      period
    );

    return NextResponse.json({
      success: true,
      data: {
        supplier: {
          id: supplier.id,
          name: supplier.name
        },
        report: {
          ...report,
          recentChanges: report.recentChanges.map(change => ({
            id: change.id,
            price: parseFloat(change.price.toString()),
            unit: change.unit,
            unitPrice: change.unitPrice ? parseFloat(change.unitPrice.toString()) : null,
            changedFrom: change.changedFrom ? parseFloat(change.changedFrom.toString()) : null,
            changePercentage: change.changePercentage,
            changeReason: change.changeReason,
            changedBy: change.changedBy,
            notes: change.notes,
            createdAt: change.createdAt,
            supplier: change.supplier,
            upload: change.upload
          }))
        }
      }
    });

  } catch (error) {
    console.error('Error in GET /api/admin/suppliers/[id]/price-changes:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}