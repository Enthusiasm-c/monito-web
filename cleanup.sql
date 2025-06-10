-- Удаляем цены из файлов Eggstra
DELETE FROM "prices" WHERE "uploadId" IN (
  SELECT id FROM "uploads" WHERE "fileName" ILIKE '%EGGSTRA%'
);

-- Удаляем файлы Eggstra  
DELETE FROM "uploads" WHERE "fileName" ILIKE '%EGGSTRA%';

-- Удаляем поставщиков без файлов (с подозрительными именами)
DELETE FROM "suppliers" WHERE "name" ILIKE '%EGGSTRA CAFÉ%' OR "name" ILIKE '%To :%';

-- Удаляем продукты без цен
DELETE FROM "products" WHERE id NOT IN (
  SELECT DISTINCT "productId" FROM "prices"
);

-- Удаляем поставщиков без файлов
DELETE FROM "suppliers" WHERE id NOT IN (
  SELECT DISTINCT "supplierId" FROM "uploads"
);

-- Показать текущее состояние
SELECT 'uploads' as table_name, COUNT(*) as count FROM "uploads"
UNION ALL
SELECT 'products' as table_name, COUNT(*) as count FROM "products"  
UNION ALL
SELECT 'suppliers' as table_name, COUNT(*) as count FROM "suppliers"
UNION ALL
SELECT 'prices' as table_name, COUNT(*) as count FROM "prices";