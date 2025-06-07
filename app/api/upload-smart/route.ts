import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
        });

        // Create a temporary supplier for processing
        const tempSupplier = await prisma.supplier.upsert({
          where: { name: 'Temporary Processing' },
          update: {},
          create: {
            name: 'Temporary Processing',
            email: 'temp@processing.com'
          }
        });

        // Create upload record in database
        const upload = await prisma.upload.create({
          data: {
            filename: blob.url,
            originalName: file.name,
            fileSize: file.size,
            mimeType: file.type,
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

        // Trigger background processing with timeout protection
        processFileInBackground(upload.id).catch(error => {
          console.error(`Background processing failed for ${upload.id}:`, error);
        });

      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
        uploadResults.push({
          filename: file.name,
          status: 'error',
          error: 'Upload failed'
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

async function processFileInBackground(uploadId: string) {
  try {
    // Update status to processing
    await prisma.upload.update({
      where: { id: uploadId },
      data: { status: 'processing' }
    });

    // Import the processing service
    const { processFile } = await import('../../services/fileProcessor');
    await processFile(uploadId);

  } catch (error) {
    console.error(`Error processing file ${uploadId}:`, error);
    
    // Update status to failed
    await prisma.upload.update({
      where: { id: uploadId },
      data: { 
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}