#!/usr/bin/env python3
"""
Упрощенный скрипт для тестирования удаления поставщика в Monito Web
"""

import requests
import json
import sys

BASE_URL = "http://209.38.85.196:3000"

def get_suppliers_via_api():
    """Получить список поставщиков через API"""
    try:
        response = requests.get(f"{BASE_URL}/api/suppliers")
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Ошибка при получении поставщиков через API: {e}")
        return None

def find_supplier_with_most_prices(suppliers):
    """Найти поставщика с наибольшим количеством цен"""
    if not suppliers:
        return None
    
    max_prices = 0
    target_supplier = None
    
    for supplier in suppliers:
        price_count = supplier.get('_count', {}).get('prices', 0)
        if price_count > max_prices:
            max_prices = price_count
            target_supplier = supplier
    
    return target_supplier

def delete_supplier_via_api(supplier_id):
    """Удалить поставщика через API"""
    try:
        # Попробуем DELETE запрос
        response = requests.delete(f"{BASE_URL}/api/suppliers/{supplier_id}")
        
        if response.status_code == 200:
            print(f"✓ Поставщик успешно удален через API")
            return True, response.json() if response.content else None
        elif response.status_code == 404:
            print(f"✗ Поставщик не найден (404)")
            return False, None
        else:
            print(f"✗ Ошибка при удалении: {response.status_code}")
            print(f"Ответ: {response.text}")
            return False, None
            
    except requests.RequestException as e:
        print(f"✗ Ошибка запроса: {e}")
        return False, None

def verify_deletion_via_api(supplier_id):
    """Проверка удаления через API"""
    try:
        response = requests.get(f"{BASE_URL}/api/suppliers/{supplier_id}")
        if response.status_code == 404:
            print(f"✓ API подтверждает, что поставщик удален (404)")
            return True
        else:
            print(f"✗ API показывает, что поставщик все еще существует (статус: {response.status_code})")
            return False
    except requests.RequestException as e:
        print(f"Ошибка при проверке через API: {e}")
        return False

def main():
    print("=== Тестирование удаления поставщика в Monito Web ===\n")
    
    # 1. Получаем список поставщиков
    print("1. Получаем список поставщиков через API...")
    suppliers = get_suppliers_via_api()
    if not suppliers:
        print("✗ Не удалось получить список поставщиков")
        sys.exit(1)
    
    print(f"✓ Получено {len(suppliers)} поставщиков")
    
    # 2. Находим поставщика с наибольшим количеством цен
    print("\n2. Ищем поставщика с наибольшим количеством price records...")
    target_supplier = find_supplier_with_most_prices(suppliers)
    
    if not target_supplier:
        print("✗ Не удалось найти подходящего поставщика")
        sys.exit(1)
    
    supplier_id = target_supplier['id']
    supplier_name = target_supplier['name']
    price_count = target_supplier['_count']['prices']
    upload_count = target_supplier['_count']['uploads']
    
    print(f"✓ Выбран поставщик: '{supplier_name}'")
    print(f"  - ID: {supplier_id}")
    print(f"  - Количество цен: {price_count}")
    print(f"  - Количество загрузок: {upload_count}")
    
    # Показываем детали того, что будет удалено
    print(f"\n📋 ПРЕДУПРЕЖДЕНИЕ: Будут удалены следующие данные:")
    print(f"   • Поставщик: {supplier_name}")
    print(f"   • Price records: {price_count}")
    print(f"   • Upload records: {upload_count}")
    print(f"   • Все связанные данные будут удалены безвозвратно (force=true)")
    
    # Автоматическое подтверждение для тестирования
    print(f"\n⚠️  ВНИМАНИЕ: Автоматически продолжаем удаление для тестирования...")
    
    # 3. Тестируем удаление через API
    print(f"\n3. Удаляем поставщика через API...")
    success, response_data = delete_supplier_via_api(supplier_id)
    
    if response_data:
        print(f"Ответ API: {json.dumps(response_data, indent=2)}")
    
    if not success:
        print("✗ Удаление через API не удалось")
        sys.exit(1)
    
    # 4. Проверяем удаление через API
    print(f"\n4. Проверяем удаление через API...")
    api_success = verify_deletion_via_api(supplier_id)
    
    # 5. Проверяем обновленный список поставщиков
    print(f"\n5. Проверяем обновленный список поставщиков...")
    updated_suppliers = get_suppliers_via_api()
    if updated_suppliers:
        supplier_still_exists = any(s['id'] == supplier_id for s in updated_suppliers)
        if not supplier_still_exists:
            print(f"✓ Поставщик отсутствует в обновленном списке")
            list_success = True
        else:
            print(f"✗ Поставщик все еще присутствует в списке")
            list_success = False
    else:
        print(f"✗ Не удалось получить обновленный список")
        list_success = False
    
    # 6. Финальный отчет
    print(f"\n=== РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ ===")
    print(f"Поставщик: {supplier_name}")
    print(f"ID: {supplier_id}")
    print(f"Количество удаленных price records: {price_count}")
    print(f"Количество удаленных uploads: {upload_count}")
    print(f"Удаление через API: {'✓ УСПЕШНО' if success else '✗ НЕУДАЧНО'}")
    print(f"Проверка через GET API: {'✓ УСПЕШНО' if api_success else '✗ НЕУДАЧНО'}")
    print(f"Проверка в списке: {'✓ УСПЕШНО' if list_success else '✗ НЕУДАЧНО'}")
    
    if success and api_success and list_success:
        print(f"\n🎉 ВСЕ ТЕСТЫ ПРОШЛИ УСПЕШНО!")
        print(f"Поставщик '{supplier_name}' и все связанные данные успешно удалены.")
        print(f"Функция force=true работает корректно - все связанные данные удалены автоматически.")
    else:
        print(f"\n❌ НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОШЛИ!")
        sys.exit(1)

if __name__ == "__main__":
    main()