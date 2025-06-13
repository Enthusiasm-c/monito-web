import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const uploadId = params.id;

    const upload = await prisma.upload.findUnique({
      where: { id: uploadId },
      select: {
        id: true,
        originalName: true,
        url: true,
        mimeType: true,
        fileSize: true,
        approvalStatus: true
      }
    });

    if (!upload) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      );
    }

    if (!upload.url) {
      return NextResponse.json(
        { error: 'File URL not available' },
        { status: 404 }
      );
    }

    // For security, only allow access to pending uploads
    if (upload.approvalStatus !== 'pending_review') {
      return NextResponse.json(
        { error: 'File access not available for this upload status' },
        { status: 403 }
      );
    }

    // Return file information for frontend to handle
    return NextResponse.json({
      fileName: upload.originalName,
      fileUrl: upload.url,
      mimeType: upload.mimeType,
      fileSize: upload.fileSize,
      uploadId: upload.id
    });

  } catch (error) {
    console.error('Error fetching file info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch file information' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}