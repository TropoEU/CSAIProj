/**
 * Customer Authentication Middleware
 * Authenticates customers (clients) using JWT tokens issued after access code verification
 */

import jwt from 'jsonwebtoken';
import { HTTP_STATUS } from '../config/constants.js';
import { Client } from '../models/Client.js';

/**
 * Verify customer JWT token and attach client to request
 */
async function customerAuth(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Access token required',
        message: 'Please log in with your access code',
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          error: 'Token expired',
          message: 'Your session has expired. Please log in again.',
        });
      }
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Invalid token',
        message: 'Invalid authentication token',
      });
    }

    // Get client from database
    const client = await Client.findById(decoded.clientId);

    if (!client) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Client not found',
        message: 'Your account could not be found',
      });
    }

    // Check if client is active
    if (client.status !== 'active') {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Account inactive',
        message: 'Your account is currently inactive. Please contact support.',
      });
    }

    // Attach client to request
    req.client = client;
    req.clientId = client.id;

    next();
  } catch (error) {
    console.error('[CustomerAuth] Authentication error:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Authentication failed',
      message: 'An error occurred during authentication',
    });
  }
}

export default customerAuth;
