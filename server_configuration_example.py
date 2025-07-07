"""
Пример конфигурации для развертывания на удаленном сервере
Этот файл показывает, как настроить маппинг пользователей к ресторанам
"""

# Пример маппинга user_id к названиям ресторанов
# Замените на реальные данные вашего проекта
USER_RESTAURANT_MAPPING_EXAMPLE = {
    # Telegram user_id: "Название ресторана"
    123456789: "Ресторан 'Солнечный берег'",
    987654321: "Кафе 'Уютный уголок'", 
    555666777: "Бистро 'Быстрый обед'",
    444555666: "Пиццерия 'Мама Мия'",
    333444555: "Суши-бар 'Токио'",
    222333444: "Столовая 'Домашняя кухня'",
    111222333: "Кондитерская 'Сладкий рай'",
    999888777: "Бар 'Старый город'",
    888777666: "Ресторан 'Гурман'",
    777666555: "Кафе 'Студенческое'"
}

# Инструкции по настройке:
SETUP_INSTRUCTIONS = """
🔧 ИНСТРУКЦИИ ПО НАСТРОЙКЕ МОНИТОРИНГА

1. Найдите user_id ваших пользователей:
   - Добавьте логирование в бота: logger.info(f"User ID: {message.from_user.id}")
   - Или используйте @userinfobot в Telegram

2. Замените USER_RESTAURANT_MAPPING в файле invoice_scan.py:
   
   USER_RESTAURANT_MAPPING = {
       123456789: "Ваш ресторан 1",
       987654321: "Ваш ресторан 2", 
       # ... добавьте все ваши рестораны
   }

3. Пример получения user_id:
   
   @router.message(F.text == "/my_id")
   async def get_user_id(message: types.Message):
       await message.answer(f"Ваш ID: {message.from_user.id}")

4. Проверка работы мониторинга:
   
   # В логах должно появиться:
   # "Monitoring system initialized successfully"
   # "User 123456789 (Название ресторана) sent a photo for processing"

5. Просмотр метрик:
   
   cat /root/monitoring/bot_metrics.json
   
6. Получение статистики (добавьте в бота):
   
   @router.message(F.text == "/stats")
   async def get_stats(message: types.Message):
       if message.from_user.id in ADMIN_IDS:  # только для админов
           stats = await get_monitoring_stats(7)  # за 7 дней
           await message.answer(f"Статистика: {stats}")
"""

# Пример функции для добавления в бота для получения статистики
ADMIN_STATS_HANDLER_EXAMPLE = '''
from ..handlers.invoice_scan import get_monitoring_stats

@router.message(F.text.startswith("/stats"))
async def admin_stats(message: types.Message):
    """Получить статистику мониторинга (только для админов)"""
    
    # Список админских user_id
    ADMIN_IDS = [123456789, 987654321]  # Замените на реальные ID админов
    
    if message.from_user.id not in ADMIN_IDS:
        await message.answer("❌ У вас нет прав для просмотра статистики")
        return
    
    try:
        # Получаем количество дней из команды или используем 7 по умолчанию
        parts = message.text.split()
        days = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 7
        
        stats = await get_monitoring_stats(days)
        
        if "error" in stats:
            await message.answer(f"❌ Ошибка получения статистики: {stats['error']}")
            return
        
        # Форматируем ответ
        response = f"""
📊 *Статистика за {days} дней*

🔢 *Общие показатели:*
• Всего сессий: {stats.get('total_sessions', 0)}
• Успешных: {stats.get('successful_sessions', 0)}
• Процент успеха: {stats.get('success_rate', 0):.1f}%
• Обработано продуктов: {stats.get('total_products_processed', 0)}
• Общая экономия: {stats.get('total_savings', 0):.2f} руб.
• Среднее время: {stats.get('average_duration', 0):.2f} сек.

🏪 *По ресторанам:*
"""
        
        restaurant_stats = stats.get('restaurant_statistics', {})
        for restaurant, data in restaurant_stats.items():
            response += f"""
• *{restaurant}*
  Сессий: {data['sessions']}
  Продуктов: {data['products']}
  Экономия: {data['savings']:.2f} руб.
  Среднее время: {data['avg_duration']:.2f} сек.
"""
        
        await message.answer(response, parse_mode="Markdown")
        
    except Exception as e:
        await message.answer(f"❌ Ошибка: {e}")
'''

if __name__ == "__main__":
    print("📋 Конфигурация для мониторинга")
    print("=" * 40)
    print("\n🗺️ Пример маппинга пользователей:")
    for user_id, restaurant in list(USER_RESTAURANT_MAPPING_EXAMPLE.items())[:5]:
        print(f"  {user_id}: \"{restaurant}\"")
    print("  ...")
    
    print(SETUP_INSTRUCTIONS)
    
    print("\n📁 Файлы для редактирования на сервере:")
    print("  /root/monito-web-deploy/telegram-bot/app/handlers/invoice_scan.py")
    print("    - Замените USER_RESTAURANT_MAPPING на ваши данные")
    print("  /root/monito-web-deploy/telegram-bot/app/handlers/start.py") 
    print("    - Добавьте обработчик статистики для админов")
    
    print("\n✅ Готово к настройке!")