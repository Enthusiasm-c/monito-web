import { NextRequest, NextResponse } from 'next/server';
import { authenticateBot } from '../../middleware';
import { calculateUnitPrice, areUnitsComparable, getCanonicalUnit } from '../../../../lib/utils/unit-price-calculator';
import { normalize, coreNoun, hasDifferentCoreNoun, calcUnitPrice } from '../../../../lib/utils/product-normalizer';
// Embedded searchProductsWithAliases function to avoid import issues
async function searchProductsWithAliases(query: string) {
  const normalizedQuery = normalize(query);
  
  // First check for exact alias match
  const alias = await prisma.product_alias.findUnique({
    where: { alias: normalizedQuery },
    select: { productId: true }
  });
  
  if (alias) {
    // Return the exact product matched by alias
    const product = await prisma.product.findUnique({
      where: { id: alias.productId },
      include: {
        prices: {
          where: { validTo: null },
          include: {
            supplier: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
    
    return product ? [product] : [];
  }
  
  // Fallback to regular search
  return await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: normalizedQuery, mode: 'insensitive' } },
        { standardizedName: { contains: normalizedQuery, mode: 'insensitive' } },
        { rawName: { contains: normalizedQuery, mode: 'insensitive' } }
      ]
    },
    include: {
      prices: {
        where: { validTo: null },
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
import { standardizeProducts, type StandardizedProduct } from '../../../../lib/utils/standardization';

// AI standardization helper function
async function tryAIStandardization(item: ComparisonRequest, reason: string) {
  console.log(`🤖 ${reason} for "${item.product_name}", trying AI standardization...`);
  console.error(`DEBUG: ${reason} for: ${item.product_name}`);
  
  try {
    const aiStandardized = await standardizeProducts([{
      name: item.product_name,
      unit: item.unit,
      quantity: item.quantity,
      price: item.scanned_price
    }]);

    if (aiStandardized.length > 0 && aiStandardized[0].confidence > 0.7) {
      const standardized = aiStandardized[0];
      console.log(`🎯 AI standardized "${item.product_name}" → "${standardized.standardizedName}"`);
      
      // Search again with AI standardized name
      const aiProducts = await searchProductsWithAliases(standardized.standardizedName);
      
      if (aiProducts.length > 0) {
        console.log(`✅ Found match after AI standardization: ${aiProducts[0].name}`);
        return { products: aiProducts, standardizedName: standardized.standardizedName };
      } else {
        console.log(`❌ Still no match after AI standardization for "${standardized.standardizedName}"`);
        
        // Fallback: try searching by individual words from AI standardized name
        const words = standardized.standardizedName.toLowerCase().split(' ').filter(w => w.length > 2);
        if (words.length > 0) {
          console.log(`🔍 Trying fallback search with words: ${words.join(', ')}`);
          
          // Collect all fallback products from all words
          let allFallbackProducts = [];
          for (const word of words) {
            const fallbackProducts = await searchProductsWithAliases(word);
            if (fallbackProducts.length > 0) {
              console.log(`🔍 Found ${fallbackProducts.length} products for word "${word}"`);
              allFallbackProducts.push(...fallbackProducts);
            }
          }
          
          if (allFallbackProducts.length > 0) {
            // Remove duplicates
            const uniqueProducts = allFallbackProducts.filter((product, index, self) => 
              index === self.findIndex(p => p.id === product.id)
            );
            
            // Find best similarity match among all fallback products
            let bestProduct = uniqueProducts[0];
            let bestSimilarity = calculateProductSimilarity(standardized.standardizedName, bestProduct.name);
            
            for (const product of uniqueProducts) {
              const similarity = calculateProductSimilarity(standardized.standardizedName, product.name);
              console.log(`🔍 Fallback similarity "${standardized.standardizedName}" → "${product.name}": ${similarity}`);
              if (similarity > bestSimilarity) {
                bestProduct = product;
                bestSimilarity = similarity;
              }
            }
            
            if (bestSimilarity > 0) {
              console.log(`✅ Found best fallback match "${standardized.standardizedName}" → "${bestProduct.name}" (similarity: ${bestSimilarity})`);
              return { products: [bestProduct], standardizedName: standardized.standardizedName };
            } else {
              console.log(`❌ All fallback products have 0 similarity with "${standardized.standardizedName}"`);
            }
          }
          console.log(`❌ No fallback matches found for any words`);
        }
      }
    } else {
      console.log(`❌ AI standardization confidence too low: ${aiStandardized[0]?.confidence || 'N/A'}`);
    }
  } catch (aiError) {
    console.error('DEBUG: AI standardization failed:', aiError);
    console.error('AI standardization failed:', aiError);
  }
  
  return { products: [], standardizedName: null };
}

interface ComparisonRequest {
  product_name: string;
  supplier_id?: string; // Supplier to exclude from recommendations
  scanned_price: number;
  unit?: string;
  quantity?: number; // For unit price calculation
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
        // Normalize the query for better matching
        const normalizedQuery = normalize(item.product_name);
        
        // Search for product - first try alias lookup and normalized search
        let products = await searchProductsWithAliases(normalizedQuery);
        
        // If no products found with normalized query, try original
        if (products.length === 0 && normalizedQuery !== item.product_name) {
          products = await searchProductsWithAliases(item.product_name);
        }

        // Enhanced search: try exact word match first
        if (products.length === 0) {
          const queryWords = getWordsArray(item.product_name);
          if (queryWords.length > 1) {
            // Search for products containing ALL query words
            const allWordsConditions = queryWords.map(word => ({
              OR: [
                { name: { contains: word, mode: 'insensitive' } },
                { standardizedName: { contains: word, mode: 'insensitive' } },
                { rawName: { contains: word, mode: 'insensitive' } }
              ]
            }));

            products = await prisma.product.findMany({
              where: {
                AND: allWordsConditions
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

        // If still no products found, try word-based search
        if (products.length === 0) {
          const words = item.product_name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
          if (words.length > 0) {
            // First try OR conditions for individual words (more permissive)
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

        // If still no results, try partial word matches (for short queries like "romana")
        if (products.length === 0 && item.product_name.length >= 4) {
          const query = item.product_name.toLowerCase();
          products = await prisma.product.findMany({
            where: {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { standardizedName: { contains: query, mode: 'insensitive' } },
                { rawName: { contains: query, mode: 'insensitive' } }
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
            take: 20
          });
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
        console.error(`DEBUG: Found ${products.length} products for "${item.product_name}"`);
        if (products.length === 0) {
          // Try AI standardization as fallback when no products found
          const aiResult = await tryAIStandardization(item, "No match found");
          if (aiResult.products.length > 0) {
            products = aiResult.products;
          }
        }

        // If still no products found after AI attempt
        if (products.length === 0) {
          // Save to unmatched queue for admin review
          try {
            const context = {
              scanned_price: item.scanned_price,
              unit: item.unit,
              quantity: item.quantity,
              search_attempts: [
                normalizedQuery,
                ...(normalizedQuery !== item.product_name ? [item.product_name] : [])
              ]
            };

            await prisma.unmatched_queue.create({
              data: {
                rawName: item.product_name,
                normalizedName: normalizedQuery,
                context,
                supplierId: item.supplier_id
              }
            });
          } catch (error) {
            console.error('Failed to save unmatched product:', error);
            // Don't fail the main request if unmatched save fails
          }

          return {
            product_name: item.product_name,
            scanned_price: item.scanned_price,
            status: 'not_found',
            matched_product: null,
            price_analysis: null
          };
        }

        // Find best matching product, prioritizing similarity score and unit match
        let bestMatch = products[0];
        
        // Always apply similarity scoring, even for single product
        if (item.unit) {
          const scannedCanonical = getCanonicalUnit(item.unit);
          bestMatch = products.reduce((best, current) => {
            const bestCanonical = getCanonicalUnit(best.unit);
            const currentCanonical = getCanonicalUnit(current.unit);
            const bestUnitMatch = bestCanonical === scannedCanonical;
            const currentUnitMatch = currentCanonical === scannedCanonical;
            
            // First check similarity scores to exclude incompatible products
            const bestScore = calculateProductSimilarity(item.product_name, best.name);
            const currentScore = calculateProductSimilarity(item.product_name, current.name);
            
            // Exclude products with 0 similarity (incompatible modifiers)
            if (currentScore === 0) return best;
            if (bestScore === 0) return current;
            
            // Prioritize unit match among compatible products
            if (currentUnitMatch && !bestUnitMatch) return current;
            if (!currentUnitMatch && bestUnitMatch) return best;
            
            // If both match or both don't match, use higher similarity score
            return currentScore > bestScore ? current : best;
          }, products[0]);
        } else {
          // No unit provided, use enhanced product similarity only
          bestMatch = products.reduce((best, current) => {
            const bestScore = calculateProductSimilarity(item.product_name, best.name);
            const currentScore = calculateProductSimilarity(item.product_name, current.name);
            
            // Exclude products with 0 similarity (incompatible modifiers)
            if (currentScore === 0) return best;
            if (bestScore === 0) return current;
            
            return currentScore > bestScore ? current : best;
          }, products[0]);
        }
        
        // Final check: if best match has low similarity, try AI standardization
        const finalSimilarity = calculateProductSimilarity(item.product_name, bestMatch.name);
        console.error(`DEBUG: Final similarity for "${item.product_name}" → "${bestMatch.name}": ${finalSimilarity}`);
        
        let aiStandardizedName = null;
        if (finalSimilarity === 0) {
          // Try AI standardization for completely incompatible matches
          const aiResult = await tryAIStandardization(item, "Incompatible match (similarity = 0)");
          if (aiResult.products.length > 0 && aiResult.standardizedName) {
            // Re-run the matching logic with AI results
            products = aiResult.products;
            bestMatch = products[0];
            aiStandardizedName = aiResult.standardizedName;
            
            // Re-calculate similarity with AI standardized products using AI standardized name
            if (item.unit) {
              const scannedCanonical = getCanonicalUnit(item.unit);
              bestMatch = products.reduce((best, current) => {
                const bestCanonical = getCanonicalUnit(best.unit);
                const currentCanonical = getCanonicalUnit(current.unit);
                const bestUnitMatch = bestCanonical === scannedCanonical;
                const currentUnitMatch = currentCanonical === scannedCanonical;
                
                const bestScore = calculateProductSimilarity(aiStandardizedName, best.name);
                const currentScore = calculateProductSimilarity(aiStandardizedName, current.name);
                
                if (currentScore === 0) return best;
                if (bestScore === 0) return current;
                
                if (currentUnitMatch && !bestUnitMatch) return current;
                if (!currentUnitMatch && bestUnitMatch) return best;
                
                return currentScore > bestScore ? current : best;
              }, products[0]);
            } else {
              bestMatch = products.reduce((best, current) => {
                const bestScore = calculateProductSimilarity(aiStandardizedName, best.name);
                const currentScore = calculateProductSimilarity(aiStandardizedName, current.name);
                
                if (currentScore === 0) return best;
                if (bestScore === 0) return current;
                
                return currentScore > bestScore ? current : best;
              }, products[0]);
            }
            
            // Re-check final similarity with AI standardized result using AI standardized name
            const newFinalSimilarity = calculateProductSimilarity(aiStandardizedName, bestMatch.name);
            console.error(`DEBUG: AI result similarity "${aiStandardizedName}" → "${bestMatch.name}": ${newFinalSimilarity}`);
            
            if (newFinalSimilarity === 0) {
              return {
                product_name: item.product_name,
                scanned_price: item.scanned_price,
                status: 'not_found',
                matched_product: null,
                price_analysis: null
              };
            }
          } else {
            // AI failed, return not found
            return {
              product_name: item.product_name,
              scanned_price: item.scanned_price,
              status: 'not_found',
              matched_product: null,
              price_analysis: null
            };
          }
        } else if (finalSimilarity < 30) {
          // Try AI standardization for low similarity matches
          console.error(`DEBUG: Low similarity (${finalSimilarity}), trying AI...`);
          const aiResult = await tryAIStandardization(item, `Low similarity match (${finalSimilarity})`);
          if (aiResult.products.length > 0 && aiResult.standardizedName) {
            // Check if AI gives us a better match using AI standardized name
            const aiBestMatch = aiResult.products[0];
            const aiSimilarity = calculateProductSimilarity(aiResult.standardizedName, aiBestMatch.name);
            console.error(`DEBUG: AI similarity "${aiResult.standardizedName}" → "${aiBestMatch.name}": ${aiSimilarity} vs original: ${finalSimilarity}`);
            
            if (aiSimilarity > finalSimilarity) {
              console.log(`✅ AI found better match: ${aiSimilarity} > ${finalSimilarity}`);
              products = aiResult.products;
              bestMatch = aiBestMatch;
              aiStandardizedName = aiResult.standardizedName;
            }
          }
        }

        // MVP: Calculate scanned unit price for comparison (M-4 requirement)
        const scannedUnitPrice = item.unit && item.quantity ? 
          calcUnitPrice(item.scanned_price, item.quantity, item.unit) : 
          item.scanned_price;

        // Collect all prices from all matching products
        const allPriceEntries: Array<{
          price: number, 
          unitPrice: number | null,
          supplier: string, 
          supplierId: string,
          productName: string, 
          unit: string, 
          unitMatch: boolean,
          createdAt: Date
        }> = [];
        
        const scannedCanonicalUnit = item.unit ? getCanonicalUnit(item.unit) : null;
        
        products.forEach(product => {
          // MODIFIER FIX: Skip products with incompatible exclusive modifiers
          if (hasExclusiveModifierMismatch(item.product_name, product.name)) {
            return; // Skip entire product if it has incompatible modifiers
          }
          
          product.prices.forEach(p => {
            // MVP: Skip same supplier recommendations
            if (item.supplier_id && p.supplierId === item.supplier_id) {
              return;
            }

            // MVP: Skip stale prices (M-5 requirement: 7 days freshness)
            const priceAge = Date.now() - p.createdAt.getTime();
            const FRESH_DAYS = 7; // M-5 requirement
            const isStale = priceAge > FRESH_DAYS * 24 * 60 * 60 * 1000;
            if (isStale && p.validTo === null) {
              return;
            }

            const priceCanonicalUnit = getCanonicalUnit(p.unit || product.unit);
            const unitsMatch = scannedCanonicalUnit && priceCanonicalUnit && 
                              scannedCanonicalUnit === priceCanonicalUnit;

            // Calculate unit price for this entry (M-4 requirement)
            let entryUnitPrice: number | null = null;
            if (p.unitPrice) {
              entryUnitPrice = Number(p.unitPrice);
            } else {
              // Calculate unit price based on unit (assuming quantity = 1 if not stored)
              entryUnitPrice = calcUnitPrice(Number(p.amount), 1, p.unit || product.unit);
            }

            allPriceEntries.push({
              price: Number(p.amount),
              unitPrice: entryUnitPrice,
              supplier: p.supplier.name,
              supplierId: p.supplierId,
              productName: product.name,
              unit: p.unit || product.unit,
              unitMatch: unitsMatch,
              createdAt: p.createdAt
            });
          });
        });

        // Sort by unit match first, then by unit price (if available), then by total price
        allPriceEntries.sort((a, b) => {
          // Prioritize unit matches
          if (a.unitMatch && !b.unitMatch) return -1;
          if (!a.unitMatch && b.unitMatch) return 1;
          
          // For matching units, sort by unit price
          if (a.unitMatch && b.unitMatch && a.unitPrice && b.unitPrice) {
            return a.unitPrice - b.unitPrice;
          }
          
          // Fallback to total price
          return a.price - b.price;
        });
        
        // C-4: Get better deals with 5% minimum savings threshold
        const MIN_SAVING_PCT = Number(process.env.MIN_SAVING_PCT) || 5;
        const betterDeals = allPriceEntries.filter(entry => {
          if (scannedUnitPrice && entry.unitPrice && entry.unitMatch) {
            // Compare unit prices for matching units - require ≥5% savings
            const savingsPct = ((scannedUnitPrice - entry.unitPrice) / scannedUnitPrice) * 100;
            return savingsPct >= MIN_SAVING_PCT;
          }
          // Fallback to total price comparison - require ≥5% savings
          const savingsPct = ((item.scanned_price - entry.price) / item.scanned_price) * 100;
          return savingsPct >= MIN_SAVING_PCT;
        });
        
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
        
        // C-4: Limit to maximum 3 alternatives, sorted by best price
        const topBetterDeals = uniqueBetterDeals.slice(0, 3); // Maximum 3 alternatives

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
            better_deals: topBetterDeals.map(deal => {
              // Calculate savings based on unit price when available
              let savings, savingsPercent;
              if (scannedUnitPrice && deal.unitPrice && deal.unitMatch) {
                savings = scannedUnitPrice - deal.unitPrice;
                savingsPercent = Math.round((savings / scannedUnitPrice) * 100);
              } else {
                savings = item.scanned_price - deal.price;
                savingsPercent = Math.round((savings / item.scanned_price) * 100);
              }

              return {
                supplier: deal.supplier,
                price: deal.price,
                unit_price: deal.unitPrice,
                product_name: deal.productName,
                unit: deal.unit,
                unit_match: deal.unitMatch,
                savings: Math.round(savings),
                savings_percent: savingsPercent
              };
            }),
            has_better_deals: betterDeals.length > 0,
            is_best_price: topBetterDeals.length === 0 // C-4: Indicate when no better alternatives found
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

// Normalize product name for comparison
function normalizeProductName(name: string): string {
  return name.toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Remove punctuation
    .replace(/\s+/g, ' ')       // Normalize spaces
    .trim();
}

// Product modifiers classification (synchronized with product-normalizer.ts)
const PRODUCT_MODIFIERS = {
  // Words that fundamentally change the product (exclude if mismatch)
  exclusive: [
    'sweet', 'oyster', 'baby', 'local', // As per M-3 requirement
    'cherry', 'grape', 'plum',
    'black', 'white', 'red', 'green', 'yellow', 'purple',
    'dried', 'frozen', 'canned', 'pickled', 'smoked',
    'wild', 'sea', 'mountain', 'water', 'bitter',
    'japanese', 'chinese', 'indian', 'thai', 'korean',
    'young', 'old', 'mature',
    'male', 'female',
    'imported', 'organic', 'conventional'
  ],
  
  // Words that describe size/quality but don't change core product
  descriptive: [
    'big', 'large', 'huge', 'giant', 'jumbo',
    'small', 'mini', 'tiny', 'little',
    'medium', 'regular', 'standard',
    'fresh', 'new', 'premium', 'grade', 'quality',
    'whole', 'half', 'piece', 'slice'
  ]
};

// Get normalized words array
function getWordsArray(name: string): string[] {
  return normalizeProductName(name).split(' ').filter(word => word.length > 0);
}

// Check if product has incompatible exclusive modifiers
function hasExclusiveModifierMismatch(query: string, productName: string): boolean {
  const queryWords = getWordsArray(query);
  const productWords = getWordsArray(productName);
  
  // Find exclusive modifiers in both query and product
  const queryExclusives = queryWords.filter(w => PRODUCT_MODIFIERS.exclusive.includes(w));
  const productExclusives = productWords.filter(w => PRODUCT_MODIFIERS.exclusive.includes(w));
  
  // FIXED: Only reject if query has exclusive modifiers that don't match product
  // Allow partial queries without exclusive modifiers to match products with them
  if (queryExclusives.length === 0) {
    return false; // Query has no exclusive modifiers, so allow any product
  }
  
  // If query has exclusive modifiers, check if product conflicts
  const conflictingModifiers = queryExclusives.filter(mod => !productExclusives.includes(mod));
  
  return conflictingModifiers.length > 0;
}

// Get core product words (excluding modifiers)
function getCoreWords(name: string): string[] {
  const words = getWordsArray(name);
  return words.filter(word => 
    !PRODUCT_MODIFIERS.exclusive.includes(word) && 
    !PRODUCT_MODIFIERS.descriptive.includes(word)
  );
}

// Check if all query words are present in product name
function hasAllWords(queryWords: string[], productWords: string[]): boolean {
  return queryWords.every(qWord => 
    productWords.some(pWord => pWord.includes(qWord) || qWord.includes(pWord))
  );
}

// Enhanced product similarity calculation with modifier awareness
function calculateProductSimilarity(query: string, productName: string): number {
  const queryWords = getWordsArray(query);
  const productWords = getWordsArray(productName);
  
  // CRITICAL: Check core noun match first (M-3 requirement)
  if (hasDifferentCoreNoun(query, productName)) {
    return 0; // "sweet potato" should not match with "potato"
  }
  
  // CRITICAL: Exclude products with incompatible exclusive modifiers
  if (hasExclusiveModifierMismatch(query, productName)) {
    return 0; // Immediate rejection for incompatible modifiers
  }
  
  // Exact normalized match (highest priority)
  if (normalizeProductName(query) === normalizeProductName(productName)) {
    return 100;
  }
  
  // Check if words match when sorted ("english spinach" = "spinach english")
  const sortedQuery = [...queryWords].sort().join(' ');
  const sortedProduct = [...productWords].sort().join(' ');
  if (sortedQuery === sortedProduct) {
    return 95;
  }
  
  // Core words must match (excluding modifiers)
  const queryCoreWords = getCoreWords(query);
  const productCoreWords = getCoreWords(productName);
  
  if (queryCoreWords.length > 0 && productCoreWords.length > 0) {
    const coreMatch = queryCoreWords.every(coreWord => 
      productCoreWords.some(pCore => pCore.includes(coreWord) || coreWord.includes(pCore))
    );
    
    if (!coreMatch) {
      return 0; // Core product must match
    }
  }
  
  // All query words must be present
  if (!hasAllWords(queryWords, productWords)) {
    return 0; // No match if missing required words
  }
  
  // Calculate word overlap score
  const matchingWords = queryWords.filter(qWord => 
    productWords.some(pWord => pWord.includes(qWord) || qWord.includes(pWord))
  );
  
  const wordOverlapScore = matchingWords.length / Math.max(queryWords.length, productWords.length);
  
  // Bonus for exact word matches
  const exactMatches = queryWords.filter(qWord => productWords.includes(qWord));
  const exactMatchBonus = exactMatches.length / queryWords.length * 0.3;
  
  // Bonus for products with only descriptive modifiers (vs exclusive ones)
  const productExclusives = productWords.filter(w => PRODUCT_MODIFIERS.exclusive.includes(w));
  const productDescriptives = productWords.filter(w => PRODUCT_MODIFIERS.descriptive.includes(w));
  const descriptiveBonus = (productExclusives.length === 0 && productDescriptives.length > 0) ? 0.1 : 0;
  
  // Penalty for extra words in product name
  const extraWordsPenalty = Math.max(0, productWords.length - queryWords.length) * 0.05; // Reduced penalty
  
  const finalScore = (wordOverlapScore + exactMatchBonus + descriptiveBonus - extraWordsPenalty) * 80;
  return Math.max(0, Math.min(90, finalScore)); // Cap at 90 to reserve 95+ for exact matches
}

// Legacy similarity function for fallback
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