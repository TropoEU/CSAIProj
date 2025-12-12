import { db } from '../db.js';
import { Client } from './Client.js';
import { Plan } from './Plan.js';

export class ApiUsage {
    /**
     * Record usage for a client (upsert - update if exists, insert if not)
     * @param {number} clientId - Client ID
     * @param {number} tokensInput - Input tokens used
     * @param {number} tokensOutput - Output tokens used
     * @param {number} toolCallsCount - Number of tool calls
     * @param {boolean} isNewConversation - Whether this is a new conversation (default: false)
     */
    static async recordUsage(clientId, tokensInput, tokensOutput, toolCallsCount = 0, isNewConversation = false) {
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // Calculate cost estimate based on client's plan pricing
        let costEstimate = 0;
        try {
            // Get client's plan
            const client = await Client.findById(clientId);
            if (client && client.plan_type) {
                const plan = await Plan.findByName(client.plan_type);
                if (plan) {
                    // Calculate cost using plan's usage_multiplier
                    // usage_multiplier is cost per token (e.g., 0.00001 = $0.00001 per token)
                    const totalTokens = tokensInput + tokensOutput;
                    costEstimate = totalTokens * parseFloat(plan.usage_multiplier || 0);
                }
            }
        } catch (error) {
            console.warn('[ApiUsage] Failed to fetch plan pricing, using fallback:', error.message);
            // Fallback to hardcoded pricing if plan lookup fails
            costEstimate = (tokensInput / 1000000 * 2.50) + (tokensOutput / 1000000 * 10);
        }

        // Convert boolean to explicit boolean for PostgreSQL
        const isNewConvBool = Boolean(isNewConversation);
        
        const result = await db.query(
            `INSERT INTO api_usage (client_id, date, conversation_count, message_count, tokens_input, tokens_output, tool_calls_count, cost_estimate)
             VALUES ($1, $2, CASE WHEN $7::boolean THEN 1 ELSE 0 END, 1, $3, $4, $5, $6)
             ON CONFLICT (client_id, date)
             DO UPDATE SET
                conversation_count = api_usage.conversation_count + CASE WHEN $7::boolean THEN 1 ELSE 0 END,
                message_count = api_usage.message_count + 1,
                tokens_input = api_usage.tokens_input + $3,
                tokens_output = api_usage.tokens_output + $4,
                tool_calls_count = api_usage.tool_calls_count + $5,
                cost_estimate = api_usage.cost_estimate + $6,
                updated_at = NOW()
             RETURNING *`,
            [clientId, date, tokensInput, tokensOutput, toolCallsCount, costEstimate, isNewConvBool]
        );
        return result.rows[0];
    }

    /**
     * Get usage for a specific date
     */
    static async getByDate(clientId, date) {
        const result = await db.query(
            'SELECT * FROM api_usage WHERE client_id = $1 AND date = $2',
            [clientId, date]
        );
        return result.rows[0] || null;
    }

    /**
     * Get usage for current billing period (current month)
     */
    static async getCurrentPeriodUsage(clientId) {
        const result = await db.query(
            `SELECT
                SUM(conversation_count) as total_conversations,
                SUM(message_count) as total_messages,
                SUM(tokens_input) as total_tokens_input,
                SUM(tokens_output) as total_tokens_output,
                SUM(tool_calls_count) as total_tool_calls,
                SUM(cost_estimate) as total_cost
             FROM api_usage
             WHERE client_id = $1
             AND date >= DATE_TRUNC('month', CURRENT_DATE)`,
            [clientId]
        );
        return result.rows[0];
    }

    /**
     * Get usage for a date range
     */
    static async getUsageRange(clientId, startDate, endDate) {
        const result = await db.query(
            `SELECT * FROM api_usage
             WHERE client_id = $1
             AND date BETWEEN $2 AND $3
             ORDER BY date ASC`,
            [clientId, startDate, endDate]
        );
        return result.rows;
    }

    /**
     * Calculate total cost for a date range
     */
    static async calculateCost(clientId, startDate, endDate) {
        const result = await db.query(
            `SELECT SUM(cost_estimate) as total_cost
             FROM api_usage
             WHERE client_id = $1
             AND date BETWEEN $2 AND $3`,
            [clientId, startDate, endDate]
        );
        return parseFloat(result.rows[0].total_cost) || 0;
    }

    /**
     * Check if client is over their usage limit
     */
    static async isOverLimit(clientId, monthlyTokenLimit) {
        const usage = await this.getCurrentPeriodUsage(clientId);
        const totalTokens = parseInt(usage.total_tokens_input) + parseInt(usage.total_tokens_output);
        return totalTokens > monthlyTokenLimit;
    }

    /**
     * Get top clients by usage (for analytics)
     */
    static async getTopClients(startDate, endDate, limit = 10) {
        const result = await db.query(
            `SELECT
                client_id,
                SUM(tokens_input + tokens_output) as total_tokens,
                SUM(cost_estimate) as total_cost,
                SUM(message_count) as total_messages
             FROM api_usage
             WHERE date BETWEEN $1 AND $2
             GROUP BY client_id
             ORDER BY total_cost DESC
             LIMIT $3`,
            [startDate, endDate, limit]
        );
        return result.rows;
    }
}
