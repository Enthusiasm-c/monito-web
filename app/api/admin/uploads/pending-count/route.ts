import { NextResponse } from 'next/server';
import { databaseService } from '../../../../../services/DatabaseService';
import { asyncHandler } from '../../../../../utils/errors';

export const GET = asyncHandler(async () => {
    const pendingCount = await databaseService.getUploadsCount({
      where: {
        approvalStatus: 'pending_review'
      }
    });

    return NextResponse.json({ count: pendingCount });
  });