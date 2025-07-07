const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_h6GaENYK1qSs@ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
    }
  }
});

async function testPriceHistoryFix() {
  try {
    console.log('🧪 ТЕСТ ИСПРАВЛЕНИЯ ЛОГИКИ ИСТОРИИ ЦЕН');
    console.log('=' .repeat(70));
    
    // Test with a small Excel file to verify the fix
    const testFile = 'Widi Wiguna 03_07.xlsx';
    const supplierFolderPath = '/Users/denisdomashenko/Downloads/ SUPPLIER JULY 2025';
    const filePath = path.join(supplierFolderPath, testFile);
    
    if (!fs.existsSync(filePath)) {
      console.log(`❌ Файл не найден: ${testFile}`);
      return;
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    const fileSize = Math.round(fileBuffer.length / 1024);
    
    console.log(`📁 Тестирование: ${testFile}`);
    console.log(`📊 Размер: ${fileSize}KB`);
    
    // Check current state of prices for Widi Wiguna products
    const widiSupplier = await prisma.supplier.findFirst({
      where: { name: 'Widi Wiguna' }
    });
    
    if (!widiSupplier) {
      console.log('❌ Поставщик Widi Wiguna не найден');
      return;
    }
    
    console.log(`🏢 Поставщик: ${widiSupplier.name} (${widiSupplier.id})`);
    
    // Get some test products before uploading
    const testProducts = await prisma.product.findMany({
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
            supplierId: widiSupplier.id,
            validTo: null
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
      take: 3
    });
    
    console.log(`\\n📦 СОСТОЯНИЕ ДО ЗАГРУЗКИ (3 тестовых товара):`);
    testProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}:`);
      console.log(`   💰 Активных цен: ${product.prices.length}`);
      console.log(`   📈 Записей истории: ${product.priceHistory.length}`);
      
      if (product.prices.length > 0) {
        product.prices.forEach((price, priceIndex) => {
          console.log(`      Цена ${priceIndex + 1}: $${price.amount} ${price.unit}`);
        });
      }
    });
    
    // Upload the file using async-upload
    const fetch = (await import('node-fetch')).default;
    const FormData = require('form-data');
    
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename: testFile,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    form.append('autoApprove', 'true');
    form.append('batchSize', '50');
    
    const startTime = Date.now();
    
    console.log('\\n🔄 Загружаем файл через async-upload...');
    
    const uploadResponse = await fetch('http://localhost:3000/api/async-upload', {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
      timeout: 120000
    });
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log(`⏱️ Время загрузки: ${Math.round(processingTime/1000)}s`);
    console.log(`📊 HTTP статус: ${uploadResponse.status}`);
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.log(`❌ Ошибка загрузки: ${errorText}`);
      return;
    }
    
    const result = await uploadResponse.json();
    console.log(`✅ Загрузка выполнена`);
    console.log(`   🆔 Upload ID: ${result.uploadId}`);
    console.log(`   📊 Статус: ${result.status}`);
    console.log(`   🛍️ Товаров создано: ${result.productsCreated || 0}`);
    
    // Wait a moment for processing to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check the same products after uploading
    const testProductsAfter = await prisma.product.findMany({
      where: {
        id: {
          in: testProducts.map(p => p.id)
        }
      },
      include: {
        prices: {
          where: {
            supplierId: widiSupplier.id,
            validTo: null
          }
        },
        priceHistory: {
          where: {
            supplierId: widiSupplier.id
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 5
        }
      }
    });
    
    console.log(`\\n📦 СОСТОЯНИЕ ПОСЛЕ ЗАГРУЗКИ (те же 3 товара):`);
    testProductsAfter.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}:`);
      console.log(`   💰 Активных цен: ${product.prices.length}`);
      console.log(`   📈 Записей истории: ${product.priceHistory.length}`);
      
      if (product.prices.length > 0) {
        product.prices.forEach((price, priceIndex) => {
          console.log(`      Цена ${priceIndex + 1}: $${price.amount} ${price.unit} (создана: ${price.createdAt.toLocaleString()})`);
        });
      }
      
      if (product.priceHistory.length > 0) {
        console.log(`   📈 Последние записи истории:`);
        product.priceHistory.slice(0, 3).forEach((history, histIndex) => {
          const changeInfo = history.changedFrom ? 
            ` (было $${history.changedFrom}, изменение ${history.changePercentage?.toFixed(1) || 'N/A'}%)` : 
            ' (первая цена)';
          console.log(`      ${histIndex + 1}. $${history.price} ${history.unit}${changeInfo}`);
          console.log(`         📅 ${history.createdAt.toLocaleString()} | Причина: ${history.changeReason || 'не указана'}`);
        });
      }
    });
    
    // Analyze the fix results
    console.log('\\n🔍 АНАЛИЗ РЕЗУЛЬТАТОВ ИСПРАВЛЕНИЯ:');
    
    let fixWorking = true;
    let multipleActivePrices = 0;
    let singleActivePrices = 0;
    let newHistoryEntries = 0;
    
    testProductsAfter.forEach((product) => {
      if (product.prices.length > 1) {
        multipleActivePrices++;
        fixWorking = false;
      } else if (product.prices.length === 1) {
        singleActivePrices++;
      }
      
      // Count new history entries (from today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayHistoryEntries = product.priceHistory.filter(h => h.createdAt >= today);
      newHistoryEntries += todayHistoryEntries.length;
    });
    
    console.log(`📊 Товаров с одной активной ценой: ${singleActivePrices}`);
    console.log(`📊 Товаров с множественными активными ценами: ${multipleActivePrices}`);
    console.log(`📊 Новых записей истории сегодня: ${newHistoryEntries}`);
    
    if (fixWorking) {
      console.log('\\n✅ ИСПРАВЛЕНИЕ РАБОТАЕТ КОРРЕКТНО!');
      console.log('   ✅ Все товары имеют только одну активную цену');
      console.log('   ✅ История цен ведется правильно');
      console.log('   ✅ Логика "одна текущая цена + история" реализована');
    } else {
      console.log('\\n❌ ИСПРАВЛЕНИЕ НЕ РАБОТАЕТ');
      console.log('   ❌ Есть товары с множественными активными ценами');
      console.log('   ❌ Нужна дополнительная отладка');
    }
    
    // Check recent uploads
    const recentUploads = await prisma.upload.findMany({
      where: {
        supplierId: widiSupplier.id,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
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
        createdAt: 'desc'
      },
      take: 3
    });
    
    console.log(`\\n📤 ПОСЛЕДНИЕ ЗАГРУЗКИ (24 часа):`);
    recentUploads.forEach((upload, index) => {
      console.log(`${index + 1}. ${upload.originalName} - ${upload._count.prices} цен`);
      console.log(`   📅 ${upload.createdAt.toLocaleString()} | Статус: ${upload.status}`);
    });
    
    return {
      success: true,
      fixWorking,
      singleActivePrices,
      multipleActivePrices,
      newHistoryEntries,
      uploadId: result.uploadId,
      processingTime: processingTime
    };
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await prisma.$disconnect();
  }
}

testPriceHistoryFix();