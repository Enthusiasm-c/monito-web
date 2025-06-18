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
        // Search for product - first try exact match
        let products = await prisma.product.findMany({
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
          take: 20 // Get more products to find best matches
        });

        // If no products found, try word-based search
        if (products.length === 0) {
          const words = item.product_name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
          if (words.length > 0) {
            const wordConditions = words.map(word => ({
              OR: [
                { name: { contains: word, mode: 'insensitive' } },
                { standardizedName: { contains: word, mode: 'insensitive' } },
                { rawName: { contains: word, mode: 'insensitive' } }
              ]
            }));

            products = await prisma.product.findMany({
              where: {
                OR: wordConditions
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
              take: 20
            });
          }
        }

        // If no products found, try fuzzy search for common misspellings
        if (products.length === 0) {
          // Common OCR mistakes
          const variations = [
            item.product_name,
            item.product_name.replace(/z/gi, 'zz'), // mozarella -> mozzarella
            item.product_name.replace(/zz/gi, 'z'), // mozzarella -> mozarella
            item.product_name.replace(/l{2}/gi, 'll'), // mayonaise -> mayonnaise
            item.product_name.replace(/n{2}/gi, 'n'), // mayonnaise -> mayonaise
            item.product_name.replace(/naise$/i, 'nnaise'), // mayonaise -> mayonnaise
            item.product_name.replace(/nnaise$/i, 'naise'), // mayonnaise -> mayonaise
          ];

          for (const variant of variations) {
            if (variant !== item.product_name) {
              products = await prisma.product.findMany({
                where: {
                  OR: [
                    { name: { contains: variant, mode: 'insensitive' } },
                    { standardizedName: { contains: variant, mode: 'insensitive' } },
                    { rawName: { contains: variant, mode: 'insensitive' } }
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
                take: 20 // Get more products to find best matches
              });
              
              if (products.length > 0) break;
            }
          }
        }

        // Check if we have any products
        if (products.length === 0) {
          return {
            product_name: item.product_name,
            scanned_price: item.scanned_price,
            status: 'not_found',
            matched_product: null,
            price_analysis: null
          };
        }

        // Find best matching product
        let bestMatch = products[0];
        if (products.length > 1) {
          // Simple matching score based on name similarity
          bestMatch = products.reduce((best, current) => {
            const bestScore = calculateSimilarity(item.product_name, best.name);
            const currentScore = calculateSimilarity(item.product_name, current.name);
            return currentScore > bestScore ? current : best;
          }, products[0]); // Add initial value to prevent reduce error
        }

        // Collect all prices from all matching products
        const allPriceEntries: Array<{price: number, supplier: string, productName: string}> = [];
        
        products.forEach(product => {
          product.prices.forEach(p => {
            allPriceEntries.push({
              price: Number(p.amount),
              supplier: p.supplier.name,
              productName: product.name
            });
          });
        });

        // Sort by price
        allPriceEntries.sort((a, b) => a.price - b.price);
        
        // Get better deals (prices lower than scanned price)
        const betterDeals = allPriceEntries.filter(entry => entry.price < item.scanned_price);
        
        // Remove duplicates (same supplier + same price + same product)
        const uniqueBetterDeals = betterDeals.reduce((acc: typeof betterDeals, current) => {
          const isDuplicate = acc.some(deal => 
            deal.supplier === current.supplier && 
            deal.price === current.price &&
            deal.productName === current.productName
          );
          if (!isDuplicate) {
            acc.push(current);
          }
          return acc;
        }, []);
        
        const topBetterDeals = uniqueBetterDeals.slice(0, 5); // Top 5 unique better deals

        // Calculate price statistics
        const allPrices = allPriceEntries.map(entry => entry.price);
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
            suppliers: allPriceEntries.slice(0, 10).map(entry => ({
              name: entry.supplier,
              price: entry.price,
              product_name: entry.productName
            })),
            better_deals: topBetterDeals.map(deal => ({
              supplier: deal.supplier,
              price: deal.price,
              product_name: deal.productName,
              savings: item.scanned_price - deal.price,
              savings_percent: Math.round(((item.scanned_price - deal.price) / item.scanned_price) * 100)
            })),
            has_better_deals: betterDeals.length > 0
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