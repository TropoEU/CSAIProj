import jwt from 'jsonwebtoken';
import { Admin } from '../models/Admin.js';

// JWT secret - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'csai-admin-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

/**
 * Generate JWT token for admin
 */
export function generateToken(admin) {
  return jwt.sign(
    {
      id: admin.id,
      username: admin.username,
      role: admin.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify JWT token and return decoded payload
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Admin authentication middleware
 * Expects JWT token in Authorization header: "Bearer <token>"
 */
export async function authenticateAdmin(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Missing or invalid Authorization header. Expected: "Bearer <token>"',
      });
    }

    const token = authHeader.substring(7);

    if (!token) {
      return res.status(401).json({
        error: 'Token is required',
      });
    }

    // Verify token
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        error: 'Invalid or expired token',
      });
    }

    // Get admin from database to ensure they still exist and are active
    const admin = await Admin.findById(decoded.id);

    if (!admin) {
      return res.status(401).json({
        error: 'Admin not found',
      });
    }

    if (admin.status !== 'active') {
      return res.status(403).json({
        error: 'Admin account is not active',
      });
    }

    // Attach admin to request
    req.admin = admin;

    next();
  } catch (error) {
    console.error('[AdminAuth] Authentication error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      message: error.message,
    });
  }
}

/**
 * Check if admin has required role
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: req.admin.role,
      });
    }

    next();
  };
}
