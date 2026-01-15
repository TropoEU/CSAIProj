/**
 * Context Fetcher Utility
 *
 * Fetches specific parts of business_info on-demand for Adaptive mode
 * Prevents loading full context when only specific info is needed
 */

// ============================================================================
// SECTION FORMATTERS (DRY helpers used by both formatContextForPrompt and formatFullBusinessInfo)
// ============================================================================

/**
 * Format the About section
 * @param {Object|string} about - About data (object with description/history/team or string)
 * @param {string} clientName - Client name for header
 * @returns {string} Formatted about section
 */
function formatAboutSection(about, clientName) {
  if (!about) return '';

  let formatted = `\n\n## About ${clientName}`;

  if (typeof about === 'string') {
    formatted += `\n${about}`;
  } else if (typeof about === 'object') {
    if (about.description) formatted += `\n${about.description}`;
    if (about.history) formatted += `\n\n**History:** ${about.history}`;
    if (about.team) formatted += `\n\n**Team:** ${about.team}`;
  }

  return formatted;
}

/**
 * Format the Contact section
 * @param {Object|string} contact - Contact data
 * @returns {string} Formatted contact section
 */
function formatContactSection(contact) {
  if (!contact) return '';

  let formatted = '\n\n## Contact Information';

  if (typeof contact === 'string') {
    formatted += `\n${contact}`;
  } else if (typeof contact === 'object') {
    if (contact.phone) formatted += `\nPhone: ${contact.phone}`;
    if (contact.email) formatted += `\nEmail: ${contact.email}`;
    if (contact.address) formatted += `\nAddress: ${contact.address}`;
    if (contact.hours) formatted += `\nHours: ${contact.hours}`;
  }

  return formatted;
}

/**
 * Format individual contact fields (when not a full contact object)
 * @param {Object} fields - Object with phone, email, address, hours keys
 * @returns {string} Formatted contact section or empty string
 */
function formatContactFields(fields) {
  const contactFields = [];
  if (fields.phone) contactFields.push(`Phone: ${fields.phone}`);
  if (fields.email) contactFields.push(`Email: ${fields.email}`);
  if (fields.address) contactFields.push(`Address: ${fields.address}`);
  if (fields.hours) contactFields.push(`Hours: ${fields.hours}`);

  if (contactFields.length === 0) return '';
  return `\n\n## Contact Information\n${contactFields.join('\n')}`;
}

/**
 * Format a single policy section
 * @param {string} title - Policy title (e.g., "Return Policy")
 * @param {string} content - Policy content
 * @returns {string} Formatted policy section
 */
function formatPolicySection(title, content) {
  if (!content) return '';
  return `\n\n## ${title}\n${content}`;
}

/**
 * Format the full Policies object
 * @param {Object} policies - Policies object with returns/shipping/privacy/terms
 * @returns {string} Formatted policies sections
 */
function formatPoliciesObject(policies) {
  if (!policies) return '';

  let formatted = '';
  if (policies.returns) formatted += formatPolicySection('Return Policy', policies.returns);
  if (policies.shipping) formatted += formatPolicySection('Shipping Policy', policies.shipping);
  if (policies.privacy) formatted += formatPolicySection('Privacy Policy', policies.privacy);
  if (policies.terms) formatted += formatPolicySection('Terms of Service', policies.terms);

  return formatted;
}

/**
 * Format the FAQs section
 * @param {Array} faqs - Array of FAQ objects with question/answer
 * @returns {string} Formatted FAQs section
 */
function formatFAQsSection(faqs) {
  if (!faqs || !Array.isArray(faqs) || faqs.length === 0) return '';

  let formatted = '\n\n## Frequently Asked Questions\n';
  formatted += faqs.map((faq, i) => `${i + 1}. Q: ${faq.question}\n   A: ${faq.answer}`).join('\n');

  return formatted;
}

/**
 * Format the AI Instructions section
 * @param {string} instructions - AI instructions content
 * @returns {string} Formatted AI instructions section
 */
function formatAIInstructionsSection(instructions) {
  if (!instructions) return '';
  return `\n\n## Custom Instructions\n${instructions}`;
}

// ============================================================================
// CONTEXT MAP
// ============================================================================

/**
 * Valid context keys that can be fetched
 * Maps request keys to business_info paths
 * Includes both detailed keys (policies.returns) and simplified keys (return_policy)
 * Supports both nested structures (contact.hours) and flat structures (business_hours)
 */
const CONTEXT_MAP = {
  // Simplified keys (as told to AI in the prompt)
  // Support both nested and flat business_info structures
  business_hours: (businessInfo) => businessInfo?.contact?.hours || businessInfo?.business_hours,
  contact_info: (businessInfo) => {
    // Prefer nested contact object
    if (businessInfo?.contact) return businessInfo.contact;
    // Fall back to flat structure
    const flat = {};
    if (businessInfo?.contact_phone) flat.phone = businessInfo.contact_phone;
    if (businessInfo?.contact_email) flat.email = businessInfo.contact_email;
    if (businessInfo?.contact_address) flat.address = businessInfo.contact_address;
    if (businessInfo?.business_hours) flat.hours = businessInfo.business_hours;
    return Object.keys(flat).length > 0 ? flat : undefined;
  },
  return_policy: (businessInfo) => businessInfo?.policies?.returns || businessInfo?.return_policy,
  shipping_policy: (businessInfo) =>
    businessInfo?.policies?.shipping || businessInfo?.shipping_policy,
  payment_methods: (businessInfo) =>
    businessInfo?.policies?.payment_methods || businessInfo?.payment_methods,
  about_business: (businessInfo) =>
    businessInfo?.about?.description || businessInfo?.about_business,

  // Detailed keys (for granular fetching)
  'policies.returns': (businessInfo) => businessInfo?.policies?.returns,
  'policies.shipping': (businessInfo) => businessInfo?.policies?.shipping,
  'policies.privacy': (businessInfo) => businessInfo?.policies?.privacy,
  'policies.terms': (businessInfo) => businessInfo?.policies?.terms,
  policies: (businessInfo) => businessInfo?.policies,

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
  faqs: (businessInfo) => businessInfo?.faqs,

  // AI instructions
  ai_instructions: (businessInfo) => businessInfo?.ai_instructions,

  // Full dump (fallback)
  all: (businessInfo) => businessInfo,
};

// ============================================================================
// PUBLIC API
// ============================================================================

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
    missing,
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
  // Handle full context fallback
  if (context.all) {
    return formatFullBusinessInfo(context.all, clientName);
  }

  let formatted = '';
  const alreadyFormatted = { about: false, contact: false, policies: {} };

  // Simplified keys (from AI needs_more_context)
  if (context['return_policy']) {
    formatted += formatPolicySection('Return Policy', context['return_policy']);
    alreadyFormatted.policies.returns = true;
  }
  if (context['shipping_policy']) {
    formatted += formatPolicySection('Shipping Policy', context['shipping_policy']);
    alreadyFormatted.policies.shipping = true;
  }
  if (context['payment_methods']) {
    formatted += formatPolicySection('Payment Methods', context['payment_methods']);
  }
  if (context['business_hours']) {
    formatted += `\n\n## Business Hours\n${context['business_hours']}`;
  }
  if (context['about_business']) {
    formatted += formatAboutSection(context['about_business'], clientName);
    alreadyFormatted.about = true;
  }
  if (context['contact_info']) {
    formatted += formatContactSection(context['contact_info']);
    alreadyFormatted.contact = true;
  }

  // Detailed policy keys (skip if already formatted via simplified keys)
  if (context['policies.returns'] && !alreadyFormatted.policies.returns) {
    formatted += formatPolicySection('Return Policy', context['policies.returns']);
    alreadyFormatted.policies.returns = true;
  }
  if (context['policies.shipping'] && !alreadyFormatted.policies.shipping) {
    formatted += formatPolicySection('Shipping Policy', context['policies.shipping']);
    alreadyFormatted.policies.shipping = true;
  }
  if (context['policies.privacy']) {
    formatted += formatPolicySection('Privacy Policy', context['policies.privacy']);
    alreadyFormatted.policies.privacy = true;
  }
  if (context['policies.terms']) {
    formatted += formatPolicySection('Terms of Service', context['policies.terms']);
    alreadyFormatted.policies.terms = true;
  }

  // Full policies object (only format policies not already done)
  if (context.policies) {
    const policies = context.policies;
    if (policies.returns && !alreadyFormatted.policies.returns) {
      formatted += formatPolicySection('Return Policy', policies.returns);
    }
    if (policies.shipping && !alreadyFormatted.policies.shipping) {
      formatted += formatPolicySection('Shipping Policy', policies.shipping);
    }
    if (policies.privacy && !alreadyFormatted.policies.privacy) {
      formatted += formatPolicySection('Privacy Policy', policies.privacy);
    }
    if (policies.terms && !alreadyFormatted.policies.terms) {
      formatted += formatPolicySection('Terms of Service', policies.terms);
    }
  }

  // Contact (detailed keys) - skip if already formatted
  if (!alreadyFormatted.contact) {
    if (context['contact.full']) {
      formatted += formatContactSection(context['contact.full']);
    } else {
      // Individual contact fields
      const fields = {
        phone: context['contact.phone'],
        email: context['contact.email'],
        address: context['contact.address'],
        hours:
          context['contact.hours'] && !context['business_hours'] ? context['contact.hours'] : null,
      };
      formatted += formatContactFields(fields);
    }
  }

  // About (detailed keys) - skip if already formatted
  if (!alreadyFormatted.about) {
    if (context['about.full']) {
      formatted += formatAboutSection(context['about.full'], clientName);
    } else if (context['about.description'] || context['about.history'] || context['about.team']) {
      // Build about object from individual fields
      const about = {};
      if (context['about.description']) about.description = context['about.description'];
      if (context['about.history']) about.history = context['about.history'];
      if (context['about.team']) about.team = context['about.team'];
      formatted += formatAboutSection(about, clientName);
    }
  }

  // FAQs and AI Instructions
  formatted += formatFAQsSection(context.faqs);
  formatted += formatAIInstructionsSection(context.ai_instructions);

  return formatted;
}

/**
 * Format full business_info (fallback)
 * Uses the same section formatters as formatContextForPrompt for consistency
 * @param {Object} businessInfo - Full business_info object
 * @param {string} clientName - Client name
 * @returns {string} Formatted string
 */
function formatFullBusinessInfo(businessInfo, clientName) {
  if (!businessInfo) return '';

  let formatted = '';

  // Format each section using shared helpers
  formatted += formatAboutSection(businessInfo.about, clientName);
  formatted += formatContactSection(businessInfo.contact);
  formatted += formatPoliciesObject(businessInfo.policies);
  formatted += formatFAQsSection(businessInfo.faqs);
  formatted += formatAIInstructionsSection(businessInfo.ai_instructions);

  return formatted;
}

/**
 * Get list of valid context keys
 * @returns {Array<string>} Valid context keys
 */
export function getValidContextKeys() {
  return Object.keys(CONTEXT_MAP);
}
