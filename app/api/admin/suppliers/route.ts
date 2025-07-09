import { NextRequest, NextResponse } from 'next/server';
import { asyncHandler } from '../../../../utils/errors';
import { databaseService } from '../../../../services/DatabaseService';
import { parsePaginationParams } from '../../../../utils/api-helpers';

export const GET = asyncHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const pagination = parsePaginationParams(request);

  const { suppliers, total } = await databaseService.getSuppliers(pagination, search);

  return NextResponse.json({
    suppliers,
    pagination: {
      ...pagination,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  });
});

export const POST = asyncHandler(async (request: NextRequest) => {
  const body = await request.json();
  const { name, email, phone, address, contactInfo } = body;

  const supplier = await databaseService.createSupplier({
    name,
    email,
    phone,
    address,
    contactInfo,
  });

  return NextResponse.json(supplier);
});
