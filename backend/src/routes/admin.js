import express from 'express';
import { Admin } from '../models/Admin.js';
import { Client } from '../models/Client.js';
import { authenticateAdmin, generateToken } from '../middleware/adminAuth.js';
import conversationService from '../services/conversationService.js';

// Import sub-routers
import clientsRouter from './admin/clients.js';
import toolsRouter from './admin/tools.js';
import conversationsRouter from './admin/conversations.js';
import integrationsRouter from './admin/integrations.js';
import analyticsRouter from './admin/analytics.js';
import billingRouter from './admin/billing.js';
import usageRouter from './admin/usage.js';
import plansRouter from './admin/plans.js';
import escalationsRouter from './admin/escalations.js';

const router = express.Router();

// =====================================================
// AUTH ROUTES (No auth required)
// =====================================================

/**
 * POST /admin/login
 * Authenticate admin and return JWT token
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const admin = await Admin.verifyCredentials(username, password);

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(admin);

    res.json({
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error('[Admin] Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /admin/verify
 * Verify JWT token and return admin info
 */
router.get('/verify', authenticateAdmin, (req, res) => {
  res.json({
    admin: {
      id: req.admin.id,
      username: req.admin.username,
      email: req.admin.email,
      role: req.admin.role,
    },
  });
});

/**
 * POST /admin/logout
 * Logout (client-side token removal, just acknowledge)
 */
router.post('/logout', authenticateAdmin, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// =====================================================
// All routes below require authentication
// =====================================================
router.use(authenticateAdmin);

// =====================================================
// MOUNT SUB-ROUTERS
// =====================================================

// Client routes - /admin/clients/*
router.use('/clients', clientsRouter);

// Tool routes - /admin/tools/* and /admin/clients/:clientId/tools/*
router.use('/tools', toolsRouter);
router.use('/', toolsRouter); // For /clients/:clientId/tools routes

// Conversation routes - /admin/conversations/*
router.use('/conversations', conversationsRouter);

// Integration routes - /admin/integrations/*, /admin/integration-types, /admin/clients/:clientId/integrations
router.use('/integrations', integrationsRouter);
router.use('/', integrationsRouter); // For /clients/:clientId/integrations and /integration-types routes

// Analytics routes - /admin/stats/*
router.use('/stats', analyticsRouter);

// Billing routes - /admin/billing/* and /admin/clients/:id/invoices
router.use('/billing', billingRouter);
router.use('/', billingRouter); // For /clients/:id/invoices routes

// Usage routes - /admin/usage/* and /admin/clients/:id/usage/*
router.use('/usage', usageRouter);
router.use('/', usageRouter); // For /clients/:id/usage routes

// Plan routes - /admin/plans/*
router.use('/plans', plansRouter);

// Escalation routes - /admin/escalations/* and /admin/clients/:clientId/escalations/*
router.use('/escalations', escalationsRouter);
router.use('/', escalationsRouter); // For /clients/:clientId/escalations routes

// =====================================================
// TEST CHAT ROUTE
// =====================================================

/**
 * POST /admin/test-chat
 * Send a test message as if from a client's widget
 */
router.post('/test-chat', async (req, res) => {
  try {
    const { clientId, message, sessionId } = req.body;

    if (!clientId || !message || !sessionId) {
      return res.status(400).json({ error: 'Client ID, message, and session ID are required' });
    }

    // Get client
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Process message using conversation service
    const result = await conversationService.processMessage(client, sessionId, message.trim(), {});

    res.json({
      message: result.response,
      toolCalls: result.toolsUsed || [],
      tokensUsed: result.tokensUsed || 0,
      sessionId,
    });
  } catch (error) {
    console.error('[Admin] Test chat error:', error);
    res.status(500).json({ error: 'Test chat failed', message: error.message });
  }
});

export default router;
