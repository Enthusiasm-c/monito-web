const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_h6GaENYK1qSs@ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
    }
  }
});

async function cleanupWidiWigunaPrices() {
  try {
    console.log('🧹 ОЧИСТКА ЦЕН WIDI WIGUNA');
    console.log('=' .repeat(70));
    
    // Find Widi Wiguna supplier
    const widiSupplier = await prisma.supplier.findFirst({
      where: { name: 'Widi Wiguna' }
    });
    
    if (!widiSupplier) {
      console.log('❌ Поставщик Widi Wiguna не найден');
      return;
    }
    
    console.log(`🏢 Поставщик: ${widiSupplier.name} (${widiSupplier.id})`);
    
    // Find all products with multiple active prices for Widi Wiguna
    const productsWithMultiplePrices = await prisma.product.findMany({
      where: {
        prices: {
          some: {
            supplierId: widiSupplier.id,
            validTo: null
          }
        }
      },
      include: {
        prices: {
          where: {
            supplierId: widiSupplier.id,
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
    
    console.log(`🔍 Найдено товаров Widi Wiguna: ${productsWithMultiplePrices.length}`);
    
    for (const product of productsWithMultiplePrices) {
      if (product.prices.length <= 1) {
        continue; // Skip products with 0 or 1 price
      }
      
      totalProductsWithDuplicates++;
      
      console.log(`\\n📦 Обрабатываем: ${product.name} (${product.prices.length} цен)`);
      
      // Keep the most recent price, remove the rest
      const [mostRecentPrice, ...oldPrices] = product.prices;
      
      for (const oldPrice of oldPrices) {
        // Create price history entry for the old price
        await prisma.priceHistory.create({
          data: {
            id: `widi_cleanup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            price: oldPrice.amount,
            unit: oldPrice.unit,
            changedFrom: null, // We don't know the previous price
            changePercentage: null,
            changeReason: 'widi_cleanup_duplicate_removal',
            productId: product.id,
            supplierId: widiSupplier.id,
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
    
    console.log(`\\n🎯 РЕЗУЛЬТАТЫ ОЧИСТКИ WIDI WIGUNA:`);
    console.log(`📦 Товаров с дублирующимися ценами: ${totalProductsWithDuplicates}`);
    console.log(`❌ Цен помечено как неактивные: ${totalPricesRemoved}`);
    console.log(`📈 Записей истории создано: ${totalHistoryCreated}`);
    
    // Verify cleanup results for Widi Wiguna
    const remainingDuplicates = await prisma.product.findMany({
      where: {
        prices: {
          some: {
            supplierId: widiSupplier.id,
            validTo: null
          }
        }
      },
      include: {
        _count: {
          select: {
            prices: {
              where: {
                supplierId: widiSupplier.id,
                validTo: null
              }
            }
          }
        }
      }
    });
    
    const productsWithMultipleActivePrices = remainingDuplicates.filter(p => p._count.prices > 1);
    
    console.log(`\\n📊 ПРОВЕРКА РЕЗУЛЬТАТОВ WIDI WIGUNA:`);
    console.log(`✅ Товаров с одной активной ценой: ${remainingDuplicates.length - productsWithMultipleActivePrices.length}`);
    console.log(`⚠️ Товаров с множественными активными ценами: ${productsWithMultipleActivePrices.length}`);
    
    if (productsWithMultipleActivePrices.length === 0) {
      console.log(`\\n🎉 ОЧИСТКА WIDI WIGUNA ЗАВЕРШЕНА УСПЕШНО!`);
      console.log(`✅ Все товары Widi Wiguna теперь имеют только одну активную цену`);
      console.log(`✅ История цен сохранена для удаленных дубликатов`);
    } else {
      console.log(`\\n⚠️ ЧАСТИЧНАЯ ОЧИСТКА WIDI WIGUNA`);
      console.log(`❌ Остались товары с множественными ценами`);
      
      // Show remaining issues
      console.log(`\\n🔍 ТОВАРЫ С ПРОБЛЕМАМИ:`);
      productsWithMultipleActivePrices.forEach((product, index) => {
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
    console.error('❌ Ошибка очистки цен Widi Wiguna:', error.message);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await prisma.$disconnect();
  }
}

cleanupWidiWigunaPrices();