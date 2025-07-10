import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../../services/DatabaseService';
import { asyncHandler } from '../../../../utils/errors';

// GET /api/admin/unmatched - Get unmatched products queue
export const GET = asyncHandler(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const sortBy = searchParams.get('sortBy') || 'frequency'; // frequency, createdAt, rawName
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const offset = (page - 1) * limit;

    const where: any = {};
    
    // Filter by status
    if (status !== 'all') {
      where.status = status;
    }

    // Search in rawName and normalizedName
    if (search) {
      where.OR = [
        { rawName: { contains: search, mode: 'insensitive' as const } },
        { normalizedName: { contains: search, mode: 'insensitive' as const } }
      ];
    }

    // Build orderBy
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [entries, total, statusCounts] = await Promise.all([
      databaseService.getUnmatchedQueue({
        where,
        orderBy,
        take: limit,
        skip: offset,
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
      }),
      databaseService.getUnmatchedQueueCount({ where }),
      // Get counts by status
      databaseService.groupUnmatchedQueueBy({
        by: ['status'],
        _count: { status: true }
      })
    ]);

    const counts = statusCounts.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      data: entries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      statusCounts: {
        pending: counts.pending || 0,
        assigned: counts.assigned || 0,
        ignored: counts.ignored || 0,
        total
      }
    });

  });

// POST /api/admin/unmatched - Create unmatched entry (used by matching pipeline)
export const POST = asyncHandler(async (request: NextRequest) => {
    const body = await request.json();
    const { 
      rawName, 
      normalizedName, 
      context, 
      uploadId, 
      supplierId 
    } = body;

    if (!rawName) {
      return NextResponse.json(
        { error: 'rawName is required' },
        { status: 400 }
      );
    }

    // Check if this rawName already exists - if so, increment frequency
    const existing = await databaseService.findFirstUnmatchedQueue({
      where: {
        rawName: rawName.toLowerCase().trim(),
        status: 'pending'
      }
    });

    if (existing) {
      const updated = await databaseService.updateUnmatchedQueue({
        where: { id: existing.id },
        data: {
          frequency: existing.frequency + 1,
          context: context || existing.context,
          // Update with latest context if provided
          ...(uploadId && { uploadId }),
          ...(supplierId && { supplierId })
        }
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Unmatched entry frequency updated'
      });
    }

    // Create new entry
    const entry = await databaseService.createUnmatchedQueue({
      data: {
        rawName: rawName.toLowerCase().trim(),
        normalizedName: normalizedName?.toLowerCase().trim(),
        context,
        uploadId,
        supplierId,
        frequency: 1
      }
    });

    return NextResponse.json({
      success: true,
      data: entry,
      message: 'Unmatched entry created successfully'
    });

  });