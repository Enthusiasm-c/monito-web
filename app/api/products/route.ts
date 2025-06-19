import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { calcUnitPrice } from '../../lib/utils/product-normalizer';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const offset = (page - 1) * limit;

    interface WhereClause {
      category?: string;
      OR?: Array<{
        name?: { contains: string; mode: 'insensitive' };
        standardizedName?: { contains: string; mode: 'insensitive' };
        category?: { contains: string; mode: 'insensitive' };
        prices?: {
          some: {
            supplier: {
              name: { contains: string; mode: 'insensitive' };
            };
          };
        };
      }>;
    }
    
    const where: WhereClause = {};
    
    if (category && category !== 'All Categories') {
      where.category = category;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { standardizedName: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { 
          prices: {
            some: {
              supplier: {
                name: { contains: search, mode: 'insensitive' }
              }
            }
          }
        }
      ];
    }

    // Create orderBy object based on sortBy parameter
    interface OrderBy {
      standardizedName?: 'asc' | 'desc';
      category?: 'asc' | 'desc';
      unit?: 'asc' | 'desc';
    }
    
    let orderBy: OrderBy = { standardizedName: 'asc' }; // default
    
    switch (sortBy) {
      case 'name':
        orderBy = { standardizedName: sortOrder as 'asc' | 'desc' };
        break;
      case 'category':
        orderBy = { category: sortOrder as 'asc' | 'desc' };
        break;
      case 'unit':
        orderBy = { unit: sortOrder as 'asc' | 'desc' };
        break;
      default:
        orderBy = { standardizedName: sortOrder as 'asc' | 'desc' };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          prices: {
            include: {
              supplier: true
            },
            where: {
              validTo: null // Only current prices
            },
            orderBy: {
              amount: 'asc'
            }
          }
        },
        skip: offset,
        take: limit,
        orderBy: orderBy
      }),
      prisma.product.count({ where })
    ]);

    // Calculate comparison data for each product
    const productsWithComparison = await Promise.all(products.map(async product => {
      // Get all prices for products with the same standardized name and unit
      const allRelatedPrices = await prisma.price.findMany({
        where: {
          product: {
            standardizedName: product.standardizedName,
            standardizedUnit: product.standardizedUnit
          },
          validTo: null
        },
        include: {
          supplier: true,
          product: {
            select: {
              rawName: true,
              name: true,
              id: true
            }
          }
        },
        orderBy: {
          amount: 'asc'
        }
      });

      // Calculate unit prices and deduplicate by supplier
      const pricesWithUnitPrice = allRelatedPrices.map(price => {
        const unitPrice = price.unitPrice 
          ? Number(price.unitPrice)
          : calcUnitPrice(Number(price.amount), 1, price.unit);
        
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
    if (sortBy === 'price' || sortBy === 'suppliers' || sortBy === 'savings') {
      productsWithComparison.sort((a, b) => {
        let aValue: number = 0;
        let bValue: number = 0;
        
        switch (sortBy) {
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
        
        if (sortOrder === 'asc') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      });
    }

    return NextResponse.json({
      products: productsWithComparison,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, category, unit, description } = body;

    if (!name || !unit) {
      return NextResponse.json(
        { error: 'Product name and unit are required' },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        name,
        standardizedName: name.toLowerCase().trim(),
        category: category || 'Other',
        unit,
        standardizedUnit: unit.toLowerCase(),
        description
      }
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}