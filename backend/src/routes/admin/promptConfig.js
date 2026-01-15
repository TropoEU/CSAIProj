import express from 'express';
import { HTTP_STATUS } from '../../config/constants.js';
import { PlatformConfig } from '../../models/PlatformConfig.js';
import { Client } from '../../models/Client.js';
import promptService from '../../services/promptService.js';
import {
  getSystemPrompt,
  refreshCachedConfig,
  getAdaptiveModePromptAsync,
} from '../../prompts/systemPrompt.js';

const router = express.Router();

// =====================================================
// PLATFORM-WIDE PROMPT CONFIG
// =====================================================

/**
 * GET /admin/prompt-config
 * Get the platform default prompt configuration
 */
router.get('/', async (req, res) => {
  try {
    const config = await PlatformConfig.getDefaultPromptConfig();
    res.json(config);
  } catch (error) {
    console.error('[Admin] Error fetching prompt config:', error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: 'Failed to fetch prompt configuration' });
  }
});

/**
 * PUT /admin/prompt-config
 * Update the platform default prompt configuration
 */
router.put('/', async (req, res) => {
  try {
    const config = req.body;

    // Validate required fields
    if (!config) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Configuration is required' });
    }

    // Validate reasoning_steps if provided
    if (config.reasoning_steps) {
      if (!Array.isArray(config.reasoning_steps)) {
        return res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json({ error: 'reasoning_steps must be an array' });
      }
      for (const step of config.reasoning_steps) {
        if (!step.title || !step.instruction) {
          return res
            .status(HTTP_STATUS.BAD_REQUEST)
            .json({ error: 'Each reasoning step must have title and instruction' });
        }
      }
    }

    // Validate tool_rules if provided
    if (config.tool_rules && !Array.isArray(config.tool_rules)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'tool_rules must be an array' });
    }

    // Update the platform config
    await PlatformConfig.setDefaultPromptConfig(config);

    // Refresh ALL caches (promptService + systemPrompt)
    await promptService.refreshDefaultConfig();
    await refreshCachedConfig();

    res.json({ message: 'Prompt configuration updated successfully', config });
  } catch (error) {
    console.error('[Admin] Error updating prompt config:', error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: error.message || 'Failed to update prompt configuration' });
  }
});

/**
 * POST /admin/prompt-config/preview
 * Preview the generated prompt with current config
 */
router.post('/preview', async (req, res) => {
  try {
    const { config, clientId } = req.body;

    // Use provided config or fetch from database
    let promptConfig = config;
    if (!promptConfig) {
      promptConfig = await PlatformConfig.getDefaultPromptConfig();
    }

    // Get client for preview (or use mock client)
    let client = { name: 'Sample Business', language: 'en' };
    if (clientId) {
      const foundClient = await Client.findById(clientId);
      if (foundClient) {
        client = foundClient;
      }
    }

    // Build the prompt
    const prompt = getSystemPrompt({ ...client, prompt_config: promptConfig });

    res.json({ prompt });
  } catch (error) {
    console.error('[Admin] Error previewing prompt:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to preview prompt' });
  }
});

/**
 * POST /admin/prompt-config/reset
 * Reset platform config to hardcoded defaults
 */
router.post('/reset', async (req, res) => {
  try {
    const defaults = PlatformConfig.getHardcodedDefaults();
    await PlatformConfig.setDefaultPromptConfig(defaults);
    await promptService.refreshDefaultConfig();
    await refreshCachedConfig();

    res.json({ message: 'Prompt configuration reset to defaults', config: defaults });
  } catch (error) {
    console.error('[Admin] Error resetting prompt config:', error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: 'Failed to reset prompt configuration' });
  }
});

// =====================================================
// ADAPTIVE MODE PROMPT CONFIG
// =====================================================

/**
 * GET /admin/prompt-config/adaptive
 * Get the adaptive mode prompt configuration
 */
router.get('/adaptive', async (req, res) => {
  try {
    const config = await PlatformConfig.getAdaptivePromptConfig();
    res.json(config);
  } catch (error) {
    console.error('[Admin] Error fetching adaptive prompt config:', error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: 'Failed to fetch adaptive prompt configuration' });
  }
});

/**
 * PUT /admin/prompt-config/adaptive
 * Update the adaptive mode prompt configuration
 */
router.put('/adaptive', async (req, res) => {
  try {
    const config = req.body;

    // Validate required fields
    if (!config) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Configuration is required' });
    }

    // Validate reasoning_steps if provided
    if (config.reasoning_steps) {
      if (!Array.isArray(config.reasoning_steps)) {
        return res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json({ error: 'reasoning_steps must be an array' });
      }
      for (const step of config.reasoning_steps) {
        if (!step.title || !step.instruction) {
          return res
            .status(HTTP_STATUS.BAD_REQUEST)
            .json({ error: 'Each reasoning step must have title and instruction' });
        }
      }
    }

    // Validate context_keys if provided
    if (config.context_keys) {
      if (!Array.isArray(config.context_keys)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'context_keys must be an array' });
      }
      for (const ctx of config.context_keys) {
        if (!ctx.key || !ctx.description) {
          return res
            .status(HTTP_STATUS.BAD_REQUEST)
            .json({ error: 'Each context key must have key and description' });
        }
      }
    }

    // Validate tool_rules if provided
    if (config.tool_rules && !Array.isArray(config.tool_rules)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'tool_rules must be an array' });
    }

    // Update the adaptive config
    await PlatformConfig.setAdaptivePromptConfig(config);

    // Clear promptService cache so it reloads
    promptService.clearCache();

    res.json({ message: 'Adaptive prompt configuration updated successfully', config });
  } catch (error) {
    console.error('[Admin] Error updating adaptive prompt config:', error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: error.message || 'Failed to update adaptive prompt configuration' });
  }
});

/**
 * POST /admin/prompt-config/adaptive/preview
 * Preview the generated adaptive prompt with current config
 */
router.post('/adaptive/preview', async (req, res) => {
  try {
    const { config, clientId } = req.body;

    // Get client for preview (or use mock client)
    let client = { name: 'Sample Business', language: 'en', business_info: {} };
    if (clientId) {
      const foundClient = await Client.findById(clientId);
      if (foundClient) {
        client = foundClient;
      }
    }

    // Temporarily set the config if provided
    let prompt;
    if (config) {
      // Use mock tools for preview
      const mockTools = [
        {
          tool_name: 'book_appointment',
          description: 'Book appointments',
          parameters_schema: {
            properties: { date: { type: 'string' }, time: { type: 'string' } },
            required: ['date', 'time'],
          },
        },
        {
          tool_name: 'check_inventory',
          description: 'Check product availability',
          parameters_schema: { properties: { product: { type: 'string' } }, required: ['product'] },
        },
      ];
      prompt = await getAdaptiveModePromptAsync(client, mockTools);
    } else {
      // Use mock tools for preview
      const mockTools = [
        {
          tool_name: 'book_appointment',
          description: 'Book appointments',
          parameters_schema: {
            properties: { date: { type: 'string' }, time: { type: 'string' } },
            required: ['date', 'time'],
          },
        },
        {
          tool_name: 'check_inventory',
          description: 'Check product availability',
          parameters_schema: { properties: { product: { type: 'string' } }, required: ['product'] },
        },
      ];
      prompt = await getAdaptiveModePromptAsync(client, mockTools);
    }

    res.json({ prompt });
  } catch (error) {
    console.error('[Admin] Error previewing adaptive prompt:', error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: 'Failed to preview adaptive prompt' });
  }
});

/**
 * POST /admin/prompt-config/adaptive/reset
 * Reset adaptive config to hardcoded defaults
 */
router.post('/adaptive/reset', async (req, res) => {
  try {
    const defaults = PlatformConfig.getAdaptiveDefaults();
    await PlatformConfig.setAdaptivePromptConfig(defaults);
    promptService.clearCache();

    res.json({ message: 'Adaptive prompt configuration reset to defaults', config: defaults });
  } catch (error) {
    console.error('[Admin] Error resetting adaptive prompt config:', error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: 'Failed to reset adaptive prompt configuration' });
  }
});

// =====================================================
// CLIENT-SPECIFIC PROMPT CONFIG
// =====================================================

/**
 * GET /admin/clients/:clientId/prompt-config
 * Get a client's prompt configuration (merged with defaults)
 */
router.get('/clients/:clientId/prompt-config', async (req, res) => {
  try {
    const { clientId } = req.params;

    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Client not found' });
    }

    // Get the effective config (client + defaults merged)
    const effectiveConfig = await promptService.getClientConfig(client);

    // Also return the raw client overrides
    const clientOverrides = client.prompt_config || {};

    // Determine which fields are customized
    const customizedFields = [];
    if ('reasoning_enabled' in clientOverrides) customizedFields.push('reasoning_enabled');
    if ('reasoning_steps' in clientOverrides) customizedFields.push('reasoning_steps');
    if ('response_style' in clientOverrides) customizedFields.push('response_style');
    if ('tool_rules' in clientOverrides) customizedFields.push('tool_rules');
    if ('custom_instructions' in clientOverrides && clientOverrides.custom_instructions) {
      customizedFields.push('custom_instructions');
    }

    res.json({
      effective: effectiveConfig,
      overrides: clientOverrides,
      customizedFields,
      hasCustomConfig: Object.keys(clientOverrides).length > 0,
    });
  } catch (error) {
    console.error('[Admin] Error fetching client prompt config:', error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: 'Failed to fetch client prompt configuration' });
  }
});

/**
 * PUT /admin/clients/:clientId/prompt-config
 * Update a client's prompt configuration overrides
 */
router.put('/clients/:clientId/prompt-config', async (req, res) => {
  try {
    const { clientId } = req.params;
    const config = req.body;

    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Client not found' });
    }

    // Validate reasoning_steps if provided
    if (config.reasoning_steps) {
      if (!Array.isArray(config.reasoning_steps)) {
        return res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json({ error: 'reasoning_steps must be an array' });
      }
      for (const step of config.reasoning_steps) {
        if (!step.title || !step.instruction) {
          return res
            .status(HTTP_STATUS.BAD_REQUEST)
            .json({ error: 'Each reasoning step must have title and instruction' });
        }
      }
    }

    // Update the client's prompt_config
    await Client.updatePromptConfig(clientId, config);

    res.json({ message: 'Client prompt configuration updated successfully', config });
  } catch (error) {
    console.error('[Admin] Error updating client prompt config:', error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: 'Failed to update client prompt configuration' });
  }
});

/**
 * DELETE /admin/clients/:clientId/prompt-config
 * Clear a client's prompt configuration (revert to platform defaults)
 */
router.delete('/clients/:clientId/prompt-config', async (req, res) => {
  try {
    const { clientId } = req.params;

    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Client not found' });
    }

    // Clear the client's prompt_config
    await Client.updatePromptConfig(clientId, {});

    res.json({ message: 'Client prompt configuration cleared, using platform defaults' });
  } catch (error) {
    console.error('[Admin] Error clearing client prompt config:', error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: 'Failed to clear client prompt configuration' });
  }
});

/**
 * POST /admin/clients/:clientId/prompt-config/preview
 * Preview the generated prompt for a specific client
 */
router.post('/clients/:clientId/prompt-config/preview', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { config } = req.body;

    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Client not found' });
    }

    // Use provided config or client's current config
    const promptConfig = config || client.prompt_config || {};

    // Build the prompt
    const prompt = getSystemPrompt({ ...client, prompt_config: promptConfig });

    res.json({ prompt });
  } catch (error) {
    console.error('[Admin] Error previewing client prompt:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to preview prompt' });
  }
});

export default router;
