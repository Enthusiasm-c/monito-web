/**
 * API endpoint for automatic cleanup of orphan products
 * Removes products without prices or suppliers
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Starting automatic orphan product cleanup...');
    
    let deletedCount = 0;
    
    // 1. Delete products without any prices
    const productsWithoutPrices = await prisma.product.findMany({
      where: {
        prices: {
          none: {}
        }
      },
      select: { id: true, name: true }
    });
    
    if (productsWithoutPrices.length > 0) {
      const productIds = productsWithoutPrices.map(p => p.id);
      const deleted = await prisma.product.deleteMany({
        where: { id: { in: productIds } }
      });
      deletedCount += deleted.count;
      console.log(`✅ Deleted ${deleted.count} products without prices`);
    }
    
    // 2. Delete products with empty or invalid names
    const deletedInvalidNames = await prisma.product.deleteMany({
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
    const deletedInvalidPrices = await prisma.price.deleteMany({
      where: {
        amount: { lte: 0 }
      }
    });
    console.log(`✅ Deleted ${deletedInvalidPrices.count} invalid prices (≤ 0)`);
    
    // 4. Remove suppliers with no prices
    const deletedEmptySuppliers = await prisma.supplier.deleteMany({
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
      products: await prisma.product.count(),
      prices: await prisma.price.count(),
      suppliers: await prisma.supplier.count(),
      uploads: await prisma.upload.count()
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
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// Allow GET for manual trigger
export async function GET() {
  return POST(new NextRequest('http://localhost:3000/api/cleanup-orphan-products'));
}