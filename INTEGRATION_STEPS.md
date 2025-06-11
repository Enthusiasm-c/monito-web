# Шаги для полной интеграции всех улучшений

## 1. Включить AI Vision Fallback

### Добавить в .env:
```env
AI_VISION_ENABLED=true
```

## 2. Интегрировать специальные экстракторы

### Модифицировать enhanced_pdf_processor.py:
```python
# Добавить импорты
from island_organics_extractor import extract_island_organics
from valenta_pdf_extractor import extract_valenta_products

# В методе process_pdf добавить проверку:
if 'island organics' in pdf_name.lower():
    return extract_island_organics(pdf_path)
elif 'valenta' in pdf_name.lower():
    return extract_valenta_products(pdf_path)
```

## 3. Сделать Smart Upload основным

### В app/components/FileUpload.tsx изменить:
```typescript
// Изменить endpoint с:
const endpoint = '/api/upload'
// На:
const endpoint = '/api/upload-smart'
```

## 4. Добавить переключатель AI режима в UI

### В FileUpload компоненте добавить:
```typescript
const [useAIMode, setUseAIMode] = useState(false);
const endpoint = useAIMode ? '/api/upload-ai' : '/api/upload-smart';

// Добавить toggle в UI
<Switch
  checked={useAIMode}
  onCheckedChange={setUseAIMode}
  label="Use AI-powered extraction"
/>
```

## 5. Обновить стандартный upload route

### В app/api/upload/route.ts:
```typescript
// Заменить fileProcessor на enhancedFileProcessor
import { enhancedFileProcessor } from '@/app/services/enhancedFileProcessor';
```

## Команды для применения изменений:

```bash
# 1. Включить AI Vision
echo "AI_VISION_ENABLED=true" >> .env

# 2. Перезапустить сервер
npm run dev

# 3. Протестировать на проблемных файлах
```

## Ожидаемый результат:
- Все файлы будут обрабатываться enhanced процессором
- AI Vision автоматически включится для сложных PDF
- Специальные экстракторы будут работать для известных поставщиков
- Пользователи смогут выбирать AI режим для максимальной точности