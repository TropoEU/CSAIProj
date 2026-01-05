/**
 * Context Fetcher Utility
 *
 * Fetches specific parts of business_info on-demand for Adaptive mode
 * Prevents loading full context when only specific info is needed
 */

/**
 * Valid context keys that can be fetched
 * Maps request keys to business_info paths
 */
const CONTEXT_MAP = {
    // Policies
    'policies.returns': (businessInfo) => businessInfo?.policies?.returns,
    'policies.shipping': (businessInfo) => businessInfo?.policies?.shipping,
    'policies.privacy': (businessInfo) => businessInfo?.policies?.privacy,
    'policies.terms': (businessInfo) => businessInfo?.policies?.terms,
    'policies': (businessInfo) => businessInfo?.policies,

    // Contact information
    'contact.phone': (businessInfo) => businessInfo?.contact?.phone,
    'contact.email': (businessInfo) => businessInfo?.contact?.email,
    'contact.address': (businessInfo) => businessInfo?.contact?.address,
    'contact.hours': (businessInfo) => businessInfo?.contact?.hours,
    'contact.full': (businessInfo) => businessInfo?.contact,

    // About information
    'about.description': (businessInfo) => businessInfo?.about?.description,
    'about.history': (businessInfo) => businessInfo?.about?.history,
    'about.team': (businessInfo) => businessInfo?.about?.team,
    'about.full': (businessInfo) => businessInfo?.about,

    // FAQs
    'faqs': (businessInfo) => businessInfo?.faqs,

    // AI instructions
    'ai_instructions': (businessInfo) => businessInfo?.ai_instructions,

    // Full dump (fallback)
    'all': (businessInfo) => businessInfo,
};

/**
 * Fetch specific context from business_info
 * @param {Object} client - Client object with business_info
 * @param {Array<string>} contextKeys - Array of context keys to fetch
 * @returns {Object} { success, context, missing }
 */
export function fetchContext(client, contextKeys = []) {
    if (!contextKeys || contextKeys.length === 0) {
        return { success: true, context: {}, missing: [] };
    }

    const businessInfo = client.business_info || {};
    const context = {};
    const missing = [];

    for (const key of contextKeys) {
        const fetcher = CONTEXT_MAP[key];

        if (!fetcher) {
            // Unknown context key
            missing.push(key);
            continue;
        }

        const value = fetcher(businessInfo);
        if (value !== undefined && value !== null) {
            context[key] = value;
        } else {
            // Context key exists but no data
            missing.push(key);
        }
    }

    return {
        success: missing.length === 0,
        context,
        missing
    };
}

/**
 * Fetch full business_info (fallback when context fetching fails)
 * @param {Object} client - Client object
 * @returns {Object} Full business_info
 */
export function fetchFullContext(client) {
    return client.business_info || {};
}

/**
 * Format fetched context for system prompt
 * @param {Object} context - Fetched context data
 * @param {string} clientName - Client name
 * @returns {string} Formatted context string
 */
export function formatContextForPrompt(context, clientName) {
    let formatted = '';

    // Policies
    if (context['policies.returns']) {
        formatted += `\n\n## Return Policy\n${context['policies.returns']}`;
    }
    if (context['policies.shipping']) {
        formatted += `\n\n## Shipping Policy\n${context['policies.shipping']}`;
    }
    if (context['policies.privacy']) {
        formatted += `\n\n## Privacy Policy\n${context['policies.privacy']}`;
    }
    if (context['policies.terms']) {
        formatted += `\n\n## Terms of Service\n${context['policies.terms']}`;
    }
    if (context.policies && !context['policies.returns']) {
        // Full policies object
        const policies = context.policies;
        if (policies.returns) formatted += `\n\n## Return Policy\n${policies.returns}`;
        if (policies.shipping) formatted += `\n\n## Shipping Policy\n${policies.shipping}`;
        if (policies.privacy) formatted += `\n\n## Privacy Policy\n${policies.privacy}`;
        if (policies.terms) formatted += `\n\n## Terms of Service\n${policies.terms}`;
    }

    // Contact
    if (context['contact.full']) {
        const contact = context['contact.full'];
        formatted += `\n\n## Contact Information`;
        if (contact.phone) formatted += `\nPhone: ${contact.phone}`;
        if (contact.email) formatted += `\nEmail: ${contact.email}`;
        if (contact.address) formatted += `\nAddress: ${contact.address}`;
        if (contact.hours) formatted += `\nHours: ${contact.hours}`;
    } else {
        // Individual contact fields
        const contactFields = [];
        if (context['contact.phone']) contactFields.push(`Phone: ${context['contact.phone']}`);
        if (context['contact.email']) contactFields.push(`Email: ${context['contact.email']}`);
        if (context['contact.address']) contactFields.push(`Address: ${context['contact.address']}`);
        if (context['contact.hours']) contactFields.push(`Hours: ${context['contact.hours']}`);

        if (contactFields.length > 0) {
            formatted += `\n\n## Contact Information\n${contactFields.join('\n')}`;
        }
    }

    // About
    if (context['about.full']) {
        const about = context['about.full'];
        formatted += `\n\n## About ${clientName}`;
        if (about.description) formatted += `\n${about.description}`;
        if (about.history) formatted += `\n\n**History:** ${about.history}`;
        if (about.team) formatted += `\n\n**Team:** ${about.team}`;
    } else {
        // Individual about fields
        if (context['about.description']) {
            formatted += `\n\n## About ${clientName}\n${context['about.description']}`;
        }
        if (context['about.history']) {
            formatted += `\n\n**History:** ${context['about.history']}`;
        }
        if (context['about.team']) {
            formatted += `\n\n**Team:** ${context['about.team']}`;
        }
    }

    // FAQs
    if (context.faqs && Array.isArray(context.faqs) && context.faqs.length > 0) {
        formatted += `\n\n## Frequently Asked Questions\n`;
        formatted += context.faqs.map((faq, i) =>
            `${i + 1}. Q: ${faq.question}\n   A: ${faq.answer}`
        ).join('\n');
    }

    // AI Instructions
    if (context.ai_instructions) {
        formatted += `\n\n## Custom Instructions\n${context.ai_instructions}`;
    }

    // Full context (fallback)
    if (context.all) {
        // Already have everything, just format the business_info
        return formatFullBusinessInfo(context.all, clientName);
    }

    return formatted;
}

/**
 * Format full business_info (fallback)
 * @param {Object} businessInfo - Full business_info object
 * @param {string} clientName - Client name
 * @returns {string} Formatted string
 */
function formatFullBusinessInfo(businessInfo, clientName) {
    let formatted = '';

    // About
    if (businessInfo.about) {
        formatted += `\n\n## About ${clientName}`;
        if (businessInfo.about.description) formatted += `\n${businessInfo.about.description}`;
        if (businessInfo.about.history) formatted += `\n\n**History:** ${businessInfo.about.history}`;
        if (businessInfo.about.team) formatted += `\n\n**Team:** ${businessInfo.about.team}`;
    }

    // Contact
    if (businessInfo.contact) {
        formatted += `\n\n## Contact Information`;
        if (businessInfo.contact.phone) formatted += `\nPhone: ${businessInfo.contact.phone}`;
        if (businessInfo.contact.email) formatted += `\nEmail: ${businessInfo.contact.email}`;
        if (businessInfo.contact.address) formatted += `\nAddress: ${businessInfo.contact.address}`;
        if (businessInfo.contact.hours) formatted += `\nHours: ${businessInfo.contact.hours}`;
    }

    // Policies
    if (businessInfo.policies) {
        if (businessInfo.policies.returns) {
            formatted += `\n\n## Return Policy\n${businessInfo.policies.returns}`;
        }
        if (businessInfo.policies.shipping) {
            formatted += `\n\n## Shipping Policy\n${businessInfo.policies.shipping}`;
        }
        if (businessInfo.policies.privacy) {
            formatted += `\n\n## Privacy Policy\n${businessInfo.policies.privacy}`;
        }
        if (businessInfo.policies.terms) {
            formatted += `\n\n## Terms of Service\n${businessInfo.policies.terms}`;
        }
    }

    // FAQs
    if (businessInfo.faqs && Array.isArray(businessInfo.faqs) && businessInfo.faqs.length > 0) {
        formatted += `\n\n## Frequently Asked Questions\n`;
        formatted += businessInfo.faqs.map((faq, i) =>
            `${i + 1}. Q: ${faq.question}\n   A: ${faq.answer}`
        ).join('\n');
    }

    // AI Instructions
    if (businessInfo.ai_instructions) {
        formatted += `\n\n## Custom Instructions\n${businessInfo.ai_instructions}`;
    }

    return formatted;
}

/**
 * Get list of valid context keys
 * @returns {Array<string>} Valid context keys
 */
export function getValidContextKeys() {
    return Object.keys(CONTEXT_MAP);
}
