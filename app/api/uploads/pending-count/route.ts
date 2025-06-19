import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function GET() {
  try {
    const pendingCount = await prisma.upload.count({
      where: {
        approvalStatus: 'pending_review'
      }
    });

    return NextResponse.json({ count: pendingCount });
  } catch (error) {
    console.error('Error fetching pending uploads count:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending uploads count' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}