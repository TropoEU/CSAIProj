import { ClientIntegration } from '../models/ClientIntegration.js';
import { TIMEOUTS } from '../config/constants.js';

/**
 * Integration Service
 *
 * Manages client integrations and provides credentials for tool execution.
 * This service bridges the gap between tools and client-specific API configurations.
 *
 * Flow:
 * 1. Tool specifies required_integrations: [{"key": "order_api", ...}, {"key": "email_api", ...}]
 * 2. Client enables tool and maps integration keys to their specific integrations
 * 3. When executing tool, we fetch all mapped integrations
 * 4. Integration credentials are passed to n8n as _integrations object
 * 5. n8n uses these credentials to call the client's APIs
 */
class IntegrationService {
  /**
   * Get multiple integrations for a tool execution based on integration mapping
   * @param {number} clientId - Client ID
   * @param {Object} integrationMapping - Maps integration keys to client_integration IDs
   *   Example: {"order_api": 5, "email_api": 8}
   * @param {Array} requiredIntegrations - Tool's required integrations config
   *   Example: [{"key": "order_api", "required": true}, {"key": "email_api", "required": false}]
   * @returns {Object} Object with integration key -> formatted config mapping
   */
  async getIntegrationsForTool(clientId, integrationMapping = {}, requiredIntegrations = []) {
    const integrations = {};
    const errors = [];

    for (const reqInt of requiredIntegrations) {
      const { key, required } = reqInt;
      const integrationId = integrationMapping[key];

      if (!integrationId) {
        if (required) {
          errors.push(`Required integration '${key}' is not mapped`);
        }
        continue;
      }

      try {
        const integration = await ClientIntegration.findById(integrationId);

        if (!integration) {
          if (required) {
            errors.push(`Integration ${integrationId} not found for key '${key}'`);
          }
          continue;
        }

        if (!integration.enabled) {
          if (required) {
            errors.push(`Integration '${key}' is disabled`);
          }
          continue;
        }

        integrations[key] = this.formatIntegrationForTool(integration);
      } catch (error) {
        console.error(`[Integration] Error fetching integration ${integrationId}:`, error);
        if (required) {
          errors.push(`Failed to load integration '${key}': ${error.message}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Integration errors: ${errors.join(', ')}`);
    }

    return integrations;
  }

  /**
   * Get integration credentials for a client and integration type (legacy method)
   * @param {number} clientId - Client ID
   * @param {string} integrationType - Type of integration (e.g., 'inventory_api')
   * @returns {Object|null} Integration config or null if not found
   */
  async getIntegrationForClient(clientId, integrationType) {
    if (!integrationType) {
      return null;
    }

    try {
      const integration = await ClientIntegration.findByClientAndType(clientId, integrationType);

      if (!integration) {
        console.log(`[Integration] No ${integrationType} integration found for client ${clientId}`);
        return null;
      }

      return this.formatIntegrationForTool(integration);
    } catch (error) {
      console.error('[Integration] Error fetching integration:', error);
      return null;
    }
  }

  /**
   * Format integration data for passing to n8n
   * Extracts and flattens connection_config for easy access in n8n
   * @param {Object} integration - Raw integration from database
   * @returns {Object} Formatted integration config
   */
  formatIntegrationForTool(integration) {
    const config = integration.connection_config || {};

    return {
      id: integration.id,
      type: integration.integration_type,
      enabled: integration.enabled,
      // Flatten connection config for easy access in n8n
      apiUrl: config.api_url || config.apiUrl || config.url || null,
      apiKey: config.api_key || config.apiKey || config.key || null,
      apiSecret: config.api_secret || config.apiSecret || config.secret || null,
      authMethod: config.auth_method || config.authMethod || 'bearer',
      method: config.method || 'GET', // HTTP method for the endpoint
      headers: config.headers || {},
      // Include full config for complex cases
      config: config
    };
  }

  /**
   * Validate that a client has the required integration
   * @param {number} clientId - Client ID
   * @param {string} integrationType - Required integration type
   * @returns {Object} { valid: boolean, error?: string }
   */
  async validateClientHasIntegration(clientId, integrationType) {
    if (!integrationType) {
      return { valid: true }; // No integration required
    }

    const integration = await this.getIntegrationForClient(clientId, integrationType);

    if (!integration) {
      return {
        valid: false,
        error: `Client does not have a '${integrationType}' integration configured. Please set up the integration in the admin panel.`
      };
    }

    if (!integration.apiUrl) {
      return {
        valid: false,
        error: `Integration '${integrationType}' is missing API URL configuration.`
      };
    }

    return { valid: true, integration };
  }

  /**
   * Build headers for API call based on integration auth method
   * @param {Object} integration - Integration config
   * @returns {Object} Headers object
   */
  buildAuthHeaders(integration) {
    const headers = { ...integration.headers };

    switch (integration.authMethod) {
      case 'bearer':
        if (integration.apiKey) {
          headers['Authorization'] = `Bearer ${integration.apiKey}`;
        }
        break;

      case 'api_key':
        if (integration.apiKey) {
          headers['X-API-Key'] = integration.apiKey;
        }
        break;

      case 'basic':
        if (integration.apiKey && integration.apiSecret) {
          const credentials = Buffer.from(`${integration.apiKey}:${integration.apiSecret}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;

      case 'custom':
        // Custom auth uses headers from config directly
        break;

      default:
        // No auth or unknown method
        break;
    }

    return headers;
  }

  /**
   * Get all available integration types that clients can configure
   * These are the supported integration types in the system
   */
  getAvailableIntegrationTypes() {
    return [
      { type: 'inventory_api', name: 'Inventory API', description: 'Product stock and availability' },
      { type: 'order_api', name: 'Order API', description: 'Order status and management' },
      { type: 'customer_api', name: 'Customer API', description: 'Customer data and profiles' },
      { type: 'booking_api', name: 'Booking API', description: 'Appointments and reservations' },
      { type: 'crm_api', name: 'CRM API', description: 'Customer relationship management' },
      { type: 'ecommerce_api', name: 'E-commerce API', description: 'Shopify, WooCommerce, etc.' },
      { type: 'calendar_api', name: 'Calendar API', description: 'Google Calendar, Outlook, etc.' },
      { type: 'email_api', name: 'Email API', description: 'Email sending and tracking' },
      { type: 'sms_api', name: 'SMS API', description: 'SMS notifications' },
      { type: 'payment_api', name: 'Payment API', description: 'Payment processing' },
      { type: 'shipping_api', name: 'Shipping API', description: 'Shipping and delivery tracking' },
      { type: 'custom_api', name: 'Custom API', description: 'Any custom REST API' },
    ];
  }

  /**
   * Test an integration by making a simple request
   * @param {number} integrationId - Integration ID
   * @returns {Object} { success: boolean, responseTime?: number, error?: string }
   */
  async testIntegration(integrationId) {
    try {
      const integration = await ClientIntegration.findById(integrationId);
      if (!integration) {
        return { success: false, error: 'Integration not found' };
      }

      const formatted = this.formatIntegrationForTool(integration);
      if (!formatted.apiUrl) {
        return { success: false, error: 'No API URL configured' };
      }

      const headers = this.buildAuthHeaders(formatted);
      headers['Content-Type'] = 'application/json';

      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.INTEGRATION_TEST);

      try {
        const response = await fetch(formatted.apiUrl, {
          method: 'GET',
          headers,
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        // Update last sync test timestamp
        await ClientIntegration.updateSyncTest(integrationId, response.ok);

        return {
          success: response.ok,
          statusCode: response.status,
          responseTime,
          error: response.ok ? null : `API returned ${response.status}`
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          return { success: false, error: 'Connection timeout (>10s)' };
        }
        throw fetchError;
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
const integrationService = new IntegrationService();
export default integrationService;

