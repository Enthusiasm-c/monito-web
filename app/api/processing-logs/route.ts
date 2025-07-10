import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

import { databaseService } from '../../../services/DatabaseService';
import { asyncHandler } from '../../../utils/errors';

/**
 * Processing Logs API
 * View detailed processing logs and metrics
 */

export const GET = asyncHandler(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const uploadId = searchParams.get('uploadId');
    const limit = parseInt(searchParams.get('limit') || '20');
    const format = searchParams.get('format') || 'summary'; // summary, detailed, raw

    if (uploadId) {
      // Get specific upload details
      const upload = await databaseService.getUploadById(uploadId);

      if (!upload) {
        return NextResponse.json(
          { error: 'Upload not found' },
          { status: 404 }
        );
      }

      // Get processing log for this upload
      const logEntry = null; // TODO: Implement log retrieval if needed

      return NextResponse.json({
        upload: {
          id: upload.id,
          originalName: upload.originalName,
          status: upload.status,
          completenessRatio: upload.completenessRatio,
          totalRowsDetected: upload.totalRowsDetected,
          totalRowsProcessed: upload.totalRowsProcessed,
          processingTimeMs: upload.processingTimeMs,
          tokensUsed: upload.tokensUsed,
          processingCostUsd: upload.processingCostUsd,
          errorMessage: upload.errorMessage,
          createdAt: upload.createdAt,
          updatedAt: upload.updatedAt
        },
        supplier: upload.supplier,
        productsCreated: upload.prices.length,
        products: upload.prices.map(price => ({
          name: price.product.name,
          standardizedName: price.product.standardizedName,
          price: price.amount,
          unit: price.unit,
          category: price.product.category
        })),
        processingLog: logEntry
      });
    }

    // Get recent uploads with processing metrics
    const uploads = await databaseService.getUploads({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: true,
        _count: {
          select: { prices: true }
        }
      }
    });

    const summaryData = uploads.map(upload => ({
      id: upload.id,
      originalName: upload.originalName,
      supplier: upload.supplier.name,
      status: upload.status,
      completenessRatio: upload.completenessRatio,
      totalRows: upload.totalRowsDetected,
      processedRows: upload.totalRowsProcessed,
      productsCreated: upload._count.prices,
      processingTimeMs: upload.processingTimeMs,
      tokensUsed: upload.tokensUsed,
      costUsd: upload.processingCostUsd,
      createdAt: upload.createdAt,
      hasErrors: !!upload.errorMessage
    }));

    if (format === 'detailed') {
      // Add detailed metrics
      const totalUploads = summaryData.length;
      const successfulUploads = summaryData.filter(u => u.status === 'completed').length;
      const avgCompleteness = summaryData.reduce((sum, u) => sum + (u.completenessRatio || 0), 0) / totalUploads;
      const totalCost = summaryData.reduce((sum, u) => sum + (u.costUsd || 0), 0);
      const totalTokens = summaryData.reduce((sum, u) => sum + (u.tokensUsed || 0), 0);

      return NextResponse.json({
        uploads: summaryData,
        metrics: {
          totalUploads,
          successfulUploads,
          successRate: totalUploads > 0 ? successfulUploads / totalUploads : 0,
          avgCompleteness,
          totalCostUsd: totalCost,
          totalTokensUsed: totalTokens,
          avgProcessingTimeMs: summaryData.reduce((sum, u) => sum + (u.processingTimeMs || 0), 0) / totalUploads
        }
      });
    }

    return NextResponse.json({
      uploads: summaryData,
      total: summaryData.length
    });

  });