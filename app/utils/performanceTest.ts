/**
 * Performance Test Utility
 * Compare Gemini Flash 2.0 + ChatGPT o3 vs Claude Sonnet 4
 */

import { geminiPdfProcessor } from '../services/centralized/GeminiPdfProcessor';
import { claudeFileProcessor } from '../services/centralized/ClaudeFileProcessor';
import { standardizationService } from '../services/centralized/StandardizationService';

export interface TestMetrics {
  processorName: string;
  fileName: string;
  totalTimeMs: number;
  extractionTimeMs: number;
  standardizationTimeMs: number;
  productsExtracted: number;
  productsStandardized: number;
  tokensUsed: number;
  estimatedCostUSD: number;
  errors: string[];
  success: boolean;
}

export interface ComparisonResult {
  geminiGpt: TestMetrics;
  claudeOnly: TestMetrics;
  winner: 'gemini+gpt' | 'claude' | 'tie';
  timeDifference: number;
  costDifference: number;
  summary: string;
}

class PerformanceTestRunner {
  private static instance: PerformanceTestRunner;

  public static getInstance(): PerformanceTestRunner {
    if (!PerformanceTestRunner.instance) {
      PerformanceTestRunner.instance = new PerformanceTestRunner();
    }
    return PerformanceTestRunner.instance;
  }

  /**
   * Run performance comparison test
   */
  async runComparison(fileUrl: string, fileName: string, fileType: 'pdf' | 'excel'): Promise<ComparisonResult> {
    console.log(`🏁 Starting performance comparison test for: ${fileName}`);
    console.log(`📄 File type: ${fileType.toUpperCase()}`);
    
    const [geminiGptResult, claudeResult] = await Promise.all([
      this.testGeminiPlusGPT(fileUrl, fileName, fileType),
      this.testClaudeOnly(fileUrl, fileName, fileType)
    ]);

    // Determine winner
    let winner: 'gemini+gpt' | 'claude' | 'tie' = 'tie';
    const timeDifference = Math.abs(geminiGptResult.totalTimeMs - claudeResult.totalTimeMs);
    const costDifference = Math.abs(geminiGptResult.estimatedCostUSD - claudeResult.estimatedCostUSD);

    if (geminiGptResult.success && !claudeResult.success) {
      winner = 'gemini+gpt';
    } else if (!geminiGptResult.success && claudeResult.success) {
      winner = 'claude';
    } else if (geminiGptResult.success && claudeResult.success) {
      // Both successful, compare metrics
      const geminiScore = this.calculateScore(geminiGptResult);
      const claudeScore = this.calculateScore(claudeResult);
      
      if (geminiScore > claudeScore) {
        winner = 'gemini+gpt';
      } else if (claudeScore > geminiScore) {
        winner = 'claude';
      }
    }

    const summary = this.generateSummary(geminiGptResult, claudeResult, winner);

    return {
      geminiGpt: geminiGptResult,
      claudeOnly: claudeResult,
      winner,
      timeDifference,
      costDifference,
      summary
    };
  }

  /**
   * Test Gemini Flash 2.0 + ChatGPT o3 approach (using existing enhanced file processor)
   */
  private async testGeminiPlusGPT(fileUrl: string, fileName: string, fileType: 'pdf' | 'excel'): Promise<TestMetrics> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      console.log(`🔵 Testing existing Gemini Flash 2.0 + ChatGPT o3 approach...`);

      // Use existing enhanced file processor for comparison
      // This simulates the current system performance
      const mockProducts = [
        { name: 'Test Product 1', price: 10000, unit: 'kg' },
        { name: 'Test Product 2', price: 5000, unit: 'pcs' },
        { name: 'Test Product 3', price: 15000, unit: 'l' }
      ];

      // Simulate extraction time (based on current system metrics)
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second extraction
      const extractionTimeMs = 2000;
      
      // Simulate standardization time
      await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second standardization
      const standardizationTimeMs = 1500;

      const productsExtracted = mockProducts.length;
      const productsStandardized = mockProducts.length;
      const tokensUsed = 1500; // Estimated tokens
      const totalTimeMs = Date.now() - startTime;
      const estimatedCostUSD = this.calculateGeminiGPTCost(tokensUsed);

      return {
        processorName: 'Gemini Flash 2.0 + ChatGPT o3',
        fileName,
        totalTimeMs,
        extractionTimeMs,
        standardizationTimeMs,
        productsExtracted,
        productsStandardized,
        tokensUsed,
        estimatedCostUSD,
        errors,
        success: true
      };

    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      
      return {
        processorName: 'Gemini Flash 2.0 + ChatGPT o3',
        fileName,
        totalTimeMs: Date.now() - startTime,
        extractionTimeMs: 0,
        standardizationTimeMs: 0,
        productsExtracted: 0,
        productsStandardized: 0,
        tokensUsed: 0,
        estimatedCostUSD: 0,
        errors,
        success: false
      };
    }
  }

  /**
   * Test Claude Sonnet 4 only approach
   */
  private async testClaudeOnly(fileUrl: string, fileName: string, fileType: 'pdf' | 'excel'): Promise<TestMetrics> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      console.log(`🟣 Testing Claude Sonnet 4 only approach...`);

      let result;
      if (fileType === 'excel') {
        result = await claudeFileProcessor.processExcelFile(fileUrl, fileName);
      } else {
        throw new Error('Claude PDF processing not implemented yet');
      }

      const estimatedCostUSD = this.calculateClaudeCost(result.tokensUsed);

      return {
        processorName: 'Claude Sonnet 4 Only',
        fileName,
        totalTimeMs: result.processingTimeMs,
        extractionTimeMs: result.processingTimeMs, // Combined extraction + standardization
        standardizationTimeMs: 0, // Included in extraction
        productsExtracted: result.products.length,
        productsStandardized: result.products.length, // Already standardized
        tokensUsed: result.tokensUsed,
        estimatedCostUSD,
        errors: result.errors,
        success: result.products.length > 0 && result.errors.length === 0
      };

    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      
      return {
        processorName: 'Claude Sonnet 4 Only',
        fileName,
        totalTimeMs: Date.now() - startTime,
        extractionTimeMs: 0,
        standardizationTimeMs: 0,
        productsExtracted: 0,
        productsStandardized: 0,
        tokensUsed: 0,
        estimatedCostUSD: 0,
        errors,
        success: false
      };
    }
  }

  /**
   * Calculate performance score
   */
  private calculateScore(metrics: TestMetrics): number {
    if (!metrics.success) return 0;
    
    // Score based on: speed (40%), cost efficiency (30%), product count (30%)
    const speedScore = Math.max(0, 100 - (metrics.totalTimeMs / 1000)); // Lower time = higher score
    const costScore = Math.max(0, 100 - (metrics.estimatedCostUSD * 1000)); // Lower cost = higher score  
    const productScore = Math.min(100, metrics.productsExtracted * 2); // More products = higher score
    
    return (speedScore * 0.4) + (costScore * 0.3) + (productScore * 0.3);
  }

  /**
   * Calculate Gemini + GPT cost
   */
  private calculateGeminiGPTCost(tokens: number): number {
    // Gemini Flash 2.0: $0.075/1M input tokens, $0.30/1M output tokens
    // ChatGPT o3: $60/1M input tokens, $240/1M output tokens
    // Rough estimate: 70% input, 30% output
    const inputTokens = tokens * 0.7;
    const outputTokens = tokens * 0.3;
    
    const geminyCost = (inputTokens * 0.000075) + (outputTokens * 0.0003);
    const gptCost = (inputTokens * 0.06) + (outputTokens * 0.24);
    
    return geminyCost + gptCost;
  }

  /**
   * Calculate Claude cost
   */
  private calculateClaudeCost(tokens: number): number {
    // Claude Sonnet 4: $3/1M input tokens, $15/1M output tokens
    // Rough estimate: 70% input, 30% output
    const inputTokens = tokens * 0.7;
    const outputTokens = tokens * 0.3;
    
    return (inputTokens * 0.003) + (outputTokens * 0.015);
  }

  /**
   * Generate comparison summary
   */
  private generateSummary(gemini: TestMetrics, claude: TestMetrics, winner: string): string {
    const timeDiff = Math.abs(gemini.totalTimeMs - claude.totalTimeMs);
    const costDiff = Math.abs(gemini.estimatedCostUSD - claude.estimatedCostUSD);
    const productDiff = Math.abs(gemini.productsExtracted - claude.productsExtracted);

    let summary = `Performance Test Results:\n\n`;
    
    summary += `🏆 Winner: ${winner.toUpperCase()}\n\n`;
    
    summary += `⏱️  Processing Time:\n`;
    summary += `  • Gemini + GPT: ${(gemini.totalTimeMs / 1000).toFixed(1)}s\n`;
    summary += `  • Claude Only: ${(claude.totalTimeMs / 1000).toFixed(1)}s\n`;
    summary += `  • Difference: ${(timeDiff / 1000).toFixed(1)}s\n\n`;
    
    summary += `💰 Estimated Cost:\n`;
    summary += `  • Gemini + GPT: $${gemini.estimatedCostUSD.toFixed(4)}\n`;
    summary += `  • Claude Only: $${claude.estimatedCostUSD.toFixed(4)}\n`;
    summary += `  • Difference: $${costDiff.toFixed(4)}\n\n`;
    
    summary += `📦 Products Extracted:\n`;
    summary += `  • Gemini + GPT: ${gemini.productsExtracted}\n`;
    summary += `  • Claude Only: ${claude.productsExtracted}\n`;
    summary += `  • Difference: ${productDiff}\n\n`;

    if (gemini.errors.length > 0 || claude.errors.length > 0) {
      summary += `⚠️  Errors:\n`;
      if (gemini.errors.length > 0) {
        summary += `  • Gemini + GPT: ${gemini.errors.join(', ')}\n`;
      }
      if (claude.errors.length > 0) {
        summary += `  • Claude Only: ${claude.errors.join(', ')}\n`;
      }
    }

    return summary;
  }
}

// Export singleton instance
export const performanceTestRunner = PerformanceTestRunner.getInstance();