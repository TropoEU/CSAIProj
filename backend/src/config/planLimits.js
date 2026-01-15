/**
 * Plan Limits Configuration
 *
 * This module provides plan management with database storage and hardcoded fallbacks.
 * Plans are loaded from the database on first access and cached in memory.
 * Hardcoded defaults are used as fallback if database is unavailable.
 */

// Import Plan model lazily to avoid circular dependencies
let Plan = null;

/**
 * Cache for database plans
 */
let dbPlanCache = null;
let cacheLoadedAt = null;
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Hardcoded fallback plan configurations
 * Used when database is unavailable or during initial startup
 */
export const FALLBACK_PLANS = {
  // Unlimited plan - no restrictions (default for all clients)
  unlimited: {
    limits: {
      conversationsPerMonth: null, // null = unlimited
      messagesPerMonth: null,
      tokensPerMonth: null,
      toolCallsPerMonth: null,
      integrationsEnabled: null,
      costLimitUSD: null,
    },
    features: {
      llmProvider: 'claude-3-5-sonnet',
      customBranding: true,
      prioritySupport: true,
      advancedAnalytics: true,
      apiAccess: true,
      whiteLabel: true,
    },
    pricing: {
      baseCost: 0,
      usageMultiplier: 0,
    },
  },
  free: {
    limits: {
      conversationsPerMonth: 50,
      messagesPerMonth: 500,
      tokensPerMonth: 50000,
      toolCallsPerMonth: 25,
      integrationsEnabled: 1,
      costLimitUSD: 5,
    },
    features: {
      llmProvider: 'ollama',
      customBranding: false,
      prioritySupport: false,
      advancedAnalytics: false,
      apiAccess: false,
      whiteLabel: false,
    },
    pricing: {
      baseCost: 0,
      usageMultiplier: 0,
    },
  },
  starter: {
    limits: {
      conversationsPerMonth: 1000,
      messagesPerMonth: 10000,
      tokensPerMonth: 1000000,
      toolCallsPerMonth: 500,
      integrationsEnabled: 3,
      costLimitUSD: 100,
    },
    features: {
      llmProvider: 'claude-3-haiku',
      customBranding: false,
      prioritySupport: false,
      advancedAnalytics: true,
      apiAccess: true,
      whiteLabel: false,
    },
    pricing: {
      baseCost: 29.99,
      usageMultiplier: 0.00001,
    },
  },
  pro: {
    limits: {
      conversationsPerMonth: 10000,
      messagesPerMonth: 100000,
      tokensPerMonth: 10000000,
      toolCallsPerMonth: 5000,
      integrationsEnabled: 10,
      costLimitUSD: 500,
    },
    features: {
      llmProvider: 'claude-3-5-sonnet',
      customBranding: true,
      prioritySupport: true,
      advancedAnalytics: true,
      apiAccess: true,
      whiteLabel: true,
    },
    pricing: {
      baseCost: 99.99,
      usageMultiplier: 0.000008,
    },
  },
  enterprise: {
    limits: {
      conversationsPerMonth: 100000,
      messagesPerMonth: 1000000,
      tokensPerMonth: 100000000,
      toolCallsPerMonth: 50000,
      integrationsEnabled: null,
      costLimitUSD: 5000,
    },
    features: {
      llmProvider: 'claude-3-5-sonnet',
      customBranding: true,
      prioritySupport: true,
      advancedAnalytics: true,
      apiAccess: true,
      whiteLabel: true,
      dedicatedSupport: true,
      sla: true,
    },
    pricing: {
      baseCost: 499.99,
      usageMultiplier: 0.000005,
    },
  },
};

// For backwards compatibility
export const PLAN_CONFIG = FALLBACK_PLANS;

/**
 * Load Plan model lazily
 */
async function loadPlanModel() {
  if (!Plan) {
    const module = await import('../models/Plan.js');
    Plan = module.Plan;
  }
  return Plan;
}

/**
 * Check if cache is still valid
 */
function isCacheValid() {
  if (!dbPlanCache || !cacheLoadedAt) return false;
  return Date.now() - cacheLoadedAt < CACHE_TTL_MS;
}

/**
 * Load plans from database into cache
 * @returns {Promise<Object>} Map of plan name to config
 */
export async function loadPlansFromDatabase() {
  try {
    const PlanModel = await loadPlanModel();
    const configs = await PlanModel.getAllConfigs();
    dbPlanCache = configs;
    cacheLoadedAt = Date.now();
    return configs;
  } catch (error) {
    console.warn(
      '[PlanLimits] Failed to load plans from database, using fallbacks:',
      error.message
    );
    return null;
  }
}

/**
 * Clear the plan cache (call after updating plans)
 */
export function clearPlanCache() {
  dbPlanCache = null;
  cacheLoadedAt = null;
}

/**
 * Get plan configuration (sync version - uses cache or fallback)
 * @param {string} planType - Plan type (free, starter, pro, enterprise)
 * @returns {Object} Plan configuration
 */
export function getPlanConfig(planType) {
  const planKey = planType?.toLowerCase();

  // Try database cache first
  if (isCacheValid() && dbPlanCache) {
    const dbPlan = dbPlanCache[planKey];
    if (dbPlan) return dbPlan;
  }

  // Fall back to hardcoded plans
  const fallbackPlan = FALLBACK_PLANS[planKey];
  if (fallbackPlan) return fallbackPlan;

  // Default to unlimited for unknown plan types
  return FALLBACK_PLANS.unlimited;
}

/**
 * Get plan configuration (async version - refreshes cache if needed)
 * @param {string} planType - Plan type
 * @returns {Promise<Object>} Plan configuration
 */
export async function getPlanConfigAsync(planType) {
  const planKey = planType?.toLowerCase();

  // Refresh cache if needed
  if (!isCacheValid()) {
    await loadPlansFromDatabase();
  }

  // Try database cache first
  if (dbPlanCache) {
    const dbPlan = dbPlanCache[planKey];
    if (dbPlan) return dbPlan;
  }

  // Fall back to hardcoded plans
  const fallbackPlan = FALLBACK_PLANS[planKey];
  if (fallbackPlan) return fallbackPlan;

  // Default to unlimited
  return FALLBACK_PLANS.unlimited;
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
  if (limit === null || limit === undefined) {
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
 * Get list of all available plans (from cache or fallback)
 * @returns {Array} Array of plan names
 */
export function getAvailablePlans() {
  if (isCacheValid() && dbPlanCache) {
    return Object.keys(dbPlanCache);
  }
  return Object.keys(FALLBACK_PLANS);
}

/**
 * Get all available plans async (refreshes cache)
 * @returns {Promise<Array>} Array of plan names
 */
export async function getAvailablePlansAsync() {
  if (!isCacheValid()) {
    await loadPlansFromDatabase();
  }

  if (dbPlanCache) {
    return Object.keys(dbPlanCache);
  }
  return Object.keys(FALLBACK_PLANS);
}

/**
 * Check multiple limits at once
 * @param {string} planType - Plan type
 * @param {Object} usage - Object with usage values
 * @returns {Object} Results for each limit
 */
export function checkMultipleLimits(planType, usage) {
  const results = {};

  for (const [limitType, currentUsage] of Object.entries(usage)) {
    results[limitType] = checkLimit(planType, limitType, currentUsage);
  }

  const anyExceeded = Object.values(results).some((r) => r.exceeded);
  const allAllowed = Object.values(results).every((r) => r.allowed);

  return {
    results,
    anyExceeded,
    allAllowed,
    message: anyExceeded ? 'One or more limits exceeded' : 'All limits within range',
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
export function getLimitWarning(planType, limitType, currentUsage, warningThreshold = 0.8) {
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
  PLAN_CONFIG: FALLBACK_PLANS,
  FALLBACK_PLANS,
  loadPlansFromDatabase,
  clearPlanCache,
  getPlanConfig,
  getPlanConfigAsync,
  checkLimit,
  hasFeature,
  getPlanLimits,
  getPlanFeatures,
  getPlanPricing,
  getAvailablePlans,
  getAvailablePlansAsync,
  checkMultipleLimits,
  getLimitWarning,
};
