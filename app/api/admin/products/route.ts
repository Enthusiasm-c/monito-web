import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../services/DatabaseService';
import { asyncHandler } from '../../../utils/errors';

export const GET = asyncHandler(async (request: NextRequest) => {
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

    const searchOptions = {
      search: search,
      category: category || 'All Categories',
      sortBy: 'name',
      sortOrder: 'asc' as const
    };
    
    const paginationParams = {
      page: page,
      limit: limit,
      offset: skip
    };
    
    const result = await databaseService.getProducts(searchOptions, paginationParams);
    const products = result.products;
    const total = result.total;

    return NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  });

export const POST = asyncHandler(async (request: NextRequest) => {
    const body = await request.json();
    const { name, standardizedName, category, unit, standardizedUnit, description, rawName } = body;

    if (!name || !unit) {
      return NextResponse.json(
        { error: 'Name and unit are required' },
        { status: 400 }
      );
    }

    const product = await databaseService.createProduct({
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

  });