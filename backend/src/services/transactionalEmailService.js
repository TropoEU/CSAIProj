import { google } from 'googleapis';
import { PlatformConfig } from '../models/PlatformConfig.js';

/**
 * TransactionalEmailService
 *
 * Handles sending platform emails (access codes, invoices, notifications)
 * using the platform's Gmail account via OAuth2.
 *
 * Configuration is loaded from the database (platform_config table),
 * so changes take effect immediately without restart.
 */
class TransactionalEmailService {
    constructor() {
        this.platformName = process.env.PLATFORM_NAME || 'CS AI Platform';
        this.oauth2Client = null;
        this.platformEmail = null;
        this.initialized = false;
        this.lastConfigCheck = null;
        this.configCheckInterval = 60000; // Re-check config every 60 seconds
    }

    /**
     * Initialize/refresh the service from database config
     * Called automatically when needed
     */
    async initialize() {
        try {
            const config = await PlatformConfig.getPlatformEmail();

            if (!config || !config.accessToken || !config.refreshToken) {
                this.initialized = false;
                this.oauth2Client = null;
                this.platformEmail = null;
                return false;
            }

            this.oauth2Client = new google.auth.OAuth2(
                process.env.GMAIL_CLIENT_ID,
                process.env.GMAIL_CLIENT_SECRET,
                process.env.GMAIL_REDIRECT_URI
            );

            this.oauth2Client.setCredentials({
                access_token: config.accessToken,
                refresh_token: config.refreshToken,
                token_type: 'Bearer'
            });

            // Handle token refresh
            this.oauth2Client.on('tokens', async (tokens) => {
                console.log('[TransactionalEmail] Tokens refreshed');
                await PlatformConfig.updatePlatformEmailTokens(
                    tokens.access_token,
                    tokens.refresh_token
                );
            });

            this.platformEmail = config.email;
            this.initialized = true;
            this.lastConfigCheck = Date.now();

            console.log(`[TransactionalEmail] Initialized with ${config.email}`);
            return true;
        } catch (error) {
            console.error('[TransactionalEmail] Failed to initialize:', error);
            this.initialized = false;
            return false;
        }
    }

    /**
     * Ensure service is ready, re-checking config if stale
     */
    async ensureReady() {
        const configStale = !this.lastConfigCheck ||
            (Date.now() - this.lastConfigCheck > this.configCheckInterval);

        if (!this.initialized || configStale) {
            await this.initialize();
        }

        return this.initialized && this.oauth2Client !== null;
    }

    /**
     * Check if service is ready to send emails
     * Use ensureReady() for async check with config refresh
     */
    isReady() {
        return this.initialized && this.oauth2Client !== null;
    }

    /**
     * Force refresh configuration from database
     */
    async refresh() {
        this.initialized = false;
        return await this.initialize();
    }

    /**
     * Send email via Gmail API
     * @param {string} to - Recipient email
     * @param {string} subject - Email subject
     * @param {string} htmlBody - HTML email body
     * @param {string} textBody - Plain text email body (fallback)
     */
    async sendEmail(to, subject, htmlBody, textBody = null) {
        // Ensure service is ready (checks/refreshes config from DB)
        const ready = await this.ensureReady();

        if (!ready) {
            console.log(`[TransactionalEmail] Not configured. Would send email to ${to}: ${subject}`);
            return { success: false, error: 'Platform email not configured' };
        }

        const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

        // Create MIME message
        const boundary = '----=_Part_' + Date.now();
        const emailLines = [
            `From: ${this.platformName} <${this.platformEmail}>`,
            `To: ${to}`,
            `Subject: ${subject}`,
            'MIME-Version: 1.0',
            `Content-Type: multipart/alternative; boundary="${boundary}"`,
            '',
            `--${boundary}`,
            'Content-Type: text/plain; charset=utf-8',
            '',
            textBody || this.htmlToText(htmlBody),
            '',
            `--${boundary}`,
            'Content-Type: text/html; charset=utf-8',
            '',
            htmlBody,
            '',
            `--${boundary}--`
        ];

        const email = emailLines.join('\r\n');
        const encodedEmail = Buffer.from(email).toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        try {
            const response = await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedEmail
                }
            });

            console.log(`[TransactionalEmail] Email sent to ${to}: ${response.data.id}`);
            return { success: true, messageId: response.data.id };
        } catch (error) {
            console.error('[TransactionalEmail] Send error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Simple HTML to text conversion
     */
    htmlToText(html) {
        return html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .trim();
    }

    /**
     * Send access code email to client
     * @param {string} to - Client email
     * @param {string} clientName - Client business name
     * @param {string} accessCode - The access code
     */
    async sendAccessCode(to, clientName, accessCode) {
        const subject = `Your Customer Dashboard Access Code`;
        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .code-box { background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
        .code { font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #667eea; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${this.platformName}</h1>
        </div>
        <div class="content">
            <h2>Hello ${clientName},</h2>
            <p>Welcome to your Customer Dashboard! Use the access code below to log in and view your conversations, usage, and billing information.</p>
            <div class="code-box">
                <p style="margin: 0; color: #666;">Your Access Code</p>
                <p class="code">${accessCode}</p>
            </div>
            <p>To access your dashboard, visit: <a href="${process.env.CUSTOMER_DASHBOARD_URL || 'http://localhost:3003'}">Customer Dashboard</a></p>
            <p>Keep this code secure. If you need a new code, please contact support.</p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${this.platformName}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        `;

        const textBody = `
Hello ${clientName},

Welcome to your Customer Dashboard!

Your Access Code: ${accessCode}

Use this code to log in at: ${process.env.CUSTOMER_DASHBOARD_URL || 'http://localhost:3003'}

Keep this code secure. If you need a new code, please contact support.

Best regards,
${this.platformName}
        `;

        return this.sendEmail(to, subject, htmlBody, textBody);
    }

    /**
     * Send invoice email
     * @param {string} to - Client email
     * @param {string} clientName - Client name
     * @param {object} invoice - Invoice details
     */
    async sendInvoice(to, clientName, invoice) {
        const subject = `Invoice #${invoice.invoice_number} - ${this.platformName}`;
        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .invoice-box { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .amount { font-size: 28px; font-weight: bold; color: #667eea; }
        .status { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
        .status-pending { background: #fef3c7; color: #92400e; }
        .status-paid { background: #d1fae5; color: #065f46; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        td { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Invoice</h1>
        </div>
        <div class="content">
            <h2>Hello ${clientName},</h2>
            <p>Here's your invoice for the billing period.</p>
            <div class="invoice-box">
                <table>
                    <tr>
                        <td><strong>Invoice Number</strong></td>
                        <td style="text-align: right;">${invoice.invoice_number}</td>
                    </tr>
                    <tr>
                        <td><strong>Billing Period</strong></td>
                        <td style="text-align: right;">${new Date(invoice.billing_period_start).toLocaleDateString()} - ${new Date(invoice.billing_period_end).toLocaleDateString()}</td>
                    </tr>
                    <tr>
                        <td><strong>Due Date</strong></td>
                        <td style="text-align: right;">${new Date(invoice.due_date).toLocaleDateString()}</td>
                    </tr>
                    <tr>
                        <td><strong>Status</strong></td>
                        <td style="text-align: right;"><span class="status status-${invoice.status}">${invoice.status.toUpperCase()}</span></td>
                    </tr>
                </table>
                <div style="text-align: center; margin-top: 20px;">
                    <p style="margin: 0; color: #666;">Amount Due</p>
                    <p class="amount">$${parseFloat(invoice.total_amount).toFixed(2)}</p>
                </div>
            </div>
            <p>View detailed billing information in your <a href="${process.env.CUSTOMER_DASHBOARD_URL || 'http://localhost:3003'}/billing">Customer Dashboard</a>.</p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${this.platformName}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        `;

        const textBody = `
Hello ${clientName},

Here's your invoice for the billing period.

Invoice Number: ${invoice.invoice_number}
Billing Period: ${new Date(invoice.billing_period_start).toLocaleDateString()} - ${new Date(invoice.billing_period_end).toLocaleDateString()}
Due Date: ${new Date(invoice.due_date).toLocaleDateString()}
Status: ${invoice.status.toUpperCase()}

Amount Due: $${parseFloat(invoice.total_amount).toFixed(2)}

View detailed billing information in your Customer Dashboard.

Best regards,
${this.platformName}
        `;

        return this.sendEmail(to, subject, htmlBody, textBody);
    }

    /**
     * Send payment confirmation email
     * @param {string} to - Client email
     * @param {string} clientName - Client name
     * @param {object} payment - Payment details
     */
    async sendPaymentConfirmation(to, clientName, payment) {
        const subject = `Payment Received - Thank You!`;
        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .success-icon { font-size: 48px; margin-bottom: 10px; }
        .amount { font-size: 28px; font-weight: bold; color: #059669; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="success-icon">&#10004;</div>
            <h1>Payment Received</h1>
        </div>
        <div class="content">
            <h2>Thank you, ${clientName}!</h2>
            <p>We've received your payment of <span class="amount">$${parseFloat(payment.amount).toFixed(2)}</span>.</p>
            <p><strong>Invoice:</strong> ${payment.invoice_number}</p>
            <p><strong>Date:</strong> ${new Date(payment.paid_at).toLocaleDateString()}</p>
            <p>Thank you for your continued business!</p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${this.platformName}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        `;

        return this.sendEmail(to, subject, htmlBody);
    }

    /**
     * Send escalation notification to client
     * @param {string} to - Client notification email
     * @param {string} clientName - Client name
     * @param {object} escalation - Escalation details
     */
    async sendEscalationNotification(to, clientName, escalation) {
        const subject = `[Action Required] Customer Escalation - ${escalation.reason}`;
        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .alert-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
        .btn { display: inline-block; padding: 12px 24px; background: #f59e0b; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Customer Needs Help</h1>
        </div>
        <div class="content">
            <h2>Hello ${clientName},</h2>
            <div class="alert-box">
                <strong>Reason:</strong> ${escalation.reason}<br>
                <strong>Channel:</strong> ${escalation.channel || 'Widget'}<br>
                <strong>Time:</strong> ${new Date(escalation.escalated_at).toLocaleString()}
            </div>
            ${escalation.customer_message ? `<p><strong>Customer's Last Message:</strong></p><blockquote style="background: white; padding: 15px; border-left: 3px solid #ccc; margin: 15px 0;">${escalation.customer_message}</blockquote>` : ''}
            <p><a href="${process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3002'}/escalations" class="btn">View in Dashboard</a></p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${this.platformName}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        `;

        return this.sendEmail(to, subject, htmlBody);
    }

    /**
     * Send welcome email to new client
     * @param {string} to - Client email
     * @param {string} clientName - Client name
     * @param {string} apiKey - Client's API key
     */
    async sendWelcomeEmail(to, clientName, apiKey) {
        const subject = `Welcome to ${this.platformName}!`;
        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .code-box { background: #1f2937; border-radius: 8px; padding: 15px; margin: 20px 0; overflow-x: auto; }
        .code { font-family: monospace; color: #10b981; font-size: 14px; word-break: break-all; }
        .step { display: flex; align-items: flex-start; margin: 15px 0; }
        .step-number { background: #667eea; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; flex-shrink: 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to ${this.platformName}!</h1>
            <p>Your AI-powered customer service is ready</p>
        </div>
        <div class="content">
            <h2>Hello ${clientName},</h2>
            <p>Thank you for joining ${this.platformName}! We're excited to help you provide excellent customer service with AI.</p>

            <h3>Your API Key</h3>
            <div class="code-box">
                <code class="code">${apiKey}</code>
            </div>
            <p style="color: #dc2626; font-size: 14px;"><strong>Important:</strong> Keep this key secure. Don't share it publicly.</p>

            <h3>Getting Started</h3>
            <div class="step">
                <div class="step-number">1</div>
                <div>
                    <strong>Add the widget to your website</strong>
                    <p>Copy the embed code from your admin dashboard and paste it before the closing &lt;/body&gt; tag.</p>
                </div>
            </div>
            <div class="step">
                <div class="step-number">2</div>
                <div>
                    <strong>Configure your business information</strong>
                    <p>Add your business details in the admin dashboard to help the AI provide accurate responses.</p>
                </div>
            </div>
            <div class="step">
                <div class="step-number">3</div>
                <div>
                    <strong>Test the chat</strong>
                    <p>Use the Test Chat feature in your dashboard to see how the AI responds to customers.</p>
                </div>
            </div>

            <p style="margin-top: 30px;">Need help? Visit our <a href="#">documentation</a> or contact support.</p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${this.platformName}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        `;

        return this.sendEmail(to, subject, htmlBody);
    }
}

// Export singleton instance
export const transactionalEmailService = new TransactionalEmailService();

export default transactionalEmailService;
