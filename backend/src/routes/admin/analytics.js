import express from 'express';
import { db } from '../../db.js';
import { HTTP_STATUS } from '../../config/constants.js';

const router = express.Router();

/**
 * GET /admin/stats/overview
 * Get dashboard overview statistics
 */
router.get('/overview', async (req, res) => {
  try {
    const clientsResult = await db.query("SELECT COUNT(*) FROM clients WHERE status = 'active'");
    const totalClients = parseInt(clientsResult.rows[0].count, 10);

    const convTodayResult = await db.query(
      'SELECT COUNT(*) FROM conversations WHERE DATE(started_at) = CURRENT_DATE'
    );
    const conversationsToday = parseInt(convTodayResult.rows[0].count, 10);

    const convYesterdayResult = await db.query(
      'SELECT COUNT(*) FROM conversations WHERE DATE(started_at) = CURRENT_DATE - 1'
    );
    const conversationsYesterday = parseInt(convYesterdayResult.rows[0].count, 10);

    const toolsTodayResult = await db.query(
      'SELECT COUNT(*) FROM tool_executions WHERE DATE(timestamp) = CURRENT_DATE'
    );
    const toolCallsToday = parseInt(toolsTodayResult.rows[0].count, 10);

    const toolsYesterdayResult = await db.query(
      'SELECT COUNT(*) FROM tool_executions WHERE DATE(timestamp) = CURRENT_DATE - 1'
    );
    const toolCallsYesterday = parseInt(toolsYesterdayResult.rows[0].count, 10);

    const tokensResult = await db.query(
      'SELECT COALESCE(SUM(tokens_used), 0) as total FROM messages WHERE DATE(timestamp) = CURRENT_DATE'
    );
    const tokensUsedToday = parseInt(tokensResult.rows[0].total, 10);

    const convOverTimeResult = await db.query(`
      SELECT DATE(started_at) as date, COUNT(*) as count
      FROM conversations
      WHERE started_at >= CURRENT_DATE - 7
      GROUP BY DATE(started_at)
      ORDER BY date
    `);

    const toolUsageResult = await db.query(`
      SELECT tool_name as name, COUNT(*) as count
      FROM tool_executions
      WHERE timestamp >= CURRENT_DATE - 7
      GROUP BY tool_name
      ORDER BY count DESC
      LIMIT 5
    `);

    const recentActivityResult = await db.query(`
      SELECT c.id, c.session_id, cl.name as client_name,
             m.content as message, te.tool_name as tool_used,
             c.started_at as time
      FROM conversations c
      LEFT JOIN clients cl ON c.client_id = cl.id
      LEFT JOIN messages m ON m.conversation_id = c.id AND m.role = 'user'
      LEFT JOIN tool_executions te ON te.conversation_id = c.id
      ORDER BY c.started_at DESC
      LIMIT 5
    `);

    const conversationsTrend =
      conversationsYesterday > 0
        ? Math.round(
            ((conversationsToday - conversationsYesterday) / conversationsYesterday) * 100
          )
        : 0;

    const toolCallsTrend =
      toolCallsYesterday > 0
        ? Math.round(((toolCallsToday - toolCallsYesterday) / toolCallsYesterday) * 100)
        : 0;

    res.json({
      totalClients,
      conversationsToday,
      conversationsTrend,
      toolCallsToday,
      toolCallsTrend,
      tokensUsedToday,
      conversationsOverTime: convOverTimeResult.rows.map((r) => ({
        date: r.date.toISOString().split('T')[0],
        count: parseInt(r.count, 10),
      })),
      toolUsage: toolUsageResult.rows.map((r) => ({
        name: r.name,
        count: parseInt(r.count, 10),
      })),
      recentActivity: recentActivityResult.rows.map((r) => ({
        clientName: r.client_name,
        message: r.message?.substring(0, 50) + (r.message?.length > 50 ? '...' : ''),
        toolUsed: r.tool_used,
        time: new Date(r.time).toLocaleTimeString(),
      })),
    });
  } catch (error) {
    console.error('[Admin] Get overview stats error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get overview stats' });
  }
});

/**
 * GET /admin/stats/tools
 * Get tool usage statistics
 */
router.get('/tools', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT tool_name, COUNT(*) as count,
             AVG(execution_time_ms) as avg_time,
             SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as success_count,
             SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as error_count
      FROM tool_executions
      WHERE DATE(timestamp) = CURRENT_DATE
      GROUP BY tool_name
      ORDER BY count DESC
    `);

    const stats = result.rows.map((r) => ({
      tool_name: r.tool_name,
      count: parseInt(r.count, 10),
      avg_time: Math.round(parseFloat(r.avg_time) || 0),
      success_rate:
        r.count > 0 ? Math.round((parseInt(r.success_count, 10) / parseInt(r.count, 10)) * 100) : 0,
    }));

    res.json(stats);
  } catch (error) {
    console.error('[Admin] Get tool stats error:', error);
    console.error('[Admin] Error details:', error.message, error.stack);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get tool stats', details: error.message });
  }
});

/**
 * GET /admin/stats/conversations
 * Get conversation statistics
 */
router.get('/conversations', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN DATE(started_at) = CURRENT_DATE THEN 1 END) as today,
        AVG(EXTRACT(EPOCH FROM (ended_at - started_at))/60) as avg_duration_minutes
      FROM conversations
      WHERE started_at >= CURRENT_DATE - 30
    `);

    res.json({
      total: parseInt(result.rows[0].total, 10),
      today: parseInt(result.rows[0].today, 10),
      avgDurationMinutes: Math.round(parseFloat(result.rows[0].avg_duration_minutes) || 0),
    });
  } catch (error) {
    console.error('[Admin] Get conversation stats error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get conversation stats' });
  }
});

export default router;
