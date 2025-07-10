import { NextResponse } from 'next/server';
import { databaseService } from '@/app/services/DatabaseService';
import { asyncHandler } from '@/app/utils/errors';

export const GET = asyncHandler(async () => {
    const [
      productCount,
      supplierCount,
      uploadCount,
      recentUploads,
      priceData
    ] = await Promise.all([
      databaseService.getProductsCount(),
      databaseService.getSuppliersCount(),
      databaseService.getUploadsCount(),
      databaseService.findFirstUpload({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      }),
      databaseService.getPrices({
        include: {
          product: true
        },
        where: {
          validTo: null
        }
      })
    ]);

    // Calculate average savings
    const productGroups = priceData.reduce((acc, price) => {
      const key = price.product.standardizedName;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(Number(price.amount));
      return acc;
    }, {} as Record<string, number[]>);

    let totalSavings = 0;
    let productWithMultiplePrices = 0;

    Object.values(productGroups).forEach(prices => {
      if (prices.length > 1) {
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const savings = ((max - min) / max) * 100;
        totalSavings += savings;
        productWithMultiplePrices++;
      }
    });

    const avgSavings = productWithMultiplePrices > 0 ? 
      Math.round((totalSavings / productWithMultiplePrices) * 10) / 10 : 0;

    // Calculate time since last update
    const lastUpdate = recentUploads ? 
      formatTimeSince(recentUploads.createdAt) : 'Never';

    return NextResponse.json({
      products: productCount,
      suppliers: supplierCount,
      lastUpdate,
      uploads: uploadCount
    });

  });

function formatTimeSince(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return `${diffDays}d ago`;
  }
}