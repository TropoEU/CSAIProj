import { db } from '../db.js';

/**
 * PlatformConfig Model
 *
 * Stores platform-wide configuration settings like platform email credentials.
 * Uses a key-value structure with JSONB values for flexibility.
 */
export class PlatformConfig {
    /**
     * Get a config value by key
     * @param {string} key - Config key
     * @returns {object|null} Config value or null if not found
     */
    static async get(key) {
        const result = await db.query(
            'SELECT value FROM platform_config WHERE key = $1',
            [key]
        );
        return result.rows[0]?.value || null;
    }

    /**
     * Set a config value
     * @param {string} key - Config key
     * @param {object} value - Config value (will be stored as JSONB)
     * @returns {object} The saved config
     */
    static async set(key, value) {
        const result = await db.query(
            `INSERT INTO platform_config (key, value, updated_at)
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT (key)
             DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [key, JSON.stringify(value)]
        );
        return result.rows[0];
    }

    /**
     * Delete a config value
     * @param {string} key - Config key
     * @returns {boolean} True if deleted
     */
    static async delete(key) {
        const result = await db.query(
            'DELETE FROM platform_config WHERE key = $1 RETURNING key',
            [key]
        );
        return result.rows.length > 0;
    }

    /**
     * Get all config values
     * @returns {object} Object with all config key-value pairs
     */
    static async getAll() {
        const result = await db.query('SELECT key, value FROM platform_config');
        const config = {};
        for (const row of result.rows) {
            config[row.key] = row.value;
        }
        return config;
    }

    // Convenience methods for platform email

    /**
     * Get platform email configuration
     * @returns {object|null} { email, accessToken, refreshToken } or null
     */
    static async getPlatformEmail() {
        return await this.get('platform_email');
    }

    /**
     * Set platform email configuration
     * @param {string} email - Email address
     * @param {string} accessToken - OAuth access token
     * @param {string} refreshToken - OAuth refresh token
     * @returns {object} The saved config
     */
    static async setPlatformEmail(email, accessToken, refreshToken) {
        return await this.set('platform_email', {
            email,
            accessToken,
            refreshToken,
            configuredAt: new Date().toISOString()
        });
    }

    /**
     * Update platform email tokens (after refresh)
     * @param {string} accessToken - New access token
     * @param {string} refreshToken - New refresh token (optional)
     */
    static async updatePlatformEmailTokens(accessToken, refreshToken = null) {
        const current = await this.getPlatformEmail();
        if (!current) return null;

        return await this.set('platform_email', {
            ...current,
            accessToken,
            refreshToken: refreshToken || current.refreshToken,
            lastRefreshed: new Date().toISOString()
        });
    }

    /**
     * Delete platform email configuration
     */
    static async deletePlatformEmail() {
        return await this.delete('platform_email');
    }
}
