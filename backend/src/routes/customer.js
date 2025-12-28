/**
 * Customer Dashboard API Routes
 * Routes for customer portal (businesses using the widget)
 */

import express from 'express';
import customerController from '../controllers/customerController.js';
import customerAuth from '../middleware/customerAuth.js';

const router = express.Router();

// ==================== Authentication ====================

/**
 * Login with access code
 * POST /api/customer/auth/login
 * Body: { accessCode, rememberMe }
 */
router.post('/auth/login', customerController.login);

// All routes below require authentication
router.use(customerAuth);

// ==================== Dashboard ====================

/**
 * Get dashboard overview
 * GET /api/customer/dashboard/overview
 * Returns: account info, usage stats, recent activity (60 days)
 */
router.get('/dashboard/overview', customerController.getOverview);

// ==================== Actions ====================

/**
 * Get enabled actions (tools)
 * GET /api/customer/actions
 * Returns: list of tools with descriptions and capabilities
 */
router.get('/actions', customerController.getActions.bind(customerController));

// ==================== Conversations ====================

/**
 * Get conversations with pagination and filters
 * GET /api/customer/conversations
 * Query params: page, limit, search, status, days (default 60)
 */
router.get('/conversations', customerController.getConversations);

/**
 * Get conversation detail
 * GET /api/customer/conversations/:id
 * Returns: full conversation with messages and tool executions
 */
router.get('/conversations/:id', customerController.getConversationDetail);

// ==================== Billing ====================

/**
 * Get invoices
 * GET /api/customer/billing/invoices
 * Returns: list of invoices with status and amounts
 */
router.get('/billing/invoices', customerController.getInvoices);

// ==================== Usage ====================

/**
 * Get current month usage
 * GET /api/customer/usage/current
 * Returns: usage vs limits for conversations, tokens, tool calls
 */
router.get('/usage/current', customerController.getCurrentUsage);

/**
 * Get usage trends
 * GET /api/customer/usage/trends
 * Query params: period (e.g., "30d")
 * Returns: daily usage data for charts
 */
router.get('/usage/trends', customerController.getUsageTrends);

/**
 * Get tool usage breakdown
 * GET /api/customer/usage/tools
 * Returns: tool call counts and success rates
 */
router.get('/usage/tools', customerController.getToolUsage);

// ==================== Settings ====================

/**
 * Get current settings
 * GET /api/customer/settings
 * Returns: language preference and other settings
 */
router.get('/settings', customerController.getSettings);

/**
 * Update settings
 * PUT /api/customer/settings
 * Body: { language }
 */
router.put('/settings', customerController.updateSettings);

// ==================== Escalations ====================

/**
 * Get escalation stats summary
 * GET /api/customer/escalations/stats
 * Returns: pending, acknowledged, resolved counts
 */
router.get('/escalations/stats', customerController.getEscalationStats);

/**
 * Get escalations list
 * GET /api/customer/escalations
 * Query params: status, limit, offset
 * Returns: list of escalations for this client
 */
router.get('/escalations', customerController.getEscalations);

/**
 * Get escalation detail
 * GET /api/customer/escalations/:id
 * Returns: escalation details with customer contact info
 */
router.get('/escalations/:id', customerController.getEscalationDetail);

/**
 * Acknowledge an escalation
 * POST /api/customer/escalations/:id/acknowledge
 * Marks escalation as acknowledged
 */
router.post('/escalations/:id/acknowledge', customerController.acknowledgeEscalation);

/**
 * Resolve an escalation
 * POST /api/customer/escalations/:id/resolve
 * Body: { notes }
 * Marks escalation as resolved with optional notes
 */
router.post('/escalations/:id/resolve', customerController.resolveEscalation);

export default router;
