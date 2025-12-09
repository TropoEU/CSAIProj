import { Invoice } from '../models/Invoice.js';
import { Client } from '../models/Client.js';
import { ApiUsage } from '../models/ApiUsage.js';
import { db } from '../db.js';

/**
 * BillingService - Infrastructure for billing with configurable pricing
 *
 * This service provides:
 * - Invoice generation from usage data
 * - Payment provider abstraction (ready for Stripe/PayPal integration)
 * - Configurable pricing (base + usage-based)
 * - Revenue analytics
 */
export class BillingService {
    /**
     * Configurable pricing structure
     * IMPORTANT: These values should be configured based on business model
     * Can be moved to environment variables or database configuration
     */
    static PRICING_CONFIG = {
        free: {
            baseCost: 0,
            costPerThousandTokens: 0,   // Free plan has no costs
            costPerMessage: 0,
            costPerToolCall: 0
        },
        starter: {
            baseCost: 29.99,
            costPerThousandTokens: 0.01,   // $0.01 per 1K tokens
            costPerMessage: 0.001,          // $0.001 per message
            costPerToolCall: 0.05           // $0.05 per tool call
        },
        pro: {
            baseCost: 99.99,
            costPerThousandTokens: 0.008,  // $0.008 per 1K tokens (volume discount)
            costPerMessage: 0.0008,         // $0.0008 per message
            costPerToolCall: 0.04           // $0.04 per tool call
        },
        enterprise: {
            baseCost: 499.99,
            costPerThousandTokens: 0.005,  // $0.005 per 1K tokens (enterprise rate)
            costPerMessage: 0.0005,         // $0.0005 per message
            costPerToolCall: 0.03           // $0.03 per tool call
        }
    };

    /**
     * Get pricing config for a plan type
     */
    static getPricingConfig(planType) {
        return this.PRICING_CONFIG[planType] || this.PRICING_CONFIG.free;
    }

    /**
     * Set pricing config (for dynamic configuration)
     */
    static setPricingConfig(planType, config) {
        if (this.PRICING_CONFIG[planType]) {
            this.PRICING_CONFIG[planType] = { ...this.PRICING_CONFIG[planType], ...config };
        }
    }

    /**
     * Calculate usage cost based on configurable pricing
     * @param {Object} usage - Usage data from ApiUsage
     * @param {string} planType - Plan type (free, starter, pro)
     * @returns {number} Usage cost
     */
    static calculateUsageCost(usage, planType) {
        const pricing = this.getPricingConfig(planType);

        // If any pricing component is null, return 0 (not configured yet)
        if (pricing.costPerThousandTokens === null ||
            pricing.costPerMessage === null ||
            pricing.costPerToolCall === null) {
            return 0;
        }

        const totalTokens = (parseInt(usage.total_tokens_input) || 0) +
                          (parseInt(usage.total_tokens_output) || 0);
        const tokensInThousands = totalTokens / 1000;

        const tokenCost = tokensInThousands * pricing.costPerThousandTokens;
        const messageCost = (parseInt(usage.total_messages) || 0) * pricing.costPerMessage;
        const toolCallCost = (parseInt(usage.total_tool_calls) || 0) * pricing.costPerToolCall;

        return parseFloat((tokenCost + messageCost + toolCallCost).toFixed(2));
    }

    /**
     * Generate invoice for a client for a specific billing period
     * @param {number} clientId - Client ID
     * @param {string} billingPeriod - YYYY-MM format
     * @param {boolean} force - Force regeneration if invoice exists
     * @returns {Object} Invoice
     */
    static async generateInvoice(clientId, billingPeriod, force = false) {
        // Check if invoice already exists
        const existingInvoice = await Invoice.findByClientAndPeriod(clientId, billingPeriod);
        if (existingInvoice && !force) {
            throw new Error(`Invoice already exists for period ${billingPeriod}`);
        }

        // Get client details
        const client = await Client.findById(clientId);
        if (!client) {
            throw new Error(`Client with ID ${clientId} not found`);
        }

        // Parse billing period (YYYY-MM)
        const [year, month] = billingPeriod.split('-');
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // Last day of month

        // Get usage data for the period
        const usageData = await this.getUsageForPeriod(
            clientId,
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
        );

        // Calculate costs
        const pricing = this.getPricingConfig(client.plan_type);
        const baseCost = pricing.baseCost || 0;
        const usageCost = this.calculateUsageCost(usageData, client.plan_type);
        const totalCost = parseFloat((baseCost + usageCost).toFixed(2));

        // Set due date (30 days from invoice creation)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        // If invoice exists and force=true, delete the old one
        if (existingInvoice && force) {
            await Invoice.delete(existingInvoice.id);
        }

        // Create invoice
        const invoice = await Invoice.create({
            clientId,
            billingPeriod,
            planType: client.plan_type,
            baseCost,
            usageCost,
            totalCost,
            status: 'pending',
            dueDate: dueDate.toISOString().split('T')[0]
        });

        return {
            invoice,
            usage: usageData
        };
    }

    /**
     * Get usage data for a billing period
     * @param {number} clientId - Client ID
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @returns {Object} Aggregated usage data
     */
    static async getUsageForPeriod(clientId, startDate, endDate) {
        const result = await db.query(
            `SELECT
                SUM(conversation_count) as total_conversations,
                SUM(message_count) as total_messages,
                SUM(tokens_input) as total_tokens_input,
                SUM(tokens_output) as total_tokens_output,
                SUM(tool_calls_count) as total_tool_calls,
                SUM(cost_estimate) as total_cost_estimate
             FROM api_usage
             WHERE client_id = $1
             AND date BETWEEN $2 AND $3`,
            [clientId, startDate, endDate]
        );
        return result.rows[0];
    }

    /**
     * Generate invoices for all clients for a billing period
     * @param {string} billingPeriod - YYYY-MM format
     * @returns {Array} Generated invoices
     */
    static async generateInvoicesForAllClients(billingPeriod) {
        const clients = await Client.findAll(1000, 0);
        const results = [];

        for (const client of clients) {
            if (client.status === 'active') {
                try {
                    const result = await this.generateInvoice(client.id, billingPeriod, false);
                    results.push({
                        success: true,
                        clientId: client.id,
                        clientName: client.name,
                        invoice: result.invoice
                    });
                } catch (error) {
                    results.push({
                        success: false,
                        clientId: client.id,
                        clientName: client.name,
                        error: error.message
                    });
                }
            }
        }

        return results;
    }

    // ========================================
    // PAYMENT PROVIDER ABSTRACTION LAYER
    // ========================================
    // These methods provide a generic interface for payment providers
    // Actual implementation (Stripe, PayPal, etc.) can be added later

    /**
     * Create a payment intent (placeholder for Stripe/PayPal integration)
     * @param {number} invoiceId - Invoice ID
     * @param {number} amount - Amount in USD
     * @param {string} currency - Currency code (default: USD)
     * @param {Object} options - Provider-specific options
     * @returns {Object} Payment intent data
     */
    static async createPaymentIntent(invoiceId, amount, currency = 'USD', options = {}) {
        // PLACEHOLDER: This is where you'd integrate with Stripe or PayPal
        // Example for Stripe:
        // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        // const paymentIntent = await stripe.paymentIntents.create({
        //     amount: Math.round(amount * 100), // Convert to cents
        //     currency: currency.toLowerCase(),
        //     metadata: { invoiceId }
        // });
        // return paymentIntent;

        // For now, return a mock payment intent
        return {
            id: `pi_mock_${Date.now()}`,
            status: 'requires_payment_method',
            amount,
            currency,
            invoiceId,
            provider: 'mock',
            ...options
        };
    }

    /**
     * Process a payment (placeholder for payment provider integration)
     * @param {number} invoiceId - Invoice ID
     * @param {string} paymentProviderId - Payment provider ID (from createPaymentIntent)
     * @param {string} provider - Payment provider (stripe/paypal/manual)
     * @param {string} paymentMethod - Payment method (credit_card/bank_transfer/etc)
     * @returns {Object} Updated invoice
     */
    static async processPayment(invoiceId, paymentProviderId, provider = 'manual', paymentMethod = 'manual') {
        // PLACEHOLDER: This is where you'd confirm the payment with the provider
        // Example for Stripe:
        // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        // const paymentIntent = await stripe.paymentIntents.retrieve(paymentProviderId);
        // if (paymentIntent.status !== 'succeeded') {
        //     throw new Error('Payment not completed');
        // }

        // Mark invoice as paid
        const invoice = await Invoice.markAsPaid(invoiceId, {
            payment_provider: provider,
            payment_provider_id: paymentProviderId,
            payment_method: paymentMethod
        });

        return invoice;
    }

    /**
     * Get payment status from provider (placeholder)
     * @param {string} paymentProviderId - Payment provider ID
     * @param {string} provider - Payment provider (stripe/paypal/etc)
     * @returns {Object} Payment status
     */
    static async getPaymentStatus(paymentProviderId, provider = 'stripe') {
        // PLACEHOLDER: Query the payment provider for status
        // Example for Stripe:
        // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        // const paymentIntent = await stripe.paymentIntents.retrieve(paymentProviderId);
        // return {
        //     status: paymentIntent.status,
        //     amount: paymentIntent.amount / 100,
        //     currency: paymentIntent.currency
        // };

        return {
            id: paymentProviderId,
            status: 'unknown',
            provider
        };
    }

    /**
     * Refund a payment (placeholder)
     * @param {number} invoiceId - Invoice ID
     * @param {number} amount - Amount to refund (null = full refund)
     * @returns {Object} Refund result
     */
    static async refundPayment(invoiceId, amount = null) {
        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            throw new Error(`Invoice with ID ${invoiceId} not found`);
        }

        if (invoice.status !== 'paid') {
            throw new Error('Can only refund paid invoices');
        }

        // PLACEHOLDER: Process refund with payment provider
        // Example for Stripe:
        // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        // const refund = await stripe.refunds.create({
        //     payment_intent: invoice.payment_provider_id,
        //     amount: amount ? Math.round(amount * 100) : undefined
        // });

        // Update invoice status
        const refundAmount = amount || invoice.total_cost;
        const updatedInvoice = await Invoice.update(invoiceId, {
            status: 'refunded',
            notes: `Refunded ${refundAmount} on ${new Date().toISOString()}`
        });

        return {
            success: true,
            invoice: updatedInvoice,
            refundAmount
        };
    }

    /**
     * Handle webhook from payment provider (placeholder)
     * @param {string} provider - Payment provider (stripe/paypal)
     * @param {Object} payload - Webhook payload
     * @returns {Object} Processing result
     */
    static async handleWebhook(provider, payload) {
        // PLACEHOLDER: Parse and handle webhook events
        // Example for Stripe:
        // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        // const event = stripe.webhooks.constructEvent(
        //     payload.body,
        //     payload.signature,
        //     process.env.STRIPE_WEBHOOK_SECRET
        // );
        //
        // switch (event.type) {
        //     case 'payment_intent.succeeded':
        //         // Find invoice and mark as paid
        //         break;
        //     case 'payment_intent.payment_failed':
        //         // Handle failed payment
        //         break;
        // }

        return {
            received: true,
            provider,
            processed: false,
            message: 'Webhook handler not implemented'
        };
    }

    // ========================================
    // MANUAL PAYMENT OPERATIONS
    // ========================================

    /**
     * Mark invoice as paid manually (for bank transfers, cash, etc.)
     * @param {number} invoiceId - Invoice ID
     * @param {Object} paymentData - Payment details
     * @returns {Object} Updated invoice
     */
    static async markInvoiceAsPaidManually(invoiceId, paymentData = {}) {
        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            throw new Error(`Invoice with ID ${invoiceId} not found`);
        }

        if (invoice.status === 'paid') {
            throw new Error('Invoice is already paid');
        }

        return await Invoice.markAsPaid(invoiceId, {
            payment_provider: 'manual',
            payment_method: paymentData.paymentMethod || 'manual',
            notes: paymentData.notes || 'Marked as paid manually'
        });
    }

    // ========================================
    // ANALYTICS & REPORTING
    // ========================================

    /**
     * Get revenue summary
     * @param {Object} filters - Date range and status filters
     * @returns {Object} Revenue analytics
     */
    static async getRevenueSummary(filters = {}) {
        return await Invoice.getRevenueAnalytics(filters);
    }

    /**
     * Get monthly revenue breakdown
     * @param {number} months - Number of months to look back
     * @returns {Array} Monthly revenue data
     */
    static async getMonthlyRevenue(months = 12) {
        return await Invoice.getRevenueByMonth(months);
    }

    /**
     * Get revenue by plan type
     * @returns {Array} Revenue breakdown by plan
     */
    static async getRevenueByPlan() {
        return await Invoice.getRevenueByPlan();
    }

    /**
     * Get outstanding payments summary
     * @returns {Object} Outstanding invoices and amounts
     */
    static async getOutstandingPayments() {
        const outstanding = await Invoice.getOutstanding();

        const summary = {
            total_count: outstanding.length,
            total_amount: 0,
            pending_count: 0,
            pending_amount: 0,
            overdue_count: 0,
            overdue_amount: 0,
            invoices: outstanding
        };

        outstanding.forEach(inv => {
            const amount = parseFloat(inv.total_cost);
            summary.total_amount += amount;

            if (inv.status === 'pending') {
                summary.pending_count++;
                summary.pending_amount += amount;
            } else if (inv.status === 'overdue') {
                summary.overdue_count++;
                summary.overdue_amount += amount;
            }
        });

        summary.total_amount = parseFloat(summary.total_amount.toFixed(2));
        summary.pending_amount = parseFloat(summary.pending_amount.toFixed(2));
        summary.overdue_amount = parseFloat(summary.overdue_amount.toFixed(2));

        return summary;
    }

    /**
     * Scheduled job: Mark overdue invoices
     * Run this daily via cron job
     */
    static async markOverdueInvoices() {
        return await Invoice.markOverdueInvoices();
    }
}
