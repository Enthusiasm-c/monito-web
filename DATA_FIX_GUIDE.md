# Руководство по исправлению существующих данных

## 🔍 Проверка качества данных

Сначала проверьте, какие проблемы есть в вашей базе данных:

```bash
npm run validate:data
```

Эта команда покажет:
- Количество товаров с индонезийскими названиями (apel fuji → Apple Fuji)
- Количество нулевых или некорректных цен
- Количество неправильных единиц измерения
- Количество дубликатов товаров
- Общий процент проблемных записей

## 🛠️ Варианты исправления

### Вариант 1: Быстрое исправление (рекомендуется)

Если у вас менее 20% проблемных записей, можно исправить данные без перезагрузки:

#### 1. Исправить индонезийские названия
```bash
npm run fix:indonesian
```

Это быстрый скрипт, который:
- Использует словарь для перевода (apel → Apple, wortel → Carrot)
- Работает мгновенно даже на больших базах
- Исправляет standardizedName и name

#### 2. Исправить все остальные проблемы
```bash
npm run fix:data
```

Этот скрипт:
- Исправляет единицы измерения (kg. → kg, gr → g)
- Пересчитывает unitPrice для всех цен
- Удаляет дубликаты (объединяет цены)
- Использует AI для сложных случаев

#### 3. Только удалить дубликаты
```bash
npm run fix:duplicates
```

### Вариант 2: Полная перезагрузка

Если проблем слишком много (>50%), лучше перезагрузить данные:

1. **Сохраните список загруженных файлов**
   ```sql
   -- Получить список успешных загрузок
   SELECT DISTINCT 
     s.name as supplier_name,
     u.fileName,
     u.createdAt,
     COUNT(p.id) as product_count
   FROM uploads u
   JOIN suppliers s ON u.supplierId = s.id
   LEFT JOIN prices p ON p.uploadId = u.id
   WHERE u.status = 'completed'
   GROUP BY s.name, u.fileName, u.createdAt
   ORDER BY u.createdAt;
   ```

2. **Очистите базу данных**
   ```bash
   npx prisma db push --force-reset
   npx prisma db seed
   ```

3. **Перезагрузите файлы**
   - Используйте обновленный пайплайн
   - Все исправления уже применены автоматически

## 📊 Пример работы скриптов

### validate:data
```
🔍 Validating data quality...

📊 Data Quality Report
======================

Total Products: 3183
Total Prices: 3183

Issues Found:
❌ Indonesian names: 214
❌ Null/zero prices: 0
❌ Invalid units: 45
❌ Missing unit prices: 156
❌ Duplicate products: 18
❌ Out-of-range prices: 3

📈 8.9% of products have issues

Sample Indonesian names:
  - apel fuji
  - wortel lokal
  - tomat cherry
  - ayam kampung
  - telur ayam

💡 Recommendations:
1. Run: npm run fix:indonesian
2. Run: npm run fix:data
```

### fix:indonesian
```
🚀 Quick fix for Indonesian product names

Found 3183 products to check

Found 214 products to fix

Preview of changes:
  "apel fuji" → "Apple Fuji"
  "wortel lokal" → "Carrot Local"
  "tomat cherry" → "Tomato Cherry"
  "ayam kampung" → "Chicken Free Range"
  "telur ayam" → "Egg Chicken"
  ... and 209 more

Applying updates...
Progress: 50/214
Progress: 100/214
Progress: 150/214
Progress: 200/214

✅ Fixed 214 products!
```

## ⚙️ Дополнительные опции

### Скрипт fix-existing-data.ts поддерживает флаги:

```bash
# Пропустить исправление имен (только units и prices)
npm run fix:data -- --skip-names

# Пропустить исправление единиц
npm run fix:data -- --skip-units

# Пропустить исправление цен
npm run fix:data -- --skip-prices

# Пропустить удаление дубликатов
npm run fix:data -- --skip-duplicates

# Режим просмотра (без изменений)
npm run fix:data -- --dry-run
```

## 🚨 Важные замечания

1. **Backup**: Всегда делайте резервную копию перед исправлениями
   ```bash
   pg_dump $DATABASE_URL > backup_before_fix.sql
   ```

2. **Время выполнения**:
   - fix:indonesian - < 1 минута на 5000 товаров
   - fix:data - ~5-10 минут на 5000 товаров (из-за AI)
   - fix:duplicates - < 1 минута

3. **AI лимиты**: 
   - fix:data использует o3-mini для сложных случаев
   - Обрабатывает батчами по 50 товаров
   - Может потребовать API ключ с достаточным балансом

4. **Проверка после исправления**:
   ```bash
   # Проверить результат
   npm run validate:data
   
   # Должно показать 0 проблем или минимальное количество
   ```

## 🔄 Автоматизация

Добавьте в cron для регулярной проверки:

```bash
# Каждый день в 3 ночи проверять и исправлять
0 3 * * * cd /path/to/monito-web && npm run validate:data >> /var/log/data-quality.log 2>&1
0 4 * * * cd /path/to/monito-web && npm run fix:indonesian >> /var/log/data-fix.log 2>&1
```

## 📞 Поддержка

Если скрипты не помогают:
1. Сохраните вывод `npm run validate:data`
2. Проверьте логи ошибок
3. Рассмотрите полную перезагрузку данных