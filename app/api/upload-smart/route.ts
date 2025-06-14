import { NextRequest, NextResponse } from 'next/server';
import { unifiedFileProcessor } from '../../services/centralized/UnifiedFileProcessor';

export const maxDuration = 60; // 60 seconds timeout

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const autoApprove = formData.get('autoApprove') === 'true';

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files uploaded' },
        { status: 400 }
      );
    }

    console.log(`🚀 Smart processing ${files.length} files with unified processor`);

    const uploadResults = [];

    for (const file of files) {
      try {
        // Validate file size (10MB limit)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
          uploadResults.push({
            filename: file.name,
            status: 'error',
            error: 'File size exceeds 10MB limit'
          });
          continue;
        }

        // Process with unified file processor (no supplierId - auto-detect)
        const result = await unifiedFileProcessor.processUpload(file, {
          autoApprove
        });

        uploadResults.push({
          id: result.uploadId,
          filename: file.name,
          status: result.success ? 'completed' : 'failed',
          extractionMethod: result.extractionMethod,
          productsExtracted: result.totalProductsExtracted,
          productsStandardized: result.totalProductsStandardized,
          productsStored: result.totalProductsStored,
          processingTimeMs: result.processingTimeMs,
          tokensUsed: result.tokensUsed,
          needsApproval: result.needsApproval,
          errors: result.errors
        });

      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        uploadResults.push({
          filename: file.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Processing failed'
        });
      }
    }

    const successCount = uploadResults.filter(r => r.status === 'completed').length;
    const totalProducts = uploadResults.reduce((sum, r) => sum + (r.productsExtracted || 0), 0);

    return NextResponse.json({
      message: `Smart processed ${successCount}/${files.length} files. AI analyzed supplier information and extracted ${totalProducts} products.`,
      results: uploadResults
    });

  } catch (error) {
    console.error('Smart upload processing error:', error);
    return NextResponse.json(
      { 
        error: 'Smart upload processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}