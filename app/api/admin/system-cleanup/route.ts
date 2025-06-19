import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Starting complete system cleanup...');
    
    // Get counts before cleanup
    const beforeCounts = {
      uploads: await prisma.upload.count(),
      products: await prisma.product.count(),
      prices: await prisma.price.count(),
      suppliers: await prisma.supplier.count()
    };

    console.log('📊 Before cleanup:', beforeCounts);

    // Delete all data in correct order (foreign key constraints)
    console.log('🗑️ Deleting all prices...');
    await prisma.price.deleteMany({});

    console.log('🗑️ Deleting all uploads...');
    await prisma.upload.deleteMany({});

    console.log('🗑️ Deleting all products...');
    await prisma.product.deleteMany({});

    console.log('🗑️ Deleting all suppliers...');
    await prisma.supplier.deleteMany({});

    // Reset sequence counters if needed
    console.log('🔄 Resetting database sequences...');
    await prisma.$executeRaw`TRUNCATE TABLE "uploads", "products", "prices", "suppliers" RESTART IDENTITY CASCADE;`;

    // Verify cleanup
    const afterCounts = {
      uploads: await prisma.upload.count(),
      products: await prisma.product.count(),
      prices: await prisma.price.count(),
      suppliers: await prisma.supplier.count()
    };

    console.log('📊 After cleanup:', afterCounts);
    console.log('✅ Complete system cleanup finished!');

    return NextResponse.json({
      success: true,
      message: 'Complete system cleanup completed successfully',
      before: beforeCounts,
      after: afterCounts,
      removed: {
        uploads: beforeCounts.uploads,
        products: beforeCounts.products,
        prices: beforeCounts.prices,
        suppliers: beforeCounts.suppliers
      }
    });
    
  } catch (error) {
    console.error('❌ System cleanup failed:', error);
    return NextResponse.json({
      success: false,
      error: 'System cleanup failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET() {
  try {
    // Get current system status
    const counts = {
      uploads: await prisma.upload.count(),
      products: await prisma.product.count(),
      prices: await prisma.price.count(),
      suppliers: await prisma.supplier.count()
    };

    return NextResponse.json({
      service: 'System Cleanup Service',
      description: 'Administrative tool to completely clean all data from the system',
      currentStatus: counts,
      endpoints: {
        'POST /api/admin/system-cleanup': 'Completely wipe all data from the system',
        'GET /api/admin/system-cleanup': 'Check current system status'
      },
      warning: 'POST operation will DELETE ALL DATA - use with extreme caution!'
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get system status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}