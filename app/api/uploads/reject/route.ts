import { NextRequest, NextResponse } from 'next/server';
import { enhancedFileProcessor } from '../../../services/enhancedFileProcessor';

export async function POST(request: NextRequest) {
  try {
    const { uploadId, rejectedBy, reason } = await request.json();

    if (!uploadId || !rejectedBy || !reason) {
      return NextResponse.json(
        { error: 'Upload ID, rejector name, and rejection reason are required' },
        { status: 400 }
      );
    }

    const result = await enhancedFileProcessor.rejectUpload(uploadId, rejectedBy, reason);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Upload rejected successfully.'
    });

  } catch (error) {
    console.error('Error rejecting upload:', error);
    return NextResponse.json(
      { error: 'Failed to reject upload' },
      { status: 500 }
    );
  }
}