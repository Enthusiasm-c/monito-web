/**
 * Test script to verify price analytics functionality
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_h6GaENYK1qSs@ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
    }
  }
});

async function testPriceAnalytics() {
  try {
    console.log('🧪 ТЕСТИРОВАНИЕ АНАЛИТИКИ ЦЕН');
    console.log('=' .repeat(50));
    
    // Найти продукт с историей цен
    console.log('1. 🔍 Поиск продуктов с историей цен...');
    
    const productsWithHistory = await prisma.product.findMany({
      include: {
        priceHistory: {
          select: {
            id: true,
            price: true,
            createdAt: true,
            supplier: {
              select: {
                name: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 5
        },
        prices: {
          where: {
            validTo: null
          },
          select: {
            amount: true,
            supplier: {
              select: {
                name: true
              }
            }
          }
        }
      },
      where: {
        AND: [
          {
            priceHistory: {
              some: {}
            }
          },
          {
            prices: {
              some: {
                validTo: null
              }
            }
          }
        ]
      },
      take: 3
    });
    
    console.log(`   ✅ Найдено ${productsWithHistory.length} продуктов с историей цен`);
    
    for (const product of productsWithHistory) {
      console.log(`\n2. 📊 Тест аналитики для продукта: ${product.name}`);
      console.log(`   ID: ${product.id}`);
      console.log(`   Текущих цен: ${product.prices.length}`);
      console.log(`   Записей в истории: ${product.priceHistory.length}`);
      
      // Показать последние изменения цен
      if (product.priceHistory.length > 0) {
        console.log('   📈 Последние изменения цен:');
        product.priceHistory.forEach((history, index) => {
          const date = history.createdAt.toLocaleDateString();
          const price = parseInt(history.price).toLocaleString();
          const supplier = history.supplier.name;
          console.log(`   ${index + 1}. ${date} - ${price} IDR (${supplier})`);
        });
      }
      
      // Показать текущие цены
      if (product.prices.length > 0) {
        console.log('   💰 Текущие цены:');
        product.prices.forEach((price, index) => {
          const amount = parseInt(price.amount).toLocaleString();
          const supplier = price.supplier.name;
          console.log(`   ${index + 1}. ${amount} IDR (${supplier})`);
        });
      }
      
      // Проверить, что аналитика сможет обработать этот продукт
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const recentHistory = await prisma.priceHistory.count({
        where: {
          productId: product.id,
          createdAt: {
            gte: sixMonthsAgo
          }
        }
      });
      
      console.log(`   📅 История за 6 месяцев: ${recentHistory} записей`);
      
      if (recentHistory > 0 || product.prices.length > 0) {
        console.log(`   ✅ Продукт готов для аналитики`);
      } else {
        console.log(`   ⚠️ Недостаточно данных для аналитики`);
      }
      
      console.log('   ' + '-'.repeat(40));
    }
    
    // Статистика по всей системе
    console.log('\n3. 📊 Общая статистика системы:');
    
    const totalProducts = await prisma.product.count();
    const productsWithPrices = await prisma.product.count({
      where: {
        prices: {
          some: {
            validTo: null
          }
        }
      }
    });
    const totalPriceHistory = await prisma.priceHistory.count();
    const totalSuppliers = await prisma.supplier.count();
    
    console.log(`   📦 Всего продуктов: ${totalProducts}`);
    console.log(`   💰 Продуктов с ценами: ${productsWithPrices}`);
    console.log(`   📈 Записей в истории цен: ${totalPriceHistory}`);
    console.log(`   🏪 Поставщиков: ${totalSuppliers}`);
    
    // Проверить топ поставщиков по количеству изменений цен
    console.log('\n4. 🏆 Топ поставщиков по активности (изменения цен):');
    
    const supplierActivity = await prisma.priceHistory.groupBy({
      by: ['supplierId'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 5
    });
    
    for (const activity of supplierActivity) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: activity.supplierId },
        select: { name: true }
      });
      
      console.log(`   📊 ${supplier?.name || 'Unknown'}: ${activity._count.id} изменений`);
    }
    
    console.log('\n✅ ТЕСТ ЗАВЕРШЕН УСПЕШНО');
    console.log('📖 Данные готовы для отображения в компоненте ProductPriceChart');
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testPriceAnalytics();