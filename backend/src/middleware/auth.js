import { HTTP_STATUS } from '../config/constants.js';
import { Client } from '../models/Client.js';

/**
 * Authentication Middleware
 *
 * Validates API keys and attaches client to request
 */

/**
 * Authenticate client via API key
 * Expects API key in Authorization header: "Bearer <api_key>"
 */
export async function authenticateClient(req, res, next) {
  try {
    // Get API key from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Missing or invalid Authorization header. Expected: "Bearer <api_key>"',
      });
    }

    const apiKey = authHeader.substring(7); // Remove "Bearer " prefix

    if (!apiKey) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'API key is required',
      });
    }

    // Look up client by API key
    const client = await Client.findByApiKey(apiKey);

    if (!client) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Invalid API key',
      });
    }

    // Check if client is active
    if (client.status !== 'active') {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Client account is not active',
      });
    }

    // Attach client to request
    req.client = client;

    next();
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Authentication failed',
      message: error.message,
    });
  }
}

/**
 * Optional authentication - doesn't fail if no API key provided
 * Used for public endpoints that have enhanced features with auth
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const apiKey = authHeader.substring(7);
      const client = await Client.findByApiKey(apiKey);

      if (client && client.status === 'active') {
        req.client = client;
      }
    }

    next();
  } catch (error) {
    console.error('[Auth] Optional auth error:', error);
    next(); // Continue anyway
  }
}
