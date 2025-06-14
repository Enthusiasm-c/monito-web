import { NextRequest, NextResponse } from 'next/server';
import { cleanupAllDuplicates } from '../../../utils/cleanupDuplicates';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting admin-initiated duplicate cleanup...');
    
    const result = await cleanupAllDuplicates();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Duplicate cleanup completed successfully',
        details: {
          products: {
            removed: result.products.productsRemoved,
            duplicateGroups: result.products.duplicateGroups
          },
          prices: {
            expired: result.prices.pricesExpired,
            duplicateGroups: result.prices.duplicateGroups
          }
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Cleanup failed',
        details: {
          productError: result.products.error,
          priceError: result.prices.error
        }
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('❌ Admin cleanup API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Cleanup operation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'Duplicate Cleanup Service',
    description: 'Administrative tool to clean up duplicate products and prices',
    endpoints: {
      'POST /api/admin/cleanup-duplicates': 'Run comprehensive duplicate cleanup'
    },
    warning: 'This operation modifies the database and should be used carefully'
  });
}