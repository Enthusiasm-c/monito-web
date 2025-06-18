import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const unit = searchParams.get('unit') || '';
    
    const skip = (page - 1) * limit;
    
    const where = {
      AND: [
        search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { standardizedName: { contains: search, mode: 'insensitive' as const } },
            { rawName: { contains: search, mode: 'insensitive' as const } }
          ]
        } : {},
        category ? { category: { contains: category, mode: 'insensitive' as const } } : {},
        unit ? { unit: { contains: unit, mode: 'insensitive' as const } } : {}
      ]
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          prices: {
            where: { validTo: null },
            include: { supplier: true },
            orderBy: { amount: 'asc' }
          }
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.product.count({ where })
    ]);

    return NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
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
    const { name, standardizedName, category, unit, standardizedUnit, description, rawName } = body;

    if (!name || !unit) {
      return NextResponse.json(
        { error: 'Name and unit are required' },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        name,
        standardizedName: standardizedName || name.toLowerCase(),
        category: category || 'Other',
        unit,
        standardizedUnit: standardizedUnit || unit,
        description: description || null,
        rawName: rawName || name
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