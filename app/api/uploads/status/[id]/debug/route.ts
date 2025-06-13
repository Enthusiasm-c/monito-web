import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('[DEBUG] Status debug endpoint called');
  console.log('[DEBUG] Params:', params);
  console.log('[DEBUG] Upload ID:', params.id);
  
  try {
    // Check if upload exists
    const upload = await prisma.upload.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        originalName: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    
    return NextResponse.json({
      debug: {
        paramsReceived: params,
        uploadId: params.id,
        uploadFound: !!upload,
        upload: upload,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('[DEBUG] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      params: params,
      uploadId: params.id,
    }, { status: 500 });
  }
}