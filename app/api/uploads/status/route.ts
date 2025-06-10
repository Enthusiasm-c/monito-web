import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const uploads = await prisma.upload.findMany({
      include: {
        supplier: true,
        prices: {
          select: {
            id: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    // Add enhanced metrics and count
    const uploadsWithMetrics = uploads.map(upload => ({
      ...upload,
      _count: {
        prices: upload.prices.length
      },
      prices: undefined, // Remove prices data, only keep count
      // Enhanced processing metrics
      processingMetrics: {
        completenessRatio: upload.completenessRatio,
        totalRows: upload.totalRowsDetected,
        processedRows: upload.totalRowsProcessed,
        processingTimeMs: upload.processingTimeMs,
        tokensUsed: upload.tokensUsed,
        costUsd: upload.processingCostUsd,
        sheetsProcessed: upload.sheetsProcessed
      }
    }));

    return NextResponse.json(uploadsWithMetrics);
  } catch (error) {
    console.error('Error fetching upload status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch upload status' },
      { status: 500 }
    );
  }
}