import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../../services/DatabaseService';
import { asyncHandler } from '../../../../utils/errors';

// PUT /api/admin/unmatched/[id] - Assign unmatched product to existing product
export const PUT = asyncHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
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

    // Get the unmatched entry to get raw name
    const unmatchedEntry = await databaseService.getUnmatchedQueueEntry(id);
    
    // Assign the unmatched entry to product
    const updatedEntry = await databaseService.assignUnmatchedToProduct(
      id, 
      productId, 
      assignedBy || 'admin', 
      notes
    );

    // Try to create alias
    let createdAlias = null;
    let aliasSkipped = false;
    try {
      createdAlias = await databaseService.createProductAlias(
        productId,
        unmatchedEntry.rawName.toLowerCase().trim(),
        'auto'
      );
    } catch (error: any) {
      // Alias already exists, that's okay
      if (error.code === 'P2002') {
        aliasSkipped = true;
      } else {
        throw error;
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedEntry,
      alias: createdAlias,
      aliasSkipped: aliasSkipped,
      message: 'Unmatched product assigned successfully'
    });

  } else if (action === 'ignore') {
    // Mark as ignored
    const updatedEntry = await databaseService.ignoreUnmatchedEntry(
      id,
      assignedBy || 'admin',
      notes
    );

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
});

// GET /api/admin/unmatched/[id] - Get specific unmatched entry
export const GET = asyncHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const { id } = params;
  
  const entry = await databaseService.getUnmatchedQueueEntry(id);

  return NextResponse.json({
    success: true,
    data: entry
  });
});

// DELETE /api/admin/unmatched/[id] - Delete unmatched entry
export const DELETE = asyncHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const { id } = params;

  await databaseService.deleteUnmatchedEntry(id);

  return NextResponse.json({
    success: true,
    message: 'Unmatched entry deleted successfully'
  });
});