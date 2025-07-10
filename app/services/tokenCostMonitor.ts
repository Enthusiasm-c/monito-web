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

export const tokenCostMonitor = {
  totalCostUsd: 0,
  monthlyUsage: new Map<string, number>(), // model -> cost

  // Cost per 1K tokens in USD (from environment)
  costs: {
    
    // Legacy model names for backward compatibility
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
  },

  


  /**
   * Track token usage and add to totals
   */
  trackUsage(usage: TokenUsage): CostCalculation {
    const cost = tokenCostMonitor.calculateCostDetailed(usage);
    
    // Add to total cost
    tokenCostMonitor.totalCostUsd += cost.totalCost;
    
    // Add to monthly usage by model
    const modelKey = tokenCostMonitor.normalizeModelName(usage.model);
    const currentMonthKey = `${new Date().getFullYear()}-${new Date().getMonth() + 1}`;
    const monthlyKey = `${currentMonthKey}-${modelKey}`;
    
    const existingCost = tokenCostMonitor.monthlyUsage.get(monthlyKey) || 0;
    tokenCostMonitor.monthlyUsage.set(monthlyKey, existingCost + cost.totalCost);

    // Log the usage
    console.log(`💰 Token Usage: ${usage.inputTokens} in + ${usage.outputTokens} out = $${cost.totalCost.toFixed(4)} (${usage.model})`);
    
    return cost;
  },

  /**
   * Get current total costs
   */
  getTotalCost(): number {
    return tokenCostMonitor.totalCostUsd;
  },

  /**
   * Get monthly usage by model
   */
  getMonthlyUsage(): Record<string, number> {
    const result: Record<string, number> = {};
    const currentMonthKey = `${new Date().getFullYear()}-${new Date().getMonth() + 1}`;
    
    for (const [key, cost] of tokenCostMonitor.monthlyUsage.entries()) {
      if (key.startsWith(currentMonthKey)) {
        const model = key.split('-').slice(2).join('-');
        result[model] = (result[model] || 0) + cost;
      }
    }
    
    return result;
  },

  /**
   * Get detailed usage statistics
   */
  getUsageStats() {
    return {
      totalCostUsd: tokenCostMonitor.totalCostUsd,
      monthlyUsage: tokenCostMonitor.getMonthlyUsage(),
      supportedModels: Object.keys(tokenCostMonitor.costs),
      costRates: tokenCostMonitor.costs
    };
  },

  /**
   * Reset usage statistics (for testing)
   */
  reset(): void {
    tokenCostMonitor.totalCostUsd = 0;
    tokenCostMonitor.monthlyUsage.clear();
  },

  /**
   * Normalize model names for consistent tracking
   */
  normalizeModelName(model: string): string {
    // Handle different model name variations
    if (model.includes('gpt-4o')) return 'gpt-4o';
    if (model.includes('gpt-o3-mini')) return 'o3-mini';
    if (model.includes('gpt-o3')) return 'gpt-4o'; // Map old model to new
    if (model.includes('gpt-4')) return 'gpt-4o'; // Default GPT-4 to gpt-4o rates
    if (model.includes('gpt-3.5')) return 'gpt-3.5-turbo';
    
    return model;
  },

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
  },

  /**
   * Simple cost calculation for a total token count
   */
  calculateCost(tokensOrUsage: number | TokenUsage, model: string = 'gpt-4o-mini'): number {
    if (typeof tokensOrUsage === 'number') {
      // Simple calculation assuming all tokens are output
      const modelKey = tokenCostMonitor.normalizeModelName(model);
      const rates = tokenCostMonitor.costs[modelKey as keyof typeof tokenCostMonitor.costs];
      if (!rates) {
        console.warn(`Unknown model: ${model}, using gpt-4o-mini rates`);
        const fallbackRates = tokenCostMonitor.costs['gpt-4o-mini'] || tokenCostMonitor.costs['gpt-o3-mini'];
        return (tokensOrUsage / 1000) * fallbackRates.output;
      }
      return (tokensOrUsage / 1000) * rates.output;
    } else {
      // Full calculation with input/output split
      const calc = tokenCostMonitor.calculateCostDetailed(tokensOrUsage);
      return calc.totalCost;
    }
  },

  /**
   * Detailed cost calculation with input/output breakdown
   */
  calculateCostDetailed(usage: TokenUsage): CostCalculation {
    const modelKey = tokenCostMonitor.normalizeModelName(usage.model);
    const rates = tokenCostMonitor.costs[modelKey as keyof typeof tokenCostMonitor.costs];
    
    if (!rates) {
      console.warn(`Unknown model: ${usage.model}, using gpt-4o-mini rates`);
      const fallbackRates = tokenCostMonitor.costs['gpt-4o-mini'] || tokenCostMonitor.costs['gpt-o3-mini'];
      const inputCost = (usage.inputTokens / 1000) * fallbackRates.input;
      const outputCost = (usage.outputTokens / 1000) * fallbackRates.output;
      const totalCost = inputCost + outputCost;
      
      return { inputCost, outputCost, totalCost, currency: 'USD' };
    }

    const inputCost = (usage.inputTokens / 1000) * rates.input;
    const outputCost = (usage.outputTokens / 1000) * rates.output;
    const totalCost = inputCost + outputCost;

    return { inputCost, outputCost, totalCost, currency: 'USD' };
  },

  /**
   * Check if cost exceeds daily budget (optional warning)
   */
  checkBudgetAlert(dailyBudgetUsd: number = 10): boolean {
    const todayKey = new Date().toISOString().split('T')[0];
    let todayCost = 0;
    
    for (const [key, cost] of tokenCostMonitor.monthlyUsage.entries()) {
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
};

// Export types
export type { TokenUsage, CostCalculation };