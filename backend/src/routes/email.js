import express from 'express';
import { HTTP_STATUS } from '../config/constants.js';
import { authenticateAdmin } from '../middleware/adminAuth.js';
import * as emailController from '../controllers/emailController.js';
import { transactionalEmailService } from '../services/transactionalEmailService.js';
import { gmailService } from '../services/gmailService.js';
import { PlatformConfig } from '../models/PlatformConfig.js';
import { Client } from '../models/Client.js';
import { Invoice } from '../models/Invoice.js';

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
    instructions:
      'Visit this URL to authorize the platform email account. After authorization, copy the tokens from the callback response.',
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
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error });
    }

    if (!code) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'No authorization code provided' });
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
            `.trim(),
    });
  } catch (error) {
    console.error('[Platform Email] OAuth callback error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: error.message });
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
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ error: 'Recipient email (to) is required' });
    }

    let result;

    if (type === 'access_code' && clientId) {
      // Send access code email
      const client = await Client.findById(clientId);
      if (!client) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Client not found' });
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
        return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Client not found' });
      }
      result = await transactionalEmailService.sendWelcomeEmail(to, client.name, client.api_key);
    } else if (type === 'custom' && subject && body) {
      // Send custom email
      result = await transactionalEmailService.sendEmail(to, subject, body);
    } else if (type === 'invoice') {
      // Send invoice email
      const { invoiceId } = req.body;
      if (!invoiceId) {
        return res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json({ error: 'invoiceId is required for invoice emails' });
      }

      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Invoice not found' });
      }

      const client = await Client.findById(invoice.client_id);
      if (!client) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Client not found' });
      }

      // Format invoice data for email template
      const invoiceData = {
        invoice_number: `INV-${invoice.id.toString().padStart(6, '0')}`,
        billing_period_start: invoice.billing_period
          ? `${invoice.billing_period}-01`
          : invoice.created_at,
        billing_period_end: invoice.billing_period
          ? new Date(
              new Date(`${invoice.billing_period}-01`).setMonth(
                new Date(`${invoice.billing_period}-01`).getMonth() + 1
              ) - 1
            )
          : invoice.created_at,
        due_date: invoice.due_date || invoice.created_at,
        status: invoice.status,
        total_amount: invoice.total_cost || 0,
      };

      result = await transactionalEmailService.sendInvoice(to, client.name, invoiceData);
    } else {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error:
          'Invalid request. Provide: type (access_code/welcome/invoice/custom) with required fields',
        examples: {
          access_code: { to: 'email@example.com', type: 'access_code', clientId: 1 },
          welcome: { to: 'email@example.com', type: 'welcome', clientId: 1 },
          invoice: { to: 'email@example.com', type: 'invoice', invoiceId: 1 },
          custom: {
            to: 'email@example.com',
            type: 'custom',
            subject: 'Test',
            body: '<p>Hello</p>',
          },
        },
      });
    }

    res.json(result);
  } catch (error) {
    console.error('[Platform Email] Test error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

/**
 * GET /api/email/platform/status
 * Check if platform email is configured
 */
router.get('/platform/status', authenticateAdmin, async (req, res) => {
  try {
    const config = await PlatformConfig.getPlatformEmail();
    const isConfigured = config && config.email && config.accessToken;

    res.json({
      configured: isConfigured,
      email: config?.email || null,
      configuredAt: config?.configuredAt || null,
      message: isConfigured
        ? 'Platform email is configured and ready'
        : 'Platform email not configured. Click "Connect Gmail Account" to set it up.',
    });
  } catch (error) {
    console.error('[Platform Email] Status check error:', error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: 'Failed to check platform email status' });
  }
});

/**
 * DELETE /api/email/platform/disconnect
 * Disconnect the platform email
 */
router.delete('/platform/disconnect', authenticateAdmin, async (req, res) => {
  try {
    await PlatformConfig.deletePlatformEmail();
    await transactionalEmailService.refresh();

    res.json({ success: true, message: 'Platform email disconnected' });
  } catch (error) {
    console.error('[Platform Email] Disconnect error:', error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: 'Failed to disconnect platform email' });
  }
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
