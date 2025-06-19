import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { calcUnitPrice } from '../../../lib/utils/product-normalizer';

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

    // Calculate price comparison data with unit prices
    const activePrices = product.prices;
    const priceAmounts = activePrices.map(p => Number(p.amount));
    
    // Calculate unit prices for comparison
    const pricesWithUnitPrice = activePrices.map(price => {
      const unitPrice = price.unitPrice 
        ? Number(price.unitPrice)
        : calcUnitPrice(Number(price.amount), 1, price.unit);
      
      return {
        ...price,
        calculatedUnitPrice: unitPrice,
        amount: Number(price.amount)
      };
    });
    
    // Sort by unit price for better comparison
    const sortedByUnitPrice = [...pricesWithUnitPrice].sort((a, b) => a.calculatedUnitPrice - b.calculatedUnitPrice);
    const sortedByTotalPrice = [...pricesWithUnitPrice].sort((a, b) => a.amount - b.amount);
    
    const bestPrice = sortedByTotalPrice.length > 0 ? {
      amount: sortedByTotalPrice[0].amount,
      unitPrice: sortedByTotalPrice[0].calculatedUnitPrice,
      supplier: sortedByTotalPrice[0].supplier.name,
      supplierId: sortedByTotalPrice[0].supplier.id
    } : null;

    const highestPrice = sortedByTotalPrice.length > 0 ? {
      amount: Math.max(...priceAmounts),
      unitPrice: sortedByUnitPrice[sortedByUnitPrice.length - 1]?.calculatedUnitPrice || 0,
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
      prices: pricesWithUnitPrice.map(price => ({
        id: price.id,
        amount: price.amount,
        unit: price.unit,
        unitPrice: price.calculatedUnitPrice,
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