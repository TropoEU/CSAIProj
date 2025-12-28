import { ClientIntegration } from '../models/ClientIntegration.js';

/**
 * Integration Tester Service
 *
 * Provides comprehensive API testing with schema capture:
 * - Tests real API endpoints with authentication
 * - Captures and validates request/response structure
 * - Stores API schema for tool configuration
 * - Provides detailed test results and error diagnostics
 */
class IntegrationTester {
  /**
   * Test integration with comprehensive schema capture
   * @param {number} integrationId - Integration ID to test
   * @param {Object} testConfig - Test configuration
   *   {
   *     endpoints: [{
   *       path: '/orders/123',
   *       method: 'GET',
   *       params: { orderId: '123' },
   *       body: null,
   *       description: 'Get order by ID'
   *     }],
   *     captureSchema: true
   *   }
   * @returns {Object} Test results with captured schema
   */
  async testIntegration(integrationId, testConfig = null) {
    try {
      const integration = await ClientIntegration.findById(integrationId);
      if (!integration) {
        return { success: false, error: 'Integration not found' };
      }

      const config = integration.connection_config || {};
      const apiUrl = config.api_url || config.apiUrl || config.url || config.apiUrl;

      if (!apiUrl) {
        return {
          success: false,
          error: 'No API URL configured',
          suggestion: 'Please configure the API base URL in the integration settings',
          timestamp: new Date().toISOString(),
          baseUrl: null,
          authMethod: config.auth_method || config.authMethod || 'none',
          endpointTests: [],
          capturedSchema: {},
          responseTime: 0
        };
      }

      // Build auth headers
      const headers = this.buildAuthHeaders(integration);
      headers['Content-Type'] = 'application/json';
      headers['Accept'] = 'application/json';

      // Parse the API URL to extract origin (base URL) for testing
      // Integration URLs are now FULL endpoint URLs like:
      // http://host.docker.internal:3000/mock-api/bobs-pizza/orders/{orderNumber}/status
      // For testing, we extract the origin: http://host.docker.internal:3000
      let testBaseUrl;
      const fullEndpointUrl = apiUrl;

      try {
        const parsedUrl = new URL(apiUrl);
        testBaseUrl = parsedUrl.origin; // Just protocol + host + port
      } catch {
        testBaseUrl = apiUrl;
      }

      const startTime = Date.now();
      const testResults = {
        success: false,
        timestamp: new Date().toISOString(),
        configuredUrl: fullEndpointUrl,
        testBaseUrl: testBaseUrl,
        authMethod: config.auth_method || config.authMethod || 'bearer',
        endpointTests: [],
        capturedSchema: {},
        responseTime: 0,
        error: null
      };

      // Determine endpoints to test
      // Since integrations now store FULL endpoint URLs, we test the API server
      // by checking health endpoints at the origin (base URL)
      let endpointsToTest;

      if (testConfig?.endpoints && testConfig.endpoints.length > 0) {
        // Use explicitly provided test endpoints (full URLs supported)
        endpointsToTest = testConfig.endpoints;
      } else if (integration.test_config?.endpoints) {
        // Use saved test endpoints from integration config
        endpointsToTest = integration.test_config.endpoints;
      } else {
        // Smart endpoint discovery at the BASE URL (origin)
        // We test common health endpoints to verify the API server is reachable
        endpointsToTest = [
          { path: '/health', method: 'GET', description: 'Health check endpoint' },
          { path: '/ping', method: 'GET', description: 'Ping endpoint' },
          { path: '/', method: 'GET', description: 'Root endpoint' },
          { path: '', method: 'GET', description: 'Base URL' }
        ];
      }

      let anyTestPassed = false;
      const isSmartDiscovery = !testConfig?.endpoints && !integration.test_config?.endpoints;

      for (const endpoint of endpointsToTest) {
        const endpointResult = await this.testEndpoint(
          testBaseUrl,  // Use extracted base URL (origin) for testing
          endpoint,
          headers,
          testConfig?.captureSchema !== false
        );

        testResults.endpointTests.push(endpointResult);

        // Capture schema if successful
        if (endpointResult.success) {
          anyTestPassed = true;
          if (endpointResult.responseSchema) {
            const schemaKey = `${endpoint.method} ${endpoint.path || '/'}`;
            testResults.capturedSchema[schemaKey] = endpointResult.responseSchema;
          }

          // For smart discovery, stop after first successful endpoint
          if (isSmartDiscovery) {
            testResults.discoveredEndpoint = endpoint.path || '/';
            break;
          }
        }
      }

      testResults.responseTime = Date.now() - startTime;

      // For smart discovery, success if ANY endpoint worked
      // For explicit tests, ALL must pass
      testResults.success = isSmartDiscovery ? anyTestPassed : testResults.endpointTests.every(t => t.success);

      // If smart discovery found a working endpoint, add suggestion
      if (isSmartDiscovery && anyTestPassed && testResults.discoveredEndpoint) {
        testResults.suggestion = `Found working endpoint: ${testResults.discoveredEndpoint}. Consider adding it to the integration config as 'test_endpoint'.`;
      }

      // If nothing worked, give helpful error
      if (!anyTestPassed) {
        testResults.error = 'No API endpoints responded successfully';
        testResults.suggestion = 'Configure a valid test endpoint in the integration settings, or ensure your API has a /health or root endpoint.';
      }

      // Generate recommendations based on test results
      testResults.recommendations = this.generateRecommendations(testResults);

      // Update integration with test results
      await ClientIntegration.updateTestResult(integrationId, testResults);

      // If schema was captured, update the integration's api_schema
      if (Object.keys(testResults.capturedSchema).length > 0) {
        await ClientIntegration.update(integrationId, {
          api_schema: testResults.capturedSchema
        });
      }

      return testResults;
    } catch (error) {
      console.error('[IntegrationTester] Test failed:', error);
      return {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
  }

  /**
   * Test a single endpoint
   */
  async testEndpoint(baseUrl, endpoint, headers, captureSchema = true) {
    const url = new URL(endpoint.path || '', baseUrl).toString();
    const method = endpoint.method || 'GET';

    const result = {
      endpoint: endpoint.path || '/',
      method,
      description: endpoint.description || `${method} ${endpoint.path || '/'}`,
      success: false,
      statusCode: null,
      responseTime: 0,
      responseSchema: null,
      error: null
    };

    const startTime = Date.now();

    try {
      const fetchOptions = {
        method,
        headers,
        signal: AbortSignal.timeout(15000) // 15 second timeout
      };

      if (endpoint.body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        fetchOptions.body = JSON.stringify(endpoint.body);
      }

      const response = await fetch(url, fetchOptions);
      result.responseTime = Date.now() - startTime;
      result.statusCode = response.status;
      result.success = response.ok;

      if (!response.ok) {
        result.error = `API returned ${response.status} ${response.statusText}`;
        const errorBody = await response.text();
        if (errorBody) {
          try {
            result.errorDetails = JSON.parse(errorBody);
          } catch {
            result.errorDetails = errorBody.substring(0, 500);
          }
        }
        return result;
      }

      // Parse response
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const responseData = await response.json();

        // Capture schema if requested
        if (captureSchema) {
          result.responseSchema = this.captureResponseSchema(responseData);
          result.sampleResponse = this.sanitizeSampleResponse(responseData);
        }
      } else {
        result.warning = `Non-JSON response (${contentType})`;
      }

      return result;
    } catch (error) {
      result.responseTime = Date.now() - startTime;

      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        result.error = 'Request timeout (>15s)';
      } else if (error.message.includes('fetch failed') || error.code === 'ENOTFOUND') {
        result.error = 'Cannot reach API - check URL and network connectivity';
      } else if (error.message.includes('ECONNREFUSED')) {
        result.error = 'Connection refused - API may be down';
      } else {
        result.error = error.message;
      }

      return result;
    }
  }

  /**
   * Build authentication headers based on integration config
   */
  buildAuthHeaders(integration) {
    const config = integration.connection_config || {};
    const headers = { ...config.headers };
    const authMethod = config.auth_method || config.authMethod || 'bearer';

    switch (authMethod) {
      case 'bearer':
        if (config.api_key || config.apiKey) {
          headers['Authorization'] = `Bearer ${config.api_key || config.apiKey}`;
        }
        break;

      case 'api_key':
        if (config.api_key || config.apiKey) {
          headers['X-API-Key'] = config.api_key || config.apiKey;
        }
        break;

      case 'basic':
        if ((config.api_key || config.apiKey) && (config.api_secret || config.apiSecret)) {
          const credentials = Buffer.from(
            `${config.api_key || config.apiKey}:${config.api_secret || config.apiSecret}`
          ).toString('base64');
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
   * Capture the structure of a response
   */
  captureResponseSchema(data, depth = 0, maxDepth = 3) {
    if (depth > maxDepth) {
      return { type: 'unknown', note: 'max depth reached' };
    }

    if (data === null) {
      return { type: 'null' };
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return { type: 'array', items: { type: 'unknown' } };
      }
      // Sample first item to determine array item type
      return {
        type: 'array',
        items: this.captureResponseSchema(data[0], depth + 1, maxDepth)
      };
    }

    if (typeof data === 'object') {
      const properties = {};
      for (const [key, value] of Object.entries(data)) {
        properties[key] = this.captureResponseSchema(value, depth + 1, maxDepth);
      }
      return {
        type: 'object',
        properties
      };
    }

    // Primitive types
    return { type: typeof data };
  }

  /**
   * Sanitize sample response (remove sensitive data, limit size)
   */
  sanitizeSampleResponse(data, maxSize = 1000) {
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'apikey', 'api_key'];
    const jsonStr = JSON.stringify(data, (key, value) => {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        return '[REDACTED]';
      }
      return value;
    }, 2);

    if (jsonStr.length > maxSize) {
      return JSON.parse(jsonStr.substring(0, maxSize) + '...');
    }

    return JSON.parse(jsonStr);
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations(testResults) {
    const recommendations = [];

    if (!testResults.success) {
      recommendations.push({
        type: 'error',
        message: 'API testing failed - check endpoint URLs and authentication'
      });
    }

    const failedTests = testResults.endpointTests.filter(t => !t.success);
    if (failedTests.length > 0) {
      failedTests.forEach(test => {
        recommendations.push({
          type: 'warning',
          endpoint: test.endpoint,
          message: test.error || 'Endpoint test failed'
        });
      });
    }

    if (testResults.responseTime > 5000) {
      recommendations.push({
        type: 'warning',
        message: `Slow API response (${testResults.responseTime}ms) - may impact user experience`
      });
    }

    if (Object.keys(testResults.capturedSchema).length === 0 && testResults.success) {
      recommendations.push({
        type: 'info',
        message: 'Configure test endpoints to capture API schema for better tool integration'
      });
    }

    return recommendations;
  }

  /**
   * Quick connectivity test (legacy support)
   */
  async quickTest(integrationId) {
    return this.testIntegration(integrationId, {
      endpoints: [{ path: '', method: 'GET', description: 'Connectivity test' }],
      captureSchema: false
    });
  }
}

// Export singleton instance
const integrationTester = new IntegrationTester();
export default integrationTester;
