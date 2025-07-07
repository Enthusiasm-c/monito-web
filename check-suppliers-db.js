const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_h6GaENYK1qSs@ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
    }
  }
});

async function checkSuppliersInDatabase() {
  try {
    console.log('🗄️ ПРОВЕРКА ПОСТАВЩИКОВ В БАЗЕ ДАННЫХ');
    console.log('=' .repeat(60));
    
    // Получить всех поставщиков
    const suppliers = await prisma.supplier.findMany({
      include: {
        _count: {
          select: {
            prices: true,
            uploads: true,
            priceHistory: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    console.log(`📊 Всего поставщиков в базе: ${suppliers.length}`);
    
    if (suppliers.length === 0) {
      console.log('⚠️ Поставщики не найдены в базе данных');
      return;
    }
    
    console.log('\n📋 СПИСОК ПОСТАВЩИКОВ:');
    suppliers.forEach((supplier, index) => {
      console.log(`${index + 1}. ${supplier.name}`);
      console.log(`   📤 Загрузок: ${supplier._count.uploads}`);
      console.log(`   💰 Цен: ${supplier._count.prices}`);
      console.log(`   📈 Истории цен: ${supplier._count.priceHistory}`);
      console.log(`   📅 Создан: ${supplier.createdAt.toLocaleDateString()}`);
      console.log('');
    });
    
    // Проверить недавние загрузки
    console.log('📈 НЕДАВНИЕ ЗАГРУЗКИ (последние 24 часа):');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const recentSuppliers = await prisma.supplier.findMany({
      where: {
        createdAt: {
          gte: yesterday
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
    
    if (recentSuppliers.length > 0) {
      recentSuppliers.forEach(supplier => {
        console.log(`✨ ${supplier.name} - ${supplier._count.uploads} загрузок, ${supplier._count.prices} цен`);
      });
    } else {
      console.log('🔍 Новых поставщиков за последние 24 часа не найдено');
    }
    
    // Проверить механизм отслеживания цен
    console.log('\n💰 ПРОВЕРКА МЕХАНИЗМА ОТСЛЕЖИВАНИЯ ЦЕН:');
    
    // Найти последние записи истории цен
    const priceHistoryRecords = await prisma.priceHistory.findMany({
      include: {
        product: true,
        supplier: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });
    
    if (priceHistoryRecords.length > 0) {
      console.log(`📊 Найдено ${priceHistoryRecords.length} записей истории цен:`);
      
      priceHistoryRecords.forEach((record, index) => {
        const change = record.changePercentage ? ` (${record.changePercentage > 0 ? '+' : ''}${record.changePercentage.toFixed(1)}%)` : '';
        console.log(`${index + 1}. ${record.product.name} - ${record.supplier.name}`);
        console.log(`   💰 $${record.price} ${record.unit}${change} - ${record.createdAt.toLocaleDateString()}`);
        if (record.changedFrom) {
          console.log(`   📈 Изменилось с $${record.changedFrom}`);
        }
      });
    } else {
      console.log('⚠️ История цен не найдена');
    }
    
    // Статистика базы данных
    console.log('\n📈 ОБЩАЯ СТАТИСТИКА:');
    const totalProducts = await prisma.product.count();
    const totalPrices = await prisma.price.count();
    const totalUploads = await prisma.upload.count();
    
    console.log(`📦 Всего товаров: ${totalProducts}`);
    console.log(`💰 Всего записей цен: ${totalPrices}`);
    console.log(`📤 Всего загрузок: ${totalUploads}`);
    
    return {
      suppliers: suppliers.length,
      recentSuppliers: recentSuppliers.length,
      priceHistoryRecords: priceHistoryRecords.length,
      totalProducts,
      totalPrices,
      totalUploads
    };
    
  } catch (error) {
    console.error('❌ Ошибка проверки базы данных:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

async function checkSupplierMatching() {
  try {
    console.log('\n🔍 ПРОВЕРКА СООТВЕТСТВИЯ ИМЕН ФАЙЛОВ И ПОСТАВЩИКОВ:');
    
    // Список поставщиков из файлов
    const fileSuppliers = [
      '0z Britts', 'Af Seafood', 'Bali Diary', 'Benoa Fish Market', 
      'Berkah Laut', 'Alam Sari', 'Cheese Work', 'Gloria Seafood Bali',
      'Happy Farm Bali', 'Meat Mart', 'Milk Up', 'Gioa Cheese',
      'Raja Boga', 'Pangan Lestari', 'Puri Pangan Utama', 'Bali Boga Sejati',
      'Pasti Enak', 'Sai Fresh', 'Siap Bali', 'Widi Wiguna',
      'Local Parts Butcher Shop', 'Oz Britts', 'Shy Cow'
    ];
    
    // Получить поставщиков из базы
    const dbSuppliers = await prisma.supplier.findMany({
      select: {
        id: true,
        name: true
      }
    });
    
    console.log('📋 СОПОСТАВЛЕНИЕ:');
    fileSuppliers.forEach(fileSupplier => {
      const match = dbSuppliers.find(dbSupplier => 
        dbSupplier.name.toLowerCase().includes(fileSupplier.toLowerCase()) ||
        fileSupplier.toLowerCase().includes(dbSupplier.name.toLowerCase())
      );
      
      if (match) {
        console.log(`✅ ${fileSupplier} → ${match.name} (ID: ${match.id})`);
      } else {
        console.log(`❌ ${fileSupplier} → НЕ НАЙДЕН`);
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка сопоставления:', error.message);
  }
}

// Запуск проверки
checkSuppliersInDatabase()
  .then(() => checkSupplierMatching());