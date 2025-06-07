import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');

    const where: { status?: string } = {};
    if (status) {
      where.status = status;
    }

    const uploads = await prisma.upload.findMany({
      where,
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
      take: limit
    });

    // Add detailed status information
    const detailedUploads = uploads.map(upload => ({
      ...upload,
      statusDetails: getStatusDetails(upload.status, upload.errorMessage),
      processingTime: upload.updatedAt.getTime() - upload.createdAt.getTime(),
      fileInfo: {
        name: upload.originalName,
        size: formatFileSize(upload.fileSize),
        type: upload.mimeType
      }
    }));

    return NextResponse.json({
      uploads: detailedUploads,
      summary: {
        total: uploads.length,
        byStatus: uploads.reduce((acc: Record<string, number>, upload) => {
          acc[upload.status] = (acc[upload.status] || 0) + 1;
          return acc;
        }, {}),
        averageProcessingTime: uploads
          .filter(u => u.status === 'completed')
          .reduce((sum, u) => sum + (u.updatedAt.getTime() - u.createdAt.getTime()), 0) 
          / uploads.filter(u => u.status === 'completed').length || 0
      }
    });

  } catch (error) {
    console.error('Error fetching upload logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch upload logs' },
      { status: 500 }
    );
  }
}

function getStatusDetails(status: string, errorMessage?: string | null) {
  const statusMap: Record<string, { description: string; color: string; icon: string }> = {
    pending: {
      description: 'Waiting to be processed',
      color: 'blue',
      icon: '⏳'
    },
    processing: {
      description: 'AI is analyzing the document',
      color: 'yellow',
      icon: '🔄'
    },
    completed: {
      description: 'Successfully processed and data extracted',
      color: 'green',
      icon: '✅'
    },
    failed: {
      description: errorMessage || 'Processing failed with unknown error',
      color: 'red',
      icon: '❌'
    }
  };

  return statusMap[status] || {
    description: 'Unknown status',
    color: 'gray',
    icon: '❓'
  };
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uploadId = searchParams.get('id');
    const clearAll = searchParams.get('clearAll') === 'true';

    if (clearAll) {
      // Clear all failed uploads
      const deleted = await prisma.upload.deleteMany({
        where: {
          status: 'failed'
        }
      });
      
      return NextResponse.json({
        message: `Cleared ${deleted.count} failed uploads`
      });
    }

    if (!uploadId) {
      return NextResponse.json(
        { error: 'Upload ID is required' },
        { status: 400 }
      );
    }

    await prisma.upload.delete({
      where: { id: uploadId }
    });

    return NextResponse.json({
      message: 'Upload log deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting upload log:', error);
    return NextResponse.json(
      { error: 'Failed to delete upload log' },
      { status: 500 }
    );
  }
}