const { PrismaClient } = require('@prisma/client');

async function checkWidiWiguna() {
  const prisma = new PrismaClient();
  
  try {
    console.log('=== ДЕТАЛЬНАЯ ИНФОРМАЦИЯ О WIDI WIGUNA ===');
    
    const supplier = await prisma.supplier.findFirst({
      where: {
        name: {
          contains: 'Widi',
          mode: 'insensitive'
        }
      },
      include: {
        _count: {
          select: { 
            prices: true, 
            uploads: true 
          }
        },
        uploads: {
          select: {
            id: true,
            originalName: true,
            status: true,
            totalRowsProcessed: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    if (!supplier) {
      console.log('❌ Widi Wiguna не найден');
      return;
    }
    
    console.log(`✅ Поставщик: ${supplier.name}`);
    console.log(`📊 Товаров: ${supplier._count.prices}`);
    console.log(`📤 Загрузок: ${supplier._count.uploads}`);
    console.log(`🆔 ID: ${supplier.id}`);
    
    console.log('\n=== ЗАГРУЗКИ ===');
    supplier.uploads.forEach((upload, index) => {
      console.log(`${index + 1}. ${upload.originalName}`);
      console.log(`   Статус: ${upload.status}`);
      console.log(`   Обработано строк: ${upload.totalRowsProcessed || 0}`);
      console.log(`   Дата: ${upload.createdAt.toISOString().split('T')[0]}`);
      console.log('');
    });
    
    // Get recent products
    const recentProducts = await prisma.price.findMany({
      where: { supplierId: supplier.id },
      include: {
        product: {
          select: {
            name: true,
            category: true,
            unit: true
          }
        }
      },
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('=== ПОСЛЕДНИЕ ТОВАРЫ (10 шт.) ===');
    recentProducts.forEach((price, index) => {
      console.log(`${index + 1}. ${price.product.name}`);
      console.log(`   Цена: ${price.amount} ${price.unit || price.product.unit || ''}`);
      console.log(`   Категория: ${price.product.category || 'Не указана'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkWidiWiguna();