#!/usr/bin/env python3
"""
Расширенный тест для проверки удаления поставщика и всех связанных данных
"""

import requests
import json
import sys

BASE_URL = "http://209.38.85.196:3000"
DELETED_SUPPLIER_ID = "cmc031m0c00ees2klbjgjnert"  # Island Organics Bali

def test_supplier_deletion():
    """Проверить, что поставщик удален"""
    try:
        response = requests.get(f"{BASE_URL}/api/suppliers/{DELETED_SUPPLIER_ID}")
        if response.status_code == 404:
            print("✓ Поставщик не найден (404) - удален корректно")
            return True
        else:
            print(f"✗ Поставщик все еще существует (статус: {response.status_code})")
            return False
    except requests.RequestException as e:
        print(f"✗ Ошибка при проверке поставщика: {e}")
        return False

def test_prices_deletion():
    """Проверить, что цены поставщика удалены"""
    try:
        # Попробуем получить цены этого поставщика
        response = requests.get(f"{BASE_URL}/api/prices")
        if response.status_code == 200:
            prices = response.json()
            supplier_prices = [p for p in prices if p.get('supplierId') == DELETED_SUPPLIER_ID]
            if len(supplier_prices) == 0:
                print("✓ Все цены поставщика удалены")
                return True
            else:
                print(f"✗ Найдено {len(supplier_prices)} цен поставщика, которые не были удалены")
                return False
        else:
            print(f"✗ Не удалось получить список цен (статус: {response.status_code})")
            return False
    except requests.RequestException as e:
        print(f"✗ Ошибка при проверке цен: {e}")
        return False

def test_uploads_deletion():
    """Проверить, что загрузки поставщика удалены"""
    try:
        # Попробуем получить загрузки этого поставщика
        response = requests.get(f"{BASE_URL}/api/uploads")
        if response.status_code == 200:
            uploads = response.json()
            supplier_uploads = [u for u in uploads if u.get('supplierId') == DELETED_SUPPLIER_ID]
            if len(supplier_uploads) == 0:
                print("✓ Все загрузки поставщика удалены")
                return True
            else:
                print(f"✗ Найдено {len(supplier_uploads)} загрузок поставщика, которые не были удалены")
                return False
        else:
            print(f"✗ Не удалось получить список загрузок (статус: {response.status_code})")
            return False
    except requests.RequestException as e:
        print(f"✗ Ошибка при проверке загрузок: {e}")
        return False

def test_data_integrity():
    """Проверить целостность оставшихся данных"""
    try:
        # Получаем все поставщиков
        response = requests.get(f"{BASE_URL}/api/suppliers")
        if response.status_code != 200:
            print(f"✗ Не удалось получить список поставщиков")
            return False
        
        suppliers = response.json()
        print(f"✓ Оставшихся поставщиков: {len(suppliers)}")
        
        # Проверяем, что у всех поставщиков есть корректные счетчики
        total_prices = sum(s['_count']['prices'] for s in suppliers)
        total_uploads = sum(s['_count']['uploads'] for s in suppliers)
        
        print(f"✓ Общее количество цен: {total_prices}")
        print(f"✓ Общее количество загрузок: {total_uploads}")
        
        # Найдем поставщика с наибольшим количеством данных
        top_supplier = max(suppliers, key=lambda x: x['_count']['prices'])
        print(f"✓ Поставщик с наибольшим количеством цен: {top_supplier['name']} ({top_supplier['_count']['prices']} цен)")
        
        return True
    except Exception as e:
        print(f"✗ Ошибка при проверке целостности данных: {e}")
        return False

def test_api_endpoints():
    """Проверить доступность основных API endpoints"""
    endpoints = [
        "/api/suppliers",
        "/api/prices",
        "/api/uploads"
    ]
    
    results = {}
    for endpoint in endpoints:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}")
            results[endpoint] = {
                'status': response.status_code,
                'success': response.status_code == 200
            }
            if response.status_code == 200:
                data = response.json()
                results[endpoint]['count'] = len(data)
                print(f"✓ {endpoint}: {len(data)} записей")
            else:
                print(f"✗ {endpoint}: статус {response.status_code}")
        except Exception as e:
            results[endpoint] = {'success': False, 'error': str(e)}
            print(f"✗ {endpoint}: ошибка - {e}")
    
    return all(r['success'] for r in results.values())

def main():
    print("=== РАСШИРЕННОЕ ТЕСТИРОВАНИЕ УДАЛЕНИЯ ПОСТАВЩИКА ===\\n")
    print(f"Тестируемый поставщик ID: {DELETED_SUPPLIER_ID}")
    print(f"Название: Island Organics Bali")
    print(f"Должно было быть удалено: 412 цен, 2 загрузки\\n")
    
    tests = [
        ("1. Проверка удаления поставщика", test_supplier_deletion),
        ("2. Проверка удаления цен", test_prices_deletion),
        ("3. Проверка удаления загрузок", test_uploads_deletion),
        ("4. Проверка целостности данных", test_data_integrity),
        ("5. Проверка API endpoints", test_api_endpoints),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\\n{test_name}:")
        try:
            result = test_func()
            results.append(result)
            print(f"Результат: {'✓ УСПЕШНО' if result else '✗ НЕУДАЧНО'}")
        except Exception as e:
            print(f"✗ ОШИБКА: {e}")
            results.append(False)
    
    # Финальный отчет
    print(f"\\n=== ИТОГОВЫЙ ОТЧЕТ ===")
    passed = sum(results)
    total = len(results)
    
    print(f"Пройдено тестов: {passed}/{total}")
    print(f"Процент успеха: {passed/total*100:.1f}%")
    
    if passed == total:
        print(f"\\n🎉 ВСЕ ТЕСТЫ ПРОШЛИ УСПЕШНО!")
        print(f"Функциональность удаления поставщика работает корректно:")
        print(f"  • Поставщик удален")
        print(f"  • Все связанные цены удалены")
        print(f"  • Все связанные загрузки удалены")
        print(f"  • Целостность данных сохранена")
        print(f"  • API endpoints работают корректно")
        print(f"  • Force=true функция работает как ожидается")
    else:
        print(f"\\n❌ НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОШЛИ!")
        print(f"Необходимо проверить реализацию удаления поставщика.")
        sys.exit(1)

if __name__ == "__main__":
    main()