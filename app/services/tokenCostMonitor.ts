/**
 * Token Cost Monitor Service
 * Tracks and calculates costs for LLM API usage
 */

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
  endpoint?: string;
  requestId?: string;
}

interface CostCalculation {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
}

class TokenCostMonitor {
  private static instance: TokenCostMonitor;
  private totalCostUsd: number = 0;
  private monthlyUsage: Map<string, number> = new Map(); // model -> cost

  // Cost per 1K tokens in USD (from environment)
  private readonly costs = {
    'gpt-o3': {
      input: parseFloat(process.env.OPENAI_GPTO3_INPUT_COST_PER_1K || '0.06'),
      output: parseFloat(process.env.OPENAI_GPTO3_OUTPUT_COST_PER_1K || '0.24')
    },
    'gpt-o3-mini': {
      input: parseFloat(process.env.OPENAI_GPTO3MINI_INPUT_COST_PER_1K || '0.003'),
      output: parseFloat(process.env.OPENAI_GPTO3MINI_OUTPUT_COST_PER_1K || '0.012')
    },
    'gpt-4o': {
      input: parseFloat(process.env.OPENAI_GPT4O_INPUT_COST_PER_1K || '0.0025'),
      output: parseFloat(process.env.OPENAI_GPT4O_OUTPUT_COST_PER_1K || '0.01')
    },
    'gpt-3.5-turbo': {
      input: parseFloat(process.env.OPENAI_GPT35_INPUT_COST_PER_1K || '0.0005'),
      output: parseFloat(process.env.OPENAI_GPT35_OUTPUT_COST_PER_1K || '0.0015')
    }
  };

  public static getInstance(): TokenCostMonitor {
    if (!TokenCostMonitor.instance) {
      TokenCostMonitor.instance = new TokenCostMonitor();
    }
    return TokenCostMonitor.instance;
  }

  /**
   * Calculate cost for token usage
   */
  calculateCost(usage: TokenUsage): CostCalculation {
    const modelKey = this.normalizeModelName(usage.model);
    const rates = this.costs[modelKey as keyof typeof this.costs];
    
    if (!rates) {
      console.warn(`Unknown model: ${usage.model}, using gpt-o3-mini rates`);
      const fallbackRates = this.costs['gpt-o3-mini'];
      const inputCost = (usage.inputTokens / 1000) * fallbackRates.input;
      const outputCost = (usage.outputTokens / 1000) * fallbackRates.output;
      const totalCost = inputCost + outputCost;
      
      return { inputCost, outputCost, totalCost, currency: 'USD' };
    }

    const inputCost = (usage.inputTokens / 1000) * rates.input;
    const outputCost = (usage.outputTokens / 1000) * rates.output;
    const totalCost = inputCost + outputCost;

    return { inputCost, outputCost, totalCost, currency: 'USD' };
  }

  /**
   * Track token usage and add to totals
   */
  trackUsage(usage: TokenUsage): CostCalculation {
    const cost = this.calculateCost(usage);
    
    // Add to total cost
    this.totalCostUsd += cost.totalCost;
    
    // Add to monthly usage by model
    const modelKey = this.normalizeModelName(usage.model);
    const currentMonthKey = `${new Date().getFullYear()}-${new Date().getMonth() + 1}`;
    const monthlyKey = `${currentMonthKey}-${modelKey}`;
    
    const existingCost = this.monthlyUsage.get(monthlyKey) || 0;
    this.monthlyUsage.set(monthlyKey, existingCost + cost.totalCost);

    // Log the usage
    console.log(`💰 Token Usage: ${usage.inputTokens} in + ${usage.outputTokens} out = $${cost.totalCost.toFixed(4)} (${usage.model})`);
    
    return cost;
  }

  /**
   * Get current total costs
   */
  getTotalCost(): number {
    return this.totalCostUsd;
  }

  /**
   * Get monthly usage by model
   */
  getMonthlyUsage(): Record<string, number> {
    const result: Record<string, number> = {};
    const currentMonthKey = `${new Date().getFullYear()}-${new Date().getMonth() + 1}`;
    
    for (const [key, cost] of this.monthlyUsage.entries()) {
      if (key.startsWith(currentMonthKey)) {
        const model = key.split('-').slice(2).join('-');
        result[model] = (result[model] || 0) + cost;
      }
    }
    
    return result;
  }

  /**
   * Get detailed usage statistics
   */
  getUsageStats() {
    return {
      totalCostUsd: this.totalCostUsd,
      monthlyUsage: this.getMonthlyUsage(),
      supportedModels: Object.keys(this.costs),
      costRates: this.costs
    };
  }

  /**
   * Reset usage statistics (for testing)
   */
  reset(): void {
    this.totalCostUsd = 0;
    this.monthlyUsage.clear();
  }

  /**
   * Normalize model names for consistent tracking
   */
  private normalizeModelName(model: string): string {
    // Handle different model name variations
    if (model.includes('gpt-o3-mini')) return 'gpt-o3-mini';
    if (model.includes('gpt-o3')) return 'gpt-o3';
    if (model.includes('gpt-4o')) return 'gpt-4o';
    if (model.includes('gpt-4')) return 'gpt-4o'; // Default GPT-4 to gpt-4o rates
    if (model.includes('gpt-3.5')) return 'gpt-3.5-turbo';
    
    return model;
  }

  /**
   * Format cost for display
   */
  formatCost(cost: number): string {
    if (cost < 0.001) {
      return `$${cost.toFixed(6)}`; // Show very small costs with 6 decimal places
    } else if (cost < 0.01) {
      return `$${cost.toFixed(5)}`; // Show small costs with 5 decimal places
    }
    return `$${cost.toFixed(4)}`; // Standard 4 decimal places for larger costs
  }

  /**
   * Check if cost exceeds daily budget (optional warning)
   */
  checkBudgetAlert(dailyBudgetUsd: number = 10): boolean {
    const todayKey = new Date().toISOString().split('T')[0];
    let todayCost = 0;
    
    for (const [key, cost] of this.monthlyUsage.entries()) {
      if (key.includes(todayKey)) {
        todayCost += cost;
      }
    }
    
    if (todayCost > dailyBudgetUsd) {
      console.warn(`⚠️ Daily budget exceeded: $${todayCost.toFixed(2)} > $${dailyBudgetUsd}`);
      return true;
    }
    
    return false;
  }
}

// Export singleton instance
export const tokenCostMonitor = TokenCostMonitor.getInstance();

// Export types
export type { TokenUsage, CostCalculation };