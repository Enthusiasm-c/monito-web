const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_h6GaENYK1qSs@ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
    }
  }
});

async function compareBeforeAfter() {
  try {
    console.log('📊 СРАВНЕНИЕ ДО И ПОСЛЕ ЗАГРУЗКИ JULY 2025');
    console.log('=' .repeat(70));
    
    // Определить время начала наших загрузок (сегодня утром)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    console.log(`📅 Анализ данных с ${today.toLocaleDateString()} (начало загрузок July 2025)`);
    
    // Получить данные ДО загрузок (созданные до сегодня)
    const beforeStats = {
      suppliers: await prisma.supplier.count({
        where: {
          createdAt: {
            lt: today
          }
        }
      }),
      products: await prisma.product.count({
        where: {
          createdAt: {
            lt: today
          }
        }
      }),
      prices: await prisma.price.count({
        where: {
          createdAt: {
            lt: today
          }
        }
      }),
      uploads: await prisma.upload.count({
        where: {
          createdAt: {
            lt: today
          }
        }
      }),
      priceHistory: await prisma.priceHistory.count({
        where: {
          createdAt: {
            lt: today
          }
        }
      })
    };
    
    // Получить данные ПОСЛЕ загрузок (текущие данные)
    const afterStats = {
      suppliers: await prisma.supplier.count(),
      products: await prisma.product.count(),
      prices: await prisma.price.count(),
      uploads: await prisma.upload.count(),
      priceHistory: await prisma.priceHistory.count()
    };
    
    // Вычислить изменения
    const changes = {
      suppliers: afterStats.suppliers - beforeStats.suppliers,
      products: afterStats.products - beforeStats.products,
      prices: afterStats.prices - beforeStats.prices,
      uploads: afterStats.uploads - beforeStats.uploads,
      priceHistory: afterStats.priceHistory - beforeStats.priceHistory
    };
    
    console.log('\n📈 СТАТИСТИКА ДО ЗАГРУЗКИ (до сегодня):');
    console.log(`🏢 Поставщики: ${beforeStats.suppliers.toLocaleString()}`);
    console.log(`📦 Товары: ${beforeStats.products.toLocaleString()}`);
    console.log(`💰 Цены: ${beforeStats.prices.toLocaleString()}`);
    console.log(`📤 Загрузки: ${beforeStats.uploads.toLocaleString()}`);
    console.log(`📈 История цен: ${beforeStats.priceHistory.toLocaleString()}`);
    
    console.log('\n📊 СТАТИСТИКА ПОСЛЕ ЗАГРУЗКИ (текущая):');
    console.log(`🏢 Поставщики: ${afterStats.suppliers.toLocaleString()}`);
    console.log(`📦 Товары: ${afterStats.products.toLocaleString()}`);
    console.log(`💰 Цены: ${afterStats.prices.toLocaleString()}`);
    console.log(`📤 Загрузки: ${afterStats.uploads.toLocaleString()}`);
    console.log(`📈 История цен: ${afterStats.priceHistory.toLocaleString()}`);
    
    console.log('\n🔄 ИЗМЕНЕНИЯ ОТ ЗАГРУЗКИ JULY 2025:');
    console.log(`🏢 Поставщики: ${changes.suppliers >= 0 ? '+' : ''}${changes.suppliers.toLocaleString()}`);
    console.log(`📦 Товары: ${changes.products >= 0 ? '+' : ''}${changes.products.toLocaleString()}`);
    console.log(`💰 Цены: ${changes.prices >= 0 ? '+' : ''}${changes.prices.toLocaleString()}`);
    console.log(`📤 Загрузки: ${changes.uploads >= 0 ? '+' : ''}${changes.uploads.toLocaleString()}`);
    console.log(`📈 История цен: ${changes.priceHistory >= 0 ? '+' : ''}${changes.priceHistory.toLocaleString()}`);
    
    // Проценты роста
    console.log('\n📈 ПРОЦЕНТНОЕ УВЕЛИЧЕНИЕ:');
    if (beforeStats.suppliers > 0) {
      const supplierGrowth = ((changes.suppliers / beforeStats.suppliers) * 100).toFixed(1);
      console.log(`🏢 Поставщики: ${supplierGrowth}%`);
    }
    if (beforeStats.products > 0) {
      const productGrowth = ((changes.products / beforeStats.products) * 100).toFixed(1);
      console.log(`📦 Товары: ${productGrowth}%`);
    }
    if (beforeStats.prices > 0) {
      const priceGrowth = ((changes.prices / beforeStats.prices) * 100).toFixed(1);
      console.log(`💰 Цены: ${priceGrowth}%`);
    }
    
    // Детали сегодняшних загрузок
    console.log('\n📋 ДЕТАЛИ ЗАГРУЗОК JULY 2025:');
    
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
        createdAt: 'asc'
      }
    });
    
    console.log(`📤 Всего загрузок сегодня: ${todayUploads.length}`);
    
    // Группировка по поставщикам
    const supplierGroups = todayUploads.reduce((acc, upload) => {
      const supplierName = upload.supplier.name;
      if (!acc[supplierName]) {
        acc[supplierName] = {
          files: 0,
          totalPrices: 0,
          statuses: []
        };
      }
      acc[supplierName].files++;
      acc[supplierName].totalPrices += upload._count.prices;
      acc[supplierName].statuses.push(upload.status);
      return acc;
    }, {});
    
    console.log('\n🏢 ЗАГРУЗКИ ПО ПОСТАВЩИКАМ:');
    Object.entries(supplierGroups)
      .sort(([,a], [,b]) => b.totalPrices - a.totalPrices)
      .forEach(([supplier, stats]) => {
        const successful = stats.statuses.filter(s => s === 'completed').length;
        console.log(`📊 ${supplier}:`);
        console.log(`   📁 Файлов: ${stats.files} (${successful} успешно)`);
        console.log(`   💰 Товаров: ${stats.totalPrices}`);
      });
    
    // Новые поставщики
    const newSuppliers = await prisma.supplier.findMany({
      where: {
        createdAt: {
          gte: today
        }
      },
      include: {
        _count: {
          select: {
            uploads: true,
            prices: true
          }
        }
      }
    });
    
    console.log('\n🆕 НОВЫЕ ПОСТАВЩИКИ (созданные сегодня):');
    if (newSuppliers.length > 0) {
      newSuppliers.forEach((supplier, index) => {
        console.log(`${index + 1}. ${supplier.name}`);
        console.log(`   📤 Загрузок: ${supplier._count.uploads}`);
        console.log(`   💰 Товаров: ${supplier._count.prices}`);
      });
    } else {
      console.log('📝 Новых поставщиков не создано (загрузки к существующим)');
    }
    
    // Сохранить отчет сравнения
    const comparisonReport = {
      timestamp: new Date().toISOString(),
      analysisDate: today.toISOString(),
      before: beforeStats,
      after: afterStats,
      changes: changes,
      percentageGrowth: {
        suppliers: beforeStats.suppliers > 0 ? ((changes.suppliers / beforeStats.suppliers) * 100).toFixed(1) : 'N/A',
        products: beforeStats.products > 0 ? ((changes.products / beforeStats.products) * 100).toFixed(1) : 'N/A',
        prices: beforeStats.prices > 0 ? ((changes.prices / beforeStats.prices) * 100).toFixed(1) : 'N/A'
      },
      todayUploads: todayUploads.length,
      newSuppliers: newSuppliers.length,
      supplierBreakdown: supplierGroups
    };
    
    console.log('\n💾 Отчет сохранен: comparison-before-after.json');
    require('fs').writeFileSync('comparison-before-after.json', JSON.stringify(comparisonReport, null, 2));
    
    return comparisonReport;
    
  } catch (error) {
    console.error('❌ Ошибка сравнения данных:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

compareBeforeAfter();