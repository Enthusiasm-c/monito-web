const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('🔍 Проверяем базу данных...\n');
    
    // Общая статистика
    const totalFiles = await prisma.file.count();
    const totalProducts = await prisma.product.count();
    const totalSuppliers = await prisma.supplier.count();
    
    console.log('📊 Общая статистика:');
    console.log(`   Файлов: ${totalFiles}`);
    console.log(`   Товаров: ${totalProducts}`);
    console.log(`   Поставщиков: ${totalSuppliers}\n`);
    
    // Последние файлы
    const recentFiles = await prisma.file.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        id: true,
        fileName: true,
        status: true,
        createdAt: true,
        _count: {
          select: { products: true }
        },
        supplier: {
          select: { name: true }
        }
      }
    });
    
    console.log('📁 Последние файлы:');
    recentFiles.forEach((file, i) => {
      const date = file.createdAt.toISOString().split('T')[0];
      const time = file.createdAt.toISOString().split('T')[1].split('.')[0];
      console.log(`   ${i+1}. ${file.fileName}`);
      console.log(`      ID: ${file.id}`);
      console.log(`      Товаров: ${file._count.products}`);
      console.log(`      Статус: ${file.status}`);
      console.log(`      Поставщик: ${file.supplier?.name || 'N/A'}`);
      console.log(`      Дата: ${date} ${time}`);
      console.log('');
    });
    
    // Проверим конкретные файлы
    const eggstraFiles = await prisma.file.findMany({
      where: {
        fileName: {
          contains: 'EGGSTRA',
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        fileName: true,
        status: true,
        createdAt: true,
        _count: {
          select: { products: true }
        }
      }
    });
    
    console.log(`🥚 Файлы Eggstra (${eggstraFiles.length}):`);
    eggstraFiles.forEach((file, i) => {
      console.log(`   ${i+1}. ${file.fileName} (ID: ${file.id})`);
      console.log(`      Товаров: ${file._count.products}`);
      console.log(`      Статус: ${file.status}`);
      console.log(`      Дата: ${file.createdAt.toISOString()}`);
      console.log('');
    });
    
    const milkFiles = await prisma.file.findMany({
      where: {
        fileName: {
          contains: 'milk',
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        fileName: true,
        status: true,
        createdAt: true,
        _count: {
          select: { products: true }
        }
      }
    });
    
    console.log(`🥛 Файлы Milk Up (${milkFiles.length}):`);
    milkFiles.forEach((file, i) => {
      console.log(`   ${i+1}. ${file.fileName} (ID: ${file.id})`);
      console.log(`      Товаров: ${file._count.products}`);
      console.log(`      Статус: ${file.status}`);
      console.log(`      Дата: ${file.createdAt.toISOString()}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();