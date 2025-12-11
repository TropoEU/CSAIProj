import express from 'express';
import { Admin } from '../models/Admin.js';
import { Client } from '../models/Client.js';
import { Tool } from '../models/Tool.js';
import { ClientTool } from '../models/ClientTool.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { ToolExecution } from '../models/ToolExecution.js';
import { ClientIntegration } from '../models/ClientIntegration.js';
import { Invoice } from '../models/Invoice.js';
import { authenticateAdmin, generateToken } from '../middleware/adminAuth.js';
import conversationService from '../services/conversationService.js';
import toolManager from '../services/toolManager.js';
import n8nService from '../services/n8nService.js';
import { BillingService } from '../services/billingService.js';
import { UsageTracker } from '../services/usageTracker.js';
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
    const {
      name,
      domain,
      planType = 'free',
      email,
      llmProvider = 'ollama',
      modelName,
      systemPrompt,
      status = 'active',
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const client = await Client.create(
      name,
      domain,
      planType,
      email,
      llmProvider,
      modelName,
      systemPrompt,
      status
    );
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
    const { name, domain, plan_type, status, email, llm_provider, model_name, system_prompt, widget_config } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (domain !== undefined) updates.domain = domain;
    if (plan_type !== undefined) updates.plan_type = plan_type;
    if (status !== undefined) updates.status = status;
    if (email !== undefined) updates.email = email;
    if (llm_provider !== undefined) updates.llm_provider = llm_provider;
    if (model_name !== undefined) updates.model_name = model_name;
    if (system_prompt !== undefined) updates.system_prompt = system_prompt;
    if (widget_config !== undefined) updates.widget_config = widget_config;

    const client = await Client.update(req.params.id, updates);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(client);
  } catch (error) {
    console.error('[Admin] Update client error:', error);
    console.error('[Admin] Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to update client', message: error.message });
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
 * POST /admin/clients/:id/upgrade-plan
 * Upgrade/downgrade client plan with prorating
 */
router.post('/clients/:id/upgrade-plan', async (req, res) => {
  try {
    const { newPlan } = req.body;

    if (!newPlan) {
      return res.status(400).json({ error: 'New plan type is required' });
    }

    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const oldPlan = client.plan_type;

    if (oldPlan === newPlan) {
      return res.status(400).json({ error: 'Client is already on this plan' });
    }

    // Calculate prorating
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysRemaining = daysInMonth - now.getDate() + 1;
    const prorateRatio = daysRemaining / daysInMonth;

    // Get pricing for both plans
    const oldPricing = BillingService.getPricingConfig(oldPlan);
    const newPricing = BillingService.getPricingConfig(newPlan);

    // Calculate prorated amounts
    const unusedOldPlanAmount = oldPricing.baseCost * prorateRatio;
    const proratedNewPlanAmount = newPricing.baseCost * prorateRatio;
    const proratedDifference = proratedNewPlanAmount - unusedOldPlanAmount;

    // Update client plan
    const updatedClient = await Client.update(req.params.id, { plan_type: newPlan });

    // Create prorated invoice/credit if there's a significant difference
    let prorateNote = '';
    if (Math.abs(proratedDifference) > 0.01) {
      if (proratedDifference > 0) {
        // Upgrade: Client owes prorated amount
        prorateNote = `Prorated charge of $${proratedDifference.toFixed(2)} for ${daysRemaining} days at new rate.`;

        // Create a prorated invoice
        const billingPeriod = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        try {
          await Invoice.create({
            clientId: client.id,
            billingPeriod,
            planType: newPlan,
            baseCost: proratedDifference,
            usageCost: 0,
            totalCost: proratedDifference,
            status: 'pending',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days
            notes: `Prorated charge for plan upgrade from ${oldPlan} to ${newPlan} on ${now.toISOString().split('T')[0]}`
          });
        } catch (err) {
          console.error('[Admin] Failed to create prorated invoice:', err);
          // Continue even if invoice creation fails
        }
      } else {
        // Downgrade: Client gets credit
        prorateNote = `Credit of $${Math.abs(proratedDifference).toFixed(2)} applied for unused ${oldPlan} plan time.`;

        // In a real system, you would apply this credit to the next invoice
        // For now, we just note it
      }
    }

    res.json({
      client: updatedClient,
      message: `Plan changed from ${oldPlan} to ${newPlan}`,
      effectiveDate: now.toISOString(),
      prorating: {
        daysRemaining,
        daysInMonth,
        prorateRatio: Math.round(prorateRatio * 100) / 100,
        unusedOldPlanAmount: Math.round(unusedOldPlanAmount * 100) / 100,
        proratedNewPlanAmount: Math.round(proratedNewPlanAmount * 100) / 100,
        difference: Math.round(proratedDifference * 100) / 100,
        note: prorateNote || 'No prorated charges apply (plans have same base cost or change at month start).'
      }
    });
  } catch (error) {
    console.error('[Admin] Upgrade plan error:', error);
    res.status(500).json({ error: 'Failed to upgrade plan' });
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
 * PUT /admin/tools/:id
 * Update a tool
 */
router.put('/tools/:id', async (req, res) => {
  try {
    const { toolName, description, parametersSchema } = req.body;
    const updates = {};

    if (toolName) updates.tool_name = toolName;
    if (description) updates.description = description;
    if (parametersSchema) updates.parameters_schema = parametersSchema;

    const tool = await Tool.update(req.params.id, updates);
    res.json(tool);
  } catch (error) {
    console.error('[Admin] Update tool error:', error);
    res.status(500).json({ error: 'Failed to update tool' });
  }
});

/**
 * DELETE /admin/tools/:id
 * Delete a tool (only if not in use by any clients)
 */
router.delete('/tools/:id', async (req, res) => {
  try {
    // Check if tool is in use
    const clientsUsingTool = await ClientTool.getClientsUsingTool(req.params.id);
    if (clientsUsingTool.length > 0) {
      return res.status(400).json({
        error: `Cannot delete tool: currently in use by ${clientsUsingTool.length} client(s)`
      });
    }

    await Tool.delete(req.params.id);
    res.json({ message: 'Tool deleted' });
  } catch (error) {
    console.error('[Admin] Delete tool error:', error);
    res.status(500).json({ error: 'Failed to delete tool' });
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
 * POST /admin/clients/:clientId/tools/:id/test
 * Test a client's tool configuration by calling its webhook
 * NOTE: This must come BEFORE the DELETE route to avoid route matching issues
 */
router.post('/clients/:clientId/tools/:id/test', async (req, res) => {
  try {
    const { clientId, id: toolId } = req.params; // Rename id to toolId for clarity
    let { parameters } = req.body;

    // Get the client tool configuration
    const clientTool = await ClientTool.find(clientId, toolId);
    if (!clientTool) {
      return res.status(404).json({ error: 'Tool not found for this client' });
    }

    if (!clientTool.n8n_webhook_url) {
      return res.status(400).json({ error: 'Tool has no webhook URL configured' });
    }

    // Parse parameters if it's a string
    if (typeof parameters === 'string') {
      try {
        parameters = JSON.parse(parameters);
      } catch (err) {
        return res.status(400).json({ error: 'Invalid JSON parameters' });
      }
    }

    // Execute the tool via n8n webhook
    const result = await n8nService.executeTool(
      clientTool.n8n_webhook_url,
      parameters || {},
      clientId
    );

    res.json({
      success: true,
      message: 'Tool test successful',
      tool: clientTool.tool_name,
      webhook: clientTool.n8n_webhook_url,
      result: result,
    });
  } catch (error) {
    console.error('[Admin] Test client tool error:', error);
    res.status(500).json({
      success: false,
      error: 'Tool test failed',
      message: error.message,
    });
  }
});

/**
 * DELETE /admin/clients/:clientId/tools/:id
 * Disable/remove a tool from a client (by client_tools junction table ID)
 */
router.delete('/clients/:clientId/tools/:id', async (req, res) => {
  try {
    await ClientTool.deleteById(req.params.id);
    res.json({ message: 'Tool removed from client' });
  } catch (error) {
    console.error('[Admin] Remove client tool error:', error);
    res.status(500).json({ error: 'Failed to remove tool' });
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
 * POST /admin/integrations/:id/toggle
 * Toggle integration enabled status
 */
router.post('/integrations/:id/toggle', async (req, res) => {
  try {
    const integration = await ClientIntegration.findById(req.params.id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const updated = await ClientIntegration.setEnabled(req.params.id, !integration.enabled);
    res.json(updated);
  } catch (error) {
    console.error('[Admin] Toggle integration error:', error);
    res.status(500).json({ error: 'Failed to toggle integration' });
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
// BILLING ROUTES
// =====================================================

/**
 * GET /admin/billing/invoices
 * Get all invoices with optional filters
 */
router.get('/billing/invoices', async (req, res) => {
  try {
    const { status, clientId, billingPeriod, limit = 100, offset = 0 } = req.query;

    const filters = {};
    if (status && status !== 'all') filters.status = status;
    if (clientId && clientId !== 'all') filters.clientId = parseInt(clientId);
    if (billingPeriod) filters.billingPeriod = billingPeriod;

    const invoices = await Invoice.findAll(filters, parseInt(limit), parseInt(offset));
    res.json(invoices);
  } catch (error) {
    console.error('[Admin] Get invoices error:', error);
    res.status(500).json({ error: 'Failed to get invoices' });
  }
});

/**
 * GET /admin/billing/invoices/:id
 * Get invoice details by ID
 */
router.get('/billing/invoices/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Get client details
    const client = await Client.findById(invoice.client_id);
    invoice.client_name = client?.name;
    invoice.client_domain = client?.domain;

    res.json(invoice);
  } catch (error) {
    console.error('[Admin] Get invoice error:', error);
    res.status(500).json({ error: 'Failed to get invoice' });
  }
});

/**
 * GET /admin/clients/:id/invoices
 * Get all invoices for a specific client
 */
router.get('/clients/:id/invoices', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const invoices = await Invoice.findByClientId(req.params.id, parseInt(limit), parseInt(offset));
    res.json(invoices);
  } catch (error) {
    console.error('[Admin] Get client invoices error:', error);
    res.status(500).json({ error: 'Failed to get client invoices' });
  }
});

/**
 * POST /admin/billing/generate
 * Generate invoice(s) for a billing period
 */
router.post('/billing/generate', async (req, res) => {
  try {
    const { clientId, billingPeriod, force = false } = req.body;

    if (!billingPeriod) {
      return res.status(400).json({ error: 'Billing period is required (YYYY-MM format)' });
    }

    // Validate billing period format
    if (!/^\d{4}-\d{2}$/.test(billingPeriod)) {
      return res.status(400).json({ error: 'Invalid billing period format. Use YYYY-MM' });
    }

    if (clientId) {
      // Generate invoice for single client
      const result = await BillingService.generateInvoice(clientId, billingPeriod, force);
      res.status(201).json(result);
    } else {
      // Generate invoices for all clients
      const results = await BillingService.generateInvoicesForAllClients(billingPeriod);
      res.status(201).json({
        message: 'Invoice generation completed',
        results
      });
    }
  } catch (error) {
    console.error('[Admin] Generate invoice error:', error);
    res.status(500).json({ error: 'Failed to generate invoice', message: error.message });
  }
});

/**
 * POST /admin/billing/invoices/:id/mark-paid
 * Mark invoice as paid manually
 */
router.post('/billing/invoices/:id/mark-paid', async (req, res) => {
  try {
    const { paymentMethod, notes } = req.body;

    const invoice = await BillingService.markInvoiceAsPaidManually(req.params.id, {
      paymentMethod: paymentMethod || 'manual',
      notes: notes || 'Marked as paid manually via admin dashboard'
    });

    res.json(invoice);
  } catch (error) {
    console.error('[Admin] Mark invoice as paid error:', error);
    res.status(500).json({ error: 'Failed to mark invoice as paid', message: error.message });
  }
});

/**
 * POST /admin/billing/invoices/:id/cancel
 * Cancel an invoice
 */
router.post('/billing/invoices/:id/cancel', async (req, res) => {
  try {
    const { notes } = req.body;
    const invoice = await Invoice.cancel(req.params.id, notes);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (error) {
    console.error('[Admin] Cancel invoice error:', error);
    res.status(500).json({ error: 'Failed to cancel invoice', message: error.message });
  }
});

/**
 * POST /admin/billing/invoices/:id/charge
 * Charge invoice via payment provider (placeholder for future integration)
 */
router.post('/billing/invoices/:id/charge', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'Invoice is already paid' });
    }

    // Create payment intent
    const paymentIntent = await BillingService.createPaymentIntent(
      invoice.id,
      invoice.total_cost,
      'USD'
    );

    res.json({
      message: 'Payment intent created (placeholder)',
      paymentIntent,
      note: 'Payment provider integration not yet implemented. Use mark-paid for manual payments.'
    });
  } catch (error) {
    console.error('[Admin] Charge invoice error:', error);
    res.status(500).json({ error: 'Failed to charge invoice', message: error.message });
  }
});

/**
 * POST /admin/billing/webhook
 * Handle webhook from payment providers (placeholder for future integration)
 */
router.post('/billing/webhook', async (req, res) => {
  try {
    const { provider = 'stripe' } = req.query;
    const result = await BillingService.handleWebhook(provider, req.body);
    res.json(result);
  } catch (error) {
    console.error('[Admin] Billing webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed', message: error.message });
  }
});

/**
 * GET /admin/billing/revenue
 * Get revenue analytics and summary
 */
router.get('/billing/revenue', async (req, res) => {
  try {
    const { startDate, endDate, status, months = 12 } = req.query;

    const filters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (status && status !== 'all') filters.status = status;

    const [
      summary,
      monthlyRevenue,
      revenueByPlan,
      outstanding
    ] = await Promise.all([
      BillingService.getRevenueSummary(filters),
      BillingService.getMonthlyRevenue(parseInt(months)),
      BillingService.getRevenueByPlan(),
      BillingService.getOutstandingPayments()
    ]);

    res.json({
      summary,
      monthlyRevenue,
      revenueByPlan,
      outstanding
    });
  } catch (error) {
    console.error('[Admin] Get revenue analytics error:', error);
    res.status(500).json({ error: 'Failed to get revenue analytics' });
  }
});

/**
 * GET /admin/billing/outstanding
 * Get outstanding invoices (pending or overdue)
 */
router.get('/billing/outstanding', async (req, res) => {
  try {
    const outstanding = await BillingService.getOutstandingPayments();
    res.json(outstanding);
  } catch (error) {
    console.error('[Admin] Get outstanding invoices error:', error);
    res.status(500).json({ error: 'Failed to get outstanding invoices' });
  }
});

// =====================================================
// USAGE REPORTING ROUTES
// =====================================================

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
    res.status(500).json({ error: 'Failed to get client usage' });
  }
});

/**
 * GET /admin/clients/:id/usage/history
 * Get usage history for a client
 */
router.get('/clients/:id/usage/history', async (req, res) => {
  try {
    const { metric = 'messages', months = 12 } = req.query;
    const history = await UsageTracker.getUsageHistory(
      req.params.id,
      metric,
      parseInt(months)
    );
    res.json(history);
  } catch (error) {
    console.error('[Admin] Get usage history error:', error);
    res.status(500).json({ error: 'Failed to get usage history' });
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
    res.status(500).json({ error: 'Failed to get daily usage' });
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
    res.status(500).json({ error: 'Failed to get tool usage' });
  }
});

/**
 * GET /admin/clients/:id/usage/compare
 * Compare usage between periods
 */
router.get('/clients/:id/usage/compare', async (req, res) => {
  try {
    const { metric = 'messages', period1 = 'month', period2 = 'last_month' } = req.query;
    const comparison = await UsageTracker.compareUsage(
      req.params.id,
      metric,
      period1,
      period2
    );
    res.json(comparison);
  } catch (error) {
    console.error('[Admin] Compare usage error:', error);
    res.status(500).json({ error: 'Failed to compare usage' });
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
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get plan limits (placeholder - should come from plan config)
    const limits = {
      messagesPerMonth: 10000,
      tokensPerMonth: 1000000,
      costLimitUSD: 100,
    };

    const alerts = await UsageTracker.getUsageAlerts(req.params.id, limits, 0.8);
    res.json(alerts);
  } catch (error) {
    console.error('[Admin] Get usage alerts error:', error);
    res.status(500).json({ error: 'Failed to get usage alerts' });
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
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const csv = await UsageTracker.exportUsageCSV(req.params.id, startDate, endDate);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=usage-${req.params.id}-${startDate}-${endDate}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('[Admin] Export usage error:', error);
    res.status(500).json({ error: 'Failed to export usage' });
  }
});

/**
 * GET /admin/usage/summary
 * Get usage summary for all clients
 */
router.get('/usage/summary', async (req, res) => {
  try {
    const { metric = 'cost', limit = 10, period = 'month' } = req.query;
    const topClients = await UsageTracker.getTopClients(metric, parseInt(limit), period);
    res.json(topClients);
  } catch (error) {
    console.error('[Admin] Get usage summary error:', error);
    res.status(500).json({ error: 'Failed to get usage summary' });
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
