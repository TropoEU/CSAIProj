import express from 'express';
import { HTTP_STATUS } from '../../config/constants.js';
import { Tool } from '../../models/Tool.js';
import { ClientTool } from '../../models/ClientTool.js';
import n8nService from '../../services/n8nService.js';
import integrationService from '../../services/integrationService.js';

const router = express.Router();

/**
 * GET /admin/tools
 * Get all tool definitions
 */
router.get('/', async (req, res) => {
  try {
    const tools = await Tool.getAll();
    res.json(tools);
  } catch (error) {
    console.error('[Admin] Get tools error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get tools' });
  }
});

/**
 * POST /admin/tools
 * Create a new tool definition
 */
router.post('/', async (req, res) => {
  try {
    const { toolName, description, parametersSchema, category, requiredIntegrations, capabilities } =
      req.body;

    if (!toolName || !description) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Tool name and description are required' });
    }

    const tool = await Tool.create(
      toolName,
      description,
      parametersSchema || {},
      category || null,
      requiredIntegrations || [],
      capabilities || null
    );
    res.status(HTTP_STATUS.CREATED).json(tool);
  } catch (error) {
    console.error('[Admin] Create tool error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to create tool' });
  }
});

/**
 * PUT /admin/tools/:id
 * Update a tool
 */
router.put('/:id', async (req, res) => {
  try {
    const { toolName, description, parametersSchema, category, requiredIntegrations, capabilities } =
      req.body;
    const updates = {};

    // Use !== undefined to allow empty strings and null values
    if (toolName !== undefined) updates.tool_name = toolName;
    if (description !== undefined) updates.description = description;
    if (parametersSchema !== undefined) updates.parameters_schema = parametersSchema;
    if (category !== undefined) updates.category = category;
    if (requiredIntegrations !== undefined) updates.required_integrations = requiredIntegrations;
    if (capabilities !== undefined) updates.capabilities = capabilities;

    // Check if there are any updates to make
    if (Object.keys(updates).length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'No valid fields provided for update' });
    }

    const tool = await Tool.update(req.params.id, updates);
    res.json(tool);
  } catch (error) {
    console.error('[Admin] Update tool error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: error.message || 'Failed to update tool' });
  }
});

/**
 * DELETE /admin/tools/:id
 * Delete a tool (only if not in use by any clients)
 */
router.delete('/:id', async (req, res) => {
  try {
    const clientsUsingTool = await ClientTool.getClientsUsingTool(req.params.id);
    if (clientsUsingTool.length > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: `Cannot delete tool: currently in use by ${clientsUsingTool.length} client(s)`,
      });
    }

    await Tool.delete(req.params.id);
    res.json({ message: 'Tool deleted' });
  } catch (error) {
    console.error('[Admin] Delete tool error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to delete tool' });
  }
});

/**
 * POST /admin/tools/:id/test
 * Test a tool by calling its webhook
 */
router.post('/:id/test', async (req, res) => {
  try {
    const { webhookUrl, params } = req.body;

    if (!webhookUrl) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Webhook URL is required' });
    }

    const result = await n8nService.executeTool(webhookUrl, params || {});
    res.json(result);
  } catch (error) {
    console.error('[Admin] Test tool error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Tool test failed', message: error.message });
  }
});

// =====================================================
// CLIENT TOOLS ROUTES
// =====================================================

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
 * Enable a tool for a client with integration mapping
 */
router.post('/clients/:clientId/tools', async (req, res) => {
  try {
    const { toolId, webhookUrl, integrationMapping } = req.body;

    if (!toolId || !webhookUrl) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Tool ID and webhook URL are required' });
    }

    const clientTool = await ClientTool.enable(
      req.params.clientId,
      toolId,
      webhookUrl,
      integrationMapping || {},
      null
    );
    res.status(HTTP_STATUS.CREATED).json(clientTool);
  } catch (error) {
    console.error('[Admin] Enable tool error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to enable tool' });
  }
});

/**
 * PUT /admin/clients/:clientId/tools/:id
 * Update client tool configuration including integration mapping
 */
router.put('/clients/:clientId/tools/:id', async (req, res) => {
  try {
    const { webhookUrl, enabled, integrationMapping } = req.body;
    const updates = {};

    if (webhookUrl !== undefined) updates.n8n_webhook_url = webhookUrl;
    if (enabled !== undefined) updates.enabled = enabled;
    if (integrationMapping !== undefined) updates.integration_mapping = integrationMapping;

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
 */
router.post('/clients/:clientId/tools/:id/test', async (req, res) => {
  try {
    const { clientId, id: toolId } = req.params;
    let { parameters } = req.body;

    const clientTool = await ClientTool.find(clientId, toolId);
    if (!clientTool) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Tool not found for this client' });
    }

    if (!clientTool.n8n_webhook_url) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Tool has no webhook URL configured' });
    }

    const tool = await Tool.findById(toolId);
    if (!tool) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Tool definition not found' });
    }

    if (typeof parameters === 'string') {
      try {
        parameters = JSON.parse(parameters);
      } catch {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Invalid JSON parameters' });
      }
    }

    let integrations = {};
    const requiredIntegrations = tool.required_integrations || [];
    const integrationMapping = clientTool.integration_mapping || {};

    if (requiredIntegrations.length > 0) {
      try {
        integrations = await integrationService.getIntegrationsForTool(
          clientId,
          integrationMapping,
          requiredIntegrations
        );
        console.log(`[Admin] Loaded ${Object.keys(integrations).length} integrations for tool test`);
      } catch (intError) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'Integration error',
          message: intError.message,
          hint: 'Make sure all required integrations are mapped in the client tool settings',
        });
      }
    }

    const result = await n8nService.executeTool(clientTool.n8n_webhook_url, parameters || {}, {
      integrations,
    });

    res.json({
      success: true,
      message: 'Tool test successful',
      tool: clientTool.tool_name,
      webhook: clientTool.n8n_webhook_url,
      integrationsLoaded: Object.keys(integrations),
      result: result,
    });
  } catch (error) {
    console.error('[Admin] Test client tool error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Tool test failed',
      message: error.message,
    });
  }
});

/**
 * DELETE /admin/clients/:clientId/tools/:id
 * Disable/remove a tool from a client
 */
router.delete('/clients/:clientId/tools/:id', async (req, res) => {
  try {
    await ClientTool.deleteById(req.params.id);
    res.json({ message: 'Tool removed from client' });
  } catch (error) {
    console.error('[Admin] Remove client tool error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to remove tool' });
  }
});

export default router;
