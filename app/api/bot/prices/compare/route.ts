import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateBot } from '../../middleware';

const prisma = new PrismaClient();

interface ComparisonRequest {
  product_name: string;
  supplier_id?: string;
  scanned_price: number;
}

// Bulk price comparison for invoice scanning
export async function POST(request: NextRequest) {
  // Authenticate bot
  const authError = authenticateBot(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Items array is required' },
        { status: 400 }
      );
    }

    const comparisons = await Promise.all(
      items.map(async (item: ComparisonRequest) => {
        // Search for product
        const products = await prisma.product.findMany({
          where: {
            OR: [
              { name: { contains: item.product_name, mode: 'insensitive' } },
              { standardizedName: { contains: item.product_name, mode: 'insensitive' } },
              { rawName: { contains: item.product_name, mode: 'insensitive' } }
            ]
          },
          include: {
            prices: {
              where: {
                validTo: null
              },
              include: {
                supplier: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          },
          take: 5
        });

        // Find best matching product
        let bestMatch = products[0];
        if (products.length > 1) {
          // Simple matching score based on name similarity
          bestMatch = products.reduce((best, current) => {
            const bestScore = calculateSimilarity(item.product_name, best.name);
            const currentScore = calculateSimilarity(item.product_name, current.name);
            return currentScore > bestScore ? current : best;
          });
        }

        if (!bestMatch) {
          return {
            product_name: item.product_name,
            scanned_price: item.scanned_price,
            status: 'not_found',
            matched_product: null,
            price_analysis: null
          };
        }

        // Get all prices for this product
        const allPrices = bestMatch.prices.map(p => Number(p.amount));
        const minPrice = Math.min(...allPrices);
        const maxPrice = Math.max(...allPrices);
        const avgPrice = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;

        // Find supplier's current price if supplier_id provided
        let supplierPrice = null;
        if (item.supplier_id) {
          const priceEntry = bestMatch.prices.find(p => p.supplierId === item.supplier_id);
          supplierPrice = priceEntry ? Number(priceEntry.amount) : null;
        }

        // Analyze scanned price
        let status = 'normal';
        let deviation = 0;

        if (item.scanned_price < minPrice * 0.7) {
          status = 'suspiciously_low';
          deviation = ((minPrice - item.scanned_price) / minPrice) * -100;
        } else if (item.scanned_price > maxPrice * 1.15) {
          status = 'overpriced';
          deviation = ((item.scanned_price - maxPrice) / maxPrice) * 100;
        } else if (item.scanned_price > avgPrice * 1.05) {
          status = 'above_average';
          deviation = ((item.scanned_price - avgPrice) / avgPrice) * 100;
        } else if (item.scanned_price < avgPrice * 0.95) {
          status = 'below_average';
          deviation = ((avgPrice - item.scanned_price) / avgPrice) * -100;
        }

        return {
          product_name: item.product_name,
          scanned_price: item.scanned_price,
          status: status,
          matched_product: {
            id: bestMatch.id,
            name: bestMatch.name,
            unit: bestMatch.unit
          },
          price_analysis: {
            min_price: minPrice,
            max_price: maxPrice,
            avg_price: Math.round(avgPrice),
            supplier_price: supplierPrice,
            deviation_percent: Math.round(deviation * 10) / 10,
            supplier_count: allPrices.length,
            suppliers: bestMatch.prices.map(p => ({
              id: p.supplier.id,
              name: p.supplier.name,
              price: Number(p.amount)
            })).sort((a, b) => a.price - b.price)
          }
        };
      })
    );

    return NextResponse.json({
      comparisons: comparisons,
      summary: {
        total_items: items.length,
        found_items: comparisons.filter(c => c.status !== 'not_found').length,
        overpriced_items: comparisons.filter(c => c.status === 'overpriced').length,
        good_deals: comparisons.filter(c => c.status === 'below_average').length
      }
    });

  } catch (error) {
    console.error('Bot API - Error comparing prices:', error);
    return NextResponse.json(
      { error: 'Failed to compare prices' },
      { status: 500 }
    );
  }
}

// Simple string similarity calculation
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  if (s1 === s2) return 1;
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.includes(shorter)) return 0.8;
  
  // Count matching characters
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }
  
  return matches / longer.length;
}