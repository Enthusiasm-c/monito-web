// Скрипт для повторной обработки существующих uploads
const { PrismaClient } = require('@prisma/client');

async function reprocessPendingUploads() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔄 Reprocessing pending uploads with AI decisions...');
    
    // Найдем все uploads в статусе pending_review с AI решениями
    const pendingUploads = await prisma.upload.findMany({
      where: {
        status: 'pending_review',
        approvalStatus: 'pending_review',
        extractedData: {
          not: null
        }
      },
      include: {
        supplier: true
      }
    });
    
    console.log(`📋 Found ${pendingUploads.length} pending uploads to reprocess`);
    
    for (const upload of pendingUploads) {
      console.log(`\n🔄 Processing upload: ${upload.originalName}`);
      
      if (!upload.extractedData || !upload.extractedData.aiDecision) {
        console.log('❌ No AI decision found, skipping');
        continue;
      }
      
      const aiDecision = upload.extractedData.aiDecision;
      console.log(`📊 AI Decision: ${aiDecision.dataQuality} quality, ${aiDecision.products?.length || 0} products`);
      
      // Подсчитаем продукты для создания
      let toCreate = 0;
      let toUpdate = 0;
      let toSkip = 0;
      
      for (const product of aiDecision.products || []) {
        if (product.decision === 'add' && product.price && product.price > 0) {
          toCreate++;
        } else if (product.decision === 'update' && product.price && product.price > 0) {
          toUpdate++;
        } else {
          toSkip++;
        }
      }
      
      console.log(`📈 Products to process: ${toCreate} create, ${toUpdate} update, ${toSkip} skip`);
      
      if (toCreate === 0 && toUpdate === 0) {
        console.log('⚠️ No products to create or update, skipping');
        continue;
      }
      
      // Начинаем создавать продукты
      let created = 0;
      let updated = 0;
      
      for (const product of aiDecision.products || []) {
        if (!product.price || product.price <= 0) {
          console.log(`⏭️ Skipping ${product.cleanedName} - no valid price (${product.price})`);
          continue;
        }
        
        try {
          if (product.decision === 'add') {
            // Создать новый продукт
            const newProduct = await prisma.product.create({
              data: {
                rawName: product.originalName,
                name: product.cleanedName,
                standardizedName: product.cleanedName,
                category: product.category,
                unit: product.unit,
                standardizedUnit: product.unit
              }
            });
            
            // Создать цену
            await prisma.price.create({
              data: {
                amount: product.price,
                unit: product.unit,
                productId: newProduct.id,
                supplierId: upload.supplierId,
                uploadId: upload.id,
                validFrom: new Date()
              }
            });
            
            created++;
            console.log(`➕ Created: ${product.cleanedName} - ${product.price}`);
            
          } else if (product.decision === 'update') {
            // Найти существующий продукт
            const existingProduct = await prisma.product.findFirst({
              where: {
                OR: [
                  { name: { equals: product.cleanedName, mode: 'insensitive' } },
                  { standardizedName: { equals: product.cleanedName, mode: 'insensitive' } }
                ]
              }
            });
            
            if (existingProduct) {
              // Закрыть старую цену
              await prisma.price.updateMany({
                where: {
                  productId: existingProduct.id,
                  supplierId: upload.supplierId,
                  validTo: null
                },
                data: {
                  validTo: new Date()
                }
              });
              
              // Создать новую цену
              await prisma.price.create({
                data: {
                  amount: product.price,
                  unit: product.unit,
                  productId: existingProduct.id,
                  supplierId: upload.supplierId,
                  uploadId: upload.id,
                  validFrom: new Date()
                }
              });
              
              updated++;
              console.log(`🔄 Updated: ${product.cleanedName} - ${product.price}`);
            } else {
              // Если не найден, создаем новый
              const newProduct = await prisma.product.create({
                data: {
                  rawName: product.originalName,
                  name: product.cleanedName,
                  standardizedName: product.cleanedName,
                  category: product.category,
                  unit: product.unit,
                  standardizedUnit: product.unit
                }
              });
              
              await prisma.price.create({
                data: {
                  amount: product.price,
                  unit: product.unit,
                  productId: newProduct.id,
                  supplierId: upload.supplierId,
                  uploadId: upload.id,
                  validFrom: new Date()
                }
              });
              
              created++;
              console.log(`➕ Created (fallback): ${product.cleanedName} - ${product.price}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error processing ${product.cleanedName}:`, error.message);
        }
      }
      
      // Обновляем статус upload
      await prisma.upload.update({
        where: { id: upload.id },
        data: {
          status: 'completed',
          approvalStatus: 'approved',
          autoApproved: true,
          approvedBy: 'SYSTEM_REPROCESS',
          approvedAt: new Date()
        }
      });
      
      console.log(`✅ Completed: ${created} created, ${updated} updated`);
    }
    
    console.log('\n🎉 Reprocessing completed!');
    
  } catch (error) {
    console.error('❌ Reprocessing error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

reprocessPendingUploads();