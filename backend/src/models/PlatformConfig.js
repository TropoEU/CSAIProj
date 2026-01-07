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

    // Convenience methods for prompt configuration

    /**
     * Get default prompt configuration
     * @returns {object} Default prompt config
     */
    static async getDefaultPromptConfig() {
        const config = await this.get('default_prompt_config');
        return config || this.getHardcodedDefaults();
    }

    /**
     * Update default prompt configuration
     * @param {object} config - New prompt config
     * @returns {object} The saved config
     */
    static async setDefaultPromptConfig(config) {
        return await this.set('default_prompt_config', config);
    }

    /**
     * Get hardcoded defaults as fallback
     * Used when database has no config
     */
    static getHardcodedDefaults() {
        return {
            intro_template: 'You are a friendly customer support assistant for {client_name}.',
            reasoning_enabled: true,
            reasoning_steps: [
                { title: 'UNDERSTAND', instruction: 'What is the customer actually asking for? Is this a question, request, complaint, or action?' },
                { title: 'CHECK CONTEXT', instruction: 'Review the conversation history and business information. If the answer is in context, do NOT call a tool.' },
                { title: 'DECIDE', instruction: 'If you can answer from context, respond directly. If you need external data, use a tool. If missing required info, ask ONE clear question.' },
                { title: 'RESPOND', instruction: 'Keep responses to 1-2 sentences. Be friendly but concise. Never show JSON or technical details.' }
            ],
            response_style: {
                tone: 'friendly',
                max_sentences: 2,
                formality: 'casual'
            },
            tone_instructions: {
                friendly: 'Be warm and approachable.',
                professional: 'Maintain a professional and polished tone.',
                casual: 'Keep it conversational and relaxed.'
            },
            formality_instructions: {
                casual: 'Use everyday language.',
                neutral: 'Balance professionalism with approachability.',
                formal: 'Use formal language and proper grammar.'
            },
            tool_rules: [
                'Only call a tool when you need data you do not have',
                'Never make up information - use a tool or ask the user',
                'Never repeat a tool call with the same parameters',
                'One tool per response maximum',
                'Never use placeholder values - ask for real data first'
            ],
            tool_instructions: {
                get_order_status: 'When a customer asks about their order, always use the get_order_status tool. Ask for their order number if they haven\'t provided it.',
                book_appointment: 'When a customer wants to schedule an appointment, reservation, or pickup, use the book_appointment tool immediately. Extract date and time from natural language. If customer provides name, email, phone, use them. If missing, use reasonable defaults or ask once, then proceed.',
                check_inventory: 'When a customer asks if a product is available, use the check_inventory tool with the product name or SKU.',
                get_product_info: 'When a customer asks about product details (price, specs, availability), use the get_product_info tool to fetch live data.',
                send_email: 'When a customer requests to receive information via email or needs documentation sent, use the send_email tool.'
            },
            tool_format_template: 'USE_TOOL: tool_name\nPARAMETERS: {"key": "value"}',
            tool_result_instruction: 'Summarize the result naturally for the customer. Do not expose raw data or JSON.',
            language_names: {
                'en': 'English',
                'he': 'Hebrew (עברית)',
                'es': 'Spanish (Español)',
                'fr': 'French (Français)',
                'de': 'German (Deutsch)',
                'ar': 'Arabic (العربية)',
                'ru': 'Russian (Русский)'
            },
            language_instruction_template: 'You MUST respond in {language_name}. Use natural, conversational {language_name}. All your responses must be in this language.',
            escalation_message: 'I apologize, but this request requires human assistance. Let me connect you with a team member who can better help you.',
            error_message: 'I\'m sorry, I\'m having trouble processing that request. Please try again.',
            custom_instructions: null,
            greeting_enabled: true,
            greeting_message: null
        };
    }

    /**
     * Get adaptive mode prompt configuration
     * @returns {object} Adaptive mode config
     */
    static async getAdaptivePromptConfig() {
        const config = await this.get('adaptive_prompt_config');
        return config || this.getAdaptiveDefaults();
    }

    /**
     * Update adaptive mode prompt configuration
     * @param {object} config - New adaptive prompt config
     * @returns {object} The saved config
     */
    static async setAdaptivePromptConfig(config) {
        return await this.set('adaptive_prompt_config', config);
    }

    /**
     * Get hardcoded defaults for adaptive mode as fallback
     */
    static getAdaptiveDefaults() {
        return {
            intro_template: 'You are a customer support assistant for {client_name}.',
            reasoning_steps: [
                { title: 'UNDERSTAND', instruction: 'What is the user asking?' },
                { title: 'DECIDE', instruction: 'Tool needed? Params? Context needed?' }
            ],
            context_keys: [
                { key: 'business_hours', description: 'Operating hours' },
                { key: 'contact_info', description: 'Phone, email, address' },
                { key: 'return_policy', description: 'Return/refund policy' },
                { key: 'shipping_policy', description: 'Delivery info' },
                { key: 'payment_methods', description: 'Accepted payments' },
                { key: 'faqs', description: 'Common questions' },
                { key: 'about_business', description: 'Company description' }
            ],
            tool_rules: [
                'Set missing_params if tool needs params you don\'t have',
                'Set needs_more_context if you need business info',
                'Never guess/invent data'
            ],
            language_names: {
                'en': 'English',
                'he': 'Hebrew (עברית)',
                'es': 'Spanish (Español)',
                'fr': 'French (Français)',
                'de': 'German (Deutsch)',
                'ar': 'Arabic (العربية)',
                'ru': 'Russian (Русский)'
            },
            assessment_fields: {
                confidence: 'Confidence level 1-10',
                tool_call: 'Tool name or null',
                tool_params: 'Parameters object',
                missing_params: 'List of missing required params',
                is_destructive: 'true for cancel/delete/refund actions',
                needs_confirmation: 'true if user should confirm',
                needs_more_context: 'List of context keys needed'
            }
        };
    }
}
