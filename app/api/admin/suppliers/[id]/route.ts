import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // First try simple query
    const supplier = await prisma.supplier.findUnique({
      where: { id }
    });

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Then get related data separately to avoid complex query issues
    const [prices, uploads, priceCounts] = await Promise.all([
      prisma.price.findMany({
        where: { 
          supplierId: id,
          validTo: null 
        },
        include: { product: true },
        orderBy: { amount: 'asc' },
        take: 20 // Limit to avoid too much data
      }),
      prisma.upload.findMany({
        where: { supplierId: id },
        orderBy: { uploadedAt: 'desc' },
        take: 10 // Limit to recent uploads
      }),
      Promise.all([
        prisma.price.count({ where: { supplierId: id, validTo: null } }),
        prisma.upload.count({ where: { supplierId: id } })
      ])
    ]);

    const result = {
      ...supplier,
      prices,
      uploads,
      _count: {
        prices: priceCounts[0],
        uploads: priceCounts[1]
      }
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching supplier:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to fetch supplier', details: error instanceof Error ? error.message : String(error) },
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

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        contactInfo: contactInfo || null,
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Check if supplier has prices or uploads
    const [pricesCount, uploadsCount] = await Promise.all([
      prisma.price.count({ where: { supplierId: id } }),
      prisma.upload.count({ where: { supplierId: id } })
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
      where: { id }
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