"use client";

import { useState, useEffect } from 'react';

interface ProcessingStep {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
  timestamp?: string;
  duration?: number;
}

interface ProcessingStatusProps {
  uploadId?: string;
  isProcessing: boolean;
  onComplete?: (success: boolean) => void;
}

export function ProcessingStatus({ uploadId, isProcessing, onComplete }: ProcessingStatusProps) {
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { id: 'upload', name: 'Загрузка файла', status: 'pending' },
    { id: 'validation', name: 'Валидация файла', status: 'pending' },
    { id: 'extraction', name: 'Извлечение данных', status: 'pending' },
    { id: 'ai_processing', name: 'AI обработка', status: 'pending' },
    { id: 'batch_processing', name: 'Батчевая обработка', status: 'pending' },
    { id: 'validation_ai', name: 'AI валидация', status: 'pending' },
    { id: 'storage', name: 'Сохранение результатов', status: 'pending' }
  ]);

  const [currentStep, setCurrentStep] = useState<string>('upload');
  const [progress, setProgress] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    if (isProcessing && !startTime) {
      setStartTime(Date.now());
      setSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));
      setProgress(0);
      setLogs([]);
      
      // Симулируем начальные этапы
      updateStep('upload', 'completed', 'Файл успешно загружен на сервер');
      setTimeout(() => {
        updateStep('validation', 'completed', 'Файл прошел валидацию');
        setCurrentStep('extraction');
        updateStep('extraction', 'processing', 'Извлечение данных из файла...');
      }, 1000);
      
      // Если нет uploadId, показываем общий прогресс
      if (!uploadId) {
        setTimeout(() => {
          updateStep('extraction', 'completed', 'Данные извлечены из файла');
          setCurrentStep('ai_processing');
          updateStep('ai_processing', 'processing', 'AI анализирует данные...');
        }, 3000);
        
        setTimeout(() => {
          updateStep('ai_processing', 'completed', 'AI обработка завершена');
          setCurrentStep('storage');
          updateStep('storage', 'processing', 'Сохранение результатов...');
        }, 8000);
        
        setTimeout(() => {
          updateStep('storage', 'completed', 'Файл успешно обработан');
          setProgress(100);
          addLog('✅ Обработка завершена! Обновите страницу для просмотра результатов');
          onComplete?.(true);
        }, 10000);
      }
    }
  }, [isProcessing, startTime, uploadId]);

  // Мониторинг статуса обработки
  useEffect(() => {
    if (!uploadId || !isProcessing) return;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/uploads/status/${uploadId}`);
        if (response.ok) {
          const data = await response.json();
          updateProgressFromStatus(data);
        }
      } catch (error) {
        console.error('Error polling status:', error);
        addLog('❌ Ошибка при получении статуса');
      }
    };

    // Проверяем статус сразу
    pollStatus();
    
    // И затем каждые 2 секунды
    const interval = setInterval(pollStatus, 2000);
    return () => clearInterval(interval);
  }, [uploadId, isProcessing]);

  const updateStep = (stepId: string, status: ProcessingStep['status'], message?: string) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { 
            ...step, 
            status, 
            message,
            timestamp: new Date().toLocaleTimeString(),
            duration: startTime ? Date.now() - startTime : undefined
          }
        : step
    ));
    
    if (status === 'completed') {
      const stepIndex = steps.findIndex(s => s.id === stepId);
      setProgress(((stepIndex + 1) / steps.length) * 100);
    }
    
    if (message) {
      addLog(`${getStepIcon(status)} ${message}`);
    }
  };

  const updateProgressFromStatus = (uploadData: any) => {
    if (uploadData.status === 'processing') {
      // Извлечение данных
      if (uploadData.totalRowsDetected && currentStep === 'extraction') {
        updateStep('extraction', 'completed', `Извлечено ${uploadData.totalRowsDetected} записей`);
        setCurrentStep('ai_processing');
        updateStep('ai_processing', 'processing', 'Началась AI обработка...');
      }
      
      // AI обработка
      if (uploadData.extractedData?.aiDecision && currentStep === 'ai_processing') {
        const aiDecision = uploadData.extractedData.aiDecision;
        updateStep('ai_processing', 'completed', `AI обработка завершена: ${aiDecision.products?.length || 0} продуктов`);
        
        if (aiDecision.products?.length > 50) {
          setCurrentStep('batch_processing');
          updateStep('batch_processing', 'processing', `Батчевая обработка ${aiDecision.products.length} продуктов...`);
        } else {
          setCurrentStep('validation_ai');
        }
      }
    } else if (uploadData.status === 'pending_review') {
      // Завершение обработки - показать все этапы как завершенные
      updateStep('extraction', 'completed', `Извлечено ${uploadData.totalRowsDetected || 'данные'}`);
      updateStep('ai_processing', 'completed', `AI обработка завершена: ${uploadData.totalRowsProcessed || 0} продуктов`);
      updateStep('batch_processing', 'completed', 'Батчевая обработка завершена');
      updateStep('validation_ai', 'completed', 'AI валидация завершена');
      updateStep('storage', 'completed', 'Результаты сохранены в режиме ожидания модерации');
      setProgress(100);
      addLog('✅ Обработка завершена! Файл отправлен на модерацию в админку.');
      
      // Не закрываем автоматически - пусть пользователь видит результат
    } else if (uploadData.status === 'failed') {
      const currentStepData = steps.find(s => s.id === currentStep);
      if (currentStepData) {
        updateStep(currentStep, 'error', uploadData.errorMessage || 'Ошибка обработки');
      }
      addLog(`❌ Ошибка: ${uploadData.errorMessage || 'Неизвестная ошибка'}`);
      onComplete?.(false);
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const getStepIcon = (status: ProcessingStep['status']) => {
    switch (status) {
      case 'completed': return '✅';
      case 'processing': return '🔄';
      case 'error': return '❌';
      default: return '⏳';
    }
  };

  const getStepColor = (status: ProcessingStep['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'processing': return 'text-blue-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-400';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    return `(${Math.round(ms / 1000)}s)`;
  };

  if (!isProcessing && progress === 0) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Статус обработки файла
          </h3>
          <div className="text-sm text-gray-500">
            {progress.toFixed(0)}%
          </div>
        </div>

        {/* Прогресс бар */}
        <div className="mb-6">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Этапы */}
        <div className="space-y-3 mb-6">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <span className={`text-lg ${getStepColor(step.status)}`}>
                  {getStepIcon(step.status)}
                </span>
              </div>
              <div className="flex-1">
                <div className={`font-medium ${getStepColor(step.status)}`}>
                  {step.name}
                </div>
                {step.message && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {step.message} {formatDuration(step.duration)}
                  </div>
                )}
              </div>
              {step.timestamp && (
                <div className="text-xs text-gray-400">
                  {step.timestamp}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Лог */}
        {logs.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Детальный лог:
            </h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="text-xs font-mono text-gray-600 dark:text-gray-400">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Кнопка закрытия (только если завершено) */}
        {(progress === 100 || steps.some(s => s.status === 'error')) && (
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={() => {
                window.location.reload();
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Обновить страницу
            </button>
            <button
              onClick={() => onComplete?.(progress === 100)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Закрыть
            </button>
          </div>
        )}
      </div>
    </div>
  );
}