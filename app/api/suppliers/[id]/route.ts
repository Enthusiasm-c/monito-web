import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../../services/DatabaseService';
import { asyncHandler } from '../../../../utils/errors';

export const GET = asyncHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
    const { id } = await params;
    const supplier = await databaseService.getSupplierById(id);

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(supplier);
  });

export const PUT = asyncHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
    const { id } = await params;
    const body = await request.json();
    const { name, email, phone, address, contactInfo } = body;

    // Validate required field
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Supplier name is required' },
        { status: 400 }
      );
    }

    // Check if another supplier exists with the same name (excluding current supplier)
    const existingSupplier = await databaseService.getSupplierByName(name.trim());

    if (existingSupplier) {
      return NextResponse.json(
        { error: 'A supplier with this name already exists' },
        { status: 400 }
      );
    }

    const supplier = await databaseService.updateSupplier(id, {
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        contactInfo: contactInfo?.trim() || null,
        updatedAt: new Date()
    });

    return NextResponse.json(supplier);
  });

export const DELETE = asyncHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
    const { id } = await params;
    await databaseService.deleteSupplier(id);

    return NextResponse.json({ message: 'Supplier deleted successfully' });
  });