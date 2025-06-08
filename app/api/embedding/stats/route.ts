import { NextResponse } from 'next/server';
import { embeddingService } from '../../../services/embeddingService';

export async function GET() {
  try {
    const stats = embeddingService.getStats();
    
    return NextResponse.json({
      message: 'Embedding statistics retrieved successfully',
      stats: {
        totalReferenceProducts: stats.total,
        productsByCategory: stats.byCategory,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting embedding stats:', error);
    return NextResponse.json(
      { error: 'Failed to get embedding statistics' },
      { status: 500 }
    );
  }
}