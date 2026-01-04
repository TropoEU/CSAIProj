import express from 'express';
import { HTTP_STATUS } from '../../config/constants.js';
import { Client } from '../../models/Client.js';
import { UsageTracker } from '../../services/usageTracker.js';
import { db } from '../../db.js';

const router = express.Router();

/**
 * GET /admin/clients/:id/usage
 * Get current usage for a client
 */
router.get('/clients/:id/usage', async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const summary = await UsageTracker.getUsageSummary(req.params.id, period);
    res.json(summary);
  } catch (error) {
    console.error('[Admin] Get client usage error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get client usage' });
  }
});

/**
 * GET /admin/clients/:id/usage/history
 * Get usage history for a client
 */
router.get('/clients/:id/usage/history', async (req, res) => {
  try {
    const { metric = 'messages', months = 12 } = req.query;
    const history = await UsageTracker.getUsageHistory(req.params.id, metric, parseInt(months, 10));
    res.json(history);
  } catch (error) {
    console.error('[Admin] Get usage history error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get usage history' });
  }
});

/**
 * GET /admin/clients/:id/usage/daily
 * Get daily usage breakdown for current month
 */
router.get('/clients/:id/usage/daily', async (req, res) => {
  try {
    const daily = await UsageTracker.getDailyUsage(req.params.id);
    res.json(daily);
  } catch (error) {
    console.error('[Admin] Get daily usage error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get daily usage' });
  }
});

/**
 * GET /admin/clients/:id/usage/tools
 * Get tool usage breakdown
 */
router.get('/clients/:id/usage/tools', async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const tools = await UsageTracker.getToolUsageBreakdown(req.params.id, period);
    res.json(tools);
  } catch (error) {
    console.error('[Admin] Get tool usage error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get tool usage' });
  }
});

/**
 * GET /admin/clients/:id/usage/compare
 * Compare usage between periods
 */
router.get('/clients/:id/usage/compare', async (req, res) => {
  try {
    const { metric = 'messages', period1 = 'month', period2 = 'last_month' } = req.query;
    const comparison = await UsageTracker.compareUsage(req.params.id, metric, period1, period2);
    res.json(comparison);
  } catch (error) {
    console.error('[Admin] Compare usage error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to compare usage' });
  }
});

/**
 * GET /admin/clients/:id/usage/alerts
 * Get usage alerts for a client
 */
router.get('/clients/:id/usage/alerts', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Client not found' });
    }

    const limits = {
      messagesPerMonth: 10000,
      tokensPerMonth: 1000000,
      costLimitUSD: 100,
    };

    const alerts = await UsageTracker.getUsageAlerts(req.params.id, limits, 0.8);
    res.json(alerts);
  } catch (error) {
    console.error('[Admin] Get usage alerts error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get usage alerts' });
  }
});

/**
 * GET /admin/clients/:id/usage/export
 * Export usage data as CSV
 */
router.get('/clients/:id/usage/export', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Start date and end date are required' });
    }

    const csv = await UsageTracker.exportUsageCSV(req.params.id, startDate, endDate);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=usage-${req.params.id}-${startDate}-${endDate}.csv`
    );
    res.send(csv);
  } catch (error) {
    console.error('[Admin] Export usage error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to export usage' });
  }
});

/**
 * GET /admin/usage/summary
 * Get usage summary for all clients
 */
router.get('/summary', async (req, res) => {
  try {
    const { period = 'month' } = req.query;

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
       WHERE date >= ${UsageTracker.getDateFilter(period)}`
    );

    const usage = result.rows[0];

    res.json({
      conversations: parseInt(usage.conversations, 10) || 0,
      messages: parseInt(usage.messages, 10) || 0,
      tokens: {
        input: parseInt(usage.tokens_input, 10) || 0,
        output: parseInt(usage.tokens_output, 10) || 0,
        total: parseInt(usage.tokens_total, 10) || 0,
      },
      toolCalls: parseInt(usage.tool_calls, 10) || 0,
      cost: parseFloat(usage.cost) || 0,
      activeDays: parseInt(usage.active_days, 10) || 0,
      period,
    });
  } catch (error) {
    console.error('[Admin] Get usage summary error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get usage summary' });
  }
});

/**
 * GET /admin/usage/history
 * Get aggregated usage history across all clients
 */
router.get('/history', async (req, res) => {
  try {
    const { metric = 'messages', months = 12 } = req.query;

    const metricMap = {
      messages: 'SUM(message_count)',
      conversations: 'SUM(conversation_count)',
      tokens: 'SUM(tokens_input + tokens_output)',
      tokensInput: 'SUM(tokens_input)',
      tokensOutput: 'SUM(tokens_output)',
      toolCalls: 'SUM(tool_calls_count)',
      cost: 'SUM(cost_estimate)',
    };

    const sqlMetric = metricMap[metric] || 'SUM(message_count)';

    const result = await db.query(
      `SELECT
        TO_CHAR(date, 'YYYY-MM') as period,
        ${sqlMetric} as value
       FROM api_usage
       WHERE date >= NOW() - INTERVAL '${parseInt(months, 10)} months'
       GROUP BY TO_CHAR(date, 'YYYY-MM')
       ORDER BY period ASC`
    );

    res.json(
      result.rows.map((row) => ({
        period: row.period,
        value: parseFloat(row.value) || 0,
      }))
    );
  } catch (error) {
    console.error('[Admin] Get usage history error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get usage history' });
  }
});

/**
 * GET /admin/usage/top-clients
 * Get top clients by usage metric
 */
router.get('/top-clients', async (req, res) => {
  try {
    const { metric = 'cost', limit = 10, period = 'month' } = req.query;
    const topClients = await UsageTracker.getTopClients(metric, parseInt(limit, 10), period);
    res.json(topClients);
  } catch (error) {
    console.error('[Admin] Get top clients error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get top clients' });
  }
});

export default router;
