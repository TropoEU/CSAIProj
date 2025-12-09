import { checkLimit, getPlanConfig, hasFeature } from '../config/planLimits.js';
import { ApiUsage } from '../models/ApiUsage.js';
import { db } from '../db.js';

/**
 * Plan Enforcement Middleware
 *
 * Generic middleware that enforces plan limits based on configurable thresholds.
 * Works with any limit type defined in planLimits.js
 */

/**
 * Get current usage for a client for the current month
 * @param {number} clientId - Client ID
 * @returns {Object} Usage statistics
 */
async function getCurrentMonthUsage(clientId) {
  const result = await db.query(
    `SELECT
      SUM(conversation_count) as conversations,
      SUM(message_count) as messages,
      SUM(tokens_input + tokens_output) as tokens,
      SUM(tool_calls_count) as tool_calls,
      SUM(cost_estimate) as cost
    FROM api_usage
    WHERE client_id = $1
    AND date >= DATE_TRUNC('month', CURRENT_DATE)`,
    [clientId]
  );

  const usage = result.rows[0];

  return {
    conversationsPerMonth: parseInt(usage.conversations) || 0,
    messagesPerMonth: parseInt(usage.messages) || 0,
    tokensPerMonth: parseInt(usage.tokens) || 0,
    toolCallsPerMonth: parseInt(usage.tool_calls) || 0,
    costLimitUSD: parseFloat(usage.cost) || 0,
  };
}

/**
 * Get number of active integrations for a client
 * @param {number} clientId - Client ID
 * @returns {number} Number of integrations
 */
async function getIntegrationsCount(clientId) {
  const result = await db.query(
    'SELECT COUNT(*) FROM client_integrations WHERE client_id = $1 AND enabled = true',
    [clientId]
  );
  return parseInt(result.rows[0].count) || 0;
}

/**
 * Middleware to check plan limits before processing requests
 * Can be configured to check specific limits
 *
 * @param {Object} options - Configuration options
 * @param {Array<string>} options.checkLimits - Array of limit types to check (e.g., ['messagesPerMonth', 'tokensPerMonth'])
 * @param {boolean} options.strict - If true, block request if any limit exceeded. If false, just log warning
 * @returns {Function} Express middleware function
 */
export function checkPlanLimits(options = {}) {
  const {
    checkLimits = ['messagesPerMonth'], // Default: check message limit
    strict = true, // Default: strictly enforce limits
  } = options;

  return async (req, res, next) => {
    try {
      // Client should be set by authentication middleware
      const client = req.client;

      if (!client) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const planType = client.plan_type || 'free';
      const planConfig = getPlanConfig(planType);

      // Get current usage
      const usage = await getCurrentMonthUsage(client.id);

      // Add integrations count if checking integration limits
      if (checkLimits.includes('integrationsEnabled')) {
        usage.integrationsEnabled = await getIntegrationsCount(client.id);
      }

      // Check each specified limit
      const violations = [];

      for (const limitType of checkLimits) {
        const currentUsage = usage[limitType] || 0;
        const limitCheck = checkLimit(planType, limitType, currentUsage);

        if (limitCheck.exceeded) {
          violations.push({
            limitType,
            current: currentUsage,
            limit: limitCheck.limit,
            message: `${limitType} limit exceeded (${currentUsage}/${limitCheck.limit})`,
          });
        }
      }

      // If there are violations
      if (violations.length > 0) {
        if (strict) {
          // Strict mode: block the request
          return res.status(429).json({
            error: 'Plan limit exceeded',
            planType,
            violations,
            message: 'Please upgrade your plan or contact support',
            upgradeUrl: '/admin/clients', // TODO: Add client-facing upgrade URL
          });
        } else {
          // Non-strict mode: log warning but allow request
          console.warn(
            `[Plan Limits] Client ${client.id} (${client.name}) exceeded limits:`,
            violations
          );

          // Attach violation info to request for logging
          req.planViolations = violations;
        }
      }

      // Attach usage info to request for reference
      req.currentUsage = usage;
      req.planConfig = planConfig;

      next();
    } catch (error) {
      console.error('[Plan Limits] Error checking limits:', error);

      // Don't block requests due to limit check errors (fail open)
      next();
    }
  };
}

/**
 * Middleware to check if a specific feature is enabled for the client's plan
 * @param {string} featureName - Feature name (e.g., 'customBranding', 'apiAccess')
 * @returns {Function} Express middleware function
 */
export function requireFeature(featureName) {
  return async (req, res, next) => {
    try {
      const client = req.client;

      if (!client) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const planType = client.plan_type || 'free';

      if (!hasFeature(planType, featureName)) {
        return res.status(403).json({
          error: 'Feature not available',
          feature: featureName,
          planType,
          message: `This feature is not available on the ${planType} plan. Please upgrade your plan.`,
        });
      }

      next();
    } catch (error) {
      console.error('[Plan Features] Error checking feature:', error);
      // Fail closed for features (deny access on error)
      return res.status(500).json({ error: 'Failed to check feature access' });
    }
  };
}

/**
 * Middleware to add usage warnings to responses
 * Attaches usage information to response headers
 */
export function addUsageHeaders() {
  return async (req, res, next) => {
    try {
      const client = req.client;

      if (!client) {
        return next();
      }

      const planType = client.plan_type || 'free';
      const usage = await getCurrentMonthUsage(client.id);

      // Check message limit
      const messageLimit = checkLimit(planType, 'messagesPerMonth', usage.messagesPerMonth);

      // Add headers
      if (messageLimit.limit !== null) {
        res.setHeader('X-RateLimit-Limit', messageLimit.limit);
        res.setHeader('X-RateLimit-Remaining', messageLimit.remaining);
        res.setHeader('X-RateLimit-Reset', getMonthlyResetTime());
      }

      // Add warning header if approaching limit
      if (messageLimit.limit !== null) {
        const usagePercent = (usage.messagesPerMonth / messageLimit.limit) * 100;
        if (usagePercent >= 80) {
          res.setHeader(
            'X-RateLimit-Warning',
            `Approaching limit (${usagePercent.toFixed(0)}% used)`
          );
        }
      }

      next();
    } catch (error) {
      console.error('[Usage Headers] Error adding headers:', error);
      next();
    }
  };
}

/**
 * Get timestamp for when monthly limits reset (start of next month)
 * @returns {string} ISO timestamp
 */
function getMonthlyResetTime() {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString();
}

/**
 * Middleware to log plan violations for analytics
 */
export function logPlanViolations() {
  return async (req, res, next) => {
    // Execute after response is sent
    res.on('finish', () => {
      if (req.planViolations && req.planViolations.length > 0) {
        // TODO: Log to analytics/monitoring system
        console.log('[Plan Violations]', {
          clientId: req.client?.id,
          clientName: req.client?.name,
          planType: req.client?.plan_type,
          violations: req.planViolations,
          timestamp: new Date().toISOString(),
          endpoint: req.path,
        });

        // Could also:
        // - Send email notification
        // - Trigger webhook
        // - Update dashboard alert
        // - Log to external monitoring service
      }
    });

    next();
  };
}

/**
 * Combined middleware for complete plan enforcement
 * Checks limits, adds headers, and logs violations
 *
 * @param {Object} options - Configuration options
 * @returns {Array<Function>} Array of middleware functions
 */
export function enforcePlanLimits(options = {}) {
  return [
    checkPlanLimits(options),
    addUsageHeaders(),
    logPlanViolations(),
  ];
}

/**
 * Default export
 */
export default {
  checkPlanLimits,
  requireFeature,
  addUsageHeaders,
  logPlanViolations,
  enforcePlanLimits,
};
