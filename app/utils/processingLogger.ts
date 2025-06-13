import { sendProcessingUpdate } from '@/app/api/uploads/status/[id]/stream/route';

export interface ProcessingStep {
  step: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
}

/**
 * Logger for sending real-time processing updates
 */
export class ProcessingLogger {
  private uploadId: string;
  
  constructor(uploadId: string) {
    this.uploadId = uploadId;
  }
  
  /**
   * Log a processing step update
   */
  logStep(step: string, status: ProcessingStep['status'], message?: string) {
    try {
      // Send to SSE stream if connected
      sendProcessingUpdate(this.uploadId, {
        step,
        status,
        message,
      });
      
      // Also log to console for debugging
      const icon = this.getStatusIcon(status);
      console.log(`${icon} [${this.uploadId}] ${step}: ${message || status}`);
    } catch (error) {
      console.error('Failed to send processing update:', error);
    }
  }
  
  /**
   * Convenience methods
   */
  startStep(step: string, message?: string) {
    this.logStep(step, 'processing', message);
  }
  
  completeStep(step: string, message?: string) {
    this.logStep(step, 'completed', message);
  }
  
  errorStep(step: string, message: string) {
    this.logStep(step, 'error', message);
  }
  
  /**
   * Log extraction progress
   */
  logExtraction(current: number, total: number, method?: string) {
    const message = method 
      ? `Извлечение данных методом ${method}: ${current}/${total}`
      : `Извлечено ${current} из ${total} записей`;
    this.logStep('extraction', 'processing', message);
  }
  
  /**
   * Log AI processing progress
   */
  logAIProcessing(message: string) {
    this.logStep('ai_processing', 'processing', message);
  }
  
  /**
   * Log validation progress
   */
  logValidation(valid: number, total: number) {
    this.logStep('validation', 'processing', `Проверено ${valid} из ${total} продуктов`);
  }
  
  private getStatusIcon(status: ProcessingStep['status']): string {
    switch (status) {
      case 'completed':
        return '✅';
      case 'processing':
        return '🔄';
      case 'error':
        return '❌';
      default:
        return '⏳';
    }
  }
}

/**
 * Create a processing logger instance
 */
export function createProcessingLogger(uploadId: string): ProcessingLogger {
  return new ProcessingLogger(uploadId);
}