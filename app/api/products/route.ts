import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../services/DatabaseService';
import { calculateUnitPrice } from '../../lib/utils/unified-unit-converter';
import { asyncHandler, ValidationError } from '../../utils/errors';
import { parseSearchParams, parsePaginationParams, createPaginatedResponse } from '../../utils/api-helpers';

export const GET = asyncHandler(async (request: NextRequest) => {
  const searchParams = parseSearchParams(request);
  const pagination = parsePaginationParams(request);

  const { products, total } = await databaseService.getProducts(searchParams, pagination);

  // Calculate comparison data for each product
  const productsWithComparison = await Promise.all(products.map(async product => {
    // Get all prices for products with the same standardized name and unit
    const allRelatedPrices = await databaseService.getRelatedPrices(
      product.standardizedName, 
      product.standardizedUnit
    );

    // Calculate unit prices and deduplicate by supplier
    const pricesWithUnitPrice = allRelatedPrices.map(price => {
      const unitPrice = price.unitPrice 
        ? Number(price.unitPrice)
        : calculateUnitPrice(Number(price.amount), 1, price.unit);
      
      return {
        ...price,
        calculatedUnitPrice: unitPrice,
        amount: Number(price.amount)
      };
    });
    
    // Deduplicate prices by supplier to prevent showing the same supplier multiple times
    const supplierMap = new Map<string, typeof pricesWithUnitPrice[0]>();
    
    for (const price of pricesWithUnitPrice) {
      const supplierId = price.supplierId;
      
      // Keep the best (lowest) unit price for each supplier
      if (!supplierMap.has(supplierId) || price.calculatedUnitPrice < supplierMap.get(supplierId)!.calculatedUnitPrice) {
        supplierMap.set(supplierId, price);
      }
    }
    
    const deduplicatedPrices = Array.from(supplierMap.values()).sort((a, b) => a.calculatedUnitPrice - b.calculatedUnitPrice);

    const bestPrice = deduplicatedPrices.length > 0 ? deduplicatedPrices[0] : null;
    const highestPrice = deduplicatedPrices.length > 0 ? 
      deduplicatedPrices.reduce((max, current) => current.calculatedUnitPrice > max.calculatedUnitPrice ? current : max) : null;
    
    // Calculate savings based on unit price for better comparison
    const savings = bestPrice && highestPrice && deduplicatedPrices.length > 1 ? 
      ((highestPrice.calculatedUnitPrice - bestPrice.calculatedUnitPrice) / highestPrice.calculatedUnitPrice * 100) : 0;

    return {
      ...product,
      prices: deduplicatedPrices.map(price => ({
        ...price,
        amount: price.amount,
        unitPrice: price.calculatedUnitPrice
      })),
      priceComparison: {
        bestPrice: bestPrice ? {
          amount: bestPrice.amount,
          unitPrice: bestPrice.calculatedUnitPrice,
          supplier: bestPrice.supplier.name,
          supplierId: bestPrice.supplierId
        } : null,
        highestPrice: highestPrice ? {
          amount: highestPrice.amount,
          unitPrice: highestPrice.calculatedUnitPrice,
          supplier: highestPrice.supplier.name,
          supplierId: highestPrice.supplierId
        } : null,
        supplierCount: deduplicatedPrices.length,
        savings: Math.round(savings * 10) / 10,
        priceRange: deduplicatedPrices.length > 1 ? {
          min: bestPrice?.amount || 0,
          max: highestPrice?.amount || 0,
          minUnitPrice: bestPrice?.calculatedUnitPrice || 0,
          maxUnitPrice: highestPrice?.calculatedUnitPrice || 0
        } : null
      }
    };
  }));

  // Sort products based on calculated fields (price, suppliers, savings)
  if (searchParams.sortBy === 'price' || searchParams.sortBy === 'suppliers' || searchParams.sortBy === 'savings') {
    productsWithComparison.sort((a, b) => {
      let aValue: number = 0;
      let bValue: number = 0;
      
      switch (searchParams.sortBy) {
        case 'price':
          aValue = a.priceComparison.bestPrice?.amount || Number.MAX_VALUE;
          bValue = b.priceComparison.bestPrice?.amount || Number.MAX_VALUE;
          break;
        case 'suppliers':
          aValue = a.priceComparison.supplierCount;
          bValue = b.priceComparison.supplierCount;
          break;
        case 'savings':
          aValue = a.priceComparison.savings;
          bValue = b.priceComparison.savings;
          break;
      }
      
      if (searchParams.sortOrder === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
  }

  const response = createPaginatedResponse(productsWithComparison, total, pagination);
  return NextResponse.json({
    products: response.data,
    pagination: response.pagination
  });
});

export const POST = asyncHandler(async (request: NextRequest) => {
  const body = await request.json();
  const { name, category, unit, description } = body;

  if (!name || !unit) {
    throw new ValidationError('Product name and unit are required');
  }

  const product = await databaseService.createProduct({
    name,
    category,
    unit,
    description
  });

  return NextResponse.json(product);
});