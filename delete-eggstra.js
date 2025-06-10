const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteLastEggstraData() {
  try {
    // Найти последний файл Eggstra
    const lastEggstraFile = await prisma.file.findFirst({
      where: {
        fileName: {
          contains: 'EGGSTRA',
          mode: 'insensitive'
        }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        products: true,
        supplier: true
      }
    });
    
    if (!lastEggstraFile) {
      console.log('❌ Файл Eggstra не найден');
      return;
    }
    
    console.log('🔍 Найден файл для удаления:');
    console.log(`   ID: ${lastEggstraFile.id}`);
    console.log(`   Название: ${lastEggstraFile.fileName}`);
    console.log(`   Товаров: ${lastEggstraFile.products.length}`);
    console.log(`   Поставщик: ${lastEggstraFile.supplier?.name || 'N/A'}`);
    console.log(`   Дата: ${lastEggstraFile.createdAt}`);
    
    // Показать примеры неверных товаров
    console.log('\n🚨 Примеры неверных товаров:');
    lastEggstraFile.products.slice(0, 10).forEach((product, i) => {
      console.log(`   ${i+1}. "${product.name}" - ${product.price} (${product.unit})`);
    });
    
    // Удаляем товары
    const deletedProducts = await prisma.product.deleteMany({
      where: { fileId: lastEggstraFile.id }
    });
    console.log(`\n✅ Удалено товаров: ${deletedProducts.count}`);
    
    // Удаляем файл
    await prisma.file.delete({
      where: { id: lastEggstraFile.id }
    });
    console.log(`✅ Удален файл: ${lastEggstraFile.fileName}`);
    
    // Проверим нужно ли удалить поставщика
    if (lastEggstraFile.supplierId) {
      const supplierFiles = await prisma.file.findMany({
        where: { supplierId: lastEggstraFile.supplierId }
      });
      
      if (supplierFiles.length === 0 && lastEggstraFile.supplier) {
        await prisma.supplier.delete({
          where: { id: lastEggstraFile.supplierId }
        });
        console.log(`✅ Удален поставщик: ${lastEggstraFile.supplier.name}`);
      }
    }
    
    console.log('\n🎉 Все неверные данные удалены');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

deleteLastEggstraData();