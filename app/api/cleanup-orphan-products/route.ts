/**
 * API endpoint for automatic cleanup of orphan products
 * Removes products without prices or suppliers
 */

import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../services/DatabaseService';
import { asyncHandler } from '../../../utils/errors';

export const POST = asyncHandler(async (request: NextRequest) => {
    console.log('🧹 Starting automatic orphan product cleanup...');
    
    let deletedCount = 0;
    
    // 1. Delete products without any prices
    const productsWithoutPrices = await databaseService.getProductsWithoutPrices();
    
    if (productsWithoutPrices.length > 0) {
      const productIds = productsWithoutPrices.map(p => p.id);
      const deleted = await databaseService.deleteProducts({
        where: { id: { in: productIds } }
      });
      deletedCount += deleted.count;
      console.log(`✅ Deleted ${deleted.count} products without prices`);
    }
    
    // 2. Delete products with empty or invalid names
    const deletedInvalidNames = await databaseService.deleteProducts({
      where: {
        OR: [
          { name: { in: ['', ' ', 'null', 'undefined'] } },
          { standardizedName: { in: ['', ' ', 'null', 'undefined'] } },
          { rawName: { in: ['', ' ', 'null', 'undefined'] } }
        ]
      }
    });
    deletedCount += deletedInvalidNames.count;
    console.log(`✅ Deleted ${deletedInvalidNames.count} products with invalid names`);
    
    // 3. Delete prices with zero or negative amounts
    const deletedInvalidPrices = await databaseService.deletePrices({
      where: {
        amount: { lte: 0 }
      }
    });
    console.log(`✅ Deleted ${deletedInvalidPrices.count} invalid prices (≤ 0)`);
    
    // 4. Remove suppliers with no prices
    const deletedEmptySuppliers = await databaseService.deleteSuppliers({
      where: {
        AND: [
          {
            prices: {
              none: {}
            }
          },
          {
            uploads: {
              none: {}
            }
          }
        ]
      }
    });
    console.log(`✅ Deleted ${deletedEmptySuppliers.count} empty suppliers`);
    
    // 5. Get final stats
    const stats = {
      products: await databaseService.getProductsCount(),
      prices: await databaseService.getPricesCount(),
      suppliers: await databaseService.getSuppliersCount(),
      uploads: await databaseService.getUploadsCount()
    };
    
    console.log('🎉 Automatic cleanup completed');
    
    return NextResponse.json({
      success: true,
      message: 'Orphan products cleanup completed',
      deletedProducts: deletedCount,
      deletedPrices: deletedInvalidPrices.count,
      deletedSuppliers: deletedEmptySuppliers.count,
      finalStats: stats
    });
    
  });

// Allow GET for manual trigger
export async function GET() {
  return POST(new NextRequest('http://localhost:3000/api/cleanup-orphan-products'));
}