/**
 * API for updating price information
 * PUT /api/admin/prices/[id] - Update price data
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { priceHistoryService } from '@/app/services/admin/PriceHistoryService';
import { priceFieldUpdateSchema, createValidationErrorResponse } from '@/app/lib/validations/admin';
import { z } from 'zod';

const prisma = new PrismaClient();

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    const currentPrice = await prisma.price.findUnique({
      where: { id: priceId },
      include: {
        product: true,
        supplier: true
      }
    });

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
    const updatedPrice = await prisma.price.update({
      where: { id: priceId },
      data: updateData,
      include: {
        product: true,
        supplier: true
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedPrice
    });

  } catch (error) {
    console.error('Error in PUT /api/admin/prices/[id]:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const priceId = params.id;
    
    // Check authentication - only admins can delete prices
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    // Check if price exists
    const price = await prisma.price.findUnique({
      where: { id: priceId },
      include: {
        product: { select: { name: true } },
        supplier: { select: { name: true } }
      }
    });

    if (!price) {
      return NextResponse.json(
        { error: 'Price not found' },
        { status: 404 }
      );
    }

    // Delete price and its history in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete price history records
      await tx.priceHistory.deleteMany({
        where: { priceId: priceId }
      });

      // Delete the price
      await tx.price.delete({
        where: { id: priceId }
      });
    });

    return NextResponse.json({
      success: true,
      message: `Price for "${price.product.name}" from "${price.supplier.name}" deleted successfully`
    });

  } catch (error) {
    console.error('Error in DELETE /api/admin/prices/[id]:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}