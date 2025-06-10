import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;

    // Get product with all its prices and suppliers
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        prices: {
          where: {
            validTo: null // Only active prices
          },
          include: {
            supplier: true
          },
          orderBy: {
            amount: 'asc'
          }
        }
      }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Calculate price comparison data
    const activePrices = product.prices;
    const priceAmounts = activePrices.map(p => Number(p.amount));
    
    const bestPrice = activePrices.length > 0 ? {
      amount: Number(activePrices[0].amount),
      supplier: activePrices[0].supplier.name,
      supplierId: activePrices[0].supplier.id
    } : null;

    const highestPrice = activePrices.length > 0 ? {
      amount: Math.max(...priceAmounts),
      supplier: activePrices.find(p => Number(p.amount) === Math.max(...priceAmounts))?.supplier.name || '',
      supplierId: activePrices.find(p => Number(p.amount) === Math.max(...priceAmounts))?.supplier.id || ''
    } : null;

    const savings = bestPrice && highestPrice && bestPrice.amount !== highestPrice.amount
      ? Math.round(((highestPrice.amount - bestPrice.amount) / highestPrice.amount) * 100)
      : 0;

    const priceRange = activePrices.length > 0 ? {
      min: Math.min(...priceAmounts),
      max: Math.max(...priceAmounts)
    } : null;

    // Format the response to match the main products API structure
    const formattedProduct = {
      id: product.id,
      name: product.name,
      standardizedName: product.standardizedName,
      category: product.category,
      unit: product.unit,
      priceComparison: {
        bestPrice,
        highestPrice,
        supplierCount: activePrices.length,
        savings,
        priceRange
      },
      prices: activePrices.map(price => ({
        id: price.id,
        amount: price.amount,
        unit: price.unit,
        supplier: price.supplier,
        createdAt: price.createdAt,
        updatedAt: price.updatedAt,
        product: {
          rawName: product.rawName,
          name: product.name
        }
      }))
    };

    return NextResponse.json(formattedProduct);

  } catch (error) {
    console.error('Error fetching product details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product details' },
      { status: 500 }
    );
  }
}