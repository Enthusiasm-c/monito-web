/**
 * API for supplier price change reports
 * GET /api/admin/suppliers/[id]/price-changes - Get price change report for a supplier
 */

import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../../../services/DatabaseService';
import { asyncHandler } from '../../../../../utils/errors';

export const GET = asyncHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
    const supplierId = params.id;
    const { searchParams } = new URL(request.url);
    
    const period = searchParams.get('period') as '7d' | '30d' | '90d' || '30d';

    // Validate supplier exists
    const supplier = await databaseService.getSupplierById(supplierId);

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

  });