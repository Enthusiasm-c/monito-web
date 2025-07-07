const { PrismaClient } = require('@prisma/client');

async function checkDetailedUploadTimes() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🕐 Анализ времени обработки загрузок Widi Wiguna...');
    
    // Получить все загрузки с Widi в названии
    const allWidiUploads = await prisma.upload.findMany({
      where: {
        fileName: {
          contains: 'Widi',
          mode: 'insensitive'
        }
      },
      include: {
        supplier: true,
        prices: {
          include: {
            product: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });
    
    if (allWidiUploads.length === 0) {
      console.log('❌ Загрузки файлов Widi Wiguna не найдены');
      return;
    }
    
    console.log(`📋 Найдено ${allWidiUploads.length} загрузок Widi Wiguna:`);
    
    allWidiUploads.forEach((upload, index) => {
      const startTime = upload.createdAt;
      const endTime = upload.updatedAt;
      const processingTimeMs = endTime.getTime() - startTime.getTime();
      const processingTimeSeconds = Math.round(processingTimeMs / 1000);
      
      console.log(`\n${index + 1}. ${upload.fileName}`);
      console.log(`   📅 Создан: ${startTime.toISOString()}`);
      console.log(`   🔄 Обновлен: ${endTime.toISOString()}`);
      console.log(`   ⏱️ Время обработки: ${processingTimeSeconds} секунд (${processingTimeMs}ms)`);
      console.log(`   📊 Статус: ${upload.status}`);
      console.log(`   🎯 Товаров найдено: ${upload.prices?.length || 0}`);
      console.log(`   🏪 Поставщик: ${upload.supplier?.name || 'Неизвестен'}`);
      
      // Проверить метаданные на наличие ошибок
      if (upload.metadata) {
        try {
          const metadata = JSON.parse(upload.metadata);
          if (metadata.error) {
            console.log(`   ❌ Ошибка в метаданных: ${metadata.error}`);
          }
          if (metadata.processor) {
            console.log(`   🔧 Процессор: ${metadata.processor}`);
          }
          if (metadata.extractionQuality !== undefined) {
            console.log(`   📈 Качество извлечения: ${metadata.extractionQuality}`);
          }
          if (metadata.fallbackUsed) {
            console.log(`   ⚡ Использован fallback механизм`);
          }
          if (metadata.totalProducts !== undefined) {
            console.log(`   📦 Всего товаров в метаданных: ${metadata.totalProducts}`);
          }
        } catch (e) {
          console.log(`   ⚠️ Не удалось разобрать метаданные`);
        }
      } else {
        console.log(`   ⚠️ Метаданные отсутствуют`);
      }
    });
    
    // Отдельно проверить поставщика Widi Wiguna
    console.log('\n🏪 Статус поставщика Widi Wiguna:');
    const widiSupplier = await prisma.supplier.findFirst({
      where: {
        name: {
          contains: 'Widi',
          mode: 'insensitive'
        }
      },
      include: {
        prices: {
          where: {
            validTo: null // Только актуальные цены
          },
          include: {
            product: true,
            upload: true
          },
          orderBy: {
            validFrom: 'desc'
          },
          take: 10
        }
      }
    });
    
    if (widiSupplier) {
      console.log(`   Название: ${widiSupplier.name}`);
      console.log(`   Активных товаров: ${widiSupplier.prices?.length || 0}`);
      console.log(`   Создан: ${widiSupplier.createdAt.toISOString()}`);
      console.log(`   Обновлен: ${widiSupplier.updatedAt.toISOString()}`);
      
      if (widiSupplier.prices && widiSupplier.prices.length > 0) {
        console.log(`\n   🔄 Последние обновления цен:`);
        widiSupplier.prices.slice(0, 5).forEach((price, index) => {
          console.log(`      ${index + 1}. ${price.product.name} - ${price.amount} ${price.unit}`);
          console.log(`         Обновлено: ${price.validFrom.toISOString()}`);
          if (price.upload) {
            console.log(`         Из загрузки: ${price.upload.fileName}`);
          }
        });
      }
    } else {
      console.log('   ❌ Поставщик Widi Wiguna не найден');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при анализе:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDetailedUploadTimes();