import { NextRequest, NextResponse } from 'next/server';
import { enhancedFileProcessor } from '../../../services/enhancedFileProcessor';

export async function POST(request: NextRequest) {
  try {
    const { uploadId, approvedBy, reviewNotes } = await request.json();

    if (!uploadId || !approvedBy) {
      return NextResponse.json(
        { error: 'Upload ID and approver name are required' },
        { status: 400 }
      );
    }

    const result = await enhancedFileProcessor.approveUpload(uploadId, approvedBy, reviewNotes);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      productsCreated: result.productsCreated,
      message: `Upload approved successfully. Created ${result.productsCreated} products.`
    });

  } catch (error) {
    console.error('Error approving upload:', error);
    return NextResponse.json(
      { error: 'Failed to approve upload' },
      { status: 500 }
    );
  }
}