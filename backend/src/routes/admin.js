import express from 'express';
import { Admin } from '../models/Admin.js';
import { Client } from '../models/Client.js';
import { Tool } from '../models/Tool.js';
import { ClientTool } from '../models/ClientTool.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { ToolExecution } from '../models/ToolExecution.js';
import { ClientIntegration } from '../models/ClientIntegration.js';
import { authenticateAdmin, generateToken } from '../middleware/adminAuth.js';
import conversationService from '../services/conversationService.js';
import toolManager from '../services/toolManager.js';
import n8nService from '../services/n8nService.js';
import { db } from '../db.js';

const router = express.Router();

// =====================================================
// AUTH ROUTES (No auth required)
// =====================================================

/**
 * POST /admin/login
 * Authenticate admin and return JWT token
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const admin = await Admin.verifyCredentials(username, password);

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(admin);

    res.json({
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error('[Admin] Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /admin/verify
 * Verify JWT token and return admin info
 */
router.get('/verify', authenticateAdmin, (req, res) => {
  res.json({
    admin: {
      id: req.admin.id,
      username: req.admin.username,
      email: req.admin.email,
      role: req.admin.role,
    },
  });
});

/**
 * POST /admin/logout
 * Logout (client-side token removal, just acknowledge)
 */
router.post('/logout', authenticateAdmin, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// =====================================================
// All routes below require authentication
// =====================================================
router.use(authenticateAdmin);

// =====================================================
// CLIENT ROUTES
// =====================================================

/**
 * GET /admin/clients
 * Get all clients with optional filtering
 */
router.get('/clients', async (req, res) => {
  try {
    const { status, search, limit = 100, offset = 0 } = req.query;
    let clients = await Client.findAll(parseInt(limit), parseInt(offset));

    if (status && status !== 'all') {
      clients = clients.filter((c) => c.status === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      clients = clients.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.domain?.toLowerCase().includes(searchLower)
      );
    }

    res.json(clients);
  } catch (error) {
    console.error('[Admin] Get clients error:', error);
    res.status(500).json({ error: 'Failed to get clients' });
  }
});

/**
 * GET /admin/clients/:id
 * Get client by ID
 */
router.get('/clients/:id', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    console.error('[Admin] Get client error:', error);
    res.status(500).json({ error: 'Failed to get client' });
  }
});

/**
 * POST /admin/clients
 * Create a new client
 */
router.post('/clients', async (req, res) => {
  try {
    const { name, domain, planType = 'free' } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const client = await Client.create(name, domain, planType);
    res.status(201).json(client);
  } catch (error) {
    console.error('[Admin] Create client error:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

/**
 * PUT /admin/clients/:id
 * Update client
 */
router.put('/clients/:id', async (req, res) => {
  try {
    const { name, domain, plan_type, status } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (domain !== undefined) updates.domain = domain;
    if (plan_type !== undefined) updates.plan_type = plan_type;
    if (status !== undefined) updates.status = status;

    const client = await Client.update(req.params.id, updates);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    console.error('[Admin] Update client error:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

/**
 * DELETE /admin/clients/:id
 * Delete client (soft delete)
 */
router.delete('/clients/:id', async (req, res) => {
  try {
    const client = await Client.deactivate(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json({ message: 'Client deactivated', client });
  } catch (error) {
    console.error('[Admin] Delete client error:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

/**
 * POST /admin/clients/:id/api-key
 * Regenerate client API key
 */
router.post('/clients/:id/api-key', async (req, res) => {
  try {
    const client = await Client.regenerateApiKey(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    console.error('[Admin] Regenerate API key error:', error);
    res.status(500).json({ error: 'Failed to regenerate API key' });
  }
});

/**
 * GET /admin/clients/:id/stats
 * Get client statistics
 */
router.get('/clients/:id/stats', async (req, res) => {
  try {
    const clientId = req.params.id;

    // Get conversation count
    const convResult = await db.query(
      'SELECT COUNT(*) FROM conversations WHERE client_id = $1',
      [clientId]
    );

    // Get message count
    const msgResult = await db.query(
      `SELECT COUNT(*) FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE c.client_id = $1`,
      [clientId]
    );

    // Get tool execution count
    const toolResult = await db.query(
      'SELECT COUNT(*) FROM tool_executions WHERE client_id = $1',
      [clientId]
    );

    res.json({
      conversations: parseInt(convResult.rows[0].count),
      messages: parseInt(msgResult.rows[0].count),
      toolExecutions: parseInt(toolResult.rows[0].count),
    });
  } catch (error) {
    console.error('[Admin] Get client stats error:', error);
    res.status(500).json({ error: 'Failed to get client stats' });
  }
});

// =====================================================
// TOOL ROUTES
// =====================================================

/**
 * GET /admin/tools
 * Get all tool definitions
 */
router.get('/tools', async (req, res) => {
  try {
    const tools = await Tool.getAll();
    res.json(tools);
  } catch (error) {
    console.error('[Admin] Get tools error:', error);
    res.status(500).json({ error: 'Failed to get tools' });
  }
});

/**
 * POST /admin/tools
 * Create a new tool definition
 */
router.post('/tools', async (req, res) => {
  try {
    const { toolName, description, parametersSchema } = req.body;

    if (!toolName || !description) {
      return res.status(400).json({ error: 'Tool name and description are required' });
    }

    const tool = await Tool.create(toolName, description, parametersSchema || {});
    res.status(201).json(tool);
  } catch (error) {
    console.error('[Admin] Create tool error:', error);
    res.status(500).json({ error: 'Failed to create tool' });
  }
});

/**
 * GET /admin/clients/:clientId/tools
 * Get tools enabled for a client
 */
router.get('/clients/:clientId/tools', async (req, res) => {
  try {
    const tools = await ClientTool.getAllTools(req.params.clientId);
    res.json(tools);
  } catch (error) {
    console.error('[Admin] Get client tools error:', error);
    res.status(500).json({ error: 'Failed to get client tools' });
  }
});

/**
 * POST /admin/clients/:clientId/tools
 * Enable a tool for a client
 */
router.post('/clients/:clientId/tools', async (req, res) => {
  try {
    const { toolId, webhookUrl } = req.body;

    if (!toolId || !webhookUrl) {
      return res.status(400).json({ error: 'Tool ID and webhook URL are required' });
    }

    const clientTool = await ClientTool.enable(
      req.params.clientId,
      toolId,
      webhookUrl
    );
    res.status(201).json(clientTool);
  } catch (error) {
    console.error('[Admin] Enable tool error:', error);
    res.status(500).json({ error: 'Failed to enable tool' });
  }
});

/**
 * PUT /admin/clients/:clientId/tools/:id
 * Update client tool configuration
 */
router.put('/clients/:clientId/tools/:id', async (req, res) => {
  try {
    const { webhookUrl, enabled } = req.body;
    const updates = {};

    if (webhookUrl !== undefined) updates.n8n_webhook_url = webhookUrl;
    if (enabled !== undefined) updates.enabled = enabled;

    const clientTool = await ClientTool.update(req.params.clientId, req.params.id, updates);
    if (!clientTool) {
      return res.status(404).json({ error: 'Client tool not found' });
    }
    res.json(clientTool);
  } catch (error) {
    console.error('[Admin] Update client tool error:', error);
    res.status(500).json({ error: 'Failed to update client tool' });
  }
});

/**
 * DELETE /admin/clients/:clientId/tools/:id
 * Disable a tool for a client
 */
router.delete('/clients/:clientId/tools/:id', async (req, res) => {
  try {
    await ClientTool.delete(req.params.clientId, req.params.id);
    res.json({ message: 'Tool disabled' });
  } catch (error) {
    console.error('[Admin] Disable tool error:', error);
    res.status(500).json({ error: 'Failed to disable tool' });
  }
});

/**
 * POST /admin/tools/:id/test
 * Test a tool by calling its webhook
 */
router.post('/tools/:id/test', async (req, res) => {
  try {
    const { webhookUrl, params } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({ error: 'Webhook URL is required' });
    }

    const result = await n8nService.executeTool(webhookUrl, params || {});
    res.json(result);
  } catch (error) {
    console.error('[Admin] Test tool error:', error);
    res.status(500).json({ error: 'Tool test failed', message: error.message });
  }
});

// =====================================================
// CONVERSATION ROUTES
// =====================================================

/**
 * GET /admin/conversations
 * Get all conversations with pagination
 */
router.get('/conversations', async (req, res) => {
  try {
    const { clientId, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT c.*, cl.name as client_name,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
        (SELECT COUNT(*) FROM tool_executions WHERE conversation_id = c.id) as tool_call_count
      FROM conversations c
      LEFT JOIN clients cl ON c.client_id = cl.id
    `;
    const params = [];

    if (clientId && clientId !== 'all') {
      query += ' WHERE c.client_id = $1';
      params.push(clientId);
    }

    query += ' ORDER BY c.started_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(parseInt(limit), offset);

    const result = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM conversations';
    const countParams = [];
    if (clientId && clientId !== 'all') {
      countQuery += ' WHERE client_id = $1';
      countParams.push(clientId);
    }
    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      conversations: result.rows,
      page: parseInt(page),
      limit: parseInt(limit),
      totalCount,
      totalPages: Math.ceil(totalCount / parseInt(limit)),
    });
  } catch (error) {
    console.error('[Admin] Get conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

/**
 * GET /admin/conversations/:id
 * Get conversation with messages and tool executions
 */
router.get('/conversations/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get client name
    const client = await Client.findById(conversation.client_id);
    conversation.client_name = client?.name;

    // Get messages
    const messages = await Message.getAll(conversation.id);
    conversation.messages = messages;

    // Get tool executions
    const toolExecutions = await ToolExecution.getByConversation(conversation.id);
    conversation.tool_executions = toolExecutions;

    res.json(conversation);
  } catch (error) {
    console.error('[Admin] Get conversation error:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

/**
 * GET /admin/conversations/export
 * Export conversations as CSV or JSON
 */
router.get('/conversations/export', async (req, res) => {
  try {
    const { clientId, format = 'json' } = req.query;

    let query = `
      SELECT c.*, cl.name as client_name
      FROM conversations c
      LEFT JOIN clients cl ON c.client_id = cl.id
    `;
    const params = [];

    if (clientId && clientId !== 'all') {
      query += ' WHERE c.client_id = $1';
      params.push(clientId);
    }

    query += ' ORDER BY c.started_at DESC';

    const result = await db.query(query, params);

    if (format === 'csv') {
      const headers = 'id,session_id,client_name,started_at,ended_at\n';
      const rows = result.rows
        .map((r) => `${r.id},${r.session_id},${r.client_name || ''},${r.started_at},${r.ended_at || ''}`)
        .join('\n');
      res.set('Content-Type', 'text/csv');
      res.send(headers + rows);
    } else {
      res.json(result.rows);
    }
  } catch (error) {
    console.error('[Admin] Export conversations error:', error);
    res.status(500).json({ error: 'Failed to export conversations' });
  }
});

// =====================================================
// INTEGRATION ROUTES
// =====================================================

/**
 * GET /admin/clients/:clientId/integrations
 * Get integrations for a client
 */
router.get('/clients/:clientId/integrations', async (req, res) => {
  try {
    const integrationList = await ClientIntegration.getByClient(req.params.clientId);
    
    // Transform database format to frontend format
    const formattedIntegrations = integrationList.map(integration => ({
      id: integration.id,
      client_id: integration.client_id,
      integration_type: integration.integration_type,
      name: integration.connection_config?.name || 'Unnamed Integration',
      status: integration.enabled ? 'active' : 'inactive',
      last_tested_at: integration.last_sync_test,
      created_at: integration.created_at,
      updated_at: integration.updated_at,
      connection_config: integration.connection_config,
      enabled: integration.enabled,
    }));
    
    res.json(formattedIntegrations);
  } catch (error) {
    console.error('[Admin] Get integrations error:', error);
    res.status(500).json({ error: 'Failed to get integrations' });
  }
});

/**
 * POST /admin/clients/:clientId/integrations
 * Create a new integration
 */
router.post('/clients/:clientId/integrations', async (req, res) => {
  try {
    const { integrationType, name, apiKey, apiSecret, webhookUrl, config } = req.body;

    if (!integrationType || !name) {
      return res.status(400).json({ error: 'Integration type and name are required' });
    }

    const connectionConfig = {
      name,
      api_key: apiKey,
      api_secret: apiSecret,
      webhook_url: webhookUrl,
      ...(config ? JSON.parse(config) : {}),
    };

    const integration = await ClientIntegration.create(
      req.params.clientId,
      integrationType,
      connectionConfig
    );

    res.status(201).json(integration);
  } catch (error) {
    console.error('[Admin] Create integration error:', error);
    res.status(500).json({ error: 'Failed to create integration' });
  }
});

/**
 * PUT /admin/integrations/:id
 * Update integration
 */
router.put('/integrations/:id', async (req, res) => {
  try {
    const { integrationType, name, apiKey, apiSecret, webhookUrl, config } = req.body;

    const existingIntegration = await ClientIntegration.findById(req.params.id);
    if (!existingIntegration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const connectionConfig = {
      ...existingIntegration.connection_config,
      ...(name && { name }),
      ...(apiKey && { api_key: apiKey }),
      ...(apiSecret && { api_secret: apiSecret }),
      ...(webhookUrl !== undefined && { webhook_url: webhookUrl }),
      ...(config && JSON.parse(config)),
    };

    const integration = await ClientIntegration.updateConfig(req.params.id, connectionConfig);
    res.json(integration);
  } catch (error) {
    console.error('[Admin] Update integration error:', error);
    res.status(500).json({ error: 'Failed to update integration' });
  }
});

/**
 * DELETE /admin/integrations/:id
 * Delete integration
 */
router.delete('/integrations/:id', async (req, res) => {
  try {
    await ClientIntegration.delete(req.params.id);
    res.json({ message: 'Integration deleted' });
  } catch (error) {
    console.error('[Admin] Delete integration error:', error);
    res.status(500).json({ error: 'Failed to delete integration' });
  }
});

/**
 * POST /admin/integrations/:id/test
 * Test integration connection
 */
router.post('/integrations/:id/test', async (req, res) => {
  try {
    const integration = await ClientIntegration.findById(req.params.id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const webhookUrl = integration.connection_config?.webhook_url;

    // For now, just test if webhook URL is reachable
    if (webhookUrl) {
      try {
        const result = await n8nService.testWebhook(webhookUrl);
        await ClientIntegration.updateSyncTest(req.params.id);
        res.json({ message: 'Connection successful', result });
      } catch (error) {
        res.status(400).json({ error: 'Connection failed', message: error.message });
      }
    } else {
      res.json({ message: 'No webhook URL to test' });
    }
  } catch (error) {
    console.error('[Admin] Test integration error:', error);
    res.status(500).json({ error: 'Failed to test integration' });
  }
});

// =====================================================
// ANALYTICS ROUTES
// =====================================================

/**
 * GET /admin/stats/overview
 * Get dashboard overview statistics
 */
router.get('/stats/overview', async (req, res) => {
  try {
    // Total clients
    const clientsResult = await db.query("SELECT COUNT(*) FROM clients WHERE status = 'active'");
    const totalClients = parseInt(clientsResult.rows[0].count);

    // Conversations today
    const convTodayResult = await db.query(
      "SELECT COUNT(*) FROM conversations WHERE DATE(started_at) = CURRENT_DATE"
    );
    const conversationsToday = parseInt(convTodayResult.rows[0].count);

    // Conversations yesterday (for trend)
    const convYesterdayResult = await db.query(
      "SELECT COUNT(*) FROM conversations WHERE DATE(started_at) = CURRENT_DATE - 1"
    );
    const conversationsYesterday = parseInt(convYesterdayResult.rows[0].count);

    // Tool calls today
    const toolsTodayResult = await db.query(
      "SELECT COUNT(*) FROM tool_executions WHERE DATE(timestamp) = CURRENT_DATE"
    );
    const toolCallsToday = parseInt(toolsTodayResult.rows[0].count);

    // Tool calls yesterday (for trend)
    const toolsYesterdayResult = await db.query(
      "SELECT COUNT(*) FROM tool_executions WHERE DATE(timestamp) = CURRENT_DATE - 1"
    );
    const toolCallsYesterday = parseInt(toolsYesterdayResult.rows[0].count);

    // Tokens used today
    const tokensResult = await db.query(
      "SELECT COALESCE(SUM(tokens_used), 0) as total FROM messages WHERE DATE(timestamp) = CURRENT_DATE"
    );
    const tokensUsedToday = parseInt(tokensResult.rows[0].total);

    // Conversations over time (last 7 days)
    const convOverTimeResult = await db.query(`
      SELECT DATE(started_at) as date, COUNT(*) as count
      FROM conversations
      WHERE started_at >= CURRENT_DATE - 7
      GROUP BY DATE(started_at)
      ORDER BY date
    `);

    // Tool usage breakdown
    const toolUsageResult = await db.query(`
      SELECT tool_name as name, COUNT(*) as count
      FROM tool_executions
      WHERE timestamp >= CURRENT_DATE - 7
      GROUP BY tool_name
      ORDER BY count DESC
      LIMIT 5
    `);

    // Recent activity
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

    // Calculate trends
    const conversationsTrend = conversationsYesterday > 0
      ? Math.round(((conversationsToday - conversationsYesterday) / conversationsYesterday) * 100)
      : 0;

    const toolCallsTrend = toolCallsYesterday > 0
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
        count: parseInt(r.count),
      })),
      toolUsage: toolUsageResult.rows.map((r) => ({
        name: r.name,
        count: parseInt(r.count),
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
    res.status(500).json({ error: 'Failed to get overview stats' });
  }
});

/**
 * GET /admin/stats/tools
 * Get tool usage statistics
 */
router.get('/stats/tools', async (req, res) => {
  try {
    // Get today's usage stats (matching the "Usage (Today)" column header)
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

    // Return empty array if no results (not an error)
    const stats = result.rows.map((r) => ({
      tool_name: r.tool_name,
      count: parseInt(r.count),
      avg_time: Math.round(parseFloat(r.avg_time) || 0),
      success_rate: r.count > 0 ? Math.round((parseInt(r.success_count) / parseInt(r.count)) * 100) : 0,
    }));

    res.json(stats);
  } catch (error) {
    console.error('[Admin] Get tool stats error:', error);
    console.error('[Admin] Error details:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to get tool stats', details: error.message });
  }
});

/**
 * GET /admin/stats/conversations
 * Get conversation statistics
 */
router.get('/stats/conversations', async (req, res) => {
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
      total: parseInt(result.rows[0].total),
      today: parseInt(result.rows[0].today),
      avgDurationMinutes: Math.round(parseFloat(result.rows[0].avg_duration_minutes) || 0),
    });
  } catch (error) {
    console.error('[Admin] Get conversation stats error:', error);
    res.status(500).json({ error: 'Failed to get conversation stats' });
  }
});

// =====================================================
// TEST CHAT ROUTE
// =====================================================

/**
 * POST /admin/test-chat
 * Send a test message as if from a client's widget
 */
router.post('/test-chat', async (req, res) => {
  try {
    const { clientId, message, sessionId } = req.body;

    if (!clientId || !message || !sessionId) {
      return res.status(400).json({ error: 'Client ID, message, and session ID are required' });
    }

    // Get client
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Process message using conversation service
    // FIX: Pass client object, not client.id
    const result = await conversationService.processMessage(
      client,  // Changed from client.id to client
      sessionId,
      message.trim(),
      {}
    );

    res.json({
      message: result.response,
      toolCalls: result.toolsUsed || [],  // Also fix: should be toolsUsed, not toolCalls
      tokensUsed: result.tokensUsed || 0,
      sessionId,
    });
  } catch (error) {
    console.error('[Admin] Test chat error:', error);
    res.status(500).json({ error: 'Test chat failed', message: error.message });
  }
});

export default router;
