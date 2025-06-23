#!/bin/bash
# Команды для обновления сервера

echo "🚀 Updating server with latest changes..."

# 1. Переход в директорию проекта
cd /path/to/your/project  # замените на реальный путь

# 2. Получение последних изменений
git pull origin main

# 3. Установка зависимостей (если есть новые)
npm install

# 4. Сборка проекта для продакшена
npm run build

# 5. Перезапуск сервиса (выберите подходящий вариант)
# Если используете PM2:
# pm2 restart monito-web

# Если используете systemd:
# sudo systemctl restart monito-web

# Если используете Docker:
# docker-compose down && docker-compose up -d --build

echo "✅ Server updated successfully!"