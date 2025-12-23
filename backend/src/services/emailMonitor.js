import { EmailChannel } from '../models/EmailChannel.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { Client } from '../models/Client.js';
import { gmailService } from './gmailService.js';
import conversationService from './conversationService.js';
import { logger } from '../utils/logger.js';

/**
 * Email Monitor Service
 *
 * Background service that monitors all active email channels for new messages
 * and processes them through the AI conversation service.
 */
class EmailMonitor {
    constructor() {
        this.isRunning = false;
        this.checkInterval = null;
        this.intervalMs = parseInt(process.env.EMAIL_MONITOR_INTERVAL_MS || '60000'); // Default: 60 seconds
        this.enabled = process.env.EMAIL_MONITOR_ENABLED !== 'false'; // Default: enabled
    }

    /**
     * Start the email monitor
     */
    start() {
        if (!this.enabled) {
            console.log('[EmailMonitor] Email monitoring is disabled');
            return;
        }

        if (this.isRunning) {
            console.log('[EmailMonitor] Already running');
            return;
        }

        console.log(`[EmailMonitor] Starting email monitor (interval: ${this.intervalMs}ms)`);
        this.isRunning = true;

        // Run immediately on start
        this.checkAllChannels();

        // Then run on interval
        this.checkInterval = setInterval(() => {
            this.checkAllChannels();
        }, this.intervalMs);
    }

    /**
     * Stop the email monitor
     */
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.isRunning = false;
        console.log('[EmailMonitor] Stopped');
    }

    /**
     * Check all active email channels for new messages
     */
    async checkAllChannels() {
        try {
            const activeChannels = await EmailChannel.getActive();

            if (activeChannels.length === 0) {
                return;
            }

            logger.log(`[EmailMonitor] Checking ${activeChannels.length} active channel(s)`);

            for (const channel of activeChannels) {
                try {
                    await this.processChannel(channel);
                } catch (error) {
                    console.error(`[EmailMonitor] Error processing channel ${channel.id}:`, error);
                    await EmailChannel.updateStatus(channel.id, 'error', error.message);
                }
            }
        } catch (error) {
            console.error('[EmailMonitor] Error checking channels:', error);
        }
    }

    /**
     * Process a single email channel
     * @param {object} channel - The email channel to process
     */
    async processChannel(channel) {
        // Get unread emails
        const emails = await gmailService.getUnreadEmails(channel.id);

        if (emails.length === 0) {
            await EmailChannel.updateLastChecked(channel.id);
            return;
        }

        logger.log(`[EmailMonitor] Found ${emails.length} unread email(s) in channel ${channel.id}`);

        // Get client for this channel
        const client = await Client.findById(channel.client_id);
        if (!client) {
            console.error(`[EmailMonitor] Client not found for channel ${channel.id}`);
            return;
        }

        // Process each email
        for (const email of emails) {
            try {
                await this.processEmail(channel, client, email);
            } catch (error) {
                console.error(`[EmailMonitor] Error processing email ${email.id}:`, error);
                // Continue with next email
            }
        }

        await EmailChannel.updateLastChecked(channel.id);
    }

    /**
     * Process a single email
     * @param {object} channel - The email channel
     * @param {object} client - The client
     * @param {object} email - The email to process
     */
    async processEmail(channel, client, email) {
        // Check if we've already processed this message
        const existingMessage = await Message.findByExternalId(email.id);
        if (existingMessage) {
            logger.log(`[EmailMonitor] Skipping already processed email ${email.id}`);
            // Mark as read anyway
            await gmailService.markAsRead(channel.id, email.id);
            return;
        }

        // Find or create conversation for this thread
        let conversation = await Conversation.findByChannelThread(
            email.threadId,
            'email',
            channel.client_id
        );

        const isNewConversation = !conversation;

        if (!conversation) {
            // Create new conversation
            const sessionId = `email-${email.threadId}`;
            conversation = await Conversation.create(
                channel.client_id,
                sessionId,
                email.from, // user identifier
                client.llm_provider || 'ollama',
                client.model_name,
                'email',
                email.threadId,
                {
                    from: email.from,
                    subject: email.subject,
                    channel_email: channel.email_address
                }
            );

            logger.log(`[EmailMonitor] Created new email conversation`, {
                conversationId: conversation.id,
                threadId: email.threadId,
                from: email.from
            });
        }

        logger.log(`[EmailMonitor] Processing email from ${email.from}`, {
            conversationId: conversation.id,
            subject: email.subject,
            threadId: email.threadId
        });

        // Generate AI response (conversationService will save the user message)
        // Remove skipUserMessageSave so conversationService saves it
        const result = await conversationService.processMessage(
            client,
            conversation.session_id,
            email.body,
            {
                userIdentifier: email.from,
                channel: 'email',
                channelMetadata: {
                    from: email.from,
                    subject: email.subject,
                    threadId: email.threadId
                }
            }
        );

        // Format email response
        const replyBody = this.formatEmailReply(
            result.response,
            isNewConversation,
            client,
            channel
        );

        // Send email reply - ALWAYS use the current email's threadId
        const replySubject = email.subject.startsWith('Re:') ?
            email.subject :
            `Re: ${email.subject}`;

        // Get the Message-ID from the original email for proper threading
        // Gmail message IDs need to be formatted as <messageId>@mail.gmail.com
        // But actually, we can use the email.id directly as the inReplyTo
        // Gmail API will handle the formatting
        const inReplyToMessageId = email.messageId || `<${email.id}@mail.gmail.com>`;

        await gmailService.sendEmail(
            channel.id,
            email.from,
            replySubject,
            replyBody,
            email.threadId,  // Thread ID for Gmail API
            inReplyToMessageId  // Message-ID for In-Reply-To header
        );

        // Mark as read
        await gmailService.markAsRead(channel.id, email.id);

        // Add "AI Handled" label if configured
        try {
            const labelId = await gmailService.getOrCreateLabel(channel.id, 'AI Handled');
            await gmailService.addLabel(channel.id, email.id, labelId);
        } catch (labelError) {
            // Non-critical error, just log it
            console.warn('[EmailMonitor] Could not add label:', labelError.message);
        }

        logger.log(`[EmailMonitor] Replied to email ${email.id}`, {
            conversationId: conversation.id,
            to: email.from,
            threadId: email.threadId
        });
    }

    /**
     * Format email reply with appropriate template
     * @param {string} aiResponse - The AI response
     * @param {boolean} isNewConversation - Whether this is a new thread
     * @param {object} client - The client
     * @param {object} channel - The email channel
     */
    formatEmailReply(aiResponse, isNewConversation, client, channel) {
        const businessName = client.name || 'Customer Service';
        const signature = channel.settings?.signature || '';

        if (isNewConversation) {
            // Welcome template for new threads
            let reply = `Hello,\n\nThank you for contacting ${businessName}. I'm the AI assistant and I'm here to help you.\n\n`;
            reply += aiResponse;
            reply += '\n\nIf you need further assistance, please reply to this email.';

            if (signature) {
                reply += `\n\n---\n${signature}`;
            } else {
                reply += `\n\nBest regards,\n${businessName} Support Team`;
            }

            return reply;
        } else {
            // Standard reply template
            let reply = aiResponse;

            if (signature) {
                reply += `\n\n---\n${signature}`;
            }

            return reply;
        }
    }

    /**
     * Get monitor status
     */
    getStatus() {
        return {
            running: this.isRunning,
            enabled: this.enabled,
            intervalMs: this.intervalMs
        };
    }
}

// Export singleton instance
export const emailMonitor = new EmailMonitor();
export default emailMonitor;
