import { db } from '../db.js';

export class Invoice {
    /**
     * Create a new invoice
     * @param {Object} invoiceData - Invoice data
     * @returns {Object} Created invoice
     */
    static async create(invoiceData) {
        const {
            clientId,
            billingPeriod,
            planType,
            baseCost = 0,
            usageCost = 0,
            totalCost,
            status = 'pending',
            paymentProvider = null,
            paymentProviderId = null,
            paymentMethod = null,
            dueDate = null,
            notes = null
        } = invoiceData;

        const result = await db.query(
            `INSERT INTO invoices
            (client_id, billing_period, plan_type, base_cost, usage_cost, total_cost,
             status, payment_provider, payment_provider_id, payment_method, due_date, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *`,
            [clientId, billingPeriod, planType, baseCost, usageCost, totalCost,
             status, paymentProvider, paymentProviderId, paymentMethod, dueDate, notes]
        );
        return result.rows[0];
    }

    /**
     * Find invoice by ID
     */
    static async findById(id) {
        const result = await db.query(
            'SELECT * FROM invoices WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }

    /**
     * Get all invoices with optional filters
     * @param {Object} filters - { status, clientId, billingPeriod }
     * @param {number} limit - Max number of results
     * @param {number} offset - Offset for pagination
     */
    static async findAll(filters = {}, limit = 100, offset = 0) {
        const conditions = [];
        const values = [];
        let paramIndex = 1;

        if (filters.status) {
            conditions.push(`i.status = $${paramIndex}`);
            values.push(filters.status);
            paramIndex++;
        }

        if (filters.clientId) {
            conditions.push(`i.client_id = $${paramIndex}`);
            values.push(filters.clientId);
            paramIndex++;
        }

        if (filters.billingPeriod) {
            conditions.push(`i.billing_period = $${paramIndex}`);
            values.push(filters.billingPeriod);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        
        // Add limit and offset to values array
        values.push(limit, offset);
        const limitParamIndex = paramIndex;
        const offsetParamIndex = paramIndex + 1;

        const query = `
            SELECT i.*, c.name as client_name, c.domain as client_domain
            FROM invoices i
            LEFT JOIN clients c ON i.client_id = c.id
            ${whereClause}
            ORDER BY i.created_at DESC
            LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
        `;

        const result = await db.query(query, values);
        return result.rows;
    }

    /**
     * Get invoices for a specific client
     */
    static async findByClientId(clientId, limit = 100, offset = 0) {
        const result = await db.query(
            `SELECT * FROM invoices
             WHERE client_id = $1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [clientId, limit, offset]
        );
        return result.rows;
    }

    /**
     * Get invoice by client and billing period
     */
    static async findByClientAndPeriod(clientId, billingPeriod) {
        const result = await db.query(
            `SELECT * FROM invoices
             WHERE client_id = $1 AND billing_period = $2`,
            [clientId, billingPeriod]
        );
        return result.rows[0] || null;
    }

    /**
     * Update invoice
     */
    static async update(id, updates) {
        const allowedFields = [
            'status', 'payment_provider', 'payment_provider_id',
            'payment_method', 'paid_at', 'due_date', 'notes',
            'base_cost', 'usage_cost', 'total_cost'
        ];
        const fields = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = $${paramIndex}`);
                values.push(value);
                paramIndex++;
            }
        }

        if (fields.length === 0) {
            throw new Error('No valid fields to update');
        }

        values.push(id);

        const query = `
            UPDATE invoices
            SET ${fields.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await db.query(query, values);
        return result.rows[0];
    }

    /**
     * Mark invoice as paid
     */
    static async markAsPaid(id, paymentData = {}) {
        const updates = {
            status: 'paid',
            paid_at: new Date(),
            ...paymentData
        };
        return this.update(id, updates);
    }

    /**
     * Mark invoice as overdue
     */
    static async markAsOverdue(id) {
        return this.update(id, { status: 'overdue' });
    }

    /**
     * Cancel invoice
     */
    static async cancel(id, notes = null) {
        const updates = { status: 'cancelled' };
        if (notes) updates.notes = notes;
        return this.update(id, updates);
    }

    /**
     * Delete invoice (hard delete)
     */
    static async delete(id) {
        const result = await db.query(
            'DELETE FROM invoices WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }

    /**
     * Get revenue analytics
     * @param {Object} filters - { startDate, endDate, status }
     */
    static async getRevenueAnalytics(filters = {}) {
        const conditions = [];
        const values = [];
        let paramIndex = 1;

        if (filters.startDate) {
            conditions.push(`created_at >= $${paramIndex}`);
            values.push(filters.startDate);
            paramIndex++;
        }

        if (filters.endDate) {
            conditions.push(`created_at <= $${paramIndex}`);
            values.push(filters.endDate);
            paramIndex++;
        }

        if (filters.status) {
            conditions.push(`status = $${paramIndex}`);
            values.push(filters.status);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const query = `
            SELECT
                COUNT(*) as total_invoices,
                SUM(total_cost) as total_revenue,
                SUM(base_cost) as total_base_cost,
                SUM(usage_cost) as total_usage_cost,
                AVG(total_cost) as avg_invoice_amount,
                COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count,
                SUM(CASE WHEN status = 'paid' THEN total_cost ELSE 0 END) as paid_revenue,
                SUM(CASE WHEN status = 'pending' THEN total_cost ELSE 0 END) as pending_revenue,
                SUM(CASE WHEN status = 'overdue' THEN total_cost ELSE 0 END) as overdue_revenue
            FROM invoices
            ${whereClause}
        `;

        const result = await db.query(query, values);
        return result.rows[0];
    }

    /**
     * Get revenue by month
     * @param {number} months - Number of months to look back
     */
    static async getRevenueByMonth(months = 12) {
        const result = await db.query(
            `SELECT
                billing_period,
                COUNT(*) as invoice_count,
                SUM(total_cost) as total_revenue,
                SUM(CASE WHEN status = 'paid' THEN total_cost ELSE 0 END) as paid_revenue,
                SUM(CASE WHEN status = 'pending' THEN total_cost ELSE 0 END) as pending_revenue
            FROM invoices
            WHERE billing_period >= TO_CHAR(NOW() - INTERVAL '${months} months', 'YYYY-MM')
            GROUP BY billing_period
            ORDER BY billing_period DESC`,
            []
        );
        return result.rows;
    }

    /**
     * Get revenue by plan type
     */
    static async getRevenueByPlan() {
        const result = await db.query(
            `SELECT
                plan_type,
                COUNT(*) as invoice_count,
                SUM(total_cost) as total_revenue,
                AVG(total_cost) as avg_revenue
            FROM invoices
            WHERE status = 'paid'
            GROUP BY plan_type
            ORDER BY total_revenue DESC`,
            []
        );
        return result.rows;
    }

    /**
     * Get outstanding invoices (pending or overdue)
     */
    static async getOutstanding() {
        const result = await db.query(
            `SELECT i.*, c.name as client_name, c.domain as client_domain
            FROM invoices i
            LEFT JOIN clients c ON i.client_id = c.id
            WHERE i.status IN ('pending', 'overdue')
            ORDER BY i.due_date ASC NULLS LAST, i.created_at DESC`,
            []
        );
        return result.rows;
    }

    /**
     * Check and mark overdue invoices
     * (Run this as a scheduled job)
     */
    static async markOverdueInvoices() {
        const result = await db.query(
            `UPDATE invoices
            SET status = 'overdue'
            WHERE status = 'pending'
            AND due_date < CURRENT_DATE
            RETURNING *`,
            []
        );
        return result.rows;
    }
}
