import { db } from '../db.js';

/**
 * Plan Model
 * Manages plan configurations stored in the database
 */
export class Plan {
  /**
   * Find all plans
   * @param {boolean} activeOnly - If true, only return active plans
   * @returns {Promise<Array>} List of plans
   */
  static async findAll(activeOnly = false) {
    const query = activeOnly
      ? 'SELECT * FROM plans WHERE is_active = true ORDER BY sort_order ASC'
      : 'SELECT * FROM plans ORDER BY sort_order ASC';
    const result = await db.query(query);
    return result.rows;
  }

  /**
   * Find plan by ID
   * @param {number} id - Plan ID
   * @returns {Promise<Object|null>} Plan or null
   */
  static async findById(id) {
    const result = await db.query('SELECT * FROM plans WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  /**
   * Find plan by name
   * @param {string} name - Plan name (e.g., 'free', 'pro')
   * @returns {Promise<Object|null>} Plan or null
   */
  static async findByName(name) {
    const result = await db.query(
      'SELECT * FROM plans WHERE LOWER(name) = LOWER($1)',
      [name]
    );
    return result.rows[0] || null;
  }

  /**
   * Get the default plan
   * @returns {Promise<Object|null>} Default plan or null
   */
  static async getDefault() {
    const result = await db.query(
      'SELECT * FROM plans WHERE is_default = true LIMIT 1'
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new plan
   * @param {Object} planData - Plan data
   * @returns {Promise<Object>} Created plan
   */
  static async create(planData) {
    const {
      name,
      displayName,
      description,
      conversationsPerMonth,
      messagesPerMonth,
      tokensPerMonth,
      toolCallsPerMonth,
      integrationsEnabled,
      costLimitUsd,
      features,
      baseCost,
      usageMultiplier,
      isDefault,
      isActive,
      sortOrder,
    } = planData;

    // If this is being set as default, unset other defaults first
    if (isDefault) {
      await db.query('UPDATE plans SET is_default = false WHERE is_default = true');
    }

    const result = await db.query(
      `INSERT INTO plans (
        name, display_name, description,
        conversations_per_month, messages_per_month, tokens_per_month,
        tool_calls_per_month, integrations_enabled, cost_limit_usd,
        features, base_cost, usage_multiplier,
        is_default, is_active, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        name,
        displayName,
        description || null,
        conversationsPerMonth ?? null,
        messagesPerMonth ?? null,
        tokensPerMonth ?? null,
        toolCallsPerMonth ?? null,
        integrationsEnabled ?? null,
        costLimitUsd ?? null,
        JSON.stringify(features || {}),
        baseCost ?? 0,
        usageMultiplier ?? 0,
        isDefault ?? false,
        isActive ?? true,
        sortOrder ?? 0,
      ]
    );

    return result.rows[0];
  }

  /**
   * Update a plan
   * @param {number} id - Plan ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated plan
   */
  static async update(id, updates) {
    const allowedFields = [
      'name', 'display_name', 'description',
      'conversations_per_month', 'messages_per_month', 'tokens_per_month',
      'tool_calls_per_month', 'integrations_enabled', 'cost_limit_usd',
      'features', 'base_cost', 'usage_multiplier',
      'is_default', 'is_active', 'sort_order'
    ];

    // Map camelCase to snake_case
    const fieldMapping = {
      displayName: 'display_name',
      conversationsPerMonth: 'conversations_per_month',
      messagesPerMonth: 'messages_per_month',
      tokensPerMonth: 'tokens_per_month',
      toolCallsPerMonth: 'tool_calls_per_month',
      integrationsEnabled: 'integrations_enabled',
      costLimitUsd: 'cost_limit_usd',
      baseCost: 'base_cost',
      usageMultiplier: 'usage_multiplier',
      isDefault: 'is_default',
      isActive: 'is_active',
      sortOrder: 'sort_order',
    };

    // Convert camelCase keys to snake_case
    const normalizedUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = fieldMapping[key] || key;
      if (allowedFields.includes(snakeKey)) {
        normalizedUpdates[snakeKey] = value;
      }
    }

    // If setting as default, unset other defaults first
    if (normalizedUpdates.is_default === true) {
      await db.query('UPDATE plans SET is_default = false WHERE is_default = true AND id != $1', [id]);
    }

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(normalizedUpdates)) {
      if (key === 'features' && typeof value === 'object') {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(JSON.stringify(value));
      } else {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
      }
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return await this.findById(id);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const result = await db.query(
      `UPDATE plans SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Delete a plan
   * @param {number} id - Plan ID
   * @returns {Promise<boolean>} Success
   */
  static async delete(id) {
    // Check if any clients are using this plan
    const clientsUsingPlan = await db.query(
      `SELECT COUNT(*) FROM clients c 
       JOIN plans p ON LOWER(c.plan_type) = LOWER(p.name) 
       WHERE p.id = $1`,
      [id]
    );

    if (parseInt(clientsUsingPlan.rows[0].count) > 0) {
      throw new Error('Cannot delete plan: clients are currently using this plan');
    }

    const result = await db.query('DELETE FROM plans WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  /**
   * Get plan configuration in the format expected by planLimits.js
   * @param {string} planName - Plan name
   * @returns {Promise<Object|null>} Plan config or null
   */
  static async getConfig(planName) {
    const plan = await this.findByName(planName);
    if (!plan) return null;

    return this.toConfig(plan);
  }

  /**
   * Convert database plan to config format
   * @param {Object} plan - Plan from database
   * @returns {Object} Config format
   */
  static toConfig(plan) {
    return {
      limits: {
        conversationsPerMonth: plan.conversations_per_month,
        messagesPerMonth: plan.messages_per_month,
        tokensPerMonth: plan.tokens_per_month ? parseInt(plan.tokens_per_month) : null,
        toolCallsPerMonth: plan.tool_calls_per_month,
        integrationsEnabled: plan.integrations_enabled,
        costLimitUSD: plan.cost_limit_usd ? parseFloat(plan.cost_limit_usd) : null,
      },
      features: plan.features || {},
      pricing: {
        baseCost: parseFloat(plan.base_cost) || 0,
        usageMultiplier: parseFloat(plan.usage_multiplier) || 0,
      },
    };
  }

  /**
   * Get all plans as a config map (for caching)
   * @returns {Promise<Object>} Map of plan name to config
   */
  static async getAllConfigs() {
    const plans = await this.findAll(true);
    const configMap = {};

    for (const plan of plans) {
      configMap[plan.name.toLowerCase()] = this.toConfig(plan);
    }

    return configMap;
  }

  /**
   * Get clients count using a specific plan
   * @param {number} planId - Plan ID
   * @returns {Promise<number>} Number of clients
   */
  static async getClientsCount(planId) {
    const plan = await this.findById(planId);
    if (!plan) return 0;

    const result = await db.query(
      'SELECT COUNT(*) FROM clients WHERE LOWER(plan_type) = LOWER($1)',
      [plan.name]
    );
    return parseInt(result.rows[0].count) || 0;
  }
}

export default Plan;

