const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_h6GaENYK1qSs@ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
    }
  }
});

async function viewPriceDynamics() {
  try {
    console.log('📈 ПРОСМОТР ДИНАМИКИ ЦЕН');
    console.log('=' .repeat(70));
    
    // Получить список поставщиков для выбора
    const suppliers = await prisma.supplier.findMany({
      include: {
        _count: {
          select: {
            priceHistory: true,
            prices: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    console.log('🏢 ДОСТУПНЫЕ ПОСТАВЩИКИ:');
    suppliers.forEach((supplier, index) => {
      console.log(`${index + 1}. ${supplier.name}`);
      console.log(`   📊 Активных цен: ${supplier._count.prices}`);
      console.log(`   📈 Записей истории: ${supplier._count.priceHistory}`);
    });
    
    // Показать динамику цен для Widi Wiguna (как пример)
    const widiSupplier = suppliers.find(s => s.name === 'Widi Wiguna');
    
    if (widiSupplier) {
      console.log(`\\n📈 ДИНАМИКА ЦЕН: ${widiSupplier.name}`);
      console.log('=' .repeat(50));
      
      // Получить топ-10 товаров с наибольшим количеством изменений цен
      const topChangedProducts = await prisma.$queryRaw`
        SELECT 
          p.name as product_name,
          COUNT(ph.id) as changes_count,
          MIN(ph."createdAt") as first_change,
          MAX(ph."createdAt") as last_change,
          AVG(ph."changePercentage") as avg_change_percentage
        FROM price_history ph
        JOIN products p ON ph."productId" = p.id
        WHERE ph."supplierId" = ${widiSupplier.id}
        AND ph."changePercentage" IS NOT NULL
        GROUP BY p.id, p.name
        HAVING COUNT(ph.id) > 1
        ORDER BY changes_count DESC
        LIMIT 10
      `;
      
      console.log('🔥 ТОП-10 ТОВАРОВ С НАИБОЛЬШИМИ ИЗМЕНЕНИЯМИ ЦЕН:');
      topChangedProducts.forEach((product, index) => {
        const avgChange = parseFloat(product.avg_change_percentage || 0);
        const changeIcon = avgChange > 0 ? '📈' : avgChange < 0 ? '📉' : '➡️';
        
        console.log(`${index + 1}. ${changeIcon} ${product.product_name}`);
        console.log(`   🔄 Изменений: ${product.changes_count}`);
        console.log(`   📊 Средний % изменения: ${avgChange.toFixed(1)}%`);
        console.log(`   📅 Период: ${new Date(product.first_change).toLocaleDateString()} - ${new Date(product.last_change).toLocaleDateString()}`);
      });
      
      // Показать детальную динамику для одного товара
      if (topChangedProducts.length > 0) {
        const exampleProduct = topChangedProducts[0];
        
        console.log(`\\n🔍 ДЕТАЛЬНАЯ ДИНАМИКА: ${exampleProduct.product_name}`);
        console.log('=' .repeat(50));
        
        // Найти товар
        const product = await prisma.product.findFirst({
          where: { name: exampleProduct.product_name }
        });
        
        if (product) {
          // Получить всю историю цен для этого товара
          const priceHistory = await prisma.priceHistory.findMany({
            where: {
              productId: product.id,
              supplierId: widiSupplier.id
            },
            orderBy: {
              createdAt: 'asc'
            }
          });
          
          console.log('📋 ХРОНОЛОГИЯ ИЗМЕНЕНИЙ ЦЕН:');
          priceHistory.forEach((entry, index) => {
            const changeInfo = entry.changedFrom && entry.changePercentage !== null
              ? ` (было $${entry.changedFrom}, изменение ${entry.changePercentage.toFixed(1)}%)`
              : ' (первая цена)';
            
            const changeIcon = entry.changePercentage > 0 ? '📈' : 
                             entry.changePercentage < 0 ? '📉' : '🆕';
            
            console.log(`${index + 1}. ${changeIcon} $${entry.price} ${entry.unit}${changeInfo}`);
            console.log(`   📅 ${entry.createdAt.toLocaleString()}`);
            console.log(`   🔧 Причина: ${entry.changeReason || 'не указана'}`);
          });
          
          // Получить текущую цену
          const currentPrice = await prisma.price.findFirst({
            where: {
              productId: product.id,
              supplierId: widiSupplier.id,
              validTo: null
            }
          });
          
          if (currentPrice) {
            console.log(`\\n💰 ТЕКУЩАЯ ЦЕНА: $${currentPrice.amount} ${currentPrice.unit}`);
            console.log(`📅 Установлена: ${currentPrice.createdAt.toLocaleString()}`);
          }
        }
      }
      
      // Показать общую статистику изменений цен
      const priceStats = await prisma.$queryRaw`
        SELECT 
          COUNT(*) as total_changes,
          COUNT(CASE WHEN "changePercentage" > 0 THEN 1 END) as price_increases,
          COUNT(CASE WHEN "changePercentage" < 0 THEN 1 END) as price_decreases,
          COUNT(CASE WHEN "changePercentage" = 0 THEN 1 END) as no_change,
          AVG("changePercentage") as avg_change,
          MAX("changePercentage") as max_increase,
          MIN("changePercentage") as max_decrease
        FROM price_history 
        WHERE "supplierId" = ${widiSupplier.id}
        AND "changePercentage" IS NOT NULL
      `;
      
      const stats = priceStats[0];
      console.log(`\\n📊 ОБЩАЯ СТАТИСТИКА ИЗМЕНЕНИЙ ЦЕН (${widiSupplier.name}):`);
      console.log(`🔄 Всего изменений: ${stats.total_changes}`);
      console.log(`📈 Подорожало: ${stats.price_increases} товаров`);
      console.log(`📉 Подешевело: ${stats.price_decreases} товаров`);
      console.log(`➡️ Без изменений: ${stats.no_change} товаров`);
      console.log(`📊 Среднее изменение: ${parseFloat(stats.avg_change || 0).toFixed(1)}%`);
      console.log(`📈 Максимальный рост: ${parseFloat(stats.max_increase || 0).toFixed(1)}%`);
      console.log(`📉 Максимальное снижение: ${parseFloat(stats.max_decrease || 0).toFixed(1)}%`);
    }
    
    // Показать последние изменения цен по всей системе
    console.log(`\\n🕐 ПОСЛЕДНИЕ ИЗМЕНЕНИЯ ЦЕН (все поставщики):`);
    console.log('=' .repeat(50));
    
    const recentChanges = await prisma.priceHistory.findMany({
      where: {
        changePercentage: {
          not: null
        }
      },
      include: {
        product: true,
        supplier: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });
    
    recentChanges.forEach((change, index) => {
      const changeIcon = change.changePercentage > 0 ? '📈' : 
                        change.changePercentage < 0 ? '📉' : '➡️';
      
      console.log(`${index + 1}. ${changeIcon} ${change.product.name} (${change.supplier.name})`);
      console.log(`   💰 $${change.changedFrom} → $${change.price} (${change.changePercentage.toFixed(1)}%)`);
      console.log(`   📅 ${change.createdAt.toLocaleString()}`);
    });
    
    console.log(`\\n💡 КАК ИСПОЛЬЗОВАТЬ СИСТЕМУ ДИНАМИКИ ЦЕН:`);
    console.log('1. 🌐 Веб-интерфейс: http://localhost:3000/admin/suppliers');
    console.log('2. 📊 API: GET /api/admin/price-history?productId={ID}');
    console.log('3. 📈 Тренды: GET /api/admin/price-trends?productId={ID}&period=30d');
    console.log('4. 🔍 Этот скрипт: node view-price-dynamics.js');
    
  } catch (error) {
    console.error('❌ Ошибка просмотра динамики цен:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

viewPriceDynamics();