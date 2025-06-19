import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: supplierId } = await params;

    // Get supplier details
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        createdAt: true
      }
    });

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Get all products with prices from this supplier
    const products = await prisma.product.findMany({
      where: {
        prices: {
          some: {
            supplierId: supplierId
          }
        }
      },
      include: {
        prices: {
          where: {
            supplierId: supplierId
          },
          include: {
            supplier: true
          }
        },
        _count: {
          select: {
            prices: true
          }
        }
      },
      orderBy: {
        standardizedName: 'asc'
      }
    });

    // Format the response with supplier-specific pricing
    const formattedProducts = products.map(product => {
      const supplierPrice = product.prices[0]; // Should only be one price per supplier per product
      
      return {
        id: product.id,
        name: product.name,
        standardizedName: product.standardizedName,
        category: product.category,
        unit: product.unit,
        price: {
          amount: supplierPrice.amount,
          unit: supplierPrice.unit,
          updatedAt: supplierPrice.updatedAt,
          createdAt: supplierPrice.createdAt
        },
        totalSuppliers: product._count.prices
      };
    });

    return NextResponse.json({
      supplier,
      products: formattedProducts
    });

  } catch (error) {
    console.error('Error fetching supplier products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supplier products' },
      { status: 500 }
    );
  }
}