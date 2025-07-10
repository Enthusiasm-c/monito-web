import { NextRequest, NextResponse } from 'next/server';
import { asyncHandler } from '../../../utils/errors';
import { parsePaginationParams } from '../../../utils/api-helpers';
import { databaseService } from '../../../services/DatabaseService';

export const GET = asyncHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const pagination = parsePaginationParams(request);

  const where = search ? {
    OR: [
      { name: { contains: search, mode: 'insensitive' as const } },
      { email: { contains: search, mode: 'insensitive' as const } },
      { phone: { contains: search, mode: 'insensitive' as const } }
    ]
  } : {};

  const [suppliers, total] = await Promise.all([
    databaseService.getSuppliers({
      where,
      include: {
        _count: {
          select: {
            prices: true,
            uploads: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      },
      skip: pagination.offset,
      take: pagination.limit,
    }),
    databaseService.getSuppliersCount({ where })
  ]);

  return NextResponse.json({
    suppliers,
    pagination: {
      ...pagination,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  });
});
