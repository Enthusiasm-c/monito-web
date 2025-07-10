import { NextRequest, NextResponse } from 'next/server';
import { asyncHandler } from '../../../utils/errors';
import { parsePaginationParams } from '../../../utils/api-helpers';
import { databaseService } from '../../../services/DatabaseService';

export const GET = asyncHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const pagination = parsePaginationParams(request);

  const result = await databaseService.getSuppliers(
    { 
      page: pagination.page, 
      limit: pagination.limit, 
      offset: pagination.offset 
    }, 
    search
  );
  
  const suppliers = result.suppliers;
  const total = result.total;

  return NextResponse.json({
    suppliers,
    pagination: {
      ...pagination,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  });
});
