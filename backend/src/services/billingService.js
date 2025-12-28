import { Invoice } from '../models/Invoice.js';
import { Client } from '../models/Client.js';
import { Plan } from '../models/Plan.js';
import { db } from '../db.js';

/**
 * BillingService - Infrastructure for billing with configurable pricing
 *
 * This service provides:
 * - Invoice generation from usage data
 * - Payment provider abstraction (ready for Stripe/PayPal integration)
 * - Configurable pricing (base + usage-based) from database
 * - Revenue analytics
 */
export class BillingService {
    /**
     * Round to cents (2 decimal places) to avoid floating point errors
     * @param {number} value - Value to round
     * @returns {number} Rounded value
     */
    static roundToCents(value) {
        return Math.round(value * 100) / 100;
    }
    /**
     * Fallback pricing structure (used if database is unavailable)
     */
    static FALLBACK_PRICING = {
        unlimited: {
            baseCost: 0,
            costPerThousandTokens: 0,
            costPerMessage: 0,
            costPerToolCall: 0
        },
        free: {
            baseCost: 0,
            costPerThousandTokens: 0,
            costPerMessage: 0,
            costPerToolCall: 0
        },
        starter: {
            baseCost: 29.99,
            costPerThousandTokens: 0.01,
            costPerMessage: 0.001,
            costPerToolCall: 0.05
        },
        pro: {
            baseCost: 99.99,
            costPerThousandTokens: 0.008,
            costPerMessage: 0.0008,
            costPerToolCall: 0.04
        },
        enterprise: {
            baseCost: 499.99,
            costPerThousandTokens: 0.005,
            costPerMessage: 0.0005,
            costPerToolCall: 0.03
        }
    };

    // For backwards compatibility
    static PRICING_CONFIG = this.FALLBACK_PRICING;

    /**
     * Get pricing config for a plan type (async, fetches from database)
     * @param {string} planType - Plan type name
     * @returns {Object} Pricing configuration
     */
    static async getPricingConfigAsync(planType) {
        try {
            const plan = await Plan.findByName(planType);
            if (plan && plan.pricing) {
                // Convert database pricing format to billing service format
                return {
                    baseCost: plan.pricing.baseCost || 0,
                    costPerThousandTokens: plan.pricing.usageMultiplier || 0,
                    costPerMessage: plan.pricing.costPerMessage || 0,
                    costPerToolCall: plan.pricing.costPerToolCall || 0
                };
            }
        } catch (error) {
            console.warn('[BillingService] Failed to fetch plan pricing from DB:', error.message);
        }
        // Fallback to hardcoded pricing
        return this.FALLBACK_PRICING[planType] || this.FALLBACK_PRICING.free;
    }

    /**
     * Get pricing config for a plan type (sync version - uses fallback)
     * @deprecated Use getPricingConfigAsync instead
     */
    static getPricingConfig(planType) {
        return this.FALLBACK_PRICING[planType] || this.FALLBACK_PRICING.free;
    }

    /**
     * Set pricing config (for dynamic configuration - updates fallback)
     */
    static setPricingConfig(planType, config) {
        if (this.FALLBACK_PRICING[planType]) {
            this.FALLBACK_PRICING[planType] = { ...this.FALLBACK_PRICING[planType], ...config };
        }
    }

    /**
     * Calculate usage cost based on configurable pricing (async version)
     * @param {Object} usage - Usage data from ApiUsage
     * @param {string} planType - Plan type (free, starter, pro)
     * @returns {Promise<number>} Usage cost
     */
    static async calculateUsageCostAsync(usage, planType) {
        const pricing = await this.getPricingConfigAsync(planType);
        return this._calculateCost(usage, pricing);
    }

    /**
     * Calculate usage cost based on configurable pricing (sync version - uses fallback)
     * @param {Object} usage - Usage data from ApiUsage
     * @param {string} planType - Plan type (free, starter, pro)
     * @returns {number} Usage cost
     */
    static calculateUsageCost(usage, planType) {
        const pricing = this.getPricingConfig(planType);
        return this._calculateCost(usage, pricing);
    }

    /**
     * Internal method to calculate cost from usage and pricing
     * Uses cents-based arithmetic to avoid floating point errors
     */
    static _calculateCost(usage, pricing) {
        // If any pricing component is null, return 0 (not configured yet)
        if (pricing.costPerThousandTokens === null ||
            pricing.costPerMessage === null ||
            pricing.costPerToolCall === null) {
            return 0;
        }

        const totalTokens = (parseInt(usage.total_tokens_input) || 0) +
                          (parseInt(usage.total_tokens_output) || 0);
        const tokensInThousands = totalTokens / 1000;

        // Calculate each component and round to avoid accumulating errors
        const tokenCost = this.roundToCents(tokensInThousands * (pricing.costPerThousandTokens || 0));
        const messageCost = this.roundToCents((parseInt(usage.total_messages) || 0) * (pricing.costPerMessage || 0));
        const toolCallCost = this.roundToCents((parseInt(usage.total_tool_calls) || 0) * (pricing.costPerToolCall || 0));

        return this.roundToCents(tokenCost + messageCost + toolCallCost);
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

        // Calculate costs (using async pricing from database)
        const pricing = await this.getPricingConfigAsync(client.plan_type);
        const baseCost = this.roundToCents(pricing.baseCost || 0);
        const usageCost = await this.calculateUsageCostAsync(usageData, client.plan_type);
        const totalCost = this.roundToCents(baseCost + usageCost);

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
    static async handleWebhook(provider, _payload) {
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
            const amount = this.roundToCents(parseFloat(inv.total_cost) || 0);
            summary.total_amount = this.roundToCents(summary.total_amount + amount);

            if (inv.status === 'pending') {
                summary.pending_count++;
                summary.pending_amount = this.roundToCents(summary.pending_amount + amount);
            } else if (inv.status === 'overdue') {
                summary.overdue_count++;
                summary.overdue_amount = this.roundToCents(summary.overdue_amount + amount);
            }
        });

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

