#!/usr/bin/env python3
"""
Скрипт для тестирования удаления поставщика в Monito Web
"""

import requests
import json
import time
import sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

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

def setup_driver():
    """Настройка WebDriver для Selenium"""
    chrome_options = Options()
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    # Уберем headless режим для наблюдения за процессом
    # chrome_options.add_argument("--headless")
    
    try:
        driver = webdriver.Chrome(options=chrome_options)
        return driver
    except Exception as e:
        print(f"Ошибка при инициализации WebDriver: {e}")
        return None

def test_supplier_deletion(supplier_id, supplier_name, price_count):
    """Тестирование удаления поставщика через веб-интерфейс"""
    driver = setup_driver()
    if not driver:
        return False
    
    try:
        print(f"Открываем страницу поставщиков...")
        driver.get(f"{BASE_URL}/admin/suppliers")
        
        # Ждем загрузки страницы
        wait = WebDriverWait(driver, 10)
        
        print(f"Ищем поставщика '{supplier_name}' в таблице...")
        
        # Ищем строку с нашим поставщиком
        supplier_row = None
        try:
            # Пытаемся найти элемент по тексту имени поставщика
            supplier_element = wait.until(
                EC.presence_of_element_located((By.XPATH, f"//td[contains(text(), '{supplier_name}')]"))
            )
            supplier_row = supplier_element.find_element(By.XPATH, "./..")
            print(f"✓ Найден поставщик '{supplier_name}'")
        except Exception as e:
            print(f"✗ Не удалось найти поставщика '{supplier_name}': {e}")
            return False
        
        # Ищем кнопку Delete в этой строке
        try:
            delete_button = supplier_row.find_element(By.XPATH, ".//button[contains(text(), 'Delete') or contains(@class, 'delete')]")
            print(f"✓ Найдена кнопка Delete для поставщика")
        except Exception as e:
            print(f"✗ Не удалось найти кнопку Delete: {e}")
            return False
        
        # Нажимаем кнопку Delete
        print(f"Нажимаем кнопку Delete...")
        delete_button.click()
        
        # Ждем появления модального окна подтверждения
        try:
            modal = wait.until(
                EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'modal') or contains(@role, 'dialog')]"))
            )
            print(f"✓ Появилось модальное окно подтверждения")
            
            # Ищем информацию о количестве удаляемых записей
            modal_text = modal.text
            print(f"Текст модального окна: {modal_text}")
            
            # Ищем кнопку подтверждения
            confirm_button = modal.find_element(By.XPATH, ".//button[contains(text(), 'Delete') or contains(text(), 'Confirm') or contains(text(), 'Yes')]")
            print(f"✓ Найдена кнопка подтверждения")
            
        except Exception as e:
            print(f"✗ Не удалось найти модальное окно подтверждения: {e}")
            return False
        
        # Подтверждаем удаление
        print(f"Подтверждаем удаление...")
        confirm_button.click()
        
        # Ждем некоторое время для обработки удаления
        time.sleep(3)
        
        # Проверяем, что поставщик удален из списка
        try:
            driver.refresh()
            time.sleep(2)
            
            # Пытаемся найти поставщика снова
            try:
                driver.find_element(By.XPATH, f"//td[contains(text(), '{supplier_name}')]")
                print(f"✗ Поставщик '{supplier_name}' все еще присутствует в списке")
                return False
            except:
                print(f"✓ Поставщик '{supplier_name}' успешно удален из списка")
        
        except Exception as e:
            print(f"Ошибка при проверке удаления: {e}")
            return False
        
        return True
        
    except Exception as e:
        print(f"Общая ошибка при тестировании: {e}")
        return False
    
    finally:
        driver.quit()

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
    
    # 3. Тестируем удаление через веб-интерфейс
    print(f"\n3. Тестируем удаление поставщика через веб-интерфейс...")
    success = test_supplier_deletion(supplier_id, supplier_name, price_count)
    
    if not success:
        print("✗ Тестирование удаления не удалось")
        sys.exit(1)
    
    # 4. Проверяем удаление через API
    print(f"\n4. Проверяем удаление через API...")
    api_success = verify_deletion_via_api(supplier_id)
    
    # 5. Финальный отчет
    print(f"\n=== РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ ===")
    print(f"Поставщик: {supplier_name}")
    print(f"ID: {supplier_id}")
    print(f"Количество удаленных price records: {price_count}")
    print(f"Количество удаленных uploads: {upload_count}")
    print(f"Удаление через веб-интерфейс: {'✓ УСПЕШНО' if success else '✗ НЕУДАЧНО'}")
    print(f"Проверка через API: {'✓ УСПЕШНО' if api_success else '✗ НЕУДАЧНО'}")
    
    if success and api_success:
        print(f"\n🎉 ВСЕ ТЕСТЫ ПРОШЛИ УСПЕШНО!")
        print(f"Поставщик '{supplier_name}' и все связанные данные успешно удалены.")
    else:
        print(f"\n❌ НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОШЛИ!")
        sys.exit(1)

if __name__ == "__main__":
    main()