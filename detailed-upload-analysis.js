const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_h6GaENYK1qSs@ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
    }
  }
});

async function detailedUploadAnalysis() {
  try {
    console.log('🔍 ДЕТАЛЬНЫЙ АНАЛИЗ ЗАГРУЗОК В БАЗЕ ДАННЫХ');
    console.log('=' .repeat(70));
    
    // Проверить загрузки за последние 24 часа
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);
    
    const recentUploads = await prisma.upload.findMany({
      where: {
        createdAt: {
          gte: last24Hours
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
    
    console.log(`📊 Загрузки за последние 24 часа: ${recentUploads.length}`);
    
    if (recentUploads.length > 0) {
      console.log('\n📋 ДЕТАЛИ НЕДАВНИХ ЗАГРУЗОК:');
      recentUploads.forEach((upload, index) => {
        console.log(`\n${index + 1}. ${upload.originalName || upload.fileName || 'Без имени'}`);
        console.log(`   🏢 Поставщик: ${upload.supplier.name}`);
        console.log(`   📊 Статус: ${upload.status}`);
        console.log(`   💰 Товаров: ${upload._count.prices}`);
        console.log(`   📅 Время: ${upload.createdAt.toLocaleString()}`);
        console.log(`   🆔 ID: ${upload.id}`);
        if (upload.errorMessage) {
          console.log(`   ❌ Ошибка: ${upload.errorMessage}`);
        }
      });
    }
    
    // Проверить загрузки с именами файлов July 2025
    console.log('\n🔍 ПОИСК ЗАГРУЗОК JULY 2025 ПО ИМЕНАМ ФАЙЛОВ:');
    
    const july2025Keywords = [
      'britts', 'seafood', 'dairy', 'benoa', 'berkah', 'alam sari',
      'cheese', 'gloria', 'happy farm', 'meat mart', 'milk up',
      'gioa', 'raja boga', 'pangan', 'puri', 'bali boga', 'pasti enak',
      'sai fresh', 'siap bali', 'oz britts', 'shy cow', 'local parts'
    ];
    
    const possibleJuly2025Uploads = await prisma.upload.findMany({
      where: {
        OR: july2025Keywords.map(keyword => ({
          OR: [
            { originalName: { contains: keyword, mode: 'insensitive' } },
            { fileName: { contains: keyword, mode: 'insensitive' } },
            { supplier: { name: { contains: keyword, mode: 'insensitive' } } }
          ]
        }))
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
      },
      take: 20
    });
    
    console.log(`📊 Найдено потенциальных загрузок July 2025: ${possibleJuly2025Uploads.length}`);
    
    if (possibleJuly2025Uploads.length > 0) {
      console.log('\n📋 ПОТЕНЦИАЛЬНЫЕ ЗАГРУЗКИ JULY 2025:');
      possibleJuly2025Uploads.forEach((upload, index) => {
        console.log(`${index + 1}. ${upload.originalName || upload.fileName || 'Без имени'} (${upload.supplier.name})`);
        console.log(`   📅 ${upload.createdAt.toLocaleDateString()} | 💰 ${upload._count.prices} товаров | 📊 ${upload.status}`);
      });
    }
    
    // Проверить общую статистику загрузок
    console.log('\n📊 ОБЩАЯ СТАТИСТИКА ЗАГРУЗОК:');
    
    const totalUploads = await prisma.upload.count();
    const completedUploads = await prisma.upload.count({ where: { status: 'completed' } });
    const failedUploads = await prisma.upload.count({ where: { status: 'failed' } });
    const processingUploads = await prisma.upload.count({ where: { status: 'processing' } });
    
    console.log(`📤 Всего загрузок: ${totalUploads}`);
    console.log(`✅ Завершенных: ${completedUploads}`);
    console.log(`❌ Неудачных: ${failedUploads}`);
    console.log(`⏳ В обработке: ${processingUploads}`);
    
    // Проверить загрузки по периодам
    console.log('\n📅 ЗАГРУЗКИ ПО ДАТАМ (последние 7 дней):');
    
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const dayUploads = await prisma.upload.count({
        where: {
          createdAt: {
            gte: date,
            lt: nextDate
          }
        }
      });
      
      if (dayUploads > 0) {
        console.log(`📅 ${date.toLocaleDateString()}: ${dayUploads} загрузок`);
      }
    }
    
    // Проверить статистику поставщиков
    console.log('\n🏢 ТОП-10 ПОСТАВЩИКОВ ПО КОЛИЧЕСТВУ ЗАГРУЗОК:');
    
    const supplierStats = await prisma.supplier.findMany({
      include: {
        _count: {
          select: {
            uploads: true,
            prices: true
          }
        }
      },
      orderBy: {
        uploads: {
          _count: 'desc'
        }
      },
      take: 10
    });
    
    supplierStats.forEach((supplier, index) => {
      console.log(`${index + 1}. ${supplier.name}: ${supplier._count.uploads} загрузок, ${supplier._count.prices} товаров`);
    });
    
    // Проверить временные аномалии в uploads
    console.log('\n⚠️ ПРОВЕРКА ВРЕМЕННЫХ АНОМАЛИЙ:');
    
    const stuckUploads = await prisma.upload.findMany({
      where: {
        status: 'processing',
        createdAt: {
          lt: new Date(Date.now() - 10 * 60 * 1000) // Старше 10 минут
        }
      },
      include: {
        supplier: true
      }
    });
    
    if (stuckUploads.length > 0) {
      console.log(`⚠️ Найдено ${stuckUploads.length} зависших загрузок:`);
      stuckUploads.forEach(upload => {
        console.log(`   ${upload.originalName || upload.fileName} (${upload.supplier.name}) - ${upload.createdAt.toLocaleString()}`);
      });
    } else {
      console.log('✅ Зависших загрузок не найдено');
    }
    
    return {
      recentUploads: recentUploads.length,
      july2025Uploads: possibleJuly2025Uploads.length,
      totalUploads,
      completedUploads,
      failedUploads,
      stuckUploads: stuckUploads.length
    };
    
  } catch (error) {
    console.error('❌ Ошибка анализа загрузок:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

detailedUploadAnalysis();