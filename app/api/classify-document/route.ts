/**
 * Document Classification API Endpoint
 * Integrates document classification into the upload pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
// import { documentClassifierService } from '../../../src/pipeline/document_classifier_service';
import path from 'path';
import fs from 'fs/promises';
import { tmpdir } from 'os';

import { prisma } from '../../../lib/prisma';

export async function POST(request: NextRequest) {
  try {
    console.log('📁 Document classification request received');
    
    // Temporary disabled - document classifier service not available
    return NextResponse.json({ 
      error: 'Document classification service temporarily disabled' 
    }, { status: 503 });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const uploadId = formData.get('uploadId') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create temporary file
    const tempFilePath = await createTempFile(buffer, file.name);

    try {
      // Validate file before classification
      const validation = await documentClassifierService.validateFile(tempFilePath);
      if (!validation.valid) {
        await fs.unlink(tempFilePath);
        return NextResponse.json(
          { error: validation.reason },
          { status: 400 }
        );
      }

      console.log(`🔍 Classifying document: ${file.name} (${validation.fileSize} bytes)`);

      // Classify document
      const classification = await documentClassifierService.classifyDocument(tempFilePath);

      // Check for duplicate files
      const existingUpload = await checkForDuplicate(classification.file_hash);
      if (existingUpload && existingUpload.id !== uploadId) {
        await fs.unlink(tempFilePath);
        return NextResponse.json({
          success: false,
          isDuplicate: true,
          existingUpload: {
            id: existingUpload.id,
            originalName: existingUpload.originalName,
            createdAt: existingUpload.createdAt,
            supplier: existingUpload.supplier
          },
          message: `File already exists (uploaded: ${existingUpload.createdAt.toISOString()})`
        });
      }

      // Update upload record with classification if uploadId provided
      if (uploadId) {
        await prisma.upload.update({
          where: { id: uploadId },
          data: {
            fileHash: classification.file_hash,
            documentType: classification.document_type,
            classificationResult: classification,
            status: classification.processing_recommendation.status,
            mimeType: classification.mime_type,
            fileSize: classification.metadata.file_size
          }
        });

        console.log(`✅ Upload ${uploadId} updated with classification: ${classification.document_type}`);
      }

      // Cleanup temp file
      await fs.unlink(tempFilePath);

      // Return classification result
      return NextResponse.json({
        success: true,
        classification,
        processingRecommendation: classification.processing_recommendation,
        message: `Document classified as ${classification.document_type}`
      });

    } catch (classificationError) {
      // Cleanup temp file on error
      await fs.unlink(tempFilePath);
      throw classificationError;
    }

  } catch (error) {
    console.error('❌ Document classification failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Classification failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'supported-types') {
      // Return supported file types
      const supportedTypes = documentClassifierService.getSupportedFileTypes();
      
      return NextResponse.json({
        supportedTypes,
        maxFileSize: '100MB',
        supportedExtensions: ['.pdf', '.xlsx', '.xls', '.csv', '.jpg', '.jpeg', '.png', '.tiff', '.bmp']
      });
    }

    if (action === 'stats') {
      // Return classification statistics
      const stats = await getClassificationStats();
      
      return NextResponse.json({
        stats,
        totalUploads: stats.total,
        byDocumentType: stats.byDocumentType,
        avgProcessingTime: stats.avgProcessingTime
      });
    }

    return NextResponse.json(
      { error: 'Invalid action parameter' },
      { status: 400 }
    );

  } catch (error) {
    console.error('❌ Classification API error:', error);
    
    return NextResponse.json(
      { 
        error: 'API request failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// Helper functions

async function createTempFile(buffer: Buffer, originalName: string): Promise<string> {
  const tempDir = tmpdir();
  const ext = path.extname(originalName);
  const tempFileName = `classify_${Date.now()}_${Math.random().toString(36).substring(2)}${ext}`;
  const tempFilePath = path.join(tempDir, tempFileName);
  
  await fs.writeFile(tempFilePath, buffer);
  return tempFilePath;
}

async function checkForDuplicate(fileHash: string) {
  return await prisma.upload.findFirst({
    where: { fileHash },
    include: { supplier: true },
    orderBy: { createdAt: 'desc' }
  });
}

async function getClassificationStats() {
  const stats = await prisma.upload.groupBy({
    by: ['documentType', 'status'],
    _count: {
      id: true
    },
    _avg: {
      processingTimeMs: true,
      completenessRatio: true,
      processingCostUsd: true
    },
    where: {
      documentType: { not: null }
    }
  });

  const total = await prisma.upload.count({
    where: { documentType: { not: null } }
  });

  const byDocumentType = stats.reduce((acc, stat) => {
    const type = stat.documentType || 'unknown';
    if (!acc[type]) {
      acc[type] = {
        total: 0,
        byStatus: {},
        avgProcessingTime: 0,
        avgCompleteness: 0,
        avgCost: 0
      };
    }
    
    acc[type].total += stat._count.id;
    acc[type].byStatus[stat.status] = stat._count.id;
    acc[type].avgProcessingTime = stat._avg.processingTimeMs || 0;
    acc[type].avgCompleteness = stat._avg.completenessRatio || 0;
    acc[type].avgCost = stat._avg.processingCostUsd || 0;
    
    return acc;
  }, {} as any);

  const avgProcessingTime = stats.reduce((sum, stat) => {
    return sum + (stat._avg.processingTimeMs || 0);
  }, 0) / stats.length;

  return {
    total,
    byDocumentType,
    avgProcessingTime: Math.round(avgProcessingTime),
    totalStats: stats.length
  };
}