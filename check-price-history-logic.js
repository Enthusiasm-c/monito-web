const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_h6GaENYK1qSs@ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
    }
  }
});

async function checkPriceHistoryLogic() {
  try {
    console.log('📈 АНАЛИЗ ЛОГИКИ ХРАНЕНИЯ ИСТОРИИ ЦЕН');
    console.log('=' .repeat(70));
    
    // Проверим конкретно поставщика Widi Wiguna, у которого были обновления
    const widiSupplier = await prisma.supplier.findFirst({
      where: { name: 'Widi Wiguna' }
    });
    
    if (!widiSupplier) {
      console.log('❌ Поставщик Widi Wiguna не найден');
      return;
    }
    
    console.log(`🏢 Анализируем поставщика: ${widiSupplier.name} (${widiSupplier.id})`);
    
    // Найдем несколько товаров этого поставщика для анализа
    const products = await prisma.product.findMany({
      where: {
        prices: {
          some: {
            supplierId: widiSupplier.id
          }
        }
      },
      include: {
        prices: {
          where: {
            supplierId: widiSupplier.id
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        priceHistory: {
          where: {
            supplierId: widiSupplier.id
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      take: 5
    });
    
    console.log(`\n📦 Найдено товаров для анализа: ${products.length}`);
    
    products.forEach((product, index) => {
      console.log(`\n${index + 1}. 📦 Товар: ${product.name}`);
      console.log(`   💰 Текущих цен в таблице prices: ${product.prices.length}`);
      console.log(`   📈 Записей в истории цен: ${product.priceHistory.length}`);
      
      // Показать текущие цены
      if (product.prices.length > 0) {
        console.log(`   💰 ТЕКУЩИЕ ЦЕНЫ:`);
        product.prices.forEach((price, priceIndex) => {
          console.log(`      ${priceIndex + 1}. $${price.amount} ${price.unit} (создано: ${price.createdAt.toLocaleString()})`);
        });
      }
      
      // Показать историю цен
      if (product.priceHistory.length > 0) {
        console.log(`   📈 ИСТОРИЯ ЦЕН:`);
        product.priceHistory.forEach((history, histIndex) => {
          const changeInfo = history.changedFrom ? 
            ` (было $${history.changedFrom}, изменение ${history.changePercentage?.toFixed(1) || 'N/A'}%)` : 
            ' (первая цена)';
          console.log(`      ${histIndex + 1}. $${history.price} ${history.unit}${changeInfo}`);
          console.log(`         📅 ${history.createdAt.toLocaleString()} | Причина: ${history.changeReason || 'не указана'}`);
        });
      }
      
      // Анализ логики хранения
      console.log(`   🔍 АНАЛИЗ:`);
      if (product.prices.length === 1 && product.priceHistory.length >= 1) {
        console.log(`      ✅ Логика корректна: 1 текущая цена + ${product.priceHistory.length} записей истории`);
      } else if (product.prices.length > 1) {
        console.log(`      ⚠️ Множественные текущие цены: ${product.prices.length} записей`);
        console.log(`      💡 Возможно, цены не перезаписываются, а добавляются`);
      } else if (product.priceHistory.length === 0) {
        console.log(`      ⚠️ Нет истории цен - только текущая цена`);
      }
    });
    
    // Проверим общую статистику по системе хранения цен
    console.log('\n📊 ОБЩАЯ СТАТИСТИКА СИСТЕМЫ:');
    
    // Подсчитаем товары с множественными ценами
    const productsWithMultiplePrices = await prisma.product.findMany({
      where: {
        prices: {
          some: {
            supplierId: widiSupplier.id
          }
        }
      },
      include: {
        _count: {
          select: {
            prices: true
          }
        }
      }
    });
    
    const multiPriceProducts = productsWithMultiplePrices.filter(p => p._count.prices > 1);
    const singlePriceProducts = productsWithMultiplePrices.filter(p => p._count.prices === 1);
    
    console.log(`📦 Товаров с одной ценой: ${singlePriceProducts.length}`);
    console.log(`📦 Товаров с множественными ценами: ${multiPriceProducts.length}`);
    
    if (multiPriceProducts.length > 0) {
      console.log(`\n⚠️ ТОВАРЫ С МНОЖЕСТВЕННЫМИ ЦЕНАМИ (первые 5):`);
      multiPriceProducts.slice(0, 5).forEach((product, index) => {
        console.log(`${index + 1}. ${product.name}: ${product._count.prices} цен`);
      });
    }
    
    // Проверим загрузки сегодня для понимания логики
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayUploads = await prisma.upload.findMany({
      where: {
        supplierId: widiSupplier.id,
        createdAt: {
          gte: today
        }
      },
      include: {
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
    
    console.log(`\n📤 ЗАГРУЗКИ WIDI WIGUNA СЕГОДНЯ: ${todayUploads.length}`);
    todayUploads.forEach((upload, index) => {
      console.log(`${index + 1}. ${upload.originalName} - ${upload._count.prices} цен (${upload.createdAt.toLocaleString()})`);
    });
    
    // Проверим, есть ли дублирующиеся цены для одного товара
    console.log('\n🔍 ПРОВЕРКА НА ДУБЛИРОВАНИЕ ЦЕН:');
    
    const duplicatePrices = await prisma.$queryRaw`
      SELECT 
        p.name as product_name,
        pr.amount,
        pr.unit,
        COUNT(*) as count,
        MIN(pr."createdAt") as first_created,
        MAX(pr."createdAt") as last_created
      FROM prices pr
      JOIN products p ON pr."productId" = p.id
      WHERE pr."supplierId" = ${widiSupplier.id}
      GROUP BY p.name, pr.amount, pr.unit
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 5
    `;
    
    if (duplicatePrices.length > 0) {
      console.log(`⚠️ Найдено ${duplicatePrices.length} товаров с дублирующимися ценами:`);
      duplicatePrices.forEach((dup, index) => {
        console.log(`${index + 1}. ${dup.product_name}: $${dup.amount} ${dup.unit}`);
        console.log(`   🔄 Повторений: ${dup.count}`);
        console.log(`   📅 Первая: ${new Date(dup.first_created).toLocaleString()}`);
        console.log(`   📅 Последняя: ${new Date(dup.last_created).toLocaleString()}`);
      });
    } else {
      console.log('✅ Дублирующихся цен не найдено');
    }
    
    // Проверим связь между prices и priceHistory
    console.log('\n🔗 СВЯЗЬ МЕЖДУ PRICES И PRICE_HISTORY:');
    
    const priceHistoryStats = await prisma.priceHistory.findMany({
      where: {
        supplierId: widiSupplier.id,
        createdAt: {
          gte: today
        }
      },
      select: {
        changeReason: true,
        changedFrom: true,
        price: true
      }
    });
    
    const reasonStats = priceHistoryStats.reduce((acc, record) => {
      const reason = record.changeReason || 'не указана';
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});
    
    console.log('📋 Причины изменений цен:');
    Object.entries(reasonStats).forEach(([reason, count]) => {
      console.log(`   ${reason}: ${count} записей`);
    });
    
    const newPrices = priceHistoryStats.filter(p => !p.changedFrom);
    const updatedPrices = priceHistoryStats.filter(p => p.changedFrom);
    
    console.log(`\n📊 Тип изменений:`);
    console.log(`🆕 Новые цены: ${newPrices.length}`);
    console.log(`🔄 Обновления существующих: ${updatedPrices.length}`);
    
    // Выводы
    console.log('\n🎯 ВЫВОДЫ О ЛОГИКЕ ХРАНЕНИЯ ЦЕН:');
    
    if (multiPriceProducts.length > 0) {
      console.log('❌ ПРОБЛЕМА: Цены НЕ перезаписываются, а добавляются как новые');
      console.log('📈 История цен ведется, но множественные текущие цены создают путаницу');
      console.log('💡 Рекомендация: Изменить логику на "одна текущая цена + история"');
    } else {
      console.log('✅ Логика корректна: цены перезаписываются, история ведется');
    }
    
    if (duplicatePrices.length > 0) {
      console.log('⚠️ Есть дублирующиеся цены - нужна дедупликация');
    }
    
    if (newPrices.length > updatedPrices.length) {
      console.log('📊 Большинство записей - новые цены, не обновления');
    }
    
    return {
      supplier: widiSupplier.name,
      totalProducts: productsWithMultiplePrices.length,
      singlePriceProducts: singlePriceProducts.length,
      multiPriceProducts: multiPriceProducts.length,
      duplicatePrices: duplicatePrices.length,
      newPrices: newPrices.length,
      updatedPrices: updatedPrices.length,
      historyLogicWorking: priceHistoryStats.length > 0
    };
    
  } catch (error) {
    console.error('❌ Ошибка анализа истории цен:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkPriceHistoryLogic();