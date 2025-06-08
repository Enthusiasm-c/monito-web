import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Get comprehensive upload status information
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Get status counts
    const statusCounts = await prisma.upload.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    // Get recent uploads (last hour)
    const recentUploads = await prisma.upload.findMany({
      where: {
        createdAt: { gt: oneHourAgo }
      },
      include: {
        supplier: { select: { name: true } },
        _count: { select: { prices: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Identify potentially stuck uploads
    const stuckPending = await prisma.upload.count({
      where: {
        status: 'pending',
        createdAt: { lt: fiveMinutesAgo }
      }
    });

    const stuckProcessing = await prisma.upload.count({
      where: {
        status: 'processing',
        updatedAt: { lt: tenMinutesAgo }
      }
    });

    // Get processing statistics
    const completedToday = await prisma.upload.count({
      where: {
        status: 'completed',
        updatedAt: { gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
      }
    });

    const failedToday = await prisma.upload.count({
      where: {
        status: 'failed',
        updatedAt: { gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
      }
    });

    // Calculate success rate
    const totalProcessedToday = completedToday + failedToday;
    const successRate = totalProcessedToday > 0 ? (completedToday / totalProcessedToday) * 100 : 0;

    // Get average processing time for completed uploads today
    const completedTodayDetails = await prisma.upload.findMany({
      where: {
        status: 'completed',
        updatedAt: { gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
      },
      select: {
        createdAt: true,
        updatedAt: true
      }
    });

    const avgProcessingTime = completedTodayDetails.length > 0 
      ? completedTodayDetails.reduce((sum, upload) => 
          sum + (upload.updatedAt.getTime() - upload.createdAt.getTime()), 0
        ) / completedTodayDetails.length / 1000 // Convert to seconds
      : 0;

    // Get recent errors
    const recentErrors = await prisma.upload.findMany({
      where: {
        status: 'failed',
        updatedAt: { gt: new Date(now.getTime() - 6 * 60 * 60 * 1000) } // Last 6 hours
      },
      select: {
        originalName: true,
        errorMessage: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' },
      take: 10
    });

    // Health assessment
    const healthStatus = getHealthStatus(stuckPending, stuckProcessing, successRate);

    return NextResponse.json({
      timestamp: now.toISOString(),
      health: healthStatus,
      summary: {
        byStatus: statusCounts.reduce((acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        totalUploads: statusCounts.reduce((sum, item) => sum + item._count.id, 0),
        successRate: Math.round(successRate * 100) / 100,
        avgProcessingTimeSeconds: Math.round(avgProcessingTime * 100) / 100
      },
      alerts: {
        stuckPending,
        stuckProcessing,
        needsAttention: stuckPending > 0 || stuckProcessing > 0
      },
      todayStats: {
        completed: completedToday,
        failed: failedToday,
        total: totalProcessedToday
      },
      recentUploads: recentUploads.map(upload => ({
        id: upload.id,
        name: upload.originalName,
        status: upload.status,
        supplier: upload.supplier.name,
        products: upload._count.prices,
        createdAt: upload.createdAt,
        updatedAt: upload.updatedAt,
        ageMinutes: Math.round((now.getTime() - upload.createdAt.getTime()) / 1000 / 60),
        processingTimeSeconds: upload.status === 'completed' 
          ? Math.round((upload.updatedAt.getTime() - upload.createdAt.getTime()) / 1000)
          : null
      })),
      recentErrors: recentErrors.map(error => ({
        name: error.originalName,
        error: error.errorMessage,
        time: error.updatedAt,
        ageMinutes: Math.round((now.getTime() - error.updatedAt.getTime()) / 1000 / 60)
      })),
      actions: {
        runStuckRecovery: '/api/process-stuck-uploads',
        viewLogs: '/api/upload-logs',
        debugUpload: '/api/upload-debug'
      }
    });

  } catch (error) {
    console.error('Error fetching upload status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch upload status',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

function getHealthStatus(stuckPending: number, stuckProcessing: number, successRate: number) {
  if (stuckPending > 5 || stuckProcessing > 3) {
    return {
      status: 'critical',
      message: 'Multiple uploads are stuck and need immediate attention',
      color: 'red'
    };
  }
  
  if (stuckPending > 0 || stuckProcessing > 0 || successRate < 80) {
    return {
      status: 'warning',
      message: 'Some uploads may need attention',
      color: 'yellow'
    };
  }
  
  if (successRate >= 95) {
    return {
      status: 'excellent',
      message: 'All systems operating normally',
      color: 'green'
    };
  }
  
  return {
    status: 'good',
    message: 'System is functioning well',
    color: 'blue'
  };
}