import { NextRequest, NextResponse } from 'next/server';
import { enhancedFileProcessor } from '../../../../services/enhancedFileProcessor';

// Rate limiting map: uploadId -> last request timestamp
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 10000; // 10 seconds between approve requests

export async function POST(request: NextRequest) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
  
  try {
    const { uploadId, approvedBy, reviewNotes } = await request.json();

    if (!uploadId || !approvedBy) {
      return NextResponse.json(
        { error: 'Upload ID and approver name are required' },
        { status: 400 }
      );
    }

    // Rate limiting check
    const now = Date.now();
    const lastRequest = rateLimitMap.get(uploadId);
    
    if (lastRequest && (now - lastRequest) < RATE_LIMIT_MS) {
      const waitTime = Math.ceil((RATE_LIMIT_MS - (now - lastRequest)) / 1000);
      return NextResponse.json(
        { error: `Please wait ${waitTime} seconds before retrying approval` },
        { status: 429 }
      );
    }
    
    rateLimitMap.set(uploadId, now);
    
    const result = await Promise.race([
      enhancedFileProcessor.approveUpload(uploadId, approvedBy, reviewNotes),
      new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => 
          reject(new Error('Approval request timeout after 60 seconds'))
        );
      })
    ]) as any;

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      productsCreated: result.productsCreated,
      message: `Upload approved successfully. Created ${result.productsCreated} products.`
    });

  } catch (error) {
    console.error('Error approving upload:', error);
    
    if (error instanceof Error && error.message.includes('timeout')) {
      return NextResponse.json(
        { error: 'Approval request timed out. Please try again.' },
        { status: 408 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to approve upload' },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}