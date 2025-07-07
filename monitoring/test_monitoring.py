#!/usr/bin/env python3
"""
Скрипт для тестирования системы мониторинга
"""

import sys
import os
import asyncio
import json
from datetime import datetime

# Добавляем путь к модулю мониторинга
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from metrics_collector import (
    start_processing,
    record_ocr_completion,
    record_api_completion,
    record_financial_summary,
    record_error,
    finish_processing,
    get_statistics,
    add_user_restaurant_mapping
)

def test_basic_monitoring():
    """Базовый тест системы мониторинга"""
    print("🚀 Запуск тестов системы мониторинга...")
    
    # Тест 1: Успешная обработка
    print("\n📊 Тест 1: Успешная обработка счета-фактуры")
    user_id = 123456789
    restaurant_name = "Тестовый ресторан"
    
    # Добавляем маппинг
    add_user_restaurant_mapping(user_id, restaurant_name)
    
    # Начинаем обработку
    metrics = start_processing(user_id)
    print(f"✅ Начата обработка для пользователя {user_id}")
    
    # Имитируем OCR обработку
    import time
    time.sleep(0.5)  # Имитация времени обработки
    record_ocr_completion(
        user_id=user_id,
        duration=0.8,
        products_count=5,
        confidence=0.95,
        supplier_name="Supplier ABC",
        invoice_date="2024-01-15"
    )
    print("✅ OCR обработка завершена")
    
    # Имитируем API запрос
    time.sleep(0.3)
    record_api_completion(
        user_id=user_id,
        duration=1.2,
        products_compared=5,
        products_not_found=1
    )
    print("✅ API сравнение завершено")
    
    # Записываем финансовую сводку
    record_financial_summary(
        user_id=user_id,
        total_amount=1500.50,
        total_savings=150.25,
        savings_percentage=10.0
    )
    print("✅ Финансовая сводка записана")
    
    # Завершаем обработку
    final_metrics = finish_processing(user_id)
    print(f"✅ Обработка завершена: {final_metrics.total_duration:.2f}s")
    
    # Тест 2: Обработка с ошибкой
    print("\n⚠️ Тест 2: Обработка с ошибкой")
    user_id_2 = 987654321
    add_user_restaurant_mapping(user_id_2, "Ресторан с ошибкой")
    
    metrics_2 = start_processing(user_id_2)
    time.sleep(0.2)
    record_error(user_id_2, "Не удалось распознать изображение")
    final_metrics_2 = finish_processing(user_id_2)
    print(f"✅ Обработка с ошибкой завершена: {final_metrics_2.total_duration:.2f}s")
    
    # Тест 3: Получение статистики
    print("\n📈 Тест 3: Получение статистики")
    stats = get_statistics(days=1)
    print(f"Статистика за 1 день:")
    print(json.dumps(stats, indent=2, ensure_ascii=False))
    
    print("\n🎉 Все тесты завершены успешно!")

def test_concurrent_processing():
    """Тест одновременной обработки нескольких счетов"""
    print("\n🔄 Тест одновременной обработки...")
    
    user_ids = [111, 222, 333, 444, 555]
    restaurants = [
        "Ресторан Alpha",
        "Кафе Beta", 
        "Бистро Gamma",
        "Столовая Delta",
        "Буфет Epsilon"
    ]
    
    # Добавляем маппинги
    for user_id, restaurant in zip(user_ids, restaurants):
        add_user_restaurant_mapping(user_id, restaurant)
    
    # Начинаем обработку для всех пользователей
    metrics_list = []
    for user_id in user_ids:
        metrics = start_processing(user_id)
        metrics_list.append(metrics)
    
    print(f"✅ Начата обработка для {len(user_ids)} пользователей")
    
    # Имитируем завершение в случайном порядке
    import random
    import time
    
    for i, user_id in enumerate(user_ids):
        time.sleep(random.uniform(0.1, 0.3))
        
        # Случайно выбираем успех или ошибку
        if random.random() > 0.2:  # 80% успешных
            record_ocr_completion(user_id, random.uniform(0.5, 2.0), 
                                random.randint(3, 10), random.uniform(0.8, 0.98))
            record_api_completion(user_id, random.uniform(0.8, 1.5), 
                                random.randint(3, 10), random.randint(0, 2))
            record_financial_summary(user_id, random.uniform(500, 2000), 
                                   random.uniform(50, 200), random.uniform(5, 15))
        else:  # 20% с ошибками
            record_error(user_id, "Случайная ошибка в тесте")
        
        finish_processing(user_id)
    
    print("✅ Все одновременные обработки завершены")
    
    # Получаем финальную статистику
    final_stats = get_statistics(days=1)
    print(f"\n📊 Финальная статистика:")
    print(f"Всего сессий: {final_stats.get('total_sessions', 0)}")
    print(f"Успешных: {final_stats.get('successful_sessions', 0)}")
    print(f"Процент успеха: {final_stats.get('success_rate', 0):.1f}%")
    print(f"Средняя длительность: {final_stats.get('average_duration', 0):.2f}s")
    
    return final_stats

def main():
    """Основная функция тестирования"""
    print("🔧 Система мониторинга Telegram бота - Тестирование")
    print("=" * 50)
    
    try:
        # Базовые тесты
        test_basic_monitoring()
        
        # Тест одновременной обработки
        test_concurrent_processing()
        
        print("\n🎯 Все тесты прошли успешно!")
        print("✅ Система мониторинга готова к работе")
        
    except Exception as e:
        print(f"\n❌ Ошибка при тестировании: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)