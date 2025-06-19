/**
 * Asynchronous Upload Endpoint
 * Accepts file upload and processes in background without timeout
 */

import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { jobQueue } from '../../services/background/JobQueue';
import '../../services/background/startProcessor';

import { prisma } from '../../../lib/prisma';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Async upload endpoint called');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const supplierId = formData.get('supplierId') as string;
    const autoApprove = formData.get('autoApprove') === 'true';
    const batchSize = parseInt(formData.get('batchSize') as string) || 25;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log(`📁 Processing file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

    // Upload file to blob storage
    const blob = await put(file.name, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    // Determine supplier
    let finalSupplierId = supplierId;
    if (!finalSupplierId) {
      const tempSupplier = await prisma.supplier.upsert({
        where: { name: 'Temporary Processing' },
        update: {},
        create: {
          name: 'Temporary Processing',
          email: 'temp@processing.com'
        }
      });
      finalSupplierId = tempSupplier.id;
    }

    // Create upload record
    const upload = await prisma.upload.create({
      data: {
        fileName: file.name,
        originalName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        url: blob.url,
        supplierId: finalSupplierId,
        status: 'processing',
        approvalStatus: autoApprove ? 'approved' : 'pending_review'
      }
    });

    // Add job to queue
    const jobId = await jobQueue.addJob({
      uploadId: upload.id,
      fileUrl: blob.url,
      fileName: file.name,
      fileType: file.type,
      supplierId: finalSupplierId,
      options: {
        autoApprove,
        batchSize
      }
    });

    console.log(`✅ File queued for async processing: ${upload.id} (job: ${jobId})`);

    // Return immediately with upload ID for status tracking
    return NextResponse.json({
      success: true,
      uploadId: upload.id,
      jobId,
      message: 'File uploaded and queued for processing',
      status: 'processing',
      batchSize
    });

  } catch (error) {
    console.error('❌ Async upload failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    }, { status: 500 });
  }
}

/**
 * Get processing status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uploadId = searchParams.get('uploadId');

    if (!uploadId) {
      return NextResponse.json({ error: 'Upload ID required' }, { status: 400 });
    }

    const status = await jobQueue.getJobStatus(uploadId);
    
    if (!status) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(status);

  } catch (error) {
    console.error('❌ Status check failed:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Status check failed'
    }, { status: 500 });
  }
}