import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: params.id },
      include: {
        prices: {
          where: { validTo: null },
          include: { 
            product: true 
          },
          orderBy: { amount: 'asc' }
        },
        uploads: {
          orderBy: { uploadedAt: 'desc' }
        },
        _count: {
          select: {
            prices: { where: { validTo: null } },
            uploads: true
          }
        }
      }
    });

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(supplier);

  } catch (error) {
    console.error('Error fetching supplier:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supplier' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, email, phone, address, website, contactPerson, notes } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.update({
      where: { id: params.id },
      data: {
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        website: website || null,
        contactPerson: contactPerson || null,
        notes: notes || null,
        updatedAt: new Date()
      },
      include: {
        prices: {
          where: { validTo: null },
          include: { product: true }
        },
        uploads: true,
        _count: {
          select: {
            prices: { where: { validTo: null } },
            uploads: true
          }
        }
      }
    });

    return NextResponse.json(supplier);

  } catch (error) {
    console.error('Error updating supplier:', error);
    return NextResponse.json(
      { error: 'Failed to update supplier' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if supplier has prices or uploads
    const [pricesCount, uploadsCount] = await Promise.all([
      prisma.price.count({ where: { supplierId: params.id } }),
      prisma.upload.count({ where: { supplierId: params.id } })
    ]);

    if (pricesCount > 0 || uploadsCount > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete supplier with existing prices or uploads. Archive them first.',
          details: { pricesCount, uploadsCount }
        },
        { status: 400 }
      );
    }

    await prisma.supplier.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting supplier:', error);
    return NextResponse.json(
      { error: 'Failed to delete supplier' },
      { status: 500 }
    );
  }
}