const { PrismaClient } = require('@prisma/client');

async function cleanupFailedSuppliers() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🧹 Очистка неудачных поставщиков...');
    
    // Get suppliers with 0 products
    const emptySuppliers = await prisma.supplier.findMany({
      include: {
        _count: {
          select: { 
            prices: true,
            uploads: true 
          }
        }
      },
      where: {
        prices: {
          none: {}
        }
      }
    });
    
    console.log(`Найдено ${emptySuppliers.length} поставщиков без товаров`);
    
    for (const supplier of emptySuppliers) {
      console.log(`\n📦 Удаляем: ${supplier.name}`);
      console.log(`   Загрузок: ${supplier._count.uploads}`);
      
      // Delete uploads first (due to foreign key constraints)
      if (supplier._count.uploads > 0) {
        await prisma.upload.deleteMany({
          where: { supplierId: supplier.id }
        });
        console.log(`   ✅ Удалено ${supplier._count.uploads} загрузок`);
      }
      
      // Delete supplier
      await prisma.supplier.delete({
        where: { id: supplier.id }
      });
      console.log(`   ✅ Поставщик удален`);
    }
    
    console.log(`\n✅ Очистка завершена! Удалено ${emptySuppliers.length} поставщиков`);
    
    // Show final stats
    const finalCount = await prisma.supplier.count();
    console.log(`📊 Поставщиков осталось: ${finalCount}`);
    
    return emptySuppliers.map(s => s.name);
    
  } catch (error) {
    console.error('❌ Ошибка при очистке:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanupFailedSuppliers();