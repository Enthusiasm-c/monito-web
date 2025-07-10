import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../../services/DatabaseService';
import { asyncHandler } from '../../../../utils/errors';

export const GET = asyncHandler(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const offset = (page - 1) * limit;

    // Get pending uploads with supplier information
    const pendingUploads = await databaseService.getUploads({
      where: {
        approvalStatus: 'pending_review'
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    });

    // Get total count for pagination
    const totalCount = await databaseService.getUploadsCount({
      where: {
        approvalStatus: 'pending_review'
      }
    });

    const totalPages = Math.ceil(totalCount / limit);

    // Transform data to include extracted products count
    const uploadsWithDetails = pendingUploads.map(upload => {
      const extractedData = upload.extractedData as any;
      const productsCount = extractedData?.products?.length || 0;
      
      return {
        ...upload,
        estimatedProductsCount: productsCount,
        extractedProducts: extractedData?.products || []
      };
    });

    return NextResponse.json({
      uploads: uploadsWithDetails,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: totalPages
      }
    });

  });