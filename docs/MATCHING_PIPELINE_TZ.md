# Техническое задание: Matching Pipeline + Price Comparator

## Модуль: matching_pipeline + price_comparator

**Цель**: довести качество матчинга и сравнения до уровня MVP, чтобы отчёты не содержали ложных «better-deal» и пустых значений.

---

## Обязательные задачи

| ID | Задача | Критерий готовности |
|----|--------|-------------------|
| M-1 | Словарь синонимов (product_alias) | При наличии строки-синонима (alias) сразу отдается верный product_id; carrot, wortrel, zanahoria все ведут к sku_id='CARROT'. |
| M-2 | Расширенный lang_map + нормализатор | В normalize(text) добавлены ключевые переводы (wortel, zanahoria, champiñón, krupuk…). Функция возвращает одинаковый normal-key для EN/ID/ES. |
| M-3 | Проверка "core noun" | В calculateSimilarity() вводится ранний выход: если core-noun запроса ≠ core-noun продукта, similarity = 0. "sweet potato" больше не матчится с "potato". |
| M-4 | unitPrice и честная экономия | Поля qty, standardizedUnit, unitPrice заполняются; better_deal вычисляется по unitPrice. Ошибка «0.2 kg за 250 000 vs 1 kg 75 000» устранена. |
| M-5 | Фильтр поставщика и свежести | Альтернативы от того же supplier_id с price_date < 7 дней исключаются. Максимум 3 альтернативы, каждая дешевле ≥ 5 % и с тем же standardizedUnit. |

---

## Детали реализации

### 1. Таблица product_alias

```sql
CREATE TABLE product_alias (
  id SERIAL PRIMARY KEY,
  sku_id TEXT REFERENCES products(sku_id),
  alias TEXT UNIQUE
);
```

- Перед поиском в БД выполняется `aliasLookup(normal_key)`.
- Форма модератора пополняет таблицу в один клик.

### 2. Нормализатор

```typescript
function normalize(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu,' ')
    .replace(/\s+/g,' ')
    .trim();

  return cleaned
    .split(' ')
    .map(w => LANG_MAP[w] ?? w)
    .join(' ');
}
```

### 3. Core-noun extractor

```typescript
const EXCLUSIVE_MOD = ['sweet', 'oyster', 'baby', 'local'];

function coreNoun(name: string) {
  return name.split(' ').filter(w => !EXCLUSIVE_MOD.includes(w))[0] ?? '';
}
```

- если `coreNoun(query) !== coreNoun(candidate)` → similarity = 0.

### 4. Unit → unitPrice

```typescript
function calcUnitPrice(price: number, qty: number, unit: string) {
  if (!qty || !unit) return null;
  const factor = unit === 'g' ? 1000 : 1; // bring to kg
  return price / (qty / factor);
}
```

- Сохраняем в колонку unit_price; используем во всех сравнениях.

### 5. Фильтр альтернатив

```typescript
const MIN_SAVING = 0.05;
const FRESH_DAYS = 7;

candidates
  .filter(c => c.supplierId !== invoice.supplierId
            || c.priceDate < invoice.date.minus({days: FRESH_DAYS}))
  .filter(c => c.unitPrice < invoice.unitPrice * (1 - MIN_SAVING))
  .filter(c => c.standardizedUnit === invoice.standardizedUnit)
  .sort(byUnitPriceAsc)
  .slice(0, 3);
```

---

## Тест-пакет

| Тест | Проверяем |
|------|-----------|
| test_alias_lookup | wortrel → sku_id 'CARROT'. |
| test_core_noun_guard | "sweet potato" ≠ "potato". |
| test_unit_price_calc | 0.2 kg @ 25 000 → unitPrice 125 000. |
| test_same_supplier_fresh | Альтернатива того же поставщика (D-3) не появляется. |
| test_alt_limit_and_pct | Альтернатив максимум три и каждая дешевле ≥ 5 %. |

Все тесты должны быть зелёными в CI.

---

## Приёмочный пример

**Инвойс**: `sample_mixed_lang_carrot.jpg`

**Ожидаем**:
- Позиция carrot/wortrel матчит sku_id=CARROT.
- Выдаются альтернативы только «carrot» других поставщиков.
- Экономия считается по unitPrice.
- Отчёт не содержит предложений того же поставщика в течение недели.

---

## Текущий статус реализации

### ✅ Частично реализовано:
- **M-3**: Проверка core noun через `hasExclusiveModifierMismatch()` функцию
- **M-4**: Расчет unitPrice в `calculateUnitPrice()` функции
- **M-5**: Фильтрация по поставщику, свежести (30 дней) и минимальной экономии (5%)

### ❌ Требует реализации:
- **M-1**: Таблица product_alias для синонимов
- **M-2**: Расширенный lang_map для мультиязычности

### 📝 Отличия от текущей реализации:
1. Вместо FRESH_DAYS=7 используется 30 дней
2. Модификатор 'local' находится в descriptive, а не в exclusive
3. Нет отдельной таблицы синонимов - используется поиск по multiple fields

---

*Документ создан: 2025-06-18*