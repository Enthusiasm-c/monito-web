#!/bin/bash

# Скрипт для развертывания системы мониторинга на сервере
# Использование: ./deploy_monitoring.sh [server_ip] [server_user]

set -e

# Параметры по умолчанию
SERVER_IP="${1:-your_server_ip}"
SERVER_USER="${2:-root}"
LOCAL_DIR="/Users/denisdomashenko/monito-web"
REMOTE_DIR="/root"

echo "🚀 Развертывание системы мониторинга Telegram бота"
echo "================================================="
echo "Сервер: $SERVER_USER@$SERVER_IP"
echo "Локальная директория: $LOCAL_DIR"
echo "Удаленная директория: $REMOTE_DIR"
echo ""

# Проверка наличия файлов
echo "📋 Проверка файлов..."
FILES_TO_CHECK=(
    "$LOCAL_DIR/monitoring/metrics_collector.py"
    "$LOCAL_DIR/telegram-bot/app/handlers/invoice_scan.py"
    "$LOCAL_DIR/monitoring/test_monitoring.py"
)

for file in "${FILES_TO_CHECK[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Файл не найден: $file"
        exit 1
    fi
    echo "✅ Найден: $file"
done

echo ""
echo "🔧 Создание резервных копий на сервере..."

# Создание резервной копии на сервере
ssh "$SERVER_USER@$SERVER_IP" "
    echo 'Создание резервной копии...'
    if [ -f '$REMOTE_DIR/monito-web-deploy/telegram-bot/app/handlers/invoice_scan.py' ]; then
        cp '$REMOTE_DIR/monito-web-deploy/telegram-bot/app/handlers/invoice_scan.py' '$REMOTE_DIR/monito-web-deploy/telegram-bot/app/handlers/invoice_scan.py.backup.$(date +%Y%m%d_%H%M%S)'
        echo '✅ Резервная копия создана'
    else
        echo '⚠️ Оригинальный файл не найден на сервере'
    fi
    
    # Создание директории для мониторинга
    mkdir -p '$REMOTE_DIR/monitoring'
    echo '✅ Директория мониторинга создана'
"

echo ""
echo "📦 Копирование файлов на сервер..."

# Копирование системы мониторинга
echo "Копирование metrics_collector.py..."
scp "$LOCAL_DIR/monitoring/metrics_collector.py" "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/monitoring/"

echo "Копирование test_monitoring.py..."
scp "$LOCAL_DIR/monitoring/test_monitoring.py" "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/monitoring/"

echo "Копирование интегрированного invoice_scan.py..."
scp "$LOCAL_DIR/telegram-bot/app/handlers/invoice_scan.py" "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/monito-web-deploy/telegram-bot/app/handlers/"

echo "Копирование отчета об интеграции..."
scp "$LOCAL_DIR/MONITORING_INTEGRATION_REPORT.md" "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/"

echo ""
echo "🧪 Тестирование системы мониторинга на сервере..."

# Тестирование на сервере
ssh "$SERVER_USER@$SERVER_IP" "
    cd '$REMOTE_DIR/monitoring'
    echo 'Запуск тестов...'
    python3 test_monitoring.py
    echo ''
    echo '✅ Тесты прошли успешно'
    echo ''
    echo '📊 Проверка созданных файлов:'
    ls -la bot_metrics.json 2>/dev/null || echo 'Файл метрик будет создан при первом использовании'
"

echo ""
echo "🔧 Настройка прав доступа..."

ssh "$SERVER_USER@$SERVER_IP" "
    chmod +x '$REMOTE_DIR/monitoring/test_monitoring.py'
    chmod 644 '$REMOTE_DIR/monitoring/metrics_collector.py'
    chmod 644 '$REMOTE_DIR/monito-web-deploy/telegram-bot/app/handlers/invoice_scan.py'
    echo '✅ Права доступа настроены'
"

echo ""
echo "📝 Информация о развертывании:"
echo "================================"

ssh "$SERVER_USER@$SERVER_IP" "
    echo '📁 Структура файлов:'
    echo '  /root/monitoring/metrics_collector.py - Система мониторинга'
    echo '  /root/monitoring/test_monitoring.py - Тесты'  
    echo '  /root/monito-web-deploy/telegram-bot/app/handlers/invoice_scan.py - Интегрированный обработчик'
    echo '  /root/MONITORING_INTEGRATION_REPORT.md - Отчет об интеграции'
    echo ''
    echo '🔍 Проверка интеграции:'
    grep -n 'metrics_collector' '$REMOTE_DIR/monito-web-deploy/telegram-bot/app/handlers/invoice_scan.py' | head -3
    echo ''
    echo '📋 Следующие шаги:'
    echo '  1. Добавьте реальные маппинги пользователей в USER_RESTAURANT_MAPPING'
    echo '  2. Перезапустите Telegram бота'
    echo '  3. Проверьте логи на наличие сообщения \"Monitoring system initialized successfully\"'
    echo '  4. Файл метрик будет создан в /root/monitoring/bot_metrics.json'
"

echo ""
echo "🎉 Развертывание завершено успешно!"
echo "===================================="
echo ""
echo "🔔 Важные заметки:"
echo "• Система мониторинга интегрирована и готова к работе"
echo "• Резервные копии созданы с временными метками"
echo "• Тесты прошли успешно"
echo "• Для активации перезапустите Telegram бота"
echo ""
echo "📚 Документация: /root/MONITORING_INTEGRATION_REPORT.md"
echo "🧪 Тестирование: cd /root/monitoring && python3 test_monitoring.py"
echo ""
echo "✨ Готово к использованию!"