import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../../services/DatabaseService';
import { asyncHandler } from '../../../../utils/errors';

export const POST = asyncHandler(async (request: NextRequest) => {
    console.log('🧹 Starting complete system cleanup...');
    
    // Get counts before cleanup
    const beforeCounts = {
      uploads: await databaseService.getUploadsCount(),
      products: await databaseService.getProductsCount(),
      prices: await databaseService.getPricesCount(),
      suppliers: await databaseService.getSuppliersCount()
    };

    console.log('📊 Before cleanup:', beforeCounts);

    // Delete all data in correct order (foreign key constraints)
    console.log('🗑️ Deleting all prices...');
    await databaseService.deletePrices({});

    console.log('🗑️ Deleting all uploads...');
    await databaseService.deleteUploads({});

    console.log('🗑️ Deleting all products...');
    await databaseService.deleteProducts({});

    console.log('🗑️ Deleting all suppliers...');
    await databaseService.deleteSuppliers({});

    // Reset sequence counters if needed
    console.log('🔄 Resetting database sequences...');
    await databaseService.executeRaw`TRUNCATE TABLE "uploads", "products", "prices", "suppliers" RESTART IDENTITY CASCADE;`;

    // Verify cleanup
    const afterCounts = {
      uploads: await databaseService.getUploadsCount(),
      products: await databaseService.getProductsCount(),
      prices: await databaseService.getPricesCount(),
      suppliers: await databaseService.getSuppliersCount()
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
    
  });

export const GET = asyncHandler(async () => {
    // Get current system status
    const counts = {
      uploads: await databaseService.getUploadsCount(),
      products: await databaseService.getProductsCount(),
      prices: await databaseService.getPricesCount(),
      suppliers: await databaseService.getSuppliersCount()
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
  });