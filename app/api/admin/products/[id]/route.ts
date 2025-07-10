import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { databaseService } from '../../../../services/DatabaseService';
import { asyncHandler } from '../../../../utils/errors';
import { productFieldUpdateSchema } from '../../../../lib/schemas/product';
import { z } from 'zod';
import { createValidationErrorResponse } from '../../../../utils/validation';

export const GET = asyncHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
    const product = await databaseService.getProductById(params.id);

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(product);

  });

export const PUT = asyncHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
    const productId = params.id;
    
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !['admin', 'manager'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    try {
      const validatedData = productFieldUpdateSchema.parse(body);
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

    // Validate product exists
    const product = await databaseService.getProductById(productId);

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Update the product
    const updatedProduct = await databaseService.updateProduct(productId, {
        [field]: value,
        updatedAt: new Date()
      });

    return NextResponse.json({
      success: true,
      data: updatedProduct
    });

  });

export const DELETE = asyncHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
    const productId = params.id;
    
    // Check authentication - only admins and managers can delete products
    const session = await getServerSession(authOptions);
    if (!session || !['admin', 'manager'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Admin or Manager role required' }, { status: 403 });
    }

    // Check if product exists
    const product = await databaseService.getProductById(productId);

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Delete all related prices first, then the product
    await databaseService.executeTransaction(async (tx) => {
      // Delete price history
      await databaseService.deletePriceHistory(tx, {
        where: { 
          price: {
            productId: productId
          }
        }
      });

      // Delete prices
      await databaseService.deletePrices(tx, {
        where: { productId: productId }
      });

      // Delete the product
      await databaseService.deleteProduct(tx, {
        where: { id: productId }
      });
    });

    return NextResponse.json({
      success: true,
      message: `Product "${product.name}" and ${product._count.prices} related prices deleted successfully`
    });

  });