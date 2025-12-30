import express from 'express';
import { ClientIntegration } from '../../models/ClientIntegration.js';
import integrationService from '../../services/integrationService.js';
import integrationTester from '../../services/integrationTester.js';

const router = express.Router();

/**
 * GET /admin/integration-types
 * Get all available integration types for tool configuration
 */
router.get('/types', async (req, res) => {
  try {
    const types = integrationService.getAvailableIntegrationTypes();
    if (Array.isArray(types)) {
      res.json(types);
    } else {
      console.warn('[Admin] Integration types is not an array:', typeof types);
      res.json([]);
    }
  } catch (error) {
    console.error('[Admin] Get integration types error:', error);
    res.status(500).json({ error: 'Failed to get integration types' });
  }
});

/**
 * GET /admin/clients/:clientId/integrations
 * Get integrations for a client
 */
router.get('/clients/:clientId/integrations', async (req, res) => {
  try {
    const integrationList = await ClientIntegration.getByClient(req.params.clientId);

    const formattedIntegrations = integrationList.map((integration) => {
      const hasApiUrl = !!(
        integration.connection_config?.api_url || integration.connection_config?.apiUrl
      );

      let status = 'inactive';
      if (integration.enabled && hasApiUrl) {
        status = 'active';
      } else if (!hasApiUrl) {
        status = 'not_configured';
      }

      return {
        id: integration.id,
        client_id: integration.client_id,
        integration_type: integration.integration_type,
        name: integration.connection_config?.name || 'Unnamed Integration',
        status: status,
        last_tested_at: integration.last_sync_test,
        created_at: integration.created_at,
        updated_at: integration.updated_at,
        connection_config: integration.connection_config,
        enabled: integration.enabled,
      };
    });

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
    const { integrationType, name, apiUrl, httpMethod, apiKey, apiSecret, authMethod, config } =
      req.body;

    if (!integrationType || !name) {
      return res.status(400).json({ error: 'Integration type and name are required' });
    }

    const connectionConfig = {
      name,
      api_url: apiUrl || null,
      method: httpMethod || 'GET',
      api_key: apiKey || null,
      api_secret: apiSecret || null,
      auth_method: authMethod || 'bearer',
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
router.put('/:id', async (req, res) => {
  try {
    const { name, apiUrl, httpMethod, apiKey, apiSecret, authMethod, config } = req.body;

    const existingIntegration = await ClientIntegration.findById(req.params.id);
    if (!existingIntegration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const connectionConfig = {
      ...existingIntegration.connection_config,
      ...(name && { name }),
      ...(apiUrl !== undefined && { api_url: apiUrl }),
      ...(httpMethod !== undefined && { method: httpMethod }),
      ...(apiKey && { api_key: apiKey }),
      ...(apiSecret && { api_secret: apiSecret }),
      ...(authMethod && { auth_method: authMethod }),
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
router.post('/:id/toggle', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
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
 * Test integration with comprehensive schema capture
 */
router.post('/:id/test', async (req, res) => {
  try {
    const integration = await ClientIntegration.findById(req.params.id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const apiUrl =
      integration.connection_config?.api_url || integration.connection_config?.apiUrl;
    if (!apiUrl) {
      return res.json({
        message: 'No API URL configured to test',
        success: false,
        error: 'This integration requires an API URL to be configured before it can be tested',
      });
    }

    const testConfig = req.body || null;
    const result = await integrationTester.testIntegration(req.params.id, testConfig);

    return res.json({
      message: result.success ? 'Integration test successful' : 'Integration test failed',
      ...result,
    });
  } catch (error) {
    console.error('[Admin] Test integration error:', error);
    res.status(500).json({ error: 'Failed to test integration' });
  }
});

/**
 * GET /admin/debug/integration-test/:clientId/:toolName
 * Test integration flow for debugging
 */
router.get('/debug/integration-test/:clientId/:toolName', async (req, res) => {
  try {
    const { clientId, toolName } = req.params;
    const toolManager = (await import('../../services/toolManager.js')).default;

    const tool = await toolManager.getToolByName(parseInt(clientId, 10), toolName);
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    let integration = null;
    if (tool.integration_type) {
      integration = await integrationService.getIntegrationForClient(
        parseInt(clientId, 10),
        tool.integration_type
      );
    }

    const toolArgs = { orderNumber: '12345' };
    const requestBody = {
      ...toolArgs,
      ...(integration && {
        _integration: {
          type: integration.type,
          apiUrl: integration.apiUrl,
          apiKey: integration.apiKey,
          authMethod: integration.authMethod,
        },
      }),
    };

    res.json({
      tool: {
        name: tool.tool_name,
        integration_type: tool.integration_type,
        webhook_url: tool.n8n_webhook_url,
      },
      integration: integration
        ? {
            type: integration.type,
            apiUrl: integration.apiUrl,
            hasApiKey: !!integration.apiKey,
            authMethod: integration.authMethod,
          }
        : null,
      requestBody,
      hasIntegration: !!requestBody._integration,
    });
  } catch (error) {
    console.error('[Admin] Debug test error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
