import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { productFieldUpdateSchema, createValidationErrorResponse } from '@/app/lib/validations/admin';
import { z } from 'zod';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        prices: {
          where: { validTo: null },
          include: { 
            supplier: true,
            upload: true 
          },
          orderBy: { amount: 'asc' }
        }
      }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(product);

  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Update the product
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        [field]: value,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedProduct
    });

  } catch (error) {
    console.error('Error in PUT /api/admin/products/[id]:', error);
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
    const productId = params.id;
    
    // Check authentication - only admins can delete products
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { _count: { select: { prices: true } } }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Delete all related prices first, then the product
    await prisma.$transaction(async (tx) => {
      // Delete price history
      await tx.priceHistory.deleteMany({
        where: { 
          price: {
            productId: productId
          }
        }
      });

      // Delete prices
      await tx.price.deleteMany({
        where: { productId: productId }
      });

      // Delete the product
      await tx.product.delete({
        where: { id: productId }
      });
    });

    return NextResponse.json({
      success: true,
      message: `Product "${product.name}" and ${product._count.prices} related prices deleted successfully`
    });

  } catch (error) {
    console.error('Error in DELETE /api/admin/products/[id]:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}