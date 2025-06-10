const { PrismaClient } = require('@prisma/client');

async function cleanupDatabase() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🧹 Начинаем очистку базы данных...\n');
    
    // 1. Найти все файлы Eggstra
    const eggstraFiles = await prisma.file.findMany({
      where: {
        fileName: {
          contains: 'EGGSTRA',
          mode: 'insensitive'
        }
      },
      include: {
        products: true,
        supplier: true
      }
    });
    
    console.log(`🔍 Найдено ${eggstraFiles.length} файлов Eggstra для удаления:`);
    eggstraFiles.forEach((file, i) => {
      console.log(`   ${i+1}. ${file.fileName} (${file.products.length} товаров)`);
      console.log(`      Поставщик: ${file.supplier?.name || 'N/A'}`);
      console.log(`      Дата: ${file.createdAt.toISOString().split('T')[0]}`);
    });
    
    if (eggstraFiles.length === 0) {
      console.log('✅ Файлы Eggstra не найдены, база уже чистая');
      return;
    }
    
    // 2. Удалить товары
    let totalDeletedProducts = 0;
    for (const file of eggstraFiles) {
      const deletedProducts = await prisma.product.deleteMany({
        where: { fileId: file.id }
      });
      totalDeletedProducts += deletedProducts.count;
      console.log(`   ✅ Удалено ${deletedProducts.count} товаров из файла ${file.fileName}`);
    }
    
    // 3. Удалить файлы
    const deletedFiles = await prisma.file.deleteMany({
      where: {
        fileName: {
          contains: 'EGGSTRA',
          mode: 'insensitive'
        }
      }
    });
    console.log(`   ✅ Удалено ${deletedFiles.count} файлов Eggstra`);
    
    // 4. Удалить неиспользуемых поставщиков
    const suppliersToCheck = [...new Set(eggstraFiles.map(f => f.supplierId).filter(Boolean))];
    let deletedSuppliers = 0;
    
    for (const supplierId of suppliersToCheck) {
      // Проверить есть ли еще файлы у этого поставщика
      const remainingFiles = await prisma.file.findMany({
        where: { supplierId: supplierId }
      });
      
      if (remainingFiles.length === 0) {
        const supplier = await prisma.supplier.findUnique({
          where: { id: supplierId }
        });
        
        if (supplier) {
          await prisma.supplier.delete({
            where: { id: supplierId }
          });
          console.log(`   ✅ Удален поставщик: "${supplier.name}"`);
          deletedSuppliers++;
        }
      }
    }
    
    // 5. Также удалим любые файлы с подозрительными названиями товаров
    console.log('\n🔍 Поиск файлов с подозрительными данными...');
    
    const suspiciousFiles = await prisma.file.findMany({
      include: {
        products: {
          take: 10 // Проверим первые 10 товаров
        },
        supplier: true
      }
    });
    
    let additionalDeleted = 0;
    for (const file of suspiciousFiles) {
      // Проверим есть ли товары с числовыми названиями
      const numericProducts = file.products.filter(p => 
        /^\d+$/.test(p.name.trim()) || // Чисто числовые названия
        p.name.trim().length <= 3 && /\d/.test(p.name) // Короткие с цифрами
      );
      
      if (numericProducts.length >= 3) { // Если много подозрительных товаров
        console.log(`   ⚠️ Подозрительный файл: ${file.fileName}`);
        console.log(`      Поставщик: ${file.supplier?.name || 'N/A'}`);
        console.log(`      Примеры плохих товаров: ${numericProducts.slice(0, 3).map(p => `"${p.name}"`).join(', ')}`);
        
        // Удалить товары
        const deleted = await prisma.product.deleteMany({
          where: { fileId: file.id }
        });
        
        // Удалить файл
        await prisma.file.delete({
          where: { id: file.id }
        });
        
        console.log(`      ✅ Удален файл и ${deleted.count} товаров`);
        additionalDeleted++;
        
        // Проверить нужно ли удалить поставщика
        if (file.supplierId) {
          const remainingFiles = await prisma.file.findMany({
            where: { supplierId: file.supplierId }
          });
          
          if (remainingFiles.length === 0) {
            await prisma.supplier.delete({
              where: { id: file.supplierId }
            });
            console.log(`      ✅ Удален поставщик: "${file.supplier?.name}"`);
          }
        }
      }
    }
    
    console.log('\n🎉 Очистка завершена!');
    console.log(`   📊 Всего удалено:`);
    console.log(`      - Файлов Eggstra: ${deletedFiles.count}`);
    console.log(`      - Подозрительных файлов: ${additionalDeleted}`);
    console.log(`      - Товаров: ${totalDeletedProducts}`);
    console.log(`      - Поставщиков: ${deletedSuppliers}`);
    
    // Показать текущее состояние базы
    const remainingFiles = await prisma.file.count();
    const remainingProducts = await prisma.product.count();
    const remainingSuppliers = await prisma.supplier.count();
    
    console.log('\n📈 Состояние базы после очистки:');
    console.log(`   - Файлов: ${remainingFiles}`);
    console.log(`   - Товаров: ${remainingProducts}`);
    console.log(`   - Поставщиков: ${remainingSuppliers}`);
    
  } catch (error) {
    console.error('❌ Ошибка при очистке:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDatabase();