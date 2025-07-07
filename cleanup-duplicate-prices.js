const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_h6GaENYK1qSs@ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
    }
  }
});

async function cleanupDuplicatePrices() {
  try {
    console.log('🧹 ОЧИСТКА ДУБЛИРУЮЩИХСЯ ЦЕН');
    console.log('=' .repeat(70));
    
    // Find all products with multiple active prices
    const productsWithMultiplePrices = await prisma.product.findMany({
      include: {
        prices: {
          where: {
            validTo: null
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });
    
    let totalProductsWithDuplicates = 0;
    let totalPricesRemoved = 0;
    let totalHistoryCreated = 0;
    
    console.log(`🔍 Найдено товаров для анализа: ${productsWithMultiplePrices.length}`);
    
    for (const product of productsWithMultiplePrices) {
      if (product.prices.length <= 1) {
        continue; // Skip products with 0 or 1 price
      }
      
      totalProductsWithDuplicates++;
      
      console.log(`\\n📦 Обрабатываем: ${product.name} (${product.prices.length} цен)`);
      
      // Group prices by supplier
      const pricesBySupplier = new Map();
      for (const price of product.prices) {
        if (!pricesBySupplier.has(price.supplierId)) {
          pricesBySupplier.set(price.supplierId, []);
        }
        pricesBySupplier.get(price.supplierId).push(price);
      }
      
      // Process each supplier's prices
      for (const [supplierId, supplierPrices] of pricesBySupplier) {
        if (supplierPrices.length <= 1) {
          continue; // Only one price for this supplier, no duplicates
        }
        
        console.log(`   🏢 Поставщик ${supplierId}: ${supplierPrices.length} цен`);
        
        // Keep the most recent price, remove the rest
        const [mostRecentPrice, ...oldPrices] = supplierPrices;
        
        for (const oldPrice of oldPrices) {
          // Create price history entry for the old price
          await prisma.priceHistory.create({
            data: {
              id: `cleanup_history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              price: oldPrice.amount,
              unit: oldPrice.unit,
              changedFrom: null, // We don't know the previous price
              changePercentage: null,
              changeReason: 'cleanup_duplicate_removal',
              productId: product.id,
              supplierId: supplierId,
              uploadId: oldPrice.uploadId,
              createdAt: oldPrice.createdAt // Use original creation date
            }
          });
          totalHistoryCreated++;
          
          // Mark old price as expired
          await prisma.price.update({
            where: { id: oldPrice.id },
            data: { 
              validTo: new Date()
            }
          });
          totalPricesRemoved++;
          
          console.log(`   ❌ Удалена дубликатная цена: $${oldPrice.amount} ${oldPrice.unit} (${oldPrice.createdAt.toLocaleString()})`);
        }
        
        console.log(`   ✅ Оставлена цена: $${mostRecentPrice.amount} ${mostRecentPrice.unit} (${mostRecentPrice.createdAt.toLocaleString()})`);
      }
    }
    
    console.log(`\\n🎯 РЕЗУЛЬТАТЫ ОЧИСТКИ:`);
    console.log(`📦 Товаров с дублирующимися ценами: ${totalProductsWithDuplicates}`);
    console.log(`❌ Цен помечено как неактивные: ${totalPricesRemoved}`);
    console.log(`📈 Записей истории создано: ${totalHistoryCreated}`);
    
    // Verify cleanup results
    const remainingDuplicates = await prisma.product.findMany({
      where: {
        prices: {
          some: {
            validTo: null
          }
        }
      },
      include: {
        _count: {
          select: {
            prices: {
              where: {
                validTo: null
              }
            }
          }
        }
      }
    });
    
    const productsWithMultipleActivePrices = remainingDuplicates.filter(p => p._count.prices > 1);
    
    console.log(`\\n📊 ПРОВЕРКА РЕЗУЛЬТАТОВ:`);
    console.log(`✅ Товаров с одной активной ценой: ${remainingDuplicates.length - productsWithMultipleActivePrices.length}`);
    console.log(`⚠️ Товаров с множественными активными ценами: ${productsWithMultipleActivePrices.length}`);
    
    if (productsWithMultipleActivePrices.length === 0) {
      console.log(`\\n🎉 ОЧИСТКА ЗАВЕРШЕНА УСПЕШНО!`);
      console.log(`✅ Все товары теперь имеют максимум одну активную цену на поставщика`);
      console.log(`✅ История цен сохранена для удаленных дубликатов`);
    } else {
      console.log(`\\n⚠️ ЧАСТИЧНАЯ ОЧИСТКА`);
      console.log(`❌ Остались товары с множественными ценами - возможно, разные поставщики`);
      
      // Show first few remaining issues
      console.log(`\\n🔍 ПЕРВЫЕ 5 ТОВАРОВ С ПРОБЛЕМАМИ:`);
      productsWithMultipleActivePrices.slice(0, 5).forEach((product, index) => {
        console.log(`${index + 1}. ${product.name}: ${product._count.prices} активных цен`);
      });
    }
    
    return {
      success: true,
      productsProcessed: totalProductsWithDuplicates,
      pricesRemoved: totalPricesRemoved,
      historyCreated: totalHistoryCreated,
      remainingIssues: productsWithMultipleActivePrices.length
    };
    
  } catch (error) {
    console.error('❌ Ошибка очистки дублирующихся цен:', error.message);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDuplicatePrices();