# КРИТИЧЕСКИЙ БАГ В ТЕЛЕГРАМ БОТЕ: Неправильный расчет Total и Potential Savings

## 🚨 Проблема
Телеграм бот неправильно рассчитывает:
1. **Total** - сумма в итоге
2. **Potential Savings** - потенциальная экономия

## 📊 Текущая неправильная логика

### В файле `/opt/telegram-bot/app/handlers/invoice_scan.py`

**СТРОКА 153 (ОШИБКА):**
```python
comparison_data['total_current'] += scanned_price  # unit_price!
```

**СТРОКА 154 (ОШИБКА):**  
```python
comparison_data['total_savings'] += savings  # экономия без учета quantity!
```

## ❌ Что происходит сейчас:
1. Бот суммирует **unit_price** (цена за единицу) вместо **total_price** (общая цена)
2. При расчете экономии не учитывается **quantity** (количество товара)

## ✅ Что должно быть:

### Пример инвойса:
```
Товар A: unit_price=10,000 IDR, quantity=3, total_price=30,000 IDR
Товар B: unit_price=5,000 IDR, quantity=2, total_price=10,000 IDR
```

### Текущий неправильный расчет:
```
Total = 10,000 + 5,000 = 15,000 IDR ❌ (сумма unit_price)
```

### Правильный расчет:
```
Total = 30,000 + 10,000 = 40,000 IDR ✅ (сумма total_price)
```

## 🔧 ИСПРАВЛЕНИЕ

### 1. Сохранить полные данные товаров:
```python
product_data = []
for item in result['products']:
    unit_price = item.get('unit_price', 0)
    quantity = item.get('quantity', 1)
    total_price = item.get('total_price', 0)
    
    # Вычисления если данные отсутствуют
    if unit_price == 0 and total_price > 0 and quantity > 0:
        unit_price = total_price / quantity
    if total_price == 0 and unit_price > 0 and quantity > 0:
        total_price = unit_price * quantity

    product_data.append({
        'name': item['name'],
        'unit_price': unit_price,
        'quantity': quantity, 
        'total_price': total_price,
        'unit': item.get('unit', '')
    })
```

### 2. Правильный расчет с учетом quantity:
```python
for idx, comp in enumerate(api_response):
    # Получаем данные товара из инвойса
    invoice_item = product_data[idx]
    quantity = invoice_item['quantity']
    total_price_in_invoice = invoice_item['total_price']
    
    # Рассчитываем экономию с учетом количества
    scanned_unit_price = comp['scanned_price']
    min_unit_price = analysis.get('min_price', scanned_unit_price)
    unit_savings = max(0, scanned_unit_price - min_unit_price)
    total_savings_for_item = unit_savings * quantity
    
    # ИСПРАВЛЕННЫЕ СУММЫ:
    comparison_data['total_current'] += total_price_in_invoice  # total_price!
    comparison_data['total_savings'] += total_savings_for_item  # с quantity!
```

### 3. Обновить отображение:
```python
# В formatting.py добавить quantity в отчет
lines.append(f"{i}. **{display_name}** x{quantity} - {format_price(total_price)} {status_emoji}")
```

## 📍 Файлы для изменения:
1. `/opt/telegram-bot/app/handlers/invoice_scan.py` - основная логика
2. `/opt/telegram-bot/app/utils/formatting.py` - отображение quantity

## 🎯 Результат исправления:
- ✅ Total будет показывать реальную сумму инвойса 
- ✅ Potential Savings будет учитывать количество товаров
- ✅ Пользователи получат корректную информацию об экономии

## 🚨 Приоритет: ВЫСОКИЙ
Эта ошибка влияет на все расчеты бота и может вводить пользователей в заблуждение относительно реальной экономии.