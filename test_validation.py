import json
import sys
import os
from dotenv import load_dotenv

# Загрузить переменные окружения
load_dotenv()

# Добавим путь к скриптам
sys.path.append('scripts')

from ai_product_validator import AIProductValidator

# Тестовые данные
test_products = [
    {"name": "10", "price": 610.5, "unit": "6 x 500 gr"},
    {"name": "Italian Grana Padano Cheese", "price": 316.35, "unit": "kg"},
    {"name": "2 x 1 kg", "price": 150.0, "unit": "pcs"}
]

api_key = os.getenv('OPENAI_API_KEY')
if not api_key:
    print("No API key found")
    sys.exit(1)

try:
    validator = AIProductValidator(api_key)
    validated_products, stats = validator.validate_products_batch(test_products, "Test Supplier")
    
    print(f"✅ Validation completed!")
    print(f"Original: {len(test_products)} products")
    print(f"Valid: {len(validated_products)} products")
    print(f"Stats: {stats}")
    
    for product in validated_products:
        print(f"- {product['name']} (${product['price']})")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()