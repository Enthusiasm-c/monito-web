import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

// PUT /api/admin/unmatched/[id] - Assign unmatched product to existing product
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { action, productId, notes, assignedBy } = body;
    const { id } = params;

    if (action === 'assign') {
      if (!productId) {
        return NextResponse.json(
          { error: 'productId is required for assignment' },
          { status: 400 }
        );
      }

      // Check if the unmatched entry exists
      const unmatchedEntry = await prisma.unmatchedQueue.findUnique({
        where: { id }
      });

      if (!unmatchedEntry) {
        return NextResponse.json(
          { error: 'Unmatched entry not found' },
          { status: 404 }
        );
      }

      // Check if the target product exists
      const targetProduct = await prisma.product.findUnique({
        where: { id: productId }
      });

      if (!targetProduct) {
        return NextResponse.json(
          { error: 'Target product not found' },
          { status: 404 }
        );
      }

      // Start a transaction to assign and create alias
      const result = await prisma.$transaction(async (tx) => {
        // Update the unmatched entry to assigned status
        const updatedEntry = await tx.unmatchedQueue.update({
          where: { id },
          data: {
            status: 'assigned',
            assignedProductId: productId,
            assignedBy: assignedBy || 'admin',
            assignedAt: new Date(),
            notes
          },
          include: {
            assignedProduct: {
              select: { id: true, name: true, standardizedName: true }
            },
            supplier: {
              select: { id: true, name: true }
            }
          }
        });

        // Create a product alias from the raw name
        const aliasData = {
          productId: productId,
          alias: unmatchedEntry.rawName.toLowerCase().trim(),
          language: 'auto' // Auto-detected language
        };

        // Check if alias already exists
        const existingAlias = await tx.productAlias.findUnique({
          where: { alias: aliasData.alias }
        });

        let createdAlias = null;
        if (!existingAlias) {
          createdAlias = await tx.productAlias.create({
            data: aliasData
          });
        }

        return {
          updatedEntry,
          createdAlias,
          aliasSkipped: !!existingAlias
        };
      });

      return NextResponse.json({
        success: true,
        data: result.updatedEntry,
        alias: result.createdAlias,
        aliasSkipped: result.aliasSkipped,
        message: 'Unmatched product assigned successfully'
      });

    } else if (action === 'ignore') {
      // Mark as ignored
      const updatedEntry = await prisma.unmatchedQueue.update({
        where: { id },
        data: {
          status: 'ignored',
          assignedBy: assignedBy || 'admin',
          assignedAt: new Date(),
          notes
        }
      });

      return NextResponse.json({
        success: true,
        data: updatedEntry,
        message: 'Unmatched product marked as ignored'
      });

    } else {
      return NextResponse.json(
        { error: 'action must be "assign" or "ignore"' },
        { status: 400 }
      );
    }

  } catch (error: any) {
    console.error('Unmatched assignment error:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Unmatched entry not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to process unmatched assignment' },
      { status: 500 }
    );
  }
}

// GET /api/admin/unmatched/[id] - Get specific unmatched entry
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const entry = await prisma.unmatchedQueue.findUnique({
      where: { id },
      include: {
        supplier: {
          select: { id: true, name: true }
        },
        upload: {
          select: { id: true, originalName: true, createdAt: true }
        },
        assignedProduct: {
          select: { id: true, name: true, standardizedName: true }
        }
      }
    });

    if (!entry) {
      return NextResponse.json(
        { error: 'Unmatched entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: entry
    });

  } catch (error) {
    console.error('Unmatched fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unmatched entry' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/unmatched/[id] - Delete unmatched entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    await prisma.unmatchedQueue.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: 'Unmatched entry deleted successfully'
    });

  } catch (error: any) {
    console.error('Unmatched deletion error:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Unmatched entry not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete unmatched entry' },
      { status: 500 }
    );
  }
}