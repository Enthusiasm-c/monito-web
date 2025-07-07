const { PrismaClient } = require('@prisma/client');

async function checkDuplicateSuppliers() {
  const prisma = new PrismaClient();
  
  try {
    const suppliers = await prisma.supplier.findMany({
      include: {
        _count: {
          select: { prices: true }
        }
      }
    });
    
    console.log('=== АНАЛИЗ ДУБЛИРУЮЩИХСЯ ПОСТАВЩИКОВ ===');
    console.log('Всего поставщиков:', suppliers.length);
    console.log('');
    
    // Group by similar names
    const nameGroups = {};
    suppliers.forEach(supplier => {
      const normalizedName = supplier.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .replace(/\s+/g, '');
      
      if (!nameGroups[normalizedName]) {
        nameGroups[normalizedName] = [];
      }
      nameGroups[normalizedName].push(supplier);
    });
    
    // Find groups with multiple suppliers
    const duplicates = Object.entries(nameGroups)
      .filter(([_, group]) => group.length > 1);
    
    if (duplicates.length > 0) {
      console.log('НАЙДЕНЫ ДУБЛИРУЮЩИЕСЯ ПОСТАВЩИКИ:');
      duplicates.forEach(([normalizedName, group]) => {
        console.log('\n--- Группа:', normalizedName, '---');
        group.forEach(supplier => {
          console.log('  •', supplier.name, '(товаров:', supplier._count.prices + ')');
        });
      });
    } else {
      console.log('Дублирующихся поставщиков не найдено.');
    }
    
    // Check for exact name matches
    console.log('\n=== ТОЧНЫЕ СОВПАДЕНИЯ ИМЕН ===');
    const exactNameGroups = {};
    suppliers.forEach(supplier => {
      const exactName = supplier.name.trim();
      if (!exactNameGroups[exactName]) {
        exactNameGroups[exactName] = [];
      }
      exactNameGroups[exactName].push(supplier);
    });
    
    const exactDuplicates = Object.entries(exactNameGroups)
      .filter(([_, group]) => group.length > 1);
    
    if (exactDuplicates.length > 0) {
      exactDuplicates.forEach(([name, group]) => {
        console.log('\n' + name + ':', group.length, 'записей');
        group.forEach(supplier => {
          console.log('  • ID:', supplier.id, '(товаров:', supplier._count.prices + ')');
        });
      });
    } else {
      console.log('Точных дубликатов имен не найдено.');
    }
    
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicateSuppliers();