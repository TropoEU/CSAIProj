/**
 * Plan Limits Configuration
 *
 * This file provides a flexible, configurable plan management system.
 * Values are intentionally left as null for configuration later.
 *
 * IMPORTANT: This is infrastructure, not business rules.
 * Actual limits and features should be configured based on business decisions.
 */

/**
 * Plan configuration structure
 * Each plan supports any type of limit and any feature flag
 */
export const PLAN_CONFIG = {
  free: {
    limits: {
      // Free tier: Limited for testing and small-scale use
      conversationsPerMonth: 50,       // 50 conversations per month
      messagesPerMonth: 500,           // 500 messages per month
      tokensPerMonth: 50000,           // 50K tokens (~35 pages of text)
      toolCallsPerMonth: 25,           // 25 tool executions
      integrationsEnabled: 1,          // 1 integration (e.g., one Shopify store)
      costLimitUSD: 5,                 // $5 monthly cost limit (safety cap)
    },
    features: {
      llmProvider: 'ollama',           // Free local model only
      customBranding: false,
      prioritySupport: false,
      advancedAnalytics: false,
      apiAccess: false,
      whiteLabel: false,
    },
    pricing: {
      baseCost: 0,                     // Free tier
      usageMultiplier: 0,
    },
  },
  starter: {
    limits: {
      conversationsPerMonth: 1000,     // 1,000 conversations per month
      messagesPerMonth: 10000,         // 10,000 messages per month
      tokensPerMonth: 1000000,         // 1M tokens (~700 pages)
      toolCallsPerMonth: 500,          // 500 tool executions
      integrationsEnabled: 3,          // 3 integrations
      costLimitUSD: 100,               // $100 monthly cost limit
    },
    features: {
      llmProvider: 'claude-3-haiku',   // Fast, cost-effective model
      customBranding: false,
      prioritySupport: false,
      advancedAnalytics: true,
      apiAccess: true,
      whiteLabel: false,
    },
    pricing: {
      baseCost: 29.99,                 // $29.99/month base
      usageMultiplier: 0.00001,        // $0.00001 per token over limit
    },
  },
  pro: {
    limits: {
      conversationsPerMonth: 10000,    // 10,000 conversations
      messagesPerMonth: 100000,        // 100,000 messages
      tokensPerMonth: 10000000,        // 10M tokens (~7,000 pages)
      toolCallsPerMonth: 5000,         // 5,000 tool executions
      integrationsEnabled: 10,         // 10 integrations
      costLimitUSD: 500,               // $500 monthly cost limit
    },
    features: {
      llmProvider: 'claude-3-5-sonnet', // High-quality model
      customBranding: true,
      prioritySupport: true,
      advancedAnalytics: true,
      apiAccess: true,
      whiteLabel: true,
    },
    pricing: {
      baseCost: 99.99,                 // $99.99/month base
      usageMultiplier: 0.000008,       // $0.000008 per token over limit
    },
  },
  enterprise: {
    limits: {
      // Enterprise: Very high limits (effectively unlimited for most use cases)
      conversationsPerMonth: 100000,   // 100K conversations
      messagesPerMonth: 1000000,       // 1M messages
      tokensPerMonth: 100000000,       // 100M tokens
      toolCallsPerMonth: 50000,        // 50K tool executions
      integrationsEnabled: null,       // Unlimited integrations
      costLimitUSD: 5000,              // $5000 monthly cost limit
    },
    features: {
      llmProvider: 'claude-3-5-sonnet', // High-quality model
      customBranding: true,
      prioritySupport: true,
      advancedAnalytics: true,
      apiAccess: true,
      whiteLabel: true,
      dedicatedSupport: true,
      sla: true,
    },
    pricing: {
      baseCost: 499.99,                // $499.99/month base
      usageMultiplier: 0.000005,       // $0.000005 per token (negotiated volume rate)
    },
  },
};

/**
 * Get plan configuration
 * @param {string} planType - Plan type (free, starter, pro, enterprise)
 * @returns {Object} Plan configuration
 */
export function getPlanConfig(planType) {
  const plan = PLAN_CONFIG[planType?.toLowerCase()];
  if (!plan) {
    console.warn(`Unknown plan type: ${planType}, defaulting to free`);
    return PLAN_CONFIG.free;
  }
  return plan;
}

/**
 * Check if a specific limit is exceeded
 * @param {string} planType - Plan type
 * @param {string} limitType - Type of limit (e.g., 'messagesPerMonth')
 * @param {number} currentUsage - Current usage value
 * @returns {Object} { allowed, remaining, limit, exceeded }
 */
export function checkLimit(planType, limitType, currentUsage) {
  const config = getPlanConfig(planType);
  const limit = config.limits[limitType];

  // null means unlimited
  if (limit === null) {
    return {
      allowed: true,
      remaining: null,
      limit: null,
      exceeded: false,
    };
  }

  const allowed = currentUsage < limit;
  const remaining = Math.max(0, limit - currentUsage);

  return {
    allowed,
    remaining,
    limit,
    exceeded: !allowed,
  };
}

/**
 * Check if a feature is enabled for a plan
 * @param {string} planType - Plan type
 * @param {string} featureName - Feature name (e.g., 'customBranding')
 * @returns {boolean} Whether feature is enabled
 */
export function hasFeature(planType, featureName) {
  const config = getPlanConfig(planType);
  return config.features[featureName] === true;
}

/**
 * Get all limits for a plan
 * @param {string} planType - Plan type
 * @returns {Object} All limits
 */
export function getPlanLimits(planType) {
  const config = getPlanConfig(planType);
  return config.limits;
}

/**
 * Get all features for a plan
 * @param {string} planType - Plan type
 * @returns {Object} All features
 */
export function getPlanFeatures(planType) {
  const config = getPlanConfig(planType);
  return config.features;
}

/**
 * Get pricing for a plan
 * @param {string} planType - Plan type
 * @returns {Object} Pricing configuration
 */
export function getPlanPricing(planType) {
  const config = getPlanConfig(planType);
  return config.pricing;
}

/**
 * Update plan configuration (for dynamic configuration)
 * @param {string} planType - Plan type
 * @param {Object} updates - Updates to apply
 */
export function updatePlanConfig(planType, updates) {
  const plan = PLAN_CONFIG[planType?.toLowerCase()];
  if (!plan) {
    throw new Error(`Unknown plan type: ${planType}`);
  }

  if (updates.limits) {
    plan.limits = { ...plan.limits, ...updates.limits };
  }
  if (updates.features) {
    plan.features = { ...plan.features, ...updates.features };
  }
  if (updates.pricing) {
    plan.pricing = { ...plan.pricing, ...updates.pricing };
  }
}

/**
 * Get list of all available plans
 * @returns {Array} Array of plan names
 */
export function getAvailablePlans() {
  return Object.keys(PLAN_CONFIG);
}

/**
 * Check multiple limits at once
 * @param {string} planType - Plan type
 * @param {Object} usage - Object with usage values (e.g., { messagesPerMonth: 100, tokensPerMonth: 5000 })
 * @returns {Object} Results for each limit
 */
export function checkMultipleLimits(planType, usage) {
  const results = {};

  for (const [limitType, currentUsage] of Object.entries(usage)) {
    results[limitType] = checkLimit(planType, limitType, currentUsage);
  }

  // Overall status
  const anyExceeded = Object.values(results).some(r => r.exceeded);
  const allAllowed = Object.values(results).every(r => r.allowed);

  return {
    results,
    anyExceeded,
    allAllowed,
    message: anyExceeded
      ? 'One or more limits exceeded'
      : 'All limits within range',
  };
}

/**
 * Get warning thresholds (e.g., warn at 80% usage)
 * @param {string} planType - Plan type
 * @param {string} limitType - Type of limit
 * @param {number} currentUsage - Current usage
 * @param {number} warningThreshold - Percentage threshold (0-1), default 0.8
 * @returns {Object} Warning status
 */
export function getLimitWarning(
  planType,
  limitType,
  currentUsage,
  warningThreshold = 0.8
) {
  const limitCheck = checkLimit(planType, limitType, currentUsage);

  if (limitCheck.limit === null) {
    return {
      warning: false,
      message: 'Unlimited',
    };
  }

  const usagePercentage = currentUsage / limitCheck.limit;

  if (usagePercentage >= 1) {
    return {
      warning: true,
      level: 'critical',
      message: `Limit exceeded (${currentUsage}/${limitCheck.limit})`,
      usagePercentage: 1,
    };
  }

  if (usagePercentage >= warningThreshold) {
    return {
      warning: true,
      level: 'warning',
      message: `Approaching limit (${currentUsage}/${limitCheck.limit})`,
      usagePercentage,
    };
  }

  return {
    warning: false,
    level: 'ok',
    message: `Within limit (${currentUsage}/${limitCheck.limit})`,
    usagePercentage,
  };
}

/**
 * Default export
 */
export default {
  PLAN_CONFIG,
  getPlanConfig,
  checkLimit,
  hasFeature,
  getPlanLimits,
  getPlanFeatures,
  getPlanPricing,
  updatePlanConfig,
  getAvailablePlans,
  checkMultipleLimits,
  getLimitWarning,
};
