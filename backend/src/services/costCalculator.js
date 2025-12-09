/**
 * Cost Calculator Service
 *
 * Provides configurable cost calculation for different LLM providers and usage patterns.
 * All pricing is configurable - no hardcoded business rules.
 */

/**
 * Configurable pricing for different LLM providers
 * Values are in USD per 1M tokens (input and output can differ)
 */
export const PROVIDER_PRICING = {
  ollama: {
    name: 'Ollama (Local)',
    inputCostPer1M: 0,      // Free (local)
    outputCostPer1M: 0,     // Free (local)
    description: 'Free local model',
  },
  'claude-3-5-sonnet': {
    name: 'Claude 3.5 Sonnet',
    inputCostPer1M: 3.00,   // Configure based on Anthropic pricing
    outputCostPer1M: 15.00, // Configure based on Anthropic pricing
    description: 'High-quality reasoning',
  },
  'claude-3-haiku': {
    name: 'Claude 3 Haiku',
    inputCostPer1M: 0.25,   // Configure based on Anthropic pricing
    outputCostPer1M: 1.25,  // Configure based on Anthropic pricing
    description: 'Fast and cost-effective',
  },
  'gpt-4o': {
    name: 'GPT-4o',
    inputCostPer1M: 2.50,   // Configure based on OpenAI pricing
    outputCostPer1M: 10.00, // Configure based on OpenAI pricing
    description: 'Multimodal flagship model',
  },
  'gpt-4o-mini': {
    name: 'GPT-4o Mini',
    inputCostPer1M: 0.15,   // Configure based on OpenAI pricing
    outputCostPer1M: 0.60,  // Configure based on OpenAI pricing
    description: 'Affordable and intelligent',
  },
};

/**
 * Cost Calculator Service
 */
export class CostCalculator {
  /**
   * Calculate cost for token usage
   * @param {number} inputTokens - Input tokens used
   * @param {number} outputTokens - Output tokens used
   * @param {string} provider - LLM provider name
   * @returns {number} Cost in USD
   */
  static calculateTokenCost(inputTokens, outputTokens, provider = 'ollama') {
    const pricing = PROVIDER_PRICING[provider] || PROVIDER_PRICING.ollama;

    const inputCost = (inputTokens / 1000000) * pricing.inputCostPer1M;
    const outputCost = (outputTokens / 1000000) * pricing.outputCostPer1M;

    return parseFloat((inputCost + outputCost).toFixed(6));
  }

  /**
   * Calculate cost for a conversation
   * @param {Object} usage - Usage object { inputTokens, outputTokens, messages }
   * @param {string} provider - LLM provider
   * @returns {Object} Cost breakdown
   */
  static calculateConversationCost(usage, provider = 'ollama') {
    const tokenCost = this.calculateTokenCost(
      usage.inputTokens || 0,
      usage.outputTokens || 0,
      provider
    );

    return {
      provider,
      inputTokens: usage.inputTokens || 0,
      outputTokens: usage.outputTokens || 0,
      totalTokens: (usage.inputTokens || 0) + (usage.outputTokens || 0),
      cost: tokenCost,
      messages: usage.messages || 0,
      costPerMessage: usage.messages > 0 ? tokenCost / usage.messages : 0,
    };
  }

  /**
   * Calculate monthly cost estimate based on usage patterns
   * @param {Object} monthlyUsage - Expected monthly usage
   * @param {string} provider - LLM provider
   * @returns {Object} Cost estimate
   */
  static calculateMonthlyEstimate(monthlyUsage, provider = 'ollama') {
    const {
      messagesPerMonth = 0,
      avgInputTokensPerMessage = 500,
      avgOutputTokensPerMessage = 200,
    } = monthlyUsage;

    const totalInputTokens = messagesPerMonth * avgInputTokensPerMessage;
    const totalOutputTokens = messagesPerMonth * avgOutputTokensPerMessage;

    const cost = this.calculateTokenCost(totalInputTokens, totalOutputTokens, provider);

    return {
      provider,
      messagesPerMonth,
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      monthlyCost: cost,
      costPerMessage: messagesPerMonth > 0 ? cost / messagesPerMonth : 0,
    };
  }

  /**
   * Compare costs across different providers
   * @param {Object} usage - Usage data
   * @returns {Array} Array of cost comparisons
   */
  static compareproviders(usage) {
    const providers = Object.keys(PROVIDER_PRICING);
    const comparisons = [];

    for (const provider of providers) {
      const cost = this.calculateConversationCost(usage, provider);
      comparisons.push({
        provider,
        name: PROVIDER_PRICING[provider].name,
        cost: cost.cost,
        costPerMessage: cost.costPerMessage,
        description: PROVIDER_PRICING[provider].description,
      });
    }

    // Sort by cost (cheapest first)
    comparisons.sort((a, b) => a.cost - b.cost);

    return comparisons;
  }

  /**
   * Get pricing information for a provider
   * @param {string} provider - Provider name
   * @returns {Object} Pricing details
   */
  static getProviderPricing(provider) {
    return PROVIDER_PRICING[provider] || PROVIDER_PRICING.ollama;
  }

  /**
   * Get all available providers
   * @returns {Array} List of providers with pricing
   */
  static getAllProviders() {
    return Object.entries(PROVIDER_PRICING).map(([key, value]) => ({
      key,
      name: value.name,
      inputCostPer1M: value.inputCostPer1M,
      outputCostPer1M: value.outputCostPer1M,
      description: value.description,
    }));
  }

  /**
   * Calculate savings by switching providers
   * @param {Object} currentUsage - Current usage with provider
   * @param {string} currentProvider - Current provider
   * @param {string} targetProvider - Target provider
   * @returns {Object} Savings analysis
   */
  static calculateSavings(currentUsage, currentProvider, targetProvider) {
    const currentCost = this.calculateConversationCost(currentUsage, currentProvider);
    const targetCost = this.calculateConversationCost(currentUsage, targetProvider);

    const savings = currentCost.cost - targetCost.cost;
    const savingsPercent = currentCost.cost > 0
      ? (savings / currentCost.cost) * 100
      : 0;

    return {
      currentProvider,
      targetProvider,
      currentCost: currentCost.cost,
      targetCost: targetCost.cost,
      savings,
      savingsPercent: Math.round(savingsPercent * 100) / 100,
      recommendation: savings > 0
        ? `Switch to ${PROVIDER_PRICING[targetProvider].name} to save $${savings.toFixed(2)}`
        : `Stay with ${PROVIDER_PRICING[currentProvider].name}`,
    };
  }

  /**
   * Calculate break-even point for plan upgrade
   * @param {Object} currentPlan - Current plan with costs
   * @param {Object} targetPlan - Target plan with costs
   * @param {number} currentUsage - Current monthly usage (messages)
   * @returns {Object} Break-even analysis
   */
  static calculatePlanBreakeven(currentPlan, targetPlan, currentUsage) {
    const currentMonthlyCost =
      currentPlan.baseCost + currentUsage * currentPlan.costPerMessage;
    const targetMonthlyCost =
      targetPlan.baseCost + currentUsage * targetPlan.costPerMessage;

    const monthlySavings = currentMonthlyCost - targetMonthlyCost;

    return {
      currentPlan: currentPlan.name,
      targetPlan: targetPlan.name,
      currentMonthlyCost,
      targetMonthlyCost,
      monthlySavings,
      breakEvenMessages:
        targetPlan.baseCost > currentPlan.baseCost
          ? Math.ceil(
              (targetPlan.baseCost - currentPlan.baseCost) /
                (currentPlan.costPerMessage - targetPlan.costPerMessage || 1)
            )
          : 0,
      recommendation:
        monthlySavings > 0 ? 'Upgrade recommended' : 'Stay on current plan',
    };
  }

  /**
   * Update provider pricing (for dynamic configuration)
   * @param {string} provider - Provider key
   * @param {Object} pricing - New pricing { inputCostPer1M, outputCostPer1M }
   */
  static updateProviderPricing(provider, pricing) {
    if (PROVIDER_PRICING[provider]) {
      PROVIDER_PRICING[provider] = {
        ...PROVIDER_PRICING[provider],
        ...pricing,
      };
    }
  }
}

/**
 * Default export
 */
export default CostCalculator;
