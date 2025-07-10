/**
 * API for updating price information
 * PUT /api/admin/prices/[id] - Update price data
 */

import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../../services/DatabaseService';
import { asyncHandler } from '../../../../utils/errors';

export const PUT = asyncHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
    const priceId = params.id;
    
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !['admin', 'manager'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    try {
      const validatedData = priceFieldUpdateSchema.parse(body);
      var { field, value } = validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          createValidationErrorResponse(error),
          { status: 400 }
        );
      }
      throw error;
    }

    // Get current price to compare for history
    const currentPrice = await databaseService.getPriceById(priceId);

    if (!currentPrice) {
      return NextResponse.json(
        { error: 'Price not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    let updateData: any = {
      [field]: field === 'amount' || field === 'unitPrice' ? parseFloat(value) : value,
      updatedAt: new Date()
    };

    // If updating amount, record price history
    if (field === 'amount' && parseFloat(value) !== parseFloat(currentPrice.amount.toString())) {
      const oldAmount = parseFloat(currentPrice.amount.toString());
      const newAmount = parseFloat(value);
      
      await priceHistoryService.recordPriceChange({
        priceId: priceId,
        productId: currentPrice.productId,
        supplierId: currentPrice.supplierId,
        changedFrom: oldAmount,
        changedTo: newAmount,
        changeReason: 'Manual edit via admin interface',
        changedById: session.user.id
      });
    }

    // Update the price
    const updatedPrice = await databaseService.updatePrice(priceId, updateData);

    return NextResponse.json({
      success: true,
      data: updatedPrice
    });

  });

export const DELETE = asyncHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
    const priceId = params.id;
    
    // Check authentication - only admins can delete prices
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    // Check if price exists
    const price = await databaseService.getPriceById(priceId);

    if (!price) {
      return NextResponse.json(
        { error: 'Price not found' },
        { status: 404 }
      );
    }

    // Delete price and its history in a transaction
    await databaseService.executeTransaction(async (tx) => {
      // Delete price history records
      await databaseService.deletePriceHistory(tx, {
        where: { priceId: priceId }
      });

      // Delete the price
      await databaseService.deletePrice(tx, {
        where: { id: priceId }
      });
    });

    return NextResponse.json({
      success: true,
      message: `Price for "${price.product.name}" from "${price.supplier.name}" deleted successfully`
    });

  });