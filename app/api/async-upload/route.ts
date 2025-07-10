/**
 * Asynchronous Upload Endpoint
 * Accepts file upload and processes in background without timeout
 */

import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { jobQueue } from '../../services/background/JobQueue';
import '../../services/background/startProcessor';

import { databaseService } from '../../../services/DatabaseService';
import { asyncHandler } from '../../../utils/errors';

export const POST = asyncHandler(async (request: NextRequest) => {
    console.log('🚀 Async upload endpoint called');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const supplierId = formData.get('supplierId') as string;
    const supplierName = formData.get('supplierName') as string; // Extract supplier name from form
    const autoApprove = formData.get('autoApprove') === 'true';
    const batchSize = parseInt(formData.get('batchSize') as string) || 25;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log(`📁 Processing file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

    // Upload file to blob storage
    console.log(`🔄 Uploading to Blob Storage: ${file.name}`);
    const blob = await put(file.name, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    // Validate blob upload result
    if (!blob || !blob.url) {
      console.error('❌ Blob Storage upload failed - no URL returned');
      throw new Error('Failed to upload file to storage');
    }

    console.log(`✅ File uploaded to Blob Storage: ${blob.url}`);

    // Determine supplier
    let finalSupplierId = supplierId;
    let actualSupplierName = supplierName;
    
    // Extract supplier name from filename if not provided
    if (!actualSupplierName) {
      actualSupplierName = extractSupplierNameFromFile(file.name);
    }
    
    if (!finalSupplierId) {
      if (actualSupplierName && actualSupplierName !== 'Temporary Processing') {
        console.log(`🏢 Creating/finding supplier: ${actualSupplierName}`);
        
        // Try to find existing supplier by name (case insensitive)
        const existingSupplier = await databaseService.getSupplierByName(actualSupplierName);
        
        if (existingSupplier) {
          console.log(`✅ Found existing supplier: ${existingSupplier.name} (${existingSupplier.id})`);
          finalSupplierId = existingSupplier.id;
        } else {
          // Create new supplier
          console.log(`🆕 Creating new supplier: ${actualSupplierName}`);
          const newSupplier = await databaseService.createSupplier({
            data: {
              name: actualSupplierName,
              email: `${actualSupplierName.toLowerCase().replace(/\s+/g, '')}@supplier.com`
            }
          });
          finalSupplierId = newSupplier.id;
          console.log(`✅ Created new supplier: ${newSupplier.name} (${newSupplier.id})`);
        }
      } else {
        // Fallback to temporary processing
        console.log(`⚠️ No supplier name found, using Temporary Processing`);
        const tempSupplier = await databaseService.upsertSupplier({
          where: { name: 'Temporary Processing' },
          update: {},
          create: {
            name: 'Temporary Processing',
            email: 'temp@processing.com'
          }
        });
        finalSupplierId = tempSupplier.id;
      }
    }

    // Create upload record
    console.log(`💾 Creating upload record in database`);
    const upload = await databaseService.createUpload({
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

    // Validate upload record was created with proper URL
    if (!upload.id || !upload.url) {
      console.error('❌ Upload record creation failed - missing ID or URL');
      throw new Error('Failed to create upload record');
    }

    console.log(`✅ Upload record created: ${upload.id} with URL: ${upload.url}`);

    // Add job to queue for background processing
    console.log(`🔄 Adding job to queue for upload: ${upload.id}`);
    await jobQueue.addJob({
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

    console.log(`✅ Job added to queue for upload: ${upload.id}`);

    return NextResponse.json({
      success: true,
      uploadId: upload.id,
      fileUrl: blob.url,
      message: 'File uploaded and queued for processing',
      status: 'queued',
      batchSize
    });

  });

/**
 * Extract supplier name from filename
 */
function extractSupplierNameFromFile(fileName: string): string {
  try {
    // Remove file extension
    let name = fileName.replace(/\.(pdf|xlsx|xls|csv|jpg|jpeg|png|docx)$/i, '');
    
    // Remove date patterns (DD_MM format)
    name = name.replace(/\s+\d{2}_\d{2}.*$/, '');
    
    // Remove trailing numbers
    name = name.replace(/\s+\d+$/, '');
    
    // Clean up and normalize
    name = name.trim()
      .replace(/\s+/g, ' ')
      .replace(/^(PT\.?|CV)\s*/i, '') // Remove PT/CV prefixes
      .replace(/\+/g, ' ') // Replace + with spaces
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Handle special mappings for known suppliers
    const supplierMappings: Record<string, string> = {
      'Widi Wiguna': 'Widi Wiguna',
      'Bali Boga Sejati': 'Bali Boga',
      'Sai Fresh': 'Sai Fresh', 
      'Milk Up': 'Milk Up',
      'Lestari Pangan': 'Lestari Pangan',
      'Pangan Lestari': 'Lestari Pangan',
      'Sutria Pangan Sejati': 'Sutria Pangan Sejati',
      'Bali Seafood': 'Bali_seafood',
      'Island Organics': 'Island Organics Bali'
    };
    
    // Check for exact mappings
    for (const [pattern, mapped] of Object.entries(supplierMappings)) {
      if (name.toLowerCase().includes(pattern.toLowerCase())) {
        return mapped;
      }
    }
    
    return name || 'Temporary Processing';
    
  } catch (error) {
    console.error('Error extracting supplier name:', error);
    return 'Temporary Processing';
  }
}

/**
 * Get processing status
 */
export const GET = asyncHandler(async (request: NextRequest) => {
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

  });