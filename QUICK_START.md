# 🚀 Quick Start Guide

## Автоматический запуск (рекомендуется)

```bash
cd /Users/denisdomashenko/monito-web
./start-local.sh
```

Скрипт автоматически:
- ✅ Запустит Monito Web на http://localhost:3000
- ✅ Запустит Telegram бота
- ✅ Создаст тестовые данные
- ✅ Проверит работу API

## Ручной запуск

### Terminal 1 - Monito Web:
```bash
cd /Users/denisdomashenko/monito-web
npm install
npx prisma generate
npx prisma db push
npx ts-node prisma/seed-test-data.ts
npm run dev
```

### Terminal 2 - Telegram Bot:
```bash
cd /Users/denisdomashenko/monito-web/telegram-bot
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m app.bot
```

## Тестирование бота

1. **Откройте Telegram**
2. **Найдите бота**: @monito_web_bot (или поиск по токену)
3. **Отправьте команды**:
   - `/start` - приветствие
   - `/price beras` - поиск цен на рис
   - `/price minyak` - поиск цен на масло
   - Отправьте фото чека для анализа цен

## Тестовые продукты в базе:
- Beras Premium 5kg - 65,000-70,000 IDR
- Minyak Goreng Bimoli 2L - 32,000-35,000 IDR
- Gula Pasir Gulaku 1kg - 14,000-15,000 IDR
- Ayam Potong Segar - 35,000-40,000 IDR/kg
- Telur Ayam Negeri - 28,000-30,000 IDR/kg

## Проверка работы API:

```bash
# Поиск продуктов
curl -H "X-Bot-API-Key: test-bot-api-key-123456" \
     "http://localhost:3000/api/bot/products/search?q=beras"

# Сравнение цен
curl -X POST -H "X-Bot-API-Key: test-bot-api-key-123456" \
     -H "Content-Type: application/json" \
     -d '{"items":[{"product_name":"Beras Premium","scanned_price":70000}]}' \
     "http://localhost:3000/api/bot/prices/compare"
```

## Остановка сервисов:
Нажмите `Ctrl+C` в терминале со скриптом start-local.sh

## Логи:
- Web: в консоли где запущен npm run dev
- Bot: telegram-bot/bot.log

## Возможные проблемы:

**Порт 3000 занят:**
```bash
lsof -i :3000
kill -9 <PID>
```

**База данных недоступна:**
Используется облачная база Neon, проверьте интернет соединение.

**Бот не отвечает:**
Проверьте что токен правильный и бот не запущен в другом месте.