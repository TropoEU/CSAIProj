import { describe, it, expect } from 'vitest';
import { CostCalculator, PROVIDER_PRICING } from '../../../src/services/costCalculator.js';

describe('CostCalculator', () => {
  describe('calculateTokenCost', () => {
    it('should return 0 for free providers (ollama)', () => {
      const cost = CostCalculator.calculateTokenCost(1000, 500, 'ollama');
      expect(cost).toBe(0);
    });

    it('should return 0 for free providers (groq)', () => {
      const cost = CostCalculator.calculateTokenCost(1000000, 500000, 'groq');
      expect(cost).toBe(0);
    });

    it('should calculate cost correctly for paid providers (claude-3-5-sonnet)', () => {
      // 1M input tokens at $3/1M = $3.00
      // 1M output tokens at $15/1M = $15.00
      // Total = $18.00
      const cost = CostCalculator.calculateTokenCost(1000000, 1000000, 'claude-3-5-sonnet');
      expect(cost).toBe(18);
    });

    it('should calculate cost correctly for partial token usage', () => {
      // 500K input tokens at $3/1M = $1.50
      // 200K output tokens at $15/1M = $3.00
      // Total = $4.50
      const cost = CostCalculator.calculateTokenCost(500000, 200000, 'claude-3-5-sonnet');
      expect(cost).toBe(4.5);
    });

    it('should handle small token counts', () => {
      // 1000 input tokens at $3/1M = $0.003
      // 500 output tokens at $15/1M = $0.0075
      // Total = $0.0105
      const cost = CostCalculator.calculateTokenCost(1000, 500, 'claude-3-5-sonnet');
      expect(cost).toBeCloseTo(0.0105, 4);
    });

    it('should default to ollama pricing for unknown providers', () => {
      const cost = CostCalculator.calculateTokenCost(1000000, 1000000, 'unknown-provider');
      expect(cost).toBe(0);
    });

    it('should handle zero tokens', () => {
      const cost = CostCalculator.calculateTokenCost(0, 0, 'claude-3-5-sonnet');
      expect(cost).toBe(0);
    });
  });

  describe('calculateConversationCost', () => {
    it('should return complete cost breakdown', () => {
      const usage = {
        inputTokens: 1000,
        outputTokens: 500,
        messages: 5,
      };

      const result = CostCalculator.calculateConversationCost(usage, 'claude-3-5-sonnet');

      expect(result).toHaveProperty('provider', 'claude-3-5-sonnet');
      expect(result).toHaveProperty('inputTokens', 1000);
      expect(result).toHaveProperty('outputTokens', 500);
      expect(result).toHaveProperty('totalTokens', 1500);
      expect(result).toHaveProperty('cost');
      expect(result).toHaveProperty('messages', 5);
      expect(result).toHaveProperty('costPerMessage');
    });

    it('should calculate costPerMessage correctly', () => {
      const usage = {
        inputTokens: 1000000,
        outputTokens: 1000000,
        messages: 10,
      };

      const result = CostCalculator.calculateConversationCost(usage, 'claude-3-5-sonnet');

      // Total cost = $18, messages = 10, costPerMessage = $1.80
      expect(result.costPerMessage).toBe(1.8);
    });

    it('should handle zero messages without division error', () => {
      const usage = {
        inputTokens: 1000,
        outputTokens: 500,
        messages: 0,
      };

      const result = CostCalculator.calculateConversationCost(usage, 'claude-3-5-sonnet');
      expect(result.costPerMessage).toBe(0);
    });

    it('should handle missing fields gracefully', () => {
      const result = CostCalculator.calculateConversationCost({}, 'ollama');

      expect(result.inputTokens).toBe(0);
      expect(result.outputTokens).toBe(0);
      expect(result.totalTokens).toBe(0);
      expect(result.messages).toBe(0);
    });
  });

  describe('calculateMonthlyEstimate', () => {
    it('should estimate monthly cost based on message count', () => {
      const usage = {
        messagesPerMonth: 1000,
        avgInputTokensPerMessage: 500,
        avgOutputTokensPerMessage: 200,
      };

      const result = CostCalculator.calculateMonthlyEstimate(usage, 'claude-3-5-sonnet');

      expect(result.messagesPerMonth).toBe(1000);
      expect(result.totalInputTokens).toBe(500000);
      expect(result.totalOutputTokens).toBe(200000);
      expect(result.totalTokens).toBe(700000);
      expect(result.monthlyCost).toBeGreaterThan(0);
    });

    it('should use default token averages when not provided', () => {
      const usage = {
        messagesPerMonth: 100,
      };

      const result = CostCalculator.calculateMonthlyEstimate(usage, 'gpt-4o');

      // Default: 500 input + 200 output per message
      expect(result.totalInputTokens).toBe(50000);
      expect(result.totalOutputTokens).toBe(20000);
    });

    it('should return zero cost for free providers', () => {
      const usage = {
        messagesPerMonth: 10000,
      };

      const result = CostCalculator.calculateMonthlyEstimate(usage, 'groq');
      expect(result.monthlyCost).toBe(0);
    });
  });

  describe('compareproviders', () => {
    it('should return sorted list of all providers', () => {
      const usage = {
        inputTokens: 1000000,
        outputTokens: 500000,
        messages: 100,
      };

      const result = CostCalculator.compareproviders(usage);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(Object.keys(PROVIDER_PRICING).length);

      // Should be sorted by cost (ascending)
      for (let i = 1; i < result.length; i++) {
        expect(result[i].cost).toBeGreaterThanOrEqual(result[i - 1].cost);
      }
    });

    it('should include provider details in comparison', () => {
      const usage = { inputTokens: 1000, outputTokens: 500, messages: 1 };
      const result = CostCalculator.compareproviders(usage);

      expect(result[0]).toHaveProperty('provider');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('cost');
      expect(result[0]).toHaveProperty('costPerMessage');
      expect(result[0]).toHaveProperty('description');
    });
  });

  describe('getProviderPricing', () => {
    it('should return pricing for known provider', () => {
      const pricing = CostCalculator.getProviderPricing('gpt-4o');

      expect(pricing.name).toBe('GPT-4o');
      expect(pricing.inputCostPer1M).toBe(2.5);
      expect(pricing.outputCostPer1M).toBe(10);
    });

    it('should return ollama pricing for unknown provider', () => {
      const pricing = CostCalculator.getProviderPricing('unknown');

      expect(pricing.inputCostPer1M).toBe(0);
      expect(pricing.outputCostPer1M).toBe(0);
    });
  });

  describe('getAllProviders', () => {
    it('should return array of all providers', () => {
      const providers = CostCalculator.getAllProviders();

      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);

      providers.forEach((provider) => {
        expect(provider).toHaveProperty('key');
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('inputCostPer1M');
        expect(provider).toHaveProperty('outputCostPer1M');
        expect(provider).toHaveProperty('description');
      });
    });
  });

  describe('calculateSavings', () => {
    it('should calculate savings when switching to cheaper provider', () => {
      const usage = {
        inputTokens: 1000000,
        outputTokens: 500000,
        messages: 100,
      };

      const result = CostCalculator.calculateSavings(usage, 'gpt-4o', 'groq');

      expect(result.currentProvider).toBe('gpt-4o');
      expect(result.targetProvider).toBe('groq');
      expect(result.savings).toBeGreaterThan(0);
      expect(result.savingsPercent).toBe(100); // groq is free
      expect(result.recommendation).toContain('Switch to');
    });

    it('should recommend staying when target is more expensive', () => {
      const usage = {
        inputTokens: 1000000,
        outputTokens: 500000,
        messages: 100,
      };

      const result = CostCalculator.calculateSavings(usage, 'groq', 'gpt-4o');

      expect(result.savings).toBeLessThan(0);
      expect(result.recommendation).toContain('Stay with');
    });
  });

  describe('calculatePlanBreakeven', () => {
    it('should calculate break-even point for plan upgrade', () => {
      const currentPlan = {
        name: 'Starter',
        baseCost: 10,
        costPerMessage: 0.01,
      };

      const targetPlan = {
        name: 'Pro',
        baseCost: 50,
        costPerMessage: 0.005,
      };

      const result = CostCalculator.calculatePlanBreakeven(currentPlan, targetPlan, 5000);

      expect(result.currentPlan).toBe('Starter');
      expect(result.targetPlan).toBe('Pro');
      expect(result).toHaveProperty('currentMonthlyCost');
      expect(result).toHaveProperty('targetMonthlyCost');
      expect(result).toHaveProperty('monthlySavings');
      expect(result).toHaveProperty('breakEvenMessages');
    });

    it('should return 0 break-even when target is cheaper base cost', () => {
      const currentPlan = {
        name: 'Pro',
        baseCost: 50,
        costPerMessage: 0.005,
      };

      const targetPlan = {
        name: 'Basic',
        baseCost: 10,
        costPerMessage: 0.01,
      };

      const result = CostCalculator.calculatePlanBreakeven(currentPlan, targetPlan, 1000);

      expect(result.breakEvenMessages).toBe(0);
    });
  });
});
