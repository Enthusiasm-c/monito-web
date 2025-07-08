import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const prisma = new PrismaClient();

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
        orderBy: { createdAt: 'desc' },
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
    
    // Check authentication - only admins can delete suppliers
    const session = await getServerSession(authOptions);
    
    // Debug logging
    console.log('Delete supplier - Session:', session);
    console.log('Delete supplier - User:', session?.user);
    console.log('Delete supplier - Role:', session?.user?.role);
    
    if (!session || !session.user || session.user.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Admin role required',
        debug: {
          hasSession: !!session,
          hasUser: !!session?.user,
          userRole: session?.user?.role || 'none'
        }
      }, { status: 403 });
    }
    
    // Get the request body to check for force delete option
    const body = await request.json().catch(() => ({}));
    const { force = false } = body;
    
    // Check if supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      select: { id: true, name: true }
    });

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Check related data counts
    const [pricesCount, uploadsCount] = await Promise.all([
      prisma.price.count({ where: { supplierId: id } }),
      prisma.upload.count({ where: { supplierId: id } })
    ]);

    if ((pricesCount > 0 || uploadsCount > 0) && !force) {
      return NextResponse.json(
        { 
          error: 'Cannot delete supplier with existing prices or uploads. Use force=true to delete all related data.',
          details: { pricesCount, uploadsCount }
        },
        { status: 400 }
      );
    }

    // Force delete - remove all related data first
    if (force && (pricesCount > 0 || uploadsCount > 0)) {
      await prisma.$transaction(async (tx) => {
        // Delete price history first (references prices)
        await tx.priceHistory.deleteMany({
          where: { 
            price: {
              supplierId: id
            }
          }
        });

        // Delete prices
        await tx.price.deleteMany({
          where: { supplierId: id }
        });

        // Delete unmatched queue items
        await tx.unmatchedQueue.deleteMany({
          where: { 
            upload: {
              supplierId: id
            }
          }
        });

        // Delete uploads
        await tx.upload.deleteMany({
          where: { supplierId: id }
        });

        // Finally delete supplier
        await tx.supplier.delete({
          where: { id }
        });
      });

      return NextResponse.json({ 
        success: true,
        message: `Supplier "${supplier.name}" and all related data deleted successfully`,
        deletedData: {
          prices: pricesCount,
          uploads: uploadsCount
        }
      });
    } else {
      // Normal delete (no related data)
      await prisma.supplier.delete({
        where: { id }
      });

      return NextResponse.json({ 
        success: true,
        message: `Supplier "${supplier.name}" deleted successfully`
      });
    }

  } catch (error) {
    console.error('Error deleting supplier:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete supplier',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}