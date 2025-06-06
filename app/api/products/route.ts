import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const where: { category?: string; OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; standardizedName?: { contains: string; mode: 'insensitive' } }> } = {};
    
    if (category && category !== 'All Categories') {
      where.category = category;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { standardizedName: { contains: search, mode: 'insensitive' } }
      ];
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
        orderBy: {
          standardizedName: 'asc'
        }
      }),
      prisma.product.count({ where })
    ]);

    // Calculate comparison data for each product
    const productsWithComparison = products.map(product => {
      const prices = product.prices;
      const bestPrice = prices.length > 0 ? prices[0] : null;
      const highestPrice = prices.length > 0 ? 
        prices.reduce((max, current) => current.amount > max.amount ? current : max) : null;
      
      const savings = bestPrice && highestPrice && prices.length > 1 ? 
        ((Number(highestPrice.amount) - Number(bestPrice.amount)) / Number(highestPrice.amount) * 100) : 0;

      return {
        ...product,
        priceComparison: {
          bestPrice: bestPrice ? {
            amount: Number(bestPrice.amount),
            supplier: bestPrice.supplier.name,
            supplierId: bestPrice.supplierId
          } : null,
          highestPrice: highestPrice ? {
            amount: Number(highestPrice.amount),
            supplier: highestPrice.supplier.name,
            supplierId: highestPrice.supplierId
          } : null,
          supplierCount: prices.length,
          savings: Math.round(savings * 10) / 10,
          priceRange: prices.length > 1 ? {
            min: Number(bestPrice?.amount || 0),
            max: Number(highestPrice?.amount || 0)
          } : null
        }
      };
    });

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