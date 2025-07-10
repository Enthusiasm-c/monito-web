import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../../../services/DatabaseService';
import { asyncHandler } from '../../../../../utils/errors';

export const GET = asyncHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
    const { id: uploadId } = await params;

    const upload = await databaseService.getUploadById(uploadId);

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

  });