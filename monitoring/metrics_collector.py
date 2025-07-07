"""
Система мониторинга для Telegram бота
Отслеживает метрики обработки счетов-фактур
"""

import time
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
import asyncio
from pathlib import Path

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class ProcessingMetrics:
    """Метрики обработки счета-фактуры"""
    user_id: int
    restaurant_name: str
    processing_start: float
    processing_end: Optional[float] = None
    ocr_duration: Optional[float] = None
    api_duration: Optional[float] = None
    total_duration: Optional[float] = None
    products_extracted: int = 0
    products_compared: int = 0
    products_not_found: int = 0
    total_invoice_amount: float = 0.0
    total_savings: float = 0.0
    savings_percentage: float = 0.0
    ocr_confidence: Optional[float] = None
    error_occurred: bool = False
    error_message: Optional[str] = None
    supplier_name: Optional[str] = None
    invoice_date: Optional[str] = None
    
    def to_dict(self) -> Dict:
        """Преобразование в словарь для JSON сериализации"""
        return asdict(self)

class MetricsCollector:
    """Коллектор метрик для мониторинга бота"""
    
    def __init__(self, metrics_file: str = "bot_metrics.json"):
        self.metrics_file = Path(metrics_file)
        self.current_sessions: Dict[int, ProcessingMetrics] = {}
        self.user_restaurant_mapping: Dict[int, str] = {
            # Здесь можно добавить маппинг user_id -> restaurant_name
            # Например: 123456789: "Ресторан 'Вкусная Еда'"
        }
        
        # Создаем директорию если не существует
        self.metrics_file.parent.mkdir(parents=True, exist_ok=True)
    
    def get_restaurant_name(self, user_id: int) -> str:
        """Получение названия ресторана по user_id"""
        return self.user_restaurant_mapping.get(user_id, f"User_{user_id}")
    
    def start_processing(self, user_id: int) -> ProcessingMetrics:
        """Начало обработки счета-фактуры"""
        restaurant_name = self.get_restaurant_name(user_id)
        
        metrics = ProcessingMetrics(
            user_id=user_id,
            restaurant_name=restaurant_name,
            processing_start=time.time()
        )
        
        self.current_sessions[user_id] = metrics
        logger.info(f"Started processing for user {user_id} ({restaurant_name})")
        
        return metrics
    
    def record_ocr_completion(self, user_id: int, duration: float, products_count: int, 
                             confidence: Optional[float] = None, 
                             supplier_name: Optional[str] = None,
                             invoice_date: Optional[str] = None):
        """Записать завершение OCR обработки"""
        if user_id not in self.current_sessions:
            logger.warning(f"No active session for user {user_id}")
            return
            
        metrics = self.current_sessions[user_id]
        metrics.ocr_duration = duration
        metrics.products_extracted = products_count
        metrics.ocr_confidence = confidence
        metrics.supplier_name = supplier_name
        metrics.invoice_date = invoice_date
        
        logger.info(f"OCR completed for user {user_id}: {products_count} products, "
                   f"duration: {duration:.2f}s, confidence: {confidence}")
    
    def record_api_completion(self, user_id: int, duration: float, 
                             products_compared: int, products_not_found: int):
        """Записать завершение API сравнения"""
        if user_id not in self.current_sessions:
            logger.warning(f"No active session for user {user_id}")
            return
            
        metrics = self.current_sessions[user_id]
        metrics.api_duration = duration
        metrics.products_compared = products_compared
        metrics.products_not_found = products_not_found
        
        logger.info(f"API comparison completed for user {user_id}: "
                   f"{products_compared} compared, {products_not_found} not found, "
                   f"duration: {duration:.2f}s")
    
    def record_financial_summary(self, user_id: int, total_amount: float, 
                                total_savings: float, savings_percentage: float):
        """Записать финансовую сводку"""
        if user_id not in self.current_sessions:
            logger.warning(f"No active session for user {user_id}")
            return
            
        metrics = self.current_sessions[user_id]
        metrics.total_invoice_amount = total_amount
        metrics.total_savings = total_savings
        metrics.savings_percentage = savings_percentage
        
        logger.info(f"Financial summary for user {user_id}: "
                   f"total: {total_amount:.2f}, savings: {total_savings:.2f} "
                   f"({savings_percentage:.1f}%)")
    
    def record_error(self, user_id: int, error_message: str):
        """Записать ошибку обработки"""
        if user_id not in self.current_sessions:
            logger.warning(f"No active session for user {user_id}")
            return
            
        metrics = self.current_sessions[user_id]
        metrics.error_occurred = True
        metrics.error_message = error_message
        
        logger.error(f"Error recorded for user {user_id}: {error_message}")
    
    def finish_processing(self, user_id: int) -> Optional[ProcessingMetrics]:
        """Завершить обработку и сохранить метрики"""
        if user_id not in self.current_sessions:
            logger.warning(f"No active session for user {user_id}")
            return None
            
        metrics = self.current_sessions[user_id]
        metrics.processing_end = time.time()
        metrics.total_duration = metrics.processing_end - metrics.processing_start
        
        # Сохранить метрики
        self._save_metrics(metrics)
        
        # Удалить из активных сессий
        del self.current_sessions[user_id]
        
        logger.info(f"Processing completed for user {user_id}: "
                   f"total duration: {metrics.total_duration:.2f}s")
        
        return metrics
    
    def _save_metrics(self, metrics: ProcessingMetrics):
        """Сохранить метрики в файл"""
        try:
            # Загрузить существующие метрики
            existing_metrics = []
            if self.metrics_file.exists():
                with open(self.metrics_file, 'r', encoding='utf-8') as f:
                    existing_metrics = json.load(f)
            
            # Добавить новые метрики
            existing_metrics.append(metrics.to_dict())
            
            # Сохранить обновленные метрики
            with open(self.metrics_file, 'w', encoding='utf-8') as f:
                json.dump(existing_metrics, f, ensure_ascii=False, indent=2)
                
            logger.info(f"Metrics saved to {self.metrics_file}")
            
        except Exception as e:
            logger.error(f"Failed to save metrics: {e}")
    
    def get_statistics(self, days: int = 7) -> Dict[str, Any]:
        """Получить статистику за указанное количество дней"""
        try:
            if not self.metrics_file.exists():
                return {}
                
            with open(self.metrics_file, 'r', encoding='utf-8') as f:
                all_metrics = json.load(f)
            
            # Фильтровать по дням
            cutoff_time = time.time() - (days * 24 * 60 * 60)
            recent_metrics = [
                m for m in all_metrics 
                if m.get('processing_start', 0) >= cutoff_time
            ]
            
            if not recent_metrics:
                return {}
            
            # Вычислить статистику
            total_sessions = len(recent_metrics)
            successful_sessions = len([m for m in recent_metrics if not m.get('error_occurred', False)])
            total_products = sum(m.get('products_extracted', 0) for m in recent_metrics)
            total_savings = sum(m.get('total_savings', 0) for m in recent_metrics)
            avg_duration = sum(m.get('total_duration', 0) for m in recent_metrics) / total_sessions if total_sessions > 0 else 0
            
            # Статистика по ресторанам
            restaurant_stats = {}
            for m in recent_metrics:
                restaurant = m.get('restaurant_name', 'Unknown')
                if restaurant not in restaurant_stats:
                    restaurant_stats[restaurant] = {
                        'sessions': 0,
                        'products': 0,
                        'savings': 0,
                        'avg_duration': 0
                    }
                restaurant_stats[restaurant]['sessions'] += 1
                restaurant_stats[restaurant]['products'] += m.get('products_extracted', 0)
                restaurant_stats[restaurant]['savings'] += m.get('total_savings', 0)
                restaurant_stats[restaurant]['avg_duration'] += m.get('total_duration', 0)
            
            # Усредняем длительность для каждого ресторана
            for restaurant in restaurant_stats:
                if restaurant_stats[restaurant]['sessions'] > 0:
                    restaurant_stats[restaurant]['avg_duration'] /= restaurant_stats[restaurant]['sessions']
            
            return {
                'period_days': days,
                'total_sessions': total_sessions,
                'successful_sessions': successful_sessions,
                'success_rate': (successful_sessions / total_sessions * 100) if total_sessions > 0 else 0,
                'total_products_processed': total_products,
                'total_savings': total_savings,
                'average_duration': avg_duration,
                'restaurant_statistics': restaurant_stats
            }
            
        except Exception as e:
            logger.error(f"Failed to get statistics: {e}")
            return {}
    
    def add_user_restaurant_mapping(self, user_id: int, restaurant_name: str):
        """Добавить маппинг пользователя к ресторану"""
        self.user_restaurant_mapping[user_id] = restaurant_name
        logger.info(f"Added mapping: user {user_id} -> '{restaurant_name}'")
    
    def get_active_sessions(self) -> Dict[int, ProcessingMetrics]:
        """Получить активные сессии"""
        return self.current_sessions.copy()

# Глобальный экземпляр коллектора
metrics_collector = MetricsCollector()

# Функции для удобного использования
def start_processing(user_id: int) -> ProcessingMetrics:
    """Начать отслеживание обработки"""
    return metrics_collector.start_processing(user_id)

def record_ocr_completion(user_id: int, duration: float, products_count: int, 
                         confidence: Optional[float] = None, 
                         supplier_name: Optional[str] = None,
                         invoice_date: Optional[str] = None):
    """Записать завершение OCR"""
    return metrics_collector.record_ocr_completion(
        user_id, duration, products_count, confidence, supplier_name, invoice_date
    )

def record_api_completion(user_id: int, duration: float, 
                         products_compared: int, products_not_found: int):
    """Записать завершение API сравнения"""
    return metrics_collector.record_api_completion(
        user_id, duration, products_compared, products_not_found
    )

def record_financial_summary(user_id: int, total_amount: float, 
                            total_savings: float, savings_percentage: float):
    """Записать финансовую сводку"""
    return metrics_collector.record_financial_summary(
        user_id, total_amount, total_savings, savings_percentage
    )

def record_error(user_id: int, error_message: str):
    """Записать ошибку"""
    return metrics_collector.record_error(user_id, error_message)

def finish_processing(user_id: int) -> Optional[ProcessingMetrics]:
    """Завершить отслеживание"""
    return metrics_collector.finish_processing(user_id)

def get_statistics(days: int = 7) -> Dict[str, Any]:
    """Получить статистику"""
    return metrics_collector.get_statistics(days)

def add_user_restaurant_mapping(user_id: int, restaurant_name: str):
    """Добавить маппинг пользователя к ресторану"""
    return metrics_collector.add_user_restaurant_mapping(user_id, restaurant_name)