const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_h6GaENYK1qSs@ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
    }
  }
});

async function checkPriceUpdates() {
  try {
    console.log('💰 ПРОВЕРКА ОБНОВЛЕНИЙ ЦЕН У ПОСТАВЩИКОВ');
    console.log('=' .repeat(70));
    
    // Проверить обновления за сегодня
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    console.log(`📅 Анализ обновлений цен с ${today.toLocaleDateString()}`);
    
    // Найти поставщиков с новыми ценами сегодня
    const suppliersWithPriceUpdates = await prisma.supplier.findMany({
      where: {
        prices: {
          some: {
            createdAt: {
              gte: today
            }
          }
        }
      },
      include: {
        _count: {
          select: {
            prices: true,
            priceHistory: true
          }
        },
        prices: {
          where: {
            createdAt: {
              gte: today
            }
          },
          include: {
            product: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        priceHistory: {
          where: {
            createdAt: {
              gte: today
            }
          },
          include: {
            product: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        }
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    console.log(`\n📊 Поставщиков с обновлениями цен сегодня: ${suppliersWithPriceUpdates.length}`);
    
    if (suppliersWithPriceUpdates.length === 0) {
      console.log('⚠️ Сегодня не было обновлений цен');
      return;
    }
    
    let totalNewPrices = 0;
    let totalPriceHistory = 0;
    
    console.log('\n🏢 ДЕТАЛИ ПО ПОСТАВЩИКАМ:');
    
    suppliersWithPriceUpdates.forEach((supplier, index) => {
      const newPricesToday = supplier.prices.length;
      const historyToday = supplier.priceHistory.length;
      
      totalNewPrices += newPricesToday;
      totalPriceHistory += historyToday;
      
      console.log(`\n${index + 1}. 🏢 ${supplier.name}`);
      console.log(`   📊 Всего цен: ${supplier._count.prices}`);
      console.log(`   📈 Всего истории: ${supplier._count.priceHistory}`);
      console.log(`   🆕 Новых цен сегодня: ${newPricesToday}`);
      console.log(`   📋 Записей истории сегодня: ${historyToday}`);
      
      // Показать примеры новых цен
      if (newPricesToday > 0) {
        console.log(`   💰 Примеры новых цен:`);
        supplier.prices.slice(0, 5).forEach((price, priceIndex) => {
          console.log(`      ${priceIndex + 1}. ${price.product.name}: $${price.amount} ${price.unit}`);
        });
        if (newPricesToday > 5) {
          console.log(`      ... и еще ${newPricesToday - 5} товаров`);
        }
      }
      
      // Показать изменения цен из истории
      if (historyToday > 0) {
        console.log(`   📈 Изменения цен:`);
        supplier.priceHistory.slice(0, 3).forEach((record, histIndex) => {
          const changeInfo = record.changedFrom ? 
            ` (было $${record.changedFrom}, изменение ${record.changePercentage?.toFixed(1) || 'N/A'}%)` : 
            ' (первая цена)';
          console.log(`      ${histIndex + 1}. ${record.product.name}: $${record.price}${changeInfo}`);
        });
        if (historyToday > 3) {
          console.log(`      ... и еще ${historyToday - 3} изменений`);
        }
      }
    });
    
    // Статистика по типам изменений
    console.log('\n📈 АНАЛИЗ ИЗМЕНЕНИЙ ЦЕН:');
    
    const priceChanges = await prisma.priceHistory.findMany({
      where: {
        createdAt: {
          gte: today
        },
        changedFrom: {
          not: null
        }
      },
      include: {
        supplier: true,
        product: true
      }
    });
    
    if (priceChanges.length > 0) {
      const increases = priceChanges.filter(p => p.changePercentage && p.changePercentage > 0);
      const decreases = priceChanges.filter(p => p.changePercentage && p.changePercentage < 0);
      const noChange = priceChanges.filter(p => p.changePercentage === 0);
      
      console.log(`📊 Всего изменений цен: ${priceChanges.length}`);
      console.log(`📈 Подорожало: ${increases.length} товаров`);
      console.log(`📉 Подешевело: ${decreases.length} товаров`);
      console.log(`➡️ Без изменений: ${noChange.length} товаров`);
      
      if (increases.length > 0) {
        const avgIncrease = increases.reduce((sum, p) => sum + (p.changePercentage || 0), 0) / increases.length;
        console.log(`📈 Средний рост цен: ${avgIncrease.toFixed(1)}%`);
      }
      
      if (decreases.length > 0) {
        const avgDecrease = decreases.reduce((sum, p) => sum + (p.changePercentage || 0), 0) / decreases.length;
        console.log(`📉 Среднее снижение цен: ${Math.abs(avgDecrease).toFixed(1)}%`);
      }
      
      // Топ-5 самых больших изменений
      const biggestChanges = priceChanges
        .filter(p => p.changePercentage !== null)
        .sort((a, b) => Math.abs(b.changePercentage || 0) - Math.abs(a.changePercentage || 0))
        .slice(0, 5);
      
      if (biggestChanges.length > 0) {
        console.log('\n🔥 ТОП-5 САМЫХ БОЛЬШИХ ИЗМЕНЕНИЙ:');
        biggestChanges.forEach((change, index) => {
          const direction = (change.changePercentage || 0) > 0 ? '📈' : '📉';
          console.log(`${index + 1}. ${direction} ${change.product.name} (${change.supplier.name})`);
          console.log(`   Было: $${change.changedFrom} → Стало: $${change.price}`);
          console.log(`   Изменение: ${change.changePercentage?.toFixed(1) || 'N/A'}%`);
        });
      }
    } else {
      console.log('📊 Все цены сегодня - новые (нет изменений существующих)');
    }
    
    // Проверить загрузки которые создали эти цены
    console.log('\n📤 ИСТОЧНИКИ ОБНОВЛЕНИЙ ЦЕН:');
    
    const todayUploads = await prisma.upload.findMany({
      where: {
        createdAt: {
          gte: today
        }
      },
      include: {
        supplier: true,
        _count: {
          select: {
            prices: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (todayUploads.length > 0) {
      console.log(`📋 Загрузок сегодня: ${todayUploads.length}`);
      
      todayUploads.forEach((upload, index) => {
        console.log(`${index + 1}. ${upload.originalName || upload.fileName} (${upload.supplier.name})`);
        console.log(`   📦 Создано цен: ${upload._count.prices}`);
        console.log(`   📊 Статус: ${upload.status}`);
        console.log(`   📅 Время: ${upload.createdAt.toLocaleString()}`);
      });
    }
    
    // Итоговая статистика
    console.log('\n🎯 ИТОГОВАЯ СТАТИСТИКА:');
    console.log(`🏢 Поставщиков обновлено: ${suppliersWithPriceUpdates.length}`);
    console.log(`💰 Новых цен добавлено: ${totalNewPrices}`);
    console.log(`📈 Записей истории создано: ${totalPriceHistory}`);
    console.log(`📤 Загрузок обработано: ${todayUploads.length}`);
    console.log(`📊 Изменений существующих цен: ${priceChanges.length}`);
    
    return {
      suppliersUpdated: suppliersWithPriceUpdates.length,
      newPrices: totalNewPrices,
      priceHistoryRecords: totalPriceHistory,
      uploads: todayUploads.length,
      priceChanges: priceChanges.length,
      suppliers: suppliersWithPriceUpdates.map(s => ({
        name: s.name,
        newPrices: s.prices.length,
        historyRecords: s.priceHistory.length
      }))
    };
    
  } catch (error) {
    console.error('❌ Ошибка проверки обновлений цен:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkPriceUpdates();