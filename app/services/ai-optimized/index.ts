export { unifiedAIProcessor } from './UnifiedAIProcessor';
export { aiDataNormalizer } from './AIDataNormalizer';
export { aiProductMatcher } from './AIProductMatcher';
export { unifiedAIPipeline } from './UnifiedAIPipeline';
export * from './config';

export type { ExtractedData } from './UnifiedAIProcessor';
export type { NormalizedProduct, BatchNormalizationResult } from './AIDataNormalizer';
export type { ProductMatch, BatchMatchResult } from './AIProductMatcher';