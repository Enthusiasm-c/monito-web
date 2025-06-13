import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { PrismaClient } from '@prisma/client';
import { enhancedFileProcessor } from '../../services/enhancedFileProcessor';

const prisma = new PrismaClient();

// Database-based queue processing to handle serverless restarts
// No in-memory state needed - we use database status for queue management

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files uploaded' },
        { status: 400 }
      );
    }

    const uploadResults = [];

    for (const file of files) {
      try {
        // Upload file to Vercel Blob
        const blob = await put(file.name, file, {
          access: 'public',
          addRandomSuffix: true,
        });

        // Create a temporary supplier for processing
        const tempSupplier = await prisma.supplier.upsert({
          where: { name: 'Temporary Processing' },
          update: {},
          create: {
            id: `temp_${Date.now()}`,
            name: 'Temporary Processing',
            email: 'temp@processing.com'
          }
        });

        // Create upload record in database
        const upload = await prisma.upload.create({
          data: {
            id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            fileName: file.name,
            originalName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            url: blob.url,
            supplierId: tempSupplier.id,
            status: 'pending'
          }
        });

        uploadResults.push({
          id: upload.id,
          filename: file.name,
          status: 'uploaded',
          url: blob.url
        });

        // Start background processing immediately
        // Database-based queue will handle coordination
        console.log(`🚀 Starting background processing for upload: ${upload.id}`);
        processFileInBackground(upload.id).catch(error => {
          console.error(`❌ Background processing failed for ${upload.id}:`, error);
        });

      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
        uploadResults.push({
          filename: file.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Upload failed'
        });
      }
    }

    return NextResponse.json({
      message: 'Files uploaded successfully. AI is analyzing supplier information...',
      results: uploadResults
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}


// Database-based sequential processing with better error handling
async function processFileInBackground(uploadId: string) {
  try {
    console.log(`🔄 Starting processing for upload: ${uploadId}`);
    
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
    
    // Update status to processing with proper error handling
    await prisma.upload.update({
      where: { id: uploadId },
      data: { 
        status: 'processing',
        updatedAt: new Date()
      }
    });
    
    console.log(`✅ Updated status to processing for: ${uploadId}`);
    
    // Add rate limiting delay (500ms between file processing starts)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Run the enhanced file processor with timeout (5 minutes max)
    const timeoutMs = 5 * 60 * 1000; // 5 minutes
    const result = await Promise.race([
      enhancedFileProcessor.processFile(uploadId),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Processing timeout after 5 minutes')), timeoutMs)
      )
    ]);
    
    console.log(`🎉 Successfully completed processing for: ${uploadId}`);
    
  } catch (error) {
    console.error(`💥 Error processing file ${uploadId}:`, error);
    
    try {
      // Update status to failed with detailed error message
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