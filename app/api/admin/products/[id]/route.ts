import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

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
    const body = await request.json();
    const { name, standardizedName, category, unit, standardizedUnit, description, rawName } = body;

    if (!name || !unit) {
      return NextResponse.json(
        { error: 'Name and unit are required' },
        { status: 400 }
      );
    }

    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        name,
        standardizedName: standardizedName || name.toLowerCase(),
        category: category || 'Other',
        unit,
        standardizedUnit: standardizedUnit || unit,
        description: description || null,
        rawName: rawName || name,
        updatedAt: new Date()
      },
      include: {
        prices: {
          where: { validTo: null },
          include: { supplier: true }
        }
      }
    });

    return NextResponse.json(product);

  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if product has prices
    const pricesCount = await prisma.price.count({
      where: { productId: params.id }
    });

    if (pricesCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete product with existing prices. Archive prices first.' },
        { status: 400 }
      );
    }

    await prisma.product.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}