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
const N8N_BASE_URL = process.env.WEBHOOK_URL || 'http://localhost:5678/';

class N8nService {
  /**
   * Execute a tool via n8n webhook
   * @param {String} webhookUrl - Full webhook URL or path
   * @param {Object} parameters - Tool parameters
   * @param {Number} timeout - Timeout in milliseconds (default 30s)
   * @returns {Object} { success, data, executionTimeMs, error }
   */
  async executeTool(webhookUrl, parameters = {}, timeout = DEFAULT_TIMEOUT) {
    const startTime = Date.now();

    try {
      // Ensure webhook URL is complete
      const fullUrl = this.buildWebhookUrl(webhookUrl);

      console.log(`[n8n] Calling webhook: ${fullUrl}`);
      console.log(`[n8n] Parameters:`, JSON.stringify(parameters, null, 2));

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(fullUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(parameters),
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

        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
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
   * Converts various n8n response formats into clean, readable text
   * @param {*} n8nResponse - Response from n8n webhook
   * @returns {String} Formatted response
   */
  formatResponseForLLM(n8nResponse) {
    // Handle null/undefined
    if (!n8nResponse) {
      return 'No data returned from tool execution.';
    }

    // Handle string responses
    if (typeof n8nResponse === 'string') {
      return n8nResponse;
    }

    // Handle array responses
    if (Array.isArray(n8nResponse)) {
      if (n8nResponse.length === 0) {
        return 'No results found.';
      }

      // If array of objects, format nicely
      if (typeof n8nResponse[0] === 'object') {
        return JSON.stringify(n8nResponse, null, 2);
      }

      // If array of primitives, join them
      return n8nResponse.join(', ');
    }

    // Handle object responses
    if (typeof n8nResponse === 'object') {
      // Check for common n8n response patterns
      if (n8nResponse.message) {
        return n8nResponse.message;
      }

      if (n8nResponse.result) {
        return this.formatResponseForLLM(n8nResponse.result);
      }

      if (n8nResponse.data) {
        return this.formatResponseForLLM(n8nResponse.data);
      }

      // Check for error responses
      if (n8nResponse.error) {
        return `Error: ${n8nResponse.error}`;
      }

      // Default: stringify the object
      return JSON.stringify(n8nResponse, null, 2);
    }

    // Fallback: convert to string
    return String(n8nResponse);
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
