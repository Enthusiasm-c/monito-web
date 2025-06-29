import { NextRequest, NextResponse } from 'next/server';
import { AsyncFileProcessor } from '../../../../services/background/AsyncFileProcessor';
import { prisma } from '../../../../../lib/prisma';

export async function POST(request: NextRequest) {
  console.log('=== Reprocess endpoint called ===');
  
  try {
    // Parse request body
    let body;
    try {
      body = await request.json();
      console.log('Request body parsed:', body);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { uploadId } = body;
    console.log('Upload ID extracted:', uploadId);

    if (!uploadId) {
      console.log('Upload ID is missing');
      return NextResponse.json(
        { error: 'Upload ID is required' },
        { status: 400 }
      );
    }

    // Check if upload exists
    console.log('Checking if upload exists...');
    const upload = await prisma.upload.findUnique({
      where: { id: uploadId }
    });
    console.log('Upload found:', upload ? 'YES' : 'NO');

    if (!upload) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      );
    }

    // Reset upload status with valid fields only
    console.log('Resetting upload status...');
    try {
      await prisma.upload.update({
        where: { id: uploadId },
        data: {
          status: 'pending',
          errorMessage: null,
          approvalStatus: 'processing'
        }
      });
      console.log('Upload status reset to pending');
    } catch (updateError) {
      console.error('Database update failed:', updateError);
      return NextResponse.json(
        { error: 'Failed to reset upload status', details: updateError.message },
        { status: 500 }
      );
    }

    // Initialize AsyncFileProcessor and start reprocessing
    console.log('Starting reprocessing with AsyncFileProcessor...');
    const asyncProcessor = new AsyncFileProcessor();
    
    // Use setTimeout to make this async and non-blocking
    setTimeout(async () => {
      try {
        console.log('Calling AsyncFileProcessor in background...');
        const result = await asyncProcessor.processFile({ uploadId });
        console.log('Background processing completed:', result);
      } catch (bgError) {
        console.error('Background processing failed:', bgError);
        // Update upload status to failed
        try {
          await prisma.upload.update({
            where: { id: uploadId },
            data: {
              status: 'failed',
              errorMessage: bgError instanceof Error ? bgError.message : 'Processing failed'
            }
          });
        } catch (updateErr) {
          console.error('Failed to update error status:', updateErr);
        }
      }
    }, 100);
    
    console.log('Reprocessing triggered in background');

    return NextResponse.json({
      success: true,
      message: 'Upload reprocessing started in background',
      uploadId: uploadId
    });

  } catch (error) {
    console.error('Error reprocessing upload:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    return NextResponse.json(
      { 
        error: 'Failed to reprocess upload',
        details: error.message 
      },
      { status: 500 }
    );
  }
}