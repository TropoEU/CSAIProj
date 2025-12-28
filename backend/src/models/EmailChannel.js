import { db } from '../db.js';

export class EmailChannel {
    /**
     * Create a new email channel
     * @param {number} clientId - The client ID
     * @param {string} emailAddress - The email address
     * @param {string} channelType - Channel type (gmail, outlook)
     * @param {object} connectionConfig - OAuth tokens and connection details
     * @param {object} settings - Channel settings
     */
    static async create(clientId, emailAddress, channelType = 'gmail', connectionConfig = {}, settings = null) {
        const query = `
            INSERT INTO email_channels (client_id, email_address, channel_type, connection_config, settings, status)
            VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, 'authenticating')
            RETURNING *
        `;
        const defaultSettings = {
            signature: '',
            auto_reply: true,
            monitoring_enabled: true,
            filter_labels: [],
            exclude_labels: ['SPAM', 'TRASH']
        };
        const params = [
            clientId,
            emailAddress,
            channelType,
            JSON.stringify(connectionConfig),
            JSON.stringify(settings || defaultSettings)
        ];

        const result = await db.query(query, params);
        return result.rows[0];
    }

    /**
     * Find email channel by ID
     */
    static async findById(id) {
        const result = await db.query(
            'SELECT * FROM email_channels WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }

    /**
     * Find all email channels for a client
     */
    static async findByClient(clientId) {
        const result = await db.query(
            `SELECT * FROM email_channels
             WHERE client_id = $1
             ORDER BY created_at DESC`,
            [clientId]
        );
        return result.rows;
    }

    /**
     * Find email channel by client ID and email address
     */
    static async findByClientAndEmail(clientId, emailAddress) {
        const result = await db.query(
            `SELECT * FROM email_channels
             WHERE client_id = $1 AND email_address = $2`,
            [clientId, emailAddress]
        );
        return result.rows[0] || null;
    }

    /**
     * Get all active email channels (for monitoring)
     */
    static async getActive() {
        const result = await db.query(
            `SELECT ec.*, c.name as client_name
             FROM email_channels ec
             JOIN clients c ON ec.client_id = c.id
             WHERE ec.status = 'active'
             AND c.status = 'active'
             AND (ec.settings->>'monitoring_enabled')::boolean = true
             ORDER BY ec.last_checked_at ASC NULLS FIRST`
        );
        return result.rows;
    }

    /**
     * Update email channel connection config (tokens)
     */
    static async updateConnectionConfig(id, connectionConfig) {
        const result = await db.query(
            `UPDATE email_channels
             SET connection_config = $2::jsonb, updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, JSON.stringify(connectionConfig)]
        );
        return result.rows[0];
    }

    /**
     * Update email channel status
     */
    static async updateStatus(id, status, errorMessage = null) {
        const result = await db.query(
            `UPDATE email_channels
             SET status = $2, last_error = $3, updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, status, errorMessage]
        );
        return result.rows[0];
    }

    /**
     * Update last checked timestamp
     */
    static async updateLastChecked(id) {
        const result = await db.query(
            `UPDATE email_channels
             SET last_checked_at = NOW(), updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id]
        );
        return result.rows[0];
    }

    /**
     * Update email channel settings
     */
    static async updateSettings(id, settings) {
        const result = await db.query(
            `UPDATE email_channels
             SET settings = $2::jsonb, updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, JSON.stringify(settings)]
        );
        return result.rows[0];
    }

    /**
     * Update email channel (general update)
     */
    static async update(id, updates) {
        const allowedFields = ['email_address', 'channel_type', 'connection_config', 'status', 'settings', 'last_error'];
        const fields = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                // Handle JSONB fields
                if ((key === 'connection_config' || key === 'settings') && value !== null && typeof value === 'object') {
                    fields.push(`${key} = $${paramIndex}::jsonb`);
                    values.push(JSON.stringify(value));
                } else {
                    fields.push(`${key} = $${paramIndex}`);
                    values.push(value);
                }
                paramIndex++;
            }
        }

        if (fields.length === 0) {
            throw new Error('No valid fields to update');
        }

        fields.push('updated_at = NOW()');
        values.push(id);

        const query = `
            UPDATE email_channels
            SET ${fields.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await db.query(query, values);
        return result.rows[0];
    }

    /**
     * Delete email channel
     */
    static async delete(id) {
        const result = await db.query(
            'DELETE FROM email_channels WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }

    /**
     * Delete all email channels for a client
     */
    static async deleteByClient(clientId) {
        const result = await db.query(
            'DELETE FROM email_channels WHERE client_id = $1 RETURNING *',
            [clientId]
        );
        return result.rows;
    }

    /**
     * Get channel statistics
     */
    static async getStats() {
        const result = await db.query(`
            SELECT
                status,
                channel_type,
                COUNT(*) as count
            FROM email_channels
            GROUP BY status, channel_type
            ORDER BY status, channel_type
        `);
        return result.rows;
    }

    /**
     * Find channels that need token refresh (checked more than 50 minutes ago)
     */
    static async findNeedingRefresh() {
        const result = await db.query(`
            SELECT * FROM email_channels
            WHERE status = 'active'
            AND (
                last_checked_at IS NULL
                OR last_checked_at < NOW() - INTERVAL '50 minutes'
            )
            ORDER BY last_checked_at ASC NULLS FIRST
        `);
        return result.rows;
    }
}
