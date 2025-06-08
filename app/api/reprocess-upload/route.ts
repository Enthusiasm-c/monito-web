import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { uploadId } = await request.json();

    if (!uploadId) {
      return NextResponse.json(
        { error: 'Upload ID is required' },
        { status: 400 }
      );
    }

    // Find the upload
    const upload = await prisma.upload.findUnique({
      where: { id: uploadId },
      include: { supplier: true }
    });

    if (!upload) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      );
    }

    console.log(`🔄 Reprocessing upload: ${upload.originalName} (${uploadId})`);

    // Update status to processing
    await prisma.upload.update({
      where: { id: uploadId },
      data: { 
        status: 'processing',
        errorMessage: null,
        updatedAt: new Date()
      }
    });

    // Start background processing
    processFileInBackground(uploadId).catch(error => {
      console.error(`❌ Reprocessing failed for ${uploadId}:`, error);
    });

    return NextResponse.json({
      message: 'File reprocessing started',
      uploadId,
      filename: upload.originalName
    });

  } catch (error) {
    console.error('Error starting reprocessing:', error);
    return NextResponse.json(
      { error: 'Failed to start reprocessing' },
      { status: 500 }
    );
  }
}

async function processFileInBackground(uploadId: string) {
  try {
    console.log(`🔄 Starting reprocessing for upload: ${uploadId}`);
    
    // Import and run the file processor
    const { processFile } = await import('../../services/fileProcessor');
    await processFile(uploadId);
    
    console.log(`🎉 Successfully reprocessed: ${uploadId}`);
    
  } catch (error) {
    console.error(`💥 Error reprocessing file ${uploadId}:`, error);
    
    try {
      // Update status to failed with detailed error message
      await prisma.upload.update({
        where: { id: uploadId },
        data: { 
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Reprocessing failed',
          updatedAt: new Date()
        }
      });
      console.log(`❌ Marked upload ${uploadId} as failed after reprocessing`);
    } catch (updateError) {
      console.error(`💥 Failed to update error status for ${uploadId}:`, updateError);
    }
    
    throw error;
  }
}