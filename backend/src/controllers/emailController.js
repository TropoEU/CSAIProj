import { EmailChannel } from '../models/EmailChannel.js';
import { PlatformConfig } from '../models/PlatformConfig.js';
import { gmailService } from '../services/gmailService.js';
import { transactionalEmailService } from '../services/transactionalEmailService.js';
import { logger } from '../utils/logger.js';

/**
 * Email Controller
 *
 * Handles email channel management and OAuth flow for Gmail integration
 */

/**
 * GET /api/email/oauth/authorize/:clientId
 * Initiate OAuth flow for Gmail
 */
export async function initiateOAuth(req, res) {
    try {
        const { clientId } = req.params;

        if (!clientId) {
            return res.status(400).json({ error: 'Client ID is required' });
        }

        const authUrl = gmailService.getAuthorizationUrl(parseInt(clientId));

        logger.log('[EmailController] OAuth initiated for client', { clientId });

        res.json({ authUrl });
    } catch (error) {
        console.error('[EmailController] OAuth initiation error:', error);
        res.status(500).json({ error: 'Failed to initiate OAuth flow' });
    }
}

/**
 * GET /api/email/oauth/callback
 * Handle OAuth callback from Google
 */
export async function handleOAuthCallback(req, res) {
    try {
        const { code, state, error } = req.query;

        if (error) {
            console.error('[EmailController] OAuth error:', error);
            return res.redirect(`${process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3002'}/email-channels?error=${encodeURIComponent(error)}`);
        }

        if (!code) {
            return res.redirect(`${process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3002'}/email-channels?error=no_code`);
        }

        // Parse state to get client ID
        let clientId;
        try {
            const stateData = JSON.parse(state);
            clientId = stateData.clientId;
        } catch (e) {
            return res.redirect(`${process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3002'}/email-channels?error=invalid_state`);
        }

        // Exchange code for tokens
        const tokens = await gmailService.getTokensFromCode(code);

        // Get email address from tokens
        const emailAddress = await gmailService.getEmailAddress(tokens);

        // Handle platform email separately - save to database, don't create channel
        if (clientId === 'platform') {
            // Save to database
            await PlatformConfig.setPlatformEmail(
                emailAddress,
                tokens.access_token,
                tokens.refresh_token
            );

            // Refresh the transactional email service to pick up new config
            await transactionalEmailService.refresh();

            logger.log('[EmailController] Platform email configured', { email: emailAddress });

            // Redirect back to admin settings with success
            return res.redirect(`${process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3002'}/settings?success=platform_email_connected`);
        }

        // Regular client email channel flow
        // Check if channel already exists
        let channel = await EmailChannel.findByClientAndEmail(clientId, emailAddress);

        if (channel) {
            // Update existing channel
            await EmailChannel.updateConnectionConfig(channel.id, tokens);
            await EmailChannel.updateStatus(channel.id, 'active');
            logger.log('[EmailController] Updated existing email channel', { channelId: channel.id, email: emailAddress });
        } else {
            // Create new channel
            channel = await EmailChannel.create(clientId, emailAddress, 'gmail', tokens);
            await EmailChannel.updateStatus(channel.id, 'active');
            logger.log('[EmailController] Created new email channel', { channelId: channel.id, email: emailAddress });
        }

        // Redirect to admin dashboard with success
        res.redirect(`${process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3002'}/clients/${clientId}?tab=email&success=connected`);
    } catch (error) {
        console.error('[EmailController] OAuth callback error:', error);
        res.redirect(`${process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3002'}/email-channels?error=${encodeURIComponent(error.message)}`);
    }
}

/**
 * GET /api/email/channels/:clientId
 * Get all email channels for a client
 */
export async function getChannels(req, res) {
    try {
        const { clientId } = req.params;

        const channels = await EmailChannel.findByClient(parseInt(clientId));

        // Don't expose connection_config (tokens) in response
        const safeChannels = channels.map(channel => ({
            id: channel.id,
            client_id: channel.client_id,
            channel_type: channel.channel_type,
            email_address: channel.email_address,
            status: channel.status,
            last_checked_at: channel.last_checked_at,
            last_error: channel.last_error,
            settings: channel.settings,
            created_at: channel.created_at,
            updated_at: channel.updated_at
        }));

        res.json(safeChannels);
    } catch (error) {
        console.error('[EmailController] Get channels error:', error);
        res.status(500).json({ error: 'Failed to get email channels' });
    }
}

/**
 * GET /api/email/channels/:clientId/:channelId
 * Get a specific email channel
 */
export async function getChannel(req, res) {
    try {
        const { channelId } = req.params;

        const channel = await EmailChannel.findById(parseInt(channelId));

        if (!channel) {
            return res.status(404).json({ error: 'Email channel not found' });
        }

        // Don't expose connection_config
        res.json({
            id: channel.id,
            client_id: channel.client_id,
            channel_type: channel.channel_type,
            email_address: channel.email_address,
            status: channel.status,
            last_checked_at: channel.last_checked_at,
            last_error: channel.last_error,
            settings: channel.settings,
            created_at: channel.created_at,
            updated_at: channel.updated_at
        });
    } catch (error) {
        console.error('[EmailController] Get channel error:', error);
        res.status(500).json({ error: 'Failed to get email channel' });
    }
}

/**
 * PUT /api/email/channels/:channelId
 * Update email channel settings
 */
export async function updateChannel(req, res) {
    try {
        const { channelId } = req.params;
        const { settings } = req.body;

        const channel = await EmailChannel.findById(parseInt(channelId));
        if (!channel) {
            return res.status(404).json({ error: 'Email channel not found' });
        }

        const updated = await EmailChannel.updateSettings(channel.id, settings);

        res.json({
            id: updated.id,
            settings: updated.settings,
            updated_at: updated.updated_at
        });
    } catch (error) {
        console.error('[EmailController] Update channel error:', error);
        res.status(500).json({ error: 'Failed to update email channel' });
    }
}

/**
 * DELETE /api/email/channels/:channelId
 * Disconnect/delete an email channel
 */
export async function disconnectChannel(req, res) {
    try {
        const { channelId } = req.params;

        const channel = await EmailChannel.findById(parseInt(channelId));
        if (!channel) {
            return res.status(404).json({ error: 'Email channel not found' });
        }

        await EmailChannel.delete(channel.id);

        logger.log('[EmailController] Email channel disconnected', { channelId: channel.id, email: channel.email_address });

        res.json({ message: 'Email channel disconnected successfully' });
    } catch (error) {
        console.error('[EmailController] Disconnect channel error:', error);
        res.status(500).json({ error: 'Failed to disconnect email channel' });
    }
}

/**
 * POST /api/email/channels/:channelId/test
 * Test connection to Gmail
 */
export async function testConnection(req, res) {
    try {
        const { channelId } = req.params;

        const channel = await EmailChannel.findById(parseInt(channelId));
        if (!channel) {
            return res.status(404).json({ error: 'Email channel not found' });
        }

        const result = await gmailService.testConnection(channel.id);

        if (result.success) {
            await EmailChannel.updateStatus(channel.id, 'active');
            await EmailChannel.updateLastChecked(channel.id);
        } else {
            await EmailChannel.updateStatus(channel.id, 'error', result.error);
        }

        res.json(result);
    } catch (error) {
        console.error('[EmailController] Test connection error:', error);
        res.status(500).json({ error: 'Failed to test connection', details: error.message });
    }
}

/**
 * POST /api/email/channels/:channelId/send-test
 * Send a test email
 */
export async function sendTestEmail(req, res) {
    try {
        const { channelId } = req.params;
        const { to, subject, body } = req.body;

        if (!to || !subject || !body) {
            return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
        }

        const channel = await EmailChannel.findById(parseInt(channelId));
        if (!channel) {
            return res.status(404).json({ error: 'Email channel not found' });
        }

        const result = await gmailService.sendEmail(channel.id, to, subject, body);

        logger.log('[EmailController] Test email sent', { channelId: channel.id, to });

        res.json({ success: true, messageId: result.id });
    } catch (error) {
        console.error('[EmailController] Send test email error:', error);
        res.status(500).json({ error: 'Failed to send test email', details: error.message });
    }
}

/**
 * GET /api/email/channels/:channelId/unread
 * Get unread emails (for debugging/testing)
 */
export async function getUnreadEmails(req, res) {
    try {
        const { channelId } = req.params;
        const { limit = 10 } = req.query;

        const channel = await EmailChannel.findById(parseInt(channelId));
        if (!channel) {
            return res.status(404).json({ error: 'Email channel not found' });
        }

        const emails = await gmailService.getUnreadEmails(channel.id, parseInt(limit));

        res.json(emails);
    } catch (error) {
        console.error('[EmailController] Get unread emails error:', error);
        res.status(500).json({ error: 'Failed to get unread emails', details: error.message });
    }
}

/**
 * GET /api/email/stats
 * Get email channel statistics
 */
export async function getStats(req, res) {
    try {
        const stats = await EmailChannel.getStats();
        res.json(stats);
    } catch (error) {
        console.error('[EmailController] Get stats error:', error);
        res.status(500).json({ error: 'Failed to get email statistics' });
    }
}
