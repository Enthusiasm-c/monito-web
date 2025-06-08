import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Starting stuck upload recovery process...');

    // Find uploads that are stuck in pending status for more than 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const stuckPendingUploads = await prisma.upload.findMany({
      where: {
        status: 'pending',
        createdAt: { lt: twoMinutesAgo }
      },
      select: {
        id: true,
        originalName: true,
        createdAt: true
      }
    });

    // Find uploads that are stuck in processing status for more than 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const stuckProcessingUploads = await prisma.upload.findMany({
      where: {
        status: 'processing',
        updatedAt: { lt: tenMinutesAgo }
      },
      select: {
        id: true,
        originalName: true,
        updatedAt: true
      }
    });

    console.log(`📊 Found ${stuckPendingUploads.length} stuck pending uploads`);
    console.log(`📊 Found ${stuckProcessingUploads.length} stuck processing uploads`);

    const results = {
      recoveredPending: 0,
      recoveredProcessing: 0,
      errors: [] as string[]
    };

    // Process stuck pending uploads
    for (const upload of stuckPendingUploads) {
      try {
        console.log(`🔄 Recovering pending upload: ${upload.originalName} (${upload.id})`);
        
        // Start processing immediately
        processFileInBackground(upload.id).catch(error => {
          console.error(`❌ Recovery processing failed for ${upload.id}:`, error);
        });
        
        results.recoveredPending++;
      } catch (error) {
        const errorMsg = `Failed to recover ${upload.originalName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }

    // Reset stuck processing uploads back to pending
    for (const upload of stuckProcessingUploads) {
      try {
        console.log(`🔄 Resetting stuck processing upload: ${upload.originalName} (${upload.id})`);
        
        await prisma.upload.update({
          where: { id: upload.id },
          data: {
            status: 'pending',
            errorMessage: 'Reset from stuck processing state',
            updatedAt: new Date()
          }
        });

        // Start processing again
        processFileInBackground(upload.id).catch(error => {
          console.error(`❌ Recovery processing failed for ${upload.id}:`, error);
        });
        
        results.recoveredProcessing++;
      } catch (error) {
        const errorMsg = `Failed to reset ${upload.originalName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }

    console.log('✅ Stuck upload recovery completed');

    return NextResponse.json({
      message: 'Stuck upload recovery completed',
      results,
      summary: {
        stuckPendingFound: stuckPendingUploads.length,
        stuckProcessingFound: stuckProcessingUploads.length,
        totalRecovered: results.recoveredPending + results.recoveredProcessing,
        errors: results.errors.length
      }
    });

  } catch (error) {
    console.error('💥 Error in stuck upload recovery:', error);
    return NextResponse.json(
      { 
        error: 'Recovery process failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function processFileInBackground(uploadId: string) {
  try {
    console.log(`🚀 Starting background processing for: ${uploadId}`);
    
    // Check if file is already being processed or completed
    const currentUpload = await prisma.upload.findUnique({
      where: { id: uploadId }
    });
    
    if (!currentUpload) {
      console.error(`❌ Upload ${uploadId} not found`);
      return;
    }
    
    if (currentUpload.status !== 'pending') {
      console.log(`ℹ️ Upload ${uploadId} is already ${currentUpload.status}, skipping`);
      return;
    }
    
    // Update status to processing
    await prisma.upload.update({
      where: { id: uploadId },
      data: { 
        status: 'processing',
        updatedAt: new Date()
      }
    });
    
    console.log(`✅ Updated status to processing for: ${uploadId}`);
    
    // Add rate limiting delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Import and run the file processor
    const { processFile } = await import('../../services/fileProcessor');
    await processFile(uploadId);
    
    console.log(`🎉 Successfully completed processing for: ${uploadId}`);
    
  } catch (error) {
    console.error(`💥 Error processing file ${uploadId}:`, error);
    
    try {
      // Update status to failed
      await prisma.upload.update({
        where: { id: uploadId },
        data: { 
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown processing error',
          updatedAt: new Date()
        }
      });
      console.log(`❌ Marked upload ${uploadId} as failed`);
    } catch (updateError) {
      console.error(`💥 Failed to update error status for ${uploadId}:`, updateError);
    }
    
    throw error;
  }
}