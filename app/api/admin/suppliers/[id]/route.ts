import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../../services/DatabaseService';
import { asyncHandler } from '../../../../utils/errors';
// TEMPORARILY DISABLED - Auth imports commented out
// import { getServerSession } from 'next-auth/next';
// import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export const GET = asyncHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  
  const supplier = await databaseService.getSupplierWithDetails(id);
  
  return NextResponse.json(supplier);
});

export const PUT = asyncHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const body = await request.json();
  const { name, email, phone, address, contactInfo } = body;

  if (!name) {
    return NextResponse.json(
      { error: 'Name is required' },
      { status: 400 }
    );
  }

  const supplier = await databaseService.updateSupplier(id, {
    name,
    email: email || null,
    phone: phone || null,
    address: address || null,
    contactInfo: contactInfo || null
  });

  // Get the updated supplier with all details
  const supplierWithDetails = await databaseService.getSupplierWithDetails(id);

  return NextResponse.json(supplierWithDetails);
});

export const DELETE = asyncHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  
  // TEMPORARILY DISABLED - Authentication check commented out for debugging
  // const session = await getServerSession(authOptions);
  
  // if (!session || !session.user || session.user.role !== 'admin') {
  //   return NextResponse.json({ 
  //     error: 'Admin role required. Please log in as an admin user.',
  //     details: 'You must be logged in with an admin account to delete suppliers.',
  //     currentUser: session?.user?.email || 'Not logged in',
  //     userRole: session?.user?.role || 'none'
  //   }, { status: 403 });
  // }
  
  console.warn('⚠️ SUPPLIER DELETION - AUTH CHECK DISABLED FOR DEBUGGING');
  
  // Get the request body to check for force delete option
  const body = await request.json().catch(() => ({}));
  const { force = false } = body;
  
  const result = await databaseService.deleteSupplierWithRelations(id, force);
  
  return NextResponse.json(result);
});