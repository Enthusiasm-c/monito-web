import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../services/DatabaseService';
import { asyncHandler, ValidationError } from '../../utils/errors';

export const GET = asyncHandler(async () => {
  const { suppliers } = await databaseService.getSuppliers();
  return NextResponse.json(suppliers);
});

export const POST = asyncHandler(async (request: NextRequest) => {
  const body = await request.json();
  const { name, email, phone, address, contactInfo } = body;

  if (!name) {
    throw new ValidationError('Supplier name is required');
  }

  const supplier = await databaseService.createSupplier({
    name,
    email,
    phone,
    address,
    contactInfo
  });

  return NextResponse.json(supplier);
});