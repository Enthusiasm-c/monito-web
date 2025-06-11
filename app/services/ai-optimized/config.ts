/**
 * Configuration for AI model selection based on task complexity
 */

export interface ModelConfig {
  model: 'o3' | 'o3-mini' | 'gpt-4.1-mini';
  maxTokens: number;
  costPerKTokenInput: number;
  costPerKTokenOutput: number;
}

export interface TaskConfig {
  taskType: string;
  description: string;
  recommendedModel: ModelConfig;
  fallbackModel?: ModelConfig;
}

// Model configurations
export const MODELS: Record<string, ModelConfig> = {
  'o3': {
    model: 'o3',
    maxTokens: 4096,
    costPerKTokenInput: 0.06,
    costPerKTokenOutput: 0.24
  },
  'o3-mini': {
    model: 'o3-mini',
    maxTokens: 4096,
    costPerKTokenInput: 0.003,
    costPerKTokenOutput: 0.012
  },
  'gpt-4.1-mini': {
    model: 'gpt-4.1-mini',
    maxTokens: 4096,
    costPerKTokenInput: 0.00015,
    costPerKTokenOutput: 0.0006
  }
};

// Task-based model selection
export const TASK_CONFIGS: Record<string, TaskConfig> = {
  // Document processing tasks
  'simple_text_extraction': {
    taskType: 'simple_text_extraction',
    description: 'Extract structured data from clear text documents',
    recommendedModel: MODELS['gpt-4.1-mini']
  },
  
  'complex_pdf_extraction': {
    taskType: 'complex_pdf_extraction',
    description: 'Extract data from complex PDFs with tables and mixed layouts',
    recommendedModel: MODELS['o3'],
    fallbackModel: MODELS['o3']
  },
  
  'image_extraction': {
    taskType: 'image_extraction',
    description: 'Extract data from images using vision capabilities',
    recommendedModel: MODELS['o3'], // Vision requires full model
    fallbackModel: MODELS['o3']
  },
  
  // Normalization tasks
  'basic_normalization': {
    taskType: 'basic_normalization',
    description: 'Normalize product names and units',
    recommendedModel: MODELS['gpt-4.1-mini']
  },
  
  'advanced_normalization': {
    taskType: 'advanced_normalization',
    description: 'Complex normalization with brand detection and categorization',
    recommendedModel: MODELS['gpt-4.1-mini'] // Still efficient for this task
  },
  
  // Matching tasks
  'product_matching': {
    taskType: 'product_matching',
    description: 'Match products with existing database',
    recommendedModel: MODELS['gpt-4.1-mini']
  },
  
  'fuzzy_matching': {
    taskType: 'fuzzy_matching',
    description: 'Complex matching with low confidence thresholds',
    recommendedModel: MODELS['o3']
  }
};

// Document complexity analyzer
export function analyzeDocumentComplexity(
  fileType: string,
  pageCount?: number,
  hasImages?: boolean,
  hasComplexTables?: boolean
): 'low' | 'medium' | 'high' {
  // Images always require higher complexity
  if (hasImages || fileType.includes('image')) {
    return 'high';
  }
  
  // PDFs with many pages or complex tables
  if (fileType === 'pdf' && (pageCount && pageCount > 10 || hasComplexTables)) {
    return 'high';
  }
  
  // Excel files are usually medium complexity
  if (fileType.includes('excel') || fileType.includes('xlsx')) {
    return 'medium';
  }
  
  // CSV and simple text files
  if (fileType === 'csv' || fileType === 'txt') {
    return 'low';
  }
  
  return 'medium';
}

// Smart model selector
export function selectOptimalModel(
  taskType: string,
  complexity: 'low' | 'medium' | 'high',
  budgetMode: boolean = false
): ModelConfig {
  const taskConfig = TASK_CONFIGS[taskType];
  
  if (!taskConfig) {
    // Default to economical model for unknown tasks
    return MODELS['gpt-4.1-mini'];
  }
  
  // In budget mode, always use the cheapest viable option
  if (budgetMode) {
    return taskType.includes('image') || taskType.includes('vision') 
      ? MODELS['o3'] // Vision requires full model
      : MODELS['gpt-4.1-mini'];
  }
  
  // For high complexity, consider using fallback model
  if (complexity === 'high' && taskConfig.fallbackModel) {
    return taskConfig.fallbackModel;
  }
  
  // For low complexity, always use the most economical model
  if (complexity === 'low' && !taskType.includes('image')) {
    return MODELS['gpt-4.1-mini'];
  }
  
  return taskConfig.recommendedModel;
}

// Cost estimator
export function estimateProcessingCost(
  model: ModelConfig,
  estimatedInputTokens: number,
  estimatedOutputTokens: number
): number {
  const inputCost = (estimatedInputTokens / 1000) * model.costPerKTokenInput;
  const outputCost = (estimatedOutputTokens / 1000) * model.costPerKTokenOutput;
  return inputCost + outputCost;
}

// Processing limits
export const PROCESSING_LIMITS = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxProductsPerBatch: 50,
  maxPagesPerPDF: 20,
  maxConcurrentRequests: 3,
  cacheExpirationHours: 24,
  maxRetries: 3
};

// Feature flags
export const FEATURES = {
  enableCaching: true,
  enableBudgetMode: false, // Can be toggled based on usage
  enableAutoApproval: false,
  enableBatchProcessing: true,
  enableSmartRouting: true,
  logTokenUsage: true
};