/**
 * n8n Integration Service
 *
 * Responsibilities:
 * - Execute tool calls via n8n webhooks
 * - Handle timeouts and errors
 * - Format responses for LLM consumption
 * - Track execution time
 */

const DEFAULT_TIMEOUT = 30000; // 30 seconds

// Build n8n URL from components, with WEBHOOK_URL as override
const buildN8nUrl = () => {
  if (process.env.WEBHOOK_URL) {
    return process.env.WEBHOOK_URL;
  }
  const host = process.env.N8N_HOST || 'localhost';
  const port = process.env.N8N_PORT || '5678';
  const protocol = process.env.N8N_PROTOCOL || 'http';
  return `${protocol}://${host}:${port}/`;
};

const N8N_BASE_URL = buildN8nUrl();
console.log(`[n8n] Base URL: ${N8N_BASE_URL}`);

class N8nService {
  /**
   * Execute a tool via n8n webhook
   * @param {String} webhookUrl - Full webhook URL or path
   * @param {Object} parameters - Tool parameters from AI
   * @param {Object} options - Execution options
   * @param {Number} options.timeout - Timeout in milliseconds (default 30s)
   * @param {Object} options.integrations - Multiple client integrations (new format)
   *   Example: { "order_api": {...}, "email_api": {...} }
   * @param {Object} options.integration - Single client integration (legacy support)
   * @returns {Object} { success, data, executionTimeMs, error }
   */
  async executeTool(webhookUrl, parameters = {}, options = {}) {
    const { timeout = DEFAULT_TIMEOUT, integrations = null, integration = null } =
      typeof options === 'number' ? { timeout: options } : options;
    const startTime = Date.now();

    try {
      // Ensure webhook URL is complete
      const fullUrl = this.buildWebhookUrl(webhookUrl);

      console.log('\n========== N8N REQUEST DEBUG ==========');
      console.log(`[n8n] Calling webhook: ${fullUrl}`);
      console.log('[n8n] Parameters:', JSON.stringify(parameters, null, 2));

      // Support both new (integrations) and legacy (integration) format
      const integrationsToUse = integrations || (integration ? { default: integration } : {});
      const integrationCount = Object.keys(integrationsToUse).length;

      console.log(`[n8n] Integrations provided: ${integrationCount}`);
      if (integrationCount > 0) {
        console.log('[n8n] Integration keys:', Object.keys(integrationsToUse).join(', '));
        Object.entries(integrationsToUse).forEach(([key, int]) => {
          console.log(`[n8n] - ${key}:`, {
            type: int.type,
            apiUrl: int.apiUrl,
            hasApiKey: !!int.apiKey,
            authMethod: int.authMethod
          });
        });
      } else {
        console.warn('[n8n] ⚠️  NO INTEGRATIONS PROVIDED');
      }

      // Build request body - include integration credentials if provided
      const requestBody = {
        ...parameters,
        // Add integrations under _integrations key for n8n to use
        ...(integrationCount > 0 && {
          _integrations: Object.fromEntries(
            Object.entries(integrationsToUse).map(([key, int]) => [
              key,
              {
                type: int.type,
                apiUrl: int.apiUrl,
                apiKey: int.apiKey,
                apiSecret: int.apiSecret,
                authMethod: int.authMethod,
                method: int.method || 'GET',
                headers: int.headers,
                config: int.config
              }
            ])
          )
        })
      };

      console.log('[n8n] Request body keys:', Object.keys(requestBody).join(', '));
      console.log('[n8n] Has _integrations in body:', !!requestBody._integrations);
      console.log('==========================================\n');

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(fullUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const executionTimeMs = Date.now() - startTime;

        // Check if response is OK
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[n8n] Webhook failed (${response.status}):`, errorText);

          return {
            success: false,
            data: null,
            executionTimeMs,
            error: `n8n webhook returned ${response.status}: ${errorText}`
          };
        }

        // Parse response
        const contentType = response.headers.get('content-type');
        let data;
        const responseText = await response.text();

        if (contentType && contentType.includes('application/json')) {
          try {
            data = responseText ? JSON.parse(responseText) : {};
          } catch (parseError) {
            console.error('[n8n] Failed to parse JSON response:', parseError.message);
            console.error('[n8n] Response text:', responseText.substring(0, 200));
            // Return the text as data if JSON parsing fails
            data = { error: 'Invalid JSON response', raw: responseText };
          }
        } else {
          data = responseText || '';
        }

        console.log(`[n8n] Webhook success (${executionTimeMs}ms)`);

        return {
          success: true,
          data,
          executionTimeMs,
          error: null
        };

      } catch (fetchError) {
        clearTimeout(timeoutId);

        // Handle abort/timeout
        if (fetchError.name === 'AbortError') {
          const executionTimeMs = Date.now() - startTime;
          console.error(`[n8n] Webhook timeout after ${timeout}ms`);

          return {
            success: false,
            data: null,
            executionTimeMs,
            error: `Tool execution timed out after ${timeout}ms`
          };
        }

        throw fetchError;
      }

    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      console.error('[n8n] Tool execution error:', error);

      return {
        success: false,
        data: null,
        executionTimeMs,
        error: error.message || 'Unknown error during tool execution'
      };
    }
  }

  /**
   * Build complete webhook URL from path or validate full URL
   * @param {String} webhookUrl - Webhook URL or path
   * @returns {String} Complete webhook URL
   */
  buildWebhookUrl(webhookUrl) {
    // If already a complete URL, return it
    if (webhookUrl.startsWith('http://') || webhookUrl.startsWith('https://')) {
      return webhookUrl;
    }

    // If it's a path, combine with base URL
    const baseUrl = N8N_BASE_URL.endsWith('/') ? N8N_BASE_URL : N8N_BASE_URL + '/';
    const path = webhookUrl.startsWith('/') ? webhookUrl.slice(1) : webhookUrl;

    return baseUrl + path;
  }

  /**
   * Test webhook connectivity
   * @param {String} webhookUrl - Webhook URL to test
   * @returns {Object} { reachable, responseTime, error }
   */
  async testWebhook(webhookUrl) {
    const startTime = Date.now();

    try {
      const fullUrl = this.buildWebhookUrl(webhookUrl);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s test timeout

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      return {
        reachable: true,
        responseTime,
        statusCode: response.status,
        error: null
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (error.name === 'AbortError') {
        return {
          reachable: false,
          responseTime,
          error: 'Webhook timeout (>5s)'
        };
      }

      return {
        reachable: false,
        responseTime,
        error: error.message
      };
    }
  }

  /**
   * Format n8n response for LLM consumption
   * Handles varied response formats from different client APIs
   * @param {*} n8nResponse - Response from n8n webhook (any format)
   * @returns {String} Formatted response suitable for LLM context
   */
  formatResponseForLLM(n8nResponse) {
    // Handle null/undefined
    if (!n8nResponse) {
      return 'No data returned from tool execution.';
    }

    // Handle string responses
    if (typeof n8nResponse === 'string') {
      return this.truncateIfNeeded(n8nResponse);
    }

    // Handle array responses
    if (Array.isArray(n8nResponse)) {
      if (n8nResponse.length === 0) {
        return 'No results found.';
      }

      // Limit array size to prevent huge responses
      const maxItems = 20;
      const truncated = n8nResponse.length > maxItems;
      const items = truncated ? n8nResponse.slice(0, maxItems) : n8nResponse;

      let result = JSON.stringify(items, null, 2);
      if (truncated) {
        result += `\n... and ${n8nResponse.length - maxItems} more items (truncated)`;
      }
      return this.truncateIfNeeded(result);
    }

    // Handle object responses - the main case for API responses
    if (typeof n8nResponse === 'object') {
      // 1. Check for error patterns first
      if (this.isErrorResponse(n8nResponse)) {
        const errorMsg = n8nResponse.error 
          || n8nResponse.errorMessage 
          || n8nResponse.err 
          || n8nResponse.message 
          || 'Unknown error';
        return `Error: ${errorMsg}`;
      }

      // 2. Try to extract a human-readable message if present
      const message = this.extractMessage(n8nResponse);
      
      // 3. Try to extract the actual data payload
      const data = this.extractData(n8nResponse);

      // 4. Build the response
      let formatted = '';
      
      if (message) {
        formatted = message;
        // Only include data if it's small and adds value (don't dump huge JSON)
        if (data && data !== message && typeof data === 'object') {
          const dataStr = JSON.stringify(data, null, 2);
          // Only include data if it's reasonably small (< 500 chars)
          // The LLM can ask for more details if needed
          if (dataStr.length < 500) {
            formatted += '\n\nDetails:\n' + dataStr;
          } else {
            // For large data, extract key fields with values (not just field names)
            // This gives LLM enough context without overwhelming it
            const importantFields = this.extractImportantFields(data);
            if (importantFields && Object.keys(importantFields).length > 0) {
              formatted += '\n\nKey Details:\n' + JSON.stringify(importantFields, null, 2);
            }
          }
        }
      } else if (data) {
        // No message, just data
        formatted = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      } else {
        // Fallback: stringify the whole response
        formatted = JSON.stringify(n8nResponse, null, 2);
      }

      return this.truncateIfNeeded(formatted);
    }

    // Fallback: convert to string
    return String(n8nResponse);
  }

  /**
   * Check if response indicates an error
   * Handles various API error patterns
   */
  isErrorResponse(response) {
    // Explicit error fields
    if (response.error || response.err || response.errorMessage) return true;
    
    // Success flags set to false
    if (response.success === false) return true;
    if (response.ok === false) return true;
    if (response.succeeded === false) return true;
    
    // Status fields indicating error
    const status = (response.status || '').toString().toLowerCase();
    if (['error', 'failed', 'failure', 'fail'].includes(status)) return true;
    
    // HTTP status codes in response
    if (response.statusCode >= 400) return true;
    if (response.code >= 400) return true;
    
    return false;
  }

  /**
   * Extract human-readable message from various response formats
   */
  extractMessage(response) {
    // Try common message field names
    const messageFields = [
      'message', 'msg', 'description', 'text', 
      'statusMessage', 'status_message', 'responseMessage',
      'display_message', 'displayMessage', 'userMessage'
    ];
    
    for (const field of messageFields) {
      if (response[field] && typeof response[field] === 'string') {
        return response[field];
      }
    }
    
    return null;
  }

  /**
   * Extract actual data payload from various response wrappers
   */
  extractData(response) {
    // Try common data wrapper field names
    const dataFields = [
      'data', 'result', 'results', 'payload', 'body',
      'response', 'content', 'items', 'records', 'output'
    ];
    
    for (const field of dataFields) {
      if (response[field] !== undefined) {
        return response[field];
      }
    }
    
    // If no wrapper found, return the response itself
    // But remove internal/meta fields
    const cleaned = { ...response };
    delete cleaned.success;
    delete cleaned.ok;
    delete cleaned.status;
    delete cleaned.statusCode;
    delete cleaned.timestamp;
    delete cleaned._integration; // Remove our internal field
    
    // If after cleaning there's nothing left, return original
    if (Object.keys(cleaned).length === 0) {
      return response;
    }
    
    return cleaned;
  }

  /**
   * Extract important fields from large data objects
   * Prioritizes common high-value fields to give LLM context without overwhelming it
   * @param {Object} data - The data object to extract from
   * @returns {Object} Subset of important fields with values
   */
  extractImportantFields(data) {
    if (!data || typeof data !== 'object') return null;

    // Priority fields to extract (in order of importance)
    const priorityFields = [
      // IDs and identifiers
      'id', 'orderId', 'orderNumber', 'order_id', 'order_number',
      'bookingId', 'booking_id', 'confirmationNumber', 'confirmation_number',
      'transactionId', 'transaction_id', 'reference', 'ref',

      // Status and state
      'status', 'statusText', 'status_text', 'state', 'orderStatus', 'order_status',

      // Time and scheduling
      'estimatedDelivery', 'estimated_delivery', 'deliveryTime', 'delivery_time',
      'eta', 'arrivalTime', 'arrival_time', 'date', 'time', 'datetime',

      // Names and descriptions
      'name', 'customerName', 'customer_name', 'title', 'description',

      // Amounts and quantities
      'total', 'amount', 'price', 'cost', 'subtotal', 'quantity', 'count',

      // Contact info
      'phone', 'email', 'address',

      // Driver/delivery info (for order tracking)
      'driver', 'courier', 'deliveryPerson', 'delivery_person'
    ];

    const extracted = {};
    let fieldCount = 0;
    const maxFields = 8; // Limit to 8 important fields

    // Extract priority fields that exist in data
    for (const field of priorityFields) {
      if (fieldCount >= maxFields) break;

      if (data[field] !== undefined && data[field] !== null) {
        // For nested objects (like driver), extract key info only
        if (typeof data[field] === 'object' && !Array.isArray(data[field])) {
          const nested = {};
          // Extract up to 3 key fields from nested object
          const nestedKeys = Object.keys(data[field]).slice(0, 3);
          for (const key of nestedKeys) {
            nested[key] = data[field][key];
          }
          extracted[field] = nested;
        }
        // For arrays, show count and first item if small
        else if (Array.isArray(data[field])) {
          if (data[field].length === 0) {
            extracted[field] = [];
          } else if (data[field].length === 1) {
            extracted[field] = data[field];
          } else {
            extracted[field] = `[${data[field].length} items]`;
          }
        }
        // For simple values, include directly
        else {
          extracted[field] = data[field];
        }
        fieldCount++;
      }
    }

    return Object.keys(extracted).length > 0 ? extracted : null;
  }

  /**
   * Truncate response if too long for LLM context
   * @param {String} text - Text to potentially truncate
   * @param {Number} maxLength - Maximum length (default 8000 chars)
   */
  truncateIfNeeded(text, maxLength = 8000) {
    if (text.length <= maxLength) {
      return text;
    }
    
    const truncated = text.substring(0, maxLength);
    return truncated + '\n\n... (response truncated due to length)';
  }

  /**
   * Execute multiple tools in parallel
   * @param {Array} toolExecutions - Array of {webhookUrl, parameters}
   * @param {Number} timeout - Timeout per tool
   * @returns {Array} Array of results
   */
  async executeToolsBatch(toolExecutions, timeout = DEFAULT_TIMEOUT) {
    console.log(`[n8n] Executing ${toolExecutions.length} tools in parallel`);

    const promises = toolExecutions.map(({ webhookUrl, parameters }) =>
      this.executeTool(webhookUrl, parameters, timeout)
    );

    return await Promise.all(promises);
  }

  /**
   * Check n8n service health
   * @returns {Object} { available, version, error }
   */
  async checkHealth() {
    try {
      const n8nUrl = N8N_BASE_URL.endsWith('/') ? N8N_BASE_URL.slice(0, -1) : N8N_BASE_URL;
      const healthUrl = `${n8nUrl}/healthz`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(healthUrl, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          available: false,
          error: `n8n returned status ${response.status}`
        };
      }

      const data = await response.json();

      return {
        available: true,
        version: data.version || 'unknown',
        error: null
      };

    } catch (error) {
      return {
        available: false,
        error: error.message || 'n8n service unreachable'
      };
    }
  }

  /**
   * Retry failed tool execution with exponential backoff
   * @param {String} webhookUrl - Webhook URL
   * @param {Object} parameters - Tool parameters
   * @param {Number} maxRetries - Maximum retry attempts
   * @param {Number} timeout - Timeout per attempt
   * @returns {Object} Execution result
   */
  async executeToolWithRetry(webhookUrl, parameters, maxRetries = 2, timeout = DEFAULT_TIMEOUT) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      console.log(`[n8n] Tool execution attempt ${attempt}/${maxRetries + 1}`);

      const result = await this.executeTool(webhookUrl, parameters, timeout);

      if (result.success) {
        return result;
      }

      lastError = result.error;

      // Don't retry on timeout or if it's the last attempt
      if (result.error.includes('timed out') || attempt === maxRetries + 1) {
        break;
      }

      // Exponential backoff: 1s, 2s, 4s, etc.
      const delay = Math.pow(2, attempt - 1) * 1000;
      console.log(`[n8n] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // All retries failed
    return {
      success: false,
      data: null,
      executionTimeMs: 0,
      error: lastError
    };
  }
}

// Export singleton instance
const n8nService = new N8nService();
export default n8nService;
