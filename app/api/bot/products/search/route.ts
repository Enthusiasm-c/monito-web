import { NextRequest, NextResponse } from 'next/server';
import { authenticateBot } from '../../middleware';

import { databaseService } from '../../../../services/DatabaseService';
import { asyncHandler } from '../../../../utils/errors';

// Simple product search API for Telegram bot
export const GET = asyncHandler(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    // Search for products with fuzzy matching
    const products = await databaseService.getProducts({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { standardizedName: { contains: query, mode: 'insensitive' } },
          { rawName: { contains: query, mode: 'insensitive' } }
        ]
      },
      include: {
        prices: {
          where: {
            validTo: null // Only current prices
          },
          include: {
            supplier: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            amount: 'asc'
          }
        }
      },
      take: limit
    });

    // Format response for bot
    const formattedProducts = products.map(product => {
      // Group prices by supplier (deduplicate)
      const supplierPrices = new Map();
      
      product.prices.forEach(price => {
        const supplierId = price.supplierId;
        if (!supplierPrices.has(supplierId) || price.amount < supplierPrices.get(supplierId).amount) {
          supplierPrices.set(supplierId, {
            supplier_id: supplierId,
            supplier_name: price.supplier.name,
            amount: Number(price.amount),
            currency: price.currency || 'IDR'
          });
        }
      });

      const pricesList = Array.from(supplierPrices.values()).sort((a, b) => a.amount - b.amount);
      const minPrice = pricesList.length > 0 ? pricesList[0].amount : null;
      const maxPrice = pricesList.length > 0 ? pricesList[pricesList.length - 1].amount : null;

      return {
        id: product.id,
        name: product.name,
        standardized_name: product.standardizedName,
        unit: product.unit,
        category: product.category,
        prices: pricesList,
        price_range: {
          min: minPrice,
          max: maxPrice,
          supplier_count: pricesList.length
        }
      };
    });

    return NextResponse.json({
      products: formattedProducts,
      count: formattedProducts.length,
      query: query
    });

  });