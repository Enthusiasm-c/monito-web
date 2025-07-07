const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_h6GaENYK1qSs@ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
    }
  },
  log: ['query', 'info', 'warn', 'error']
});

async function diagnoseDatabasePerformance() {
  try {
    console.log('🔍 ДИАГНОСТИКА ПРОИЗВОДИТЕЛЬНОСТИ БАЗЫ ДАННЫХ');
    console.log('=' .repeat(70));
    
    // Тест подключения
    console.log('1. 🔗 Тестирование подключения...');
    const startConnect = Date.now();
    await prisma.$connect();
    const connectTime = Date.now() - startConnect;
    console.log(`   ✅ Подключение: ${connectTime}ms`);
    
    // Проверка количества записей в основных таблицах
    console.log('\\n2. 📊 Проверка размера таблиц...');
    
    const tables = [
      { name: 'products', model: prisma.product },
      { name: 'prices', model: prisma.price },
      { name: 'priceHistory', model: prisma.priceHistory },
      { name: 'suppliers', model: prisma.supplier },
      { name: 'uploads', model: prisma.upload }
    ];
    
    for (const table of tables) {
      const startCount = Date.now();
      const count = await table.model.count();
      const countTime = Date.now() - startCount;
      console.log(`   📋 ${table.name}: ${count.toLocaleString()} записей (${countTime}ms)`);
    }
    
    // Тест простого запроса продуктов
    console.log('\\n3. 🧪 Тест простого запроса продуктов...');
    const startSimple = Date.now();
    const simpleProducts = await prisma.product.findMany({
      take: 10,
      select: {
        id: true,
        name: true
      }
    });
    const simpleTime = Date.now() - startSimple;
    console.log(`   ✅ Простой запрос (10 продуктов): ${simpleTime}ms`);
    
    // Тест сложного запроса (как в admin панели)
    console.log('\\n4. 🔬 Тест сложного запроса (с joinами)...');
    const startComplex = Date.now();
    const complexProducts = await prisma.product.findMany({
      take: 50,
      include: {
        prices: {
          take: 1,
          where: {
            validTo: null
          },
          include: {
            supplier: true
          }
        }
      }
    });
    const complexTime = Date.now() - startComplex;
    console.log(`   ⏱️ Сложный запрос (50 продуктов с ценами): ${complexTime}ms`);
    
    // Тест запроса всех продуктов (проблемный)
    console.log('\\n5. ⚠️ Тест загрузки ВСЕХ продуктов (проблемный запрос)...');
    const startAll = Date.now();
    try {
      const allProducts = await prisma.product.findMany({
        select: {
          id: true,
          name: true,
          standardizedName: true,
          category: true
        }
      });
      const allTime = Date.now() - startAll;
      console.log(`   📊 Все продукты (${allProducts.length}): ${allTime}ms`);
      
      if (allTime > 5000) {
        console.log(`   ⚠️ МЕДЛЕННО! Запрос занял ${Math.round(allTime/1000)}s`);
      }
    } catch (error) {
      const failTime = Date.now() - startAll;
      console.log(`   ❌ Запрос провалился через ${failTime}ms: ${error.message}`);
    }
    
    // Проверить индексы
    console.log('\\n6. 🔍 Проверка индексов...');
    try {
      const indexes = await prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE schemaname = 'public'
        AND tablename IN ('products', 'prices', 'priceHistory')
        ORDER BY tablename, indexname
      `;
      
      console.log('   📋 Существующие индексы:');
      indexes.forEach(idx => {
        console.log(`   - ${idx.tablename}.${idx.indexname}`);
      });
    } catch (error) {
      console.log(`   ⚠️ Не удалось получить индексы: ${error.message}`);
    }
    
    // Анализ медленных запросов
    console.log('\\n7. 🐌 Проверка потенциально медленных операций...');
    
    // Проверить таблицы без limit
    const unlimitedQueries = [
      {
        name: 'products без limit',
        query: () => prisma.product.findMany({
          select: { id: true, name: true }
        })
      },
      {
        name: 'priceHistory без limit', 
        query: () => prisma.priceHistory.findMany({
          select: { id: true, price: true, createdAt: true },
          take: 100
        })
      }
    ];
    
    for (const test of unlimitedQueries) {
      const start = Date.now();
      try {
        const result = await test.query();
        const time = Date.now() - start;
        console.log(`   ${time > 1000 ? '🐌' : '⚡'} ${test.name}: ${time}ms (${Array.isArray(result) ? result.length : 'N/A'} записей)`);
      } catch (error) {
        const time = Date.now() - start;
        console.log(`   ❌ ${test.name}: провал через ${time}ms`);
      }
    }
    
    // Рекомендации по оптимизации
    console.log('\\n💡 РЕКОМЕНДАЦИИ ПО ОПТИМИЗАЦИИ:');
    
    const productCount = await prisma.product.count();
    if (productCount > 1000) {
      console.log('1. 📄 Добавить пагинацию для загрузки продуктов (по 50-100 за раз)');
    }
    
    console.log('2. 🔍 Добавить индексы для часто используемых полей');
    console.log('3. 📊 Использовать lazy loading вместо загрузки всех данных сразу');
    console.log('4. ⚡ Кэшировать результаты частых запросов');
    console.log('5. 🎯 Оптимизировать запросы с JOINами');
    
    // Быстрый фикс - создать оптимизированный эндпоинт
    console.log('\\n🔧 БЫСТРОЕ РЕШЕНИЕ:');
    console.log('- Изменить admin панель для загрузки продуктов с пагинацией');
    console.log('- Добавить фильтры и поиск');
    console.log('- Использовать виртуализацию для больших списков');
    
    return {
      connectTime,
      productCount,
      performanceIssue: complexTime > 2000 || connectTime > 1000
    };
    
  } catch (error) {
    console.error('❌ Ошибка диагностики:', error.message);
    return {
      error: error.message,
      performanceIssue: true
    };
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseDatabasePerformance();