import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../../../../services/DatabaseService';
import { asyncHandler } from '../../../../../../utils/errors';

export const GET = asyncHandler(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
    const params = await context.params;
    const uploadId = params.id;

    const upload = await databaseService.getUploadById(uploadId);

    if (!upload) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      );
    }

    // Вычисляем детальный статус
    const detailedStatus = {
      id: upload.id,
      originalName: upload.originalName,
      status: upload.status,
      approvalStatus: upload.approvalStatus,
      supplier: upload.supplier,
      
      // Метрики обработки
      totalRowsDetected: upload.totalRowsDetected,
      totalRowsProcessed: upload.totalRowsProcessed,
      completenessRatio: upload.completenessRatio,
      processingTimeMs: upload.processingTimeMs,
      tokensUsed: upload.tokensUsed,
      processingCostUsd: upload.processingCostUsd,
      
      // AI данные если есть
      extractedData: upload.extractedData,
      errorMessage: upload.errorMessage,
      
      // Временные метки
      createdAt: upload.createdAt,
      updatedAt: upload.updatedAt,
      
      // Расчет прогресса
      progress: calculateProgress(upload),
      
      // Текущий этап
      currentStage: getCurrentStage(upload),
      
      // Время обработки
      processingDuration: upload.createdAt ? Date.now() - new Date(upload.createdAt).getTime() : 0
    };

    return NextResponse.json(detailedStatus);

  });

function calculateProgress(upload: any): number {
  if (upload.status === 'failed') return 0;
  if (upload.status === 'pending_review' || upload.status === 'completed') return 100;
  
  let progress = 0;
  
  // Файл загружен
  if (upload.id) progress += 10;
  
  // Началась обработка
  if (upload.status === 'processing') progress += 20;
  
  // Есть извлеченные данные
  if (upload.totalRowsDetected) progress += 30;
  
  // Есть AI решения
  if (upload.extractedData?.aiDecision) progress += 30;
  
  // Завершена обработка
  if (upload.totalRowsProcessed) progress += 10;
  
  return Math.min(progress, 90); // Максимум 90% до полного завершения
}

function getCurrentStage(upload: any): string {
  if (upload.status === 'failed') return 'error';
  if (upload.status === 'pending_review') return 'completed';
  if (upload.status === 'completed') return 'completed';
  
  if (!upload.totalRowsDetected) return 'extraction';
  if (!upload.extractedData?.aiDecision) return 'ai_processing';
  if (!upload.totalRowsProcessed) return 'validation';
  
  return 'storage';
}