import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../../services/DatabaseService';
import { asyncHandler } from '../../../../utils/errors';
import { calculateUnitPrice } from '../../../../lib/utils/unified-unit-converter';

export const GET = asyncHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
    const { id: productId } = await params;

    // Get product with all its prices and suppliers
    const product = await databaseService.getProductById(productId);

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
        : calculateUnitPrice(Number(price.amount), 1, price.unit);
      
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

  });