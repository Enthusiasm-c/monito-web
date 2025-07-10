import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/app/services/DatabaseService';
import { asyncHandler } from '@/app/utils/errors';

export const GET = asyncHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
    // Check if upload exists
    const upload = await databaseService.getUploadById(params.id);
    
    return NextResponse.json({
      debug: {
        paramsReceived: params,
        uploadId: params.id,
        uploadFound: !!upload,
        upload: upload,
        timestamp: new Date().toISOString(),
      }
    });
  });