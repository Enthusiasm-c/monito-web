import { NextRequest, NextResponse } from 'next/server';
import { AsyncFileProcessor } from '../../../../services/background/AsyncFileProcessor';
import { databaseService } from '../../../../services/DatabaseService';
import { asyncHandler } from '../../../../utils/errors';

export const POST = asyncHandler(async (request: NextRequest) => {
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
    const upload = await databaseService.getUploadById(uploadId);
    console.log('Upload found:', upload ? 'YES' : 'NO');

    if (!upload) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      );
    }

    // Check if upload has fileUrl - if not, mark as failed
    if (!upload.url) {
      console.log('Upload has no fileUrl - marking as failed');
      await databaseService.updateUpload(uploadId, {
        status: 'failed',
        error: 'Missing file URL',
      });
      
      return NextResponse.json({
        success: true,
        message: 'Upload marked as failed - missing file URL',
        uploadId: uploadId,
        action: 'marked_failed'
      });
    }

    // Reset upload status with valid fields only
    console.log('Resetting upload status...');
    try {
      await databaseService.updateUpload(uploadId, {
        status: 'pending',
        error: null,
        processedAt: null,
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
          await databaseService.updateUpload(uploadId, {
            status: 'failed',
            error: bgError.message || 'Background processing failed',
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

  });