import { google } from 'googleapis';
import { EmailChannel } from '../models/EmailChannel.js';

// Gmail API scopes - FULL access for AI email channels (read, send, modify)
const GMAIL_SCOPES_FULL = [
    'https://www.googleapis.com/auth/gmail.readonly',   // Read emails
    'https://www.googleapis.com/auth/gmail.send',       // Send emails
    'https://www.googleapis.com/auth/gmail.modify',     // Mark as read/unread
    'https://www.googleapis.com/auth/gmail.labels',     // Create/manage labels
    'https://www.googleapis.com/auth/userinfo.email'    // Get user email address
];

// Gmail API scopes - SEND ONLY for platform transactional emails
const GMAIL_SCOPES_SEND_ONLY = [
    'https://www.googleapis.com/auth/gmail.send',       // Send emails only
    'https://www.googleapis.com/auth/userinfo.email'    // Get user email address
];

class GmailService {
    constructor() {
        this.clientId = process.env.GMAIL_CLIENT_ID;
        this.clientSecret = process.env.GMAIL_CLIENT_SECRET;
        this.redirectUri = process.env.GMAIL_REDIRECT_URI;
    }

    /**
     * Create OAuth2 client
     */
    createOAuth2Client() {
        return new google.auth.OAuth2(
            this.clientId,
            this.clientSecret,
            this.redirectUri
        );
    }

    /**
     * Generate OAuth2 authorization URL
     * @param {number|string} clientId - The client ID (for state), or 'platform' for platform email
     * @returns {string} Authorization URL
     */
    getAuthorizationUrl(clientId) {
        const oauth2Client = this.createOAuth2Client();

        // Use minimal scopes for platform email (send only)
        // Use full scopes for client email channels (AI needs to read and respond)
        const scopes = clientId === 'platform' ? GMAIL_SCOPES_SEND_ONLY : GMAIL_SCOPES_FULL;

        return oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent', // Force consent to get refresh token
            state: JSON.stringify({ clientId })
        });
    }

    /**
     * Exchange authorization code for tokens
     * @param {string} code - Authorization code from OAuth callback
     * @returns {object} Tokens object
     */
    async getTokensFromCode(code) {
        const oauth2Client = this.createOAuth2Client();
        const { tokens } = await oauth2Client.getToken(code);
        return tokens;
    }

    /**
     * Get authenticated OAuth2 client for an email channel
     * @param {number} emailChannelId - The email channel ID
     * @returns {object} Authenticated OAuth2 client
     */
    async getAuthenticatedClient(emailChannelId) {
        const channel = await EmailChannel.findById(emailChannelId);
        if (!channel) {
            throw new Error(`Email channel not found: ${emailChannelId}`);
        }

        const oauth2Client = this.createOAuth2Client();
        oauth2Client.setCredentials(channel.connection_config);

        // Check if token needs refresh
        if (this.isTokenExpired(channel.connection_config)) {
            try {
                const { credentials } = await oauth2Client.refreshAccessToken();
                // Update stored tokens
                await EmailChannel.updateConnectionConfig(emailChannelId, credentials);
                oauth2Client.setCredentials(credentials);
            } catch (error) {
                console.error('Error refreshing token:', error);
                await EmailChannel.updateStatus(emailChannelId, 'error', 'Token refresh failed: ' + error.message);
                throw error;
            }
        }

        return oauth2Client;
    }

    /**
     * Check if token is expired
     * @param {object} tokens - Token object
     * @returns {boolean} True if expired
     */
    isTokenExpired(tokens) {
        if (!tokens.expiry_date) return true;
        // Refresh 5 minutes before expiry
        return tokens.expiry_date - Date.now() < 5 * 60 * 1000;
    }

    /**
     * Get user's email address from OAuth tokens
     * @param {object} tokens - Token object
     * @returns {string} Email address
     */
    async getEmailAddress(tokens) {
        const oauth2Client = this.createOAuth2Client();
        oauth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const { data } = await oauth2.userinfo.get();
        return data.email;
    }

    /**
     * Get unread emails from inbox
     * @param {number} emailChannelId - The email channel ID
     * @param {number} maxResults - Maximum number of emails to fetch
     * @returns {Array} Array of email objects
     */
    async getUnreadEmails(emailChannelId, maxResults = 10) {
        const oauth2Client = await this.getAuthenticatedClient(emailChannelId);
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        const channel = await EmailChannel.findById(emailChannelId);
        const excludeLabels = channel.settings?.exclude_labels || ['SPAM', 'TRASH'];

        // Build query
        let query = 'is:unread in:inbox';
        excludeLabels.forEach(label => {
            query += ` -in:${label.toLowerCase()}`;
        });

        try {
            // List unread messages
            const response = await gmail.users.messages.list({
                userId: 'me',
                q: query,
                maxResults
            });

            if (!response.data.messages || response.data.messages.length === 0) {
                return [];
            }

            // Fetch full message details
            const emails = await Promise.all(
                response.data.messages.map(async (msg) => {
                    const fullMessage = await gmail.users.messages.get({
                        userId: 'me',
                        id: msg.id,
                        format: 'full'
                    });
                    return this.parseMessage(fullMessage.data);
                })
            );

            return emails;
        } catch (error) {
            console.error('Error fetching unread emails:', error);
            await EmailChannel.updateStatus(emailChannelId, 'error', error.message);
            throw error;
        }
    }

    /**
     * Parse Gmail message into structured object
     * @param {object} message - Gmail message object
     * @returns {object} Parsed email object
     */
    parseMessage(message) {
        const headers = message.payload.headers;
        const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;

        // Extract body
        let body = '';
        if (message.payload.body?.data) {
            body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
        } else if (message.payload.parts) {
            // Find text/plain or text/html part
            const textPart = this.findPart(message.payload.parts, 'text/plain') ||
                            this.findPart(message.payload.parts, 'text/html');
            if (textPart?.body?.data) {
                body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
            }
        }

        // Clean HTML if needed
        if (body.includes('<html') || body.includes('<div') || body.includes('<p>')) {
            body = this.stripHtml(body);
        }

        // Clean up quoted replies
        body = this.cleanEmailBody(body);

        return {
            id: message.id,
            threadId: message.threadId,
            from: this.parseEmailAddress(getHeader('From')),
            to: getHeader('To'),
            subject: getHeader('Subject') || '(no subject)',
            date: new Date(parseInt(message.internalDate, 10)),
            body: body.trim(),
            snippet: message.snippet,
            labelIds: message.labelIds || [],
            messageId: getHeader('Message-ID') || `<${message.id}@mail.gmail.com>`  // Add Message-ID
        };
    }

    /**
     * Find MIME part by type
     */
    findPart(parts, mimeType) {
        for (const part of parts) {
            if (part.mimeType === mimeType) {
                return part;
            }
            if (part.parts) {
                const found = this.findPart(part.parts, mimeType);
                if (found) return found;
            }
        }
        return null;
    }

    /**
     * Strip HTML tags from text
     */
    stripHtml(html) {
        return html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Clean email body - remove quoted replies
     */
    cleanEmailBody(body) {
        // Remove common quote patterns
        const quotePatterns = [
            /^On .+ wrote:$/gm,                          // "On Mon, Jan 1... wrote:"
            /^-----Original Message-----$/gm,            // Outlook
            /^_{10,}$/gm,                                // Underscores separator
            /^>.*$/gm,                                   // > quoted lines
            /^Sent from my iPhone$/gm,                   // Mobile signatures
            /^Sent from my Android$/gm,
            /^Get Outlook for .+$/gm
        ];

        let cleaned = body;
        for (const pattern of quotePatterns) {
            const match = cleaned.match(pattern);
            if (match) {
                // Remove everything from the quote marker onwards
                const index = cleaned.search(pattern);
                if (index > 0) {
                    cleaned = cleaned.substring(0, index);
                }
            }
        }

        return cleaned.trim();
    }

    /**
     * Parse email address from "Name <email@example.com>" format
     */
    parseEmailAddress(from) {
        if (!from) return null;
        const match = from.match(/<([^>]+)>/);
        return match ? match[1] : from;
    }

    /**
     * Send email reply
     * @param {number} emailChannelId - The email channel ID
     * @param {string} to - Recipient email
     * @param {string} subject - Email subject
     * @param {string} body - Email body (plain text)
     * @param {string} threadId - Thread ID to reply to
     * @param {string} inReplyTo - Message-ID to reply to
     * @returns {object} Sent message info
     */
    async sendEmail(emailChannelId, to, subject, body, threadId = null, inReplyTo = null) {
        const oauth2Client = await this.getAuthenticatedClient(emailChannelId);
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        const channel = await EmailChannel.findById(emailChannelId);

        // Build email with signature
        let fullBody = body;
        if (channel.settings?.signature) {
            fullBody += '\n\n---\n' + channel.settings.signature;
        }

        // Create email message
        const emailLines = [
            `To: ${to}`,
            `Subject: ${subject}`,
            'Content-Type: text/plain; charset=utf-8',
            'MIME-Version: 1.0'
        ];

        if (inReplyTo) {
            emailLines.push(`In-Reply-To: ${inReplyTo}`);
            emailLines.push(`References: ${inReplyTo}`);
        }

        emailLines.push('');
        emailLines.push(fullBody);

        const email = emailLines.join('\r\n');
        const encodedEmail = Buffer.from(email).toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        try {
            const response = await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedEmail,
                    threadId: threadId || undefined
                }
            });

            return {
                id: response.data.id,
                threadId: response.data.threadId
            };
        } catch (error) {
            console.error('Error sending email:', error);
            throw error;
        }
    }

    /**
     * Mark email as read
     * @param {number} emailChannelId - The email channel ID
     * @param {string} messageId - Gmail message ID
     */
    async markAsRead(emailChannelId, messageId) {
        const oauth2Client = await this.getAuthenticatedClient(emailChannelId);
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        try {
            await gmail.users.messages.modify({
                userId: 'me',
                id: messageId,
                requestBody: {
                    removeLabelIds: ['UNREAD']
                }
            });
        } catch (error) {
            console.error('Error marking email as read:', error);
            throw error;
        }
    }

    /**
     * Add label to email
     * @param {number} emailChannelId - The email channel ID
     * @param {string} messageId - Gmail message ID
     * @param {string} labelId - Label ID to add
     */
    async addLabel(emailChannelId, messageId, labelId) {
        const oauth2Client = await this.getAuthenticatedClient(emailChannelId);
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        try {
            await gmail.users.messages.modify({
                userId: 'me',
                id: messageId,
                requestBody: {
                    addLabelIds: [labelId]
                }
            });
        } catch (error) {
            console.error('Error adding label:', error);
            throw error;
        }
    }

    /**
     * Get or create a label
     * @param {number} emailChannelId - The email channel ID
     * @param {string} labelName - Label name
     * @returns {string} Label ID
     */
    async getOrCreateLabel(emailChannelId, labelName) {
        const oauth2Client = await this.getAuthenticatedClient(emailChannelId);
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        try {
            // List existing labels
            const response = await gmail.users.labels.list({ userId: 'me' });
            const existingLabel = response.data.labels?.find(l => l.name === labelName);

            if (existingLabel) {
                return existingLabel.id;
            }

            // Create new label
            const createResponse = await gmail.users.labels.create({
                userId: 'me',
                requestBody: {
                    name: labelName,
                    labelListVisibility: 'labelShow',
                    messageListVisibility: 'show'
                }
            });

            return createResponse.data.id;
        } catch (error) {
            console.error('Error getting/creating label:', error);
            throw error;
        }
    }

    /**
     * Get thread messages
     * @param {number} emailChannelId - The email channel ID
     * @param {string} threadId - Thread ID
     * @returns {Array} Array of messages in thread
     */
    async getThread(emailChannelId, threadId) {
        const oauth2Client = await this.getAuthenticatedClient(emailChannelId);
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        try {
            const response = await gmail.users.threads.get({
                userId: 'me',
                id: threadId,
                format: 'full'
            });

            return response.data.messages.map(msg => this.parseMessage(msg));
        } catch (error) {
            console.error('Error fetching thread:', error);
            throw error;
        }
    }

    /**
     * Test connection to Gmail
     * @param {number} emailChannelId - The email channel ID
     * @returns {object} Connection status
     */
    async testConnection(emailChannelId) {
        try {
            const oauth2Client = await this.getAuthenticatedClient(emailChannelId);
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

            // Try to get profile
            const profile = await gmail.users.getProfile({ userId: 'me' });

            return {
                success: true,
                email: profile.data.emailAddress,
                messagesTotal: profile.data.messagesTotal,
                threadsTotal: profile.data.threadsTotal
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Export singleton instance
export const gmailService = new GmailService();
export default gmailService;
