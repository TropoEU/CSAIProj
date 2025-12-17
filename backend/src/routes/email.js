import express from 'express';
import { authenticateAdmin } from '../middleware/adminAuth.js';
import * as emailController from '../controllers/emailController.js';
import { transactionalEmailService } from '../services/transactionalEmailService.js';
import { gmailService } from '../services/gmailService.js';
import { Client } from '../models/Client.js';

const router = express.Router();

// =====================================================
// Platform Email Setup Routes
// =====================================================

/**
 * GET /api/email/platform/authorize
 * Initiate OAuth for the platform's own email account
 * This is a ONE-TIME setup to get tokens for transactional emails
 */
router.get('/platform/authorize', (req, res) => {
    const authUrl = gmailService.getAuthorizationUrl('platform');
    res.json({
        authUrl,
        instructions: 'Visit this URL to authorize the platform email account. After authorization, copy the tokens from the callback response.'
    });
});

/**
 * GET /api/email/platform/callback
 * Handle OAuth callback for platform email setup
 * Returns the tokens that need to be added to .env
 */
router.get('/platform/callback', async (req, res) => {
    try {
        const { code, error } = req.query;

        if (error) {
            return res.status(400).json({ error });
        }

        if (!code) {
            return res.status(400).json({ error: 'No authorization code provided' });
        }

        // Exchange code for tokens
        const tokens = await gmailService.getTokensFromCode(code);
        const email = await gmailService.getEmailAddress(tokens);

        // Return the tokens to be added to .env
        res.json({
            success: true,
            message: 'Add these to your backend/.env file:',
            env_variables: {
                PLATFORM_EMAIL: email,
                PLATFORM_EMAIL_ACCESS_TOKEN: tokens.access_token,
                PLATFORM_EMAIL_REFRESH_TOKEN: tokens.refresh_token,
            },
            copy_paste: `
# Platform Email Configuration (add to backend/.env)
PLATFORM_EMAIL=${email}
PLATFORM_EMAIL_ACCESS_TOKEN=${tokens.access_token}
PLATFORM_EMAIL_REFRESH_TOKEN=${tokens.refresh_token}
            `.trim()
        });
    } catch (error) {
        console.error('[Platform Email] OAuth callback error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/email/platform/test
 * Test sending a transactional email
 * Body: { to, type: 'access_code' | 'welcome' | 'custom', clientId?, subject?, body? }
 */
router.post('/platform/test', authenticateAdmin, async (req, res) => {
    try {
        const { to, type, clientId, subject, body } = req.body;

        if (!to) {
            return res.status(400).json({ error: 'Recipient email (to) is required' });
        }

        let result;

        if (type === 'access_code' && clientId) {
            // Send access code email
            const client = await Client.findById(clientId);
            if (!client) {
                return res.status(404).json({ error: 'Client not found' });
            }
            result = await transactionalEmailService.sendAccessCode(
                to,
                client.name,
                client.access_code || 'TEST123'
            );
        } else if (type === 'welcome' && clientId) {
            // Send welcome email
            const client = await Client.findById(clientId);
            if (!client) {
                return res.status(404).json({ error: 'Client not found' });
            }
            result = await transactionalEmailService.sendWelcomeEmail(
                to,
                client.name,
                client.api_key
            );
        } else if (type === 'custom' && subject && body) {
            // Send custom email
            result = await transactionalEmailService.sendEmail(to, subject, body);
        } else {
            return res.status(400).json({
                error: 'Invalid request. Provide: type (access_code/welcome/custom) with required fields',
                examples: {
                    access_code: { to: 'email@example.com', type: 'access_code', clientId: 1 },
                    welcome: { to: 'email@example.com', type: 'welcome', clientId: 1 },
                    custom: { to: 'email@example.com', type: 'custom', subject: 'Test', body: '<p>Hello</p>' }
                }
            });
        }

        res.json(result);
    } catch (error) {
        console.error('[Platform Email] Test error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/email/platform/status
 * Check if platform email is configured
 */
router.get('/platform/status', authenticateAdmin, (req, res) => {
    const isConfigured = transactionalEmailService.isReady();
    res.json({
        configured: isConfigured,
        email: process.env.PLATFORM_EMAIL || null,
        message: isConfigured
            ? 'Platform email is configured and ready'
            : 'Platform email not configured. Visit /api/email/platform/authorize to set it up.'
    });
});

// =====================================================
// OAuth Routes (No auth required - these are redirects)
// =====================================================

/**
 * GET /api/email/oauth/authorize/:clientId
 * Initiate Gmail OAuth flow
 * Returns: { authUrl: string }
 */
router.get('/oauth/authorize/:clientId', authenticateAdmin, emailController.initiateOAuth);

/**
 * GET /api/email/oauth/callback
 * Handle OAuth callback from Google
 * Redirects to admin dashboard with success/error
 */
router.get('/oauth/callback', emailController.handleOAuthCallback);

// =====================================================
// Protected Routes (Admin auth required)
// =====================================================
router.use(authenticateAdmin);

// =====================================================
// Channel Management Routes
// =====================================================

/**
 * GET /api/email/channels/:clientId
 * Get all email channels for a client
 */
router.get('/channels/:clientId', emailController.getChannels);

/**
 * GET /api/email/channel/:channelId
 * Get a specific email channel
 */
router.get('/channel/:channelId', emailController.getChannel);

/**
 * PUT /api/email/channel/:channelId
 * Update email channel settings
 */
router.put('/channel/:channelId', emailController.updateChannel);

/**
 * DELETE /api/email/channel/:channelId
 * Disconnect/delete an email channel
 */
router.delete('/channel/:channelId', emailController.disconnectChannel);

// =====================================================
// Testing & Debug Routes
// =====================================================

/**
 * POST /api/email/channel/:channelId/test
 * Test connection to Gmail
 */
router.post('/channel/:channelId/test', emailController.testConnection);

/**
 * POST /api/email/channel/:channelId/send-test
 * Send a test email
 * Body: { to: string, subject: string, body: string }
 */
router.post('/channel/:channelId/send-test', emailController.sendTestEmail);

/**
 * GET /api/email/channel/:channelId/unread
 * Get unread emails (for debugging)
 */
router.get('/channel/:channelId/unread', emailController.getUnreadEmails);

// =====================================================
// Statistics Routes
// =====================================================

/**
 * GET /api/email/stats
 * Get email channel statistics
 */
router.get('/stats', emailController.getStats);

export default router;
