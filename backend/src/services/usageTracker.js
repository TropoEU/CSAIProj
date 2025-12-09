import { db } from '../db.js';
import { ApiUsage } from '../models/ApiUsage.js';

/**
 * Enhanced Usage Tracking Service
 *
 * Provides comprehensive usage tracking and analytics for clients.
 * Works with any metric type - extensible for new usage types.
 */
export class UsageTracker {
  /**
   * Get current usage for any metric
   * @param {number} clientId - Client ID
   * @param {string} metric - Metric name (messages, tokens, conversations, cost, etc.)
   * @param {string} period - Time period ('day', 'week', 'month', 'year')
   * @returns {number} Current usage value
   */
  static async getCurrentUsage(clientId, metric, period = 'month') {
    const dateFilter = this.getDateFilter(period);

    const metricMap = {
      messages: 'SUM(message_count)',
      conversations: 'SUM(conversation_count)',
      tokens: 'SUM(tokens_input + tokens_output)',
      tokensInput: 'SUM(tokens_input)',
      tokensOutput: 'SUM(tokens_output)',
      toolCalls: 'SUM(tool_calls_count)',
      cost: 'SUM(cost_estimate)',
    };

    const sqlMetric = metricMap[metric] || 'COUNT(*)';

    const result = await db.query(
      `SELECT ${sqlMetric} as value
       FROM api_usage
       WHERE client_id = $1
       AND date >= ${dateFilter}`,
      [clientId]
    );

    return parseFloat(result.rows[0]?.value) || 0;
  }

  /**
   * Get usage history for a metric over time
   * @param {number} clientId - Client ID
   * @param {string} metric - Metric name
   * @param {number} months - Number of months to look back
   * @returns {Array} Array of { date, value } objects
   */
  static async getUsageHistory(clientId, metric, months = 12) {
    const metricMap = {
      messages: 'SUM(message_count)',
      conversations: 'SUM(conversation_count)',
      tokens: 'SUM(tokens_input + tokens_output)',
      tokensInput: 'SUM(tokens_input)',
      tokensOutput: 'SUM(tokens_output)',
      toolCalls: 'SUM(tool_calls_count)',
      cost: 'SUM(cost_estimate)',
    };

    const sqlMetric = metricMap[metric] || 'COUNT(*)';

    const result = await db.query(
      `SELECT
        TO_CHAR(date, 'YYYY-MM') as period,
        ${sqlMetric} as value
       FROM api_usage
       WHERE client_id = $1
       AND date >= NOW() - INTERVAL '${months} months'
       GROUP BY TO_CHAR(date, 'YYYY-MM')
       ORDER BY period ASC`,
      [clientId]
    );

    return result.rows.map(row => ({
      period: row.period,
      value: parseFloat(row.value) || 0,
    }));
  }

  /**
   * Get comprehensive usage summary for a client
   * @param {number} clientId - Client ID
   * @param {string} period - Time period ('month', 'week', 'day')
   * @returns {Object} Complete usage summary
   */
  static async getUsageSummary(clientId, period = 'month') {
    const dateFilter = this.getDateFilter(period);

    const result = await db.query(
      `SELECT
        SUM(conversation_count) as conversations,
        SUM(message_count) as messages,
        SUM(tokens_input) as tokens_input,
        SUM(tokens_output) as tokens_output,
        SUM(tokens_input + tokens_output) as tokens_total,
        SUM(tool_calls_count) as tool_calls,
        SUM(cost_estimate) as cost,
        COUNT(DISTINCT date) as active_days
       FROM api_usage
       WHERE client_id = $1
       AND date >= ${dateFilter}`,
      [clientId]
    );

    const usage = result.rows[0];

    return {
      conversations: parseInt(usage.conversations) || 0,
      messages: parseInt(usage.messages) || 0,
      tokens: {
        input: parseInt(usage.tokens_input) || 0,
        output: parseInt(usage.tokens_output) || 0,
        total: parseInt(usage.tokens_total) || 0,
      },
      toolCalls: parseInt(usage.tool_calls) || 0,
      cost: parseFloat(usage.cost) || 0,
      activeDays: parseInt(usage.active_days) || 0,
      period,
    };
  }

  /**
   * Get usage breakdown by tool
   * @param {number} clientId - Client ID
   * @param {string} period - Time period
   * @returns {Array} Array of { toolName, count, avgTime, successRate }
   */
  static async getToolUsageBreakdown(clientId, period = 'month') {
    const dateFilter = this.getDateFilter(period);

    const result = await db.query(
      `SELECT
        tool_name,
        COUNT(*) as count,
        AVG(execution_time_ms) as avg_time,
        SUM(CASE WHEN success = true THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as success_rate
       FROM tool_executions
       WHERE client_id = $1
       AND timestamp >= ${dateFilter}
       GROUP BY tool_name
       ORDER BY count DESC`,
      [clientId]
    );

    return result.rows.map(row => ({
      toolName: row.tool_name,
      count: parseInt(row.count),
      avgTime: Math.round(parseFloat(row.avg_time) || 0),
      successRate: Math.round(parseFloat(row.success_rate) || 0),
    }));
  }

  /**
   * Compare usage between two periods
   * @param {number} clientId - Client ID
   * @param {string} metric - Metric to compare
   * @param {string} period1 - First period ('current_month', 'last_month', etc.)
   * @param {string} period2 - Second period
   * @returns {Object} Comparison with percentage change
   */
  static async compareUsage(clientId, metric, period1 = 'month', period2 = 'last_month') {
    const value1 = await this.getCurrentUsage(clientId, metric, period1);
    const value2 = await this.getCurrentUsage(clientId, metric, period2);

    const change = value1 - value2;
    const percentChange = value2 === 0 ? (value1 > 0 ? 100 : 0) : (change / value2) * 100;

    return {
      current: value1,
      previous: value2,
      change,
      percentChange: Math.round(percentChange * 100) / 100,
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
    };
  }

  /**
   * Get daily usage breakdown for current month
   * @param {number} clientId - Client ID
   * @returns {Array} Array of daily usage
   */
  static async getDailyUsage(clientId) {
    const result = await db.query(
      `SELECT
        date,
        conversation_count as conversations,
        message_count as messages,
        tokens_input + tokens_output as tokens,
        tool_calls_count as tool_calls,
        cost_estimate as cost
       FROM api_usage
       WHERE client_id = $1
       AND date >= DATE_TRUNC('month', CURRENT_DATE)
       ORDER BY date ASC`,
      [clientId]
    );

    return result.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      conversations: parseInt(row.conversations) || 0,
      messages: parseInt(row.messages) || 0,
      tokens: parseInt(row.tokens) || 0,
      toolCalls: parseInt(row.tool_calls) || 0,
      cost: parseFloat(row.cost) || 0,
    }));
  }

  /**
   * Reset usage counters (for testing or manual reset)
   * @param {number} clientId - Client ID
   * @param {string} period - Period to reset
   */
  static async resetUsage(clientId, period = 'month') {
    const dateFilter = this.getDateFilter(period);

    await db.query(
      `DELETE FROM api_usage
       WHERE client_id = $1
       AND date >= $2`,
      [clientId, dateFilter]
    );

    return { success: true, message: `Usage reset for period: ${period}` };
  }

  /**
   * Get usage alerts (when approaching limits)
   * @param {number} clientId - Client ID
   * @param {Object} limits - Object with limit values
   * @param {number} warningThreshold - Percentage threshold (0.8 = 80%)
   * @returns {Array} Array of alerts
   */
  static async getUsageAlerts(clientId, limits, warningThreshold = 0.8) {
    const usage = await this.getUsageSummary(clientId, 'month');
    const alerts = [];

    for (const [metric, limit] of Object.entries(limits)) {
      if (limit === null || limit === 0) continue; // Skip unlimited

      let currentValue;
      if (metric === 'tokensPerMonth') {
        currentValue = usage.tokens.total;
      } else if (metric === 'messagesPerMonth') {
        currentValue = usage.messages;
      } else if (metric === 'conversationsPerMonth') {
        currentValue = usage.conversations;
      } else if (metric === 'toolCallsPerMonth') {
        currentValue = usage.toolCalls;
      } else if (metric === 'costLimitUSD') {
        currentValue = usage.cost;
      } else {
        continue;
      }

      const usagePercent = currentValue / limit;

      if (usagePercent >= 1) {
        alerts.push({
          metric,
          level: 'critical',
          message: `${metric} limit exceeded`,
          current: currentValue,
          limit,
          usagePercent: 100,
        });
      } else if (usagePercent >= warningThreshold) {
        alerts.push({
          metric,
          level: 'warning',
          message: `Approaching ${metric} limit`,
          current: currentValue,
          limit,
          usagePercent: Math.round(usagePercent * 100),
        });
      }
    }

    return alerts;
  }

  /**
   * Export usage data to CSV format
   * @param {number} clientId - Client ID
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {string} CSV formatted data
   */
  static async exportUsageCSV(clientId, startDate, endDate) {
    const result = await db.query(
      `SELECT
        date,
        conversation_count,
        message_count,
        tokens_input,
        tokens_output,
        tool_calls_count,
        cost_estimate
       FROM api_usage
       WHERE client_id = $1
       AND date BETWEEN $2 AND $3
       ORDER BY date ASC`,
      [clientId, startDate, endDate]
    );

    const headers = 'Date,Conversations,Messages,Tokens Input,Tokens Output,Tool Calls,Cost\n';
    const rows = result.rows
      .map(
        row =>
          `${row.date.toISOString().split('T')[0]},${row.conversation_count},${row.message_count},${row.tokens_input},${row.tokens_output},${row.tool_calls_count},${row.cost_estimate}`
      )
      .join('\n');

    return headers + rows;
  }

  /**
   * Get top clients by usage
   * @param {string} metric - Metric to rank by
   * @param {number} limit - Number of results
   * @param {string} period - Time period
   * @returns {Array} Top clients
   */
  static async getTopClients(metric = 'cost', limit = 10, period = 'month') {
    const dateFilter = this.getDateFilter(period);

    const metricMap = {
      messages: 'SUM(message_count)',
      conversations: 'SUM(conversation_count)',
      tokens: 'SUM(tokens_input + tokens_output)',
      toolCalls: 'SUM(tool_calls_count)',
      cost: 'SUM(cost_estimate)',
    };

    const sqlMetric = metricMap[metric] || 'SUM(cost_estimate)';

    const result = await db.query(
      `SELECT
        c.id,
        c.name,
        c.domain,
        c.plan_type,
        ${sqlMetric} as value
       FROM api_usage a
       JOIN clients c ON a.client_id = c.id
       WHERE a.date >= ${dateFilter}
       GROUP BY c.id, c.name, c.domain, c.plan_type
       ORDER BY value DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => ({
      clientId: row.id,
      clientName: row.name,
      domain: row.domain,
      planType: row.plan_type,
      value: parseFloat(row.value) || 0,
    }));
  }

  /**
   * Helper: Get date filter for period
   * @param {string} period - Period name
   * @returns {string} SQL date string
   */
  static getDateFilter(period) {
    const filters = {
      day: "CURRENT_DATE",
      week: "CURRENT_DATE - INTERVAL '7 days'",
      month: "DATE_TRUNC('month', CURRENT_DATE)",
      last_month: "DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')",
      quarter: "DATE_TRUNC('quarter', CURRENT_DATE)",
      year: "DATE_TRUNC('year', CURRENT_DATE)",
    };

    return filters[period] || filters.month;
  }
}

export default UsageTracker;
