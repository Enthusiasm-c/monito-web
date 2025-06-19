import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        prices: {
          include: {
            product: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        uploads: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        _count: {
          select: {
            prices: true,
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    const existingSupplier = await prisma.supplier.findFirst({
      where: {
        name: name.trim(),
        NOT: {
          id: id
        }
      }
    });

    if (existingSupplier) {
      return NextResponse.json(
        { error: 'A supplier with this name already exists' },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        contactInfo: contactInfo?.trim() || null,
        updatedAt: new Date()
      }
    });

    return NextResponse.json(supplier);
  } catch (error) {
    console.error('Error updating supplier:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update supplier' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.supplier.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    return NextResponse.json(
      { error: 'Failed to delete supplier' },
      { status: 500 }
    );
  }
}