import fs from 'fs/promises';

import { prisma } from '../lib/prisma';

async function cleanAndReprocess() {
  try {
    console.log('Cleaning milk up upload...\n');
    
    // 1. Найдем загрузку
    const upload = await prisma.upload.findFirst({
      where: { 
        id: 'upload_1749815294121_bth7l2nyw'
      }
    });
    
    if (!upload) {
      console.log('Upload not found');
      return;
    }
    
    // 2. Удалим все цены этой загрузки
    const deletedPrices = await prisma.price.deleteMany({
      where: { uploadId: upload.id }
    });
    console.log(`Deleted ${deletedPrices.count} prices`);
    
    // 3. Удалим продукты без цен
    const orphanProducts = await prisma.product.findMany({
      where: {
        prices: {
          none: {}
        }
      }
    });
    
    for (const product of orphanProducts) {
      await prisma.product.delete({ where: { id: product.id } });
    }
    console.log(`Deleted ${orphanProducts.length} orphan products`);
    
    // 4. Загрузим правильные данные из milk_up_ai_vision_complete.json
    const jsonData = await fs.readFile('./milk_up_ai_vision_complete.json', 'utf-8');
    const data = JSON.parse(jsonData);
    
    console.log(`\nLoading ${data.products.length} products from AI Vision extraction...`);
    
    // 5. Импортируем стандартизацию
    const { generateStandardizedData } = await import('../app/services/standardization/index.js');
    
    // 6. Обработаем каждый продукт
    let created = 0;
    let updated = 0;
    
    for (const item of data.products) {
      // Создадим правильное название
      const productName = item.size ? 
        `${item.name} ${item.size}` : 
        item.name;
      
      const unit = item.unit || 'pcs';
      
      // Стандартизируем
      const { standardizedName, standardizedUnit } = generateStandardizedData(
        productName,
        unit
      );
      
      // Проверим существование
      const existing = await prisma.product.findFirst({
        where: {
          standardizedName,
          standardizedUnit
        }
      });
      
      if (existing) {
        // Добавим цену к существующему
        await prisma.price.create({
          data: {
            id: `price_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            productId: existing.id,
            supplierId: upload.supplierId,
            uploadId: upload.id,
            amount: item.price || 0,
            unit: unit,
            validFrom: new Date()
          }
        });
        updated++;
      } else {
        // Создадим новый продукт
        const category = determineCategory(item.name);
        
        const newProduct = await prisma.product.create({
          data: {
            id: `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            rawName: productName,
            name: productName,
            standardizedName,
            unit,
            standardizedUnit,
            category
          }
        });
        
        // Создадим цену
        await prisma.price.create({
          data: {
            id: `price_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            productId: newProduct.id,
            supplierId: upload.supplierId,
            uploadId: upload.id,
            amount: item.price || 0,
            unit: unit,
            validFrom: new Date()
          }
        });
        
        created++;
      }
    }
    
    // 7. Обновим статистику загрузки
    await prisma.upload.update({
      where: { id: upload.id },
      data: {
        totalRowsDetected: data.products.length,
        totalRowsProcessed: data.products.length,
        status: 'completed'
      }
    });
    
    console.log('\n=== Summary ===');
    console.log(`New products created: ${created}`);
    console.log(`Existing products updated: ${updated}`);
    console.log(`Total processed: ${created + updated}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function determineCategory(name: string): string {
  const nameLower = name.toLowerCase();
  
  if (nameLower.includes('yogurt') || nameLower.includes('kefir')) {
    return 'DAIRY';
  }
  if (nameLower.includes('cheese') || nameLower.includes('mascarpone') || 
      nameLower.includes('ricotta') || nameLower.includes('cottage')) {
    return 'DAIRY';
  }
  if (nameLower.includes('milk') || nameLower.includes('cream')) {
    return 'DAIRY';
  }
  if (nameLower.includes('dumpling')) {
    return 'MEAT';
  }
  if (nameLower.includes('cake') || nameLower.includes('cookie')) {
    return 'OTHER';
  }
  
  return 'OTHER';
}

cleanAndReprocess();