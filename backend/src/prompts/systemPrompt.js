/**
 * System Prompts for AI Customer Service Agent
 *
 * These prompts define the AI's personality, behavior, and instructions
 * Supports English and Hebrew languages
 */

/**
 * Base system prompt template - English
 * @param {Object} client - Client configuration
 * @returns {String} System prompt in English
 */
function getEnglishPrompt(client) {
  return `You are a friendly customer support person for ${client.name}. Keep responses SHORT (1-2 sentences).

## CRITICAL - READ CAREFULLY:
1. When user provides ALL required info (like date, time, name) → CALL THE TOOL IMMEDIATELY
2. Do NOT say "let me book that" or "I'll check" → Just CALL THE TOOL
3. After tool executes, you get a [TOOL RESULT] → Use that info in your response
4. NEVER make up confirmations - only confirm what the tool result says

## WHEN TO CALL TOOLS:
- "book table for today 8pm, John" → HAS date, time, name → CALL book_appointment NOW
- "check order 12345" → HAS order number → CALL get_order_status NOW
- "is pizza available?" → HAS product name → CALL check_inventory NOW
- "book a table" → MISSING date/time/name → Ask for them FIRST

## TOOL FORMAT (EXACT):
USE_TOOL: tool_name
PARAMETERS: {"key": "value"}

## AFTER TOOL RESULT:
When you see [TOOL RESULT], use that information to respond. Example:
- Tool returns "Reservation confirmed for 8pm, table 5" → Say "You're all set! Table 5 at 8pm."
- Tool returns "Pizza in stock, 32 available" → Say "Yes, we have it! 32 in stock."

## DON'T:
- Say "Let me book/check that for you" without calling the tool
- Show raw JSON to the user
- Explain technical details
- Make up information not in tool results
`;
}

/**
 * Base system prompt template - Hebrew
 * @param {Object} client - Client configuration
 * @returns {String} System prompt in Hebrew
 */
function getHebrewPrompt(client) {
  return `אתה נציג שירות לקוחות ידידותי של ${client.name}. תהיה קצר ותמציתי (משפט או שניים מקסימום).

## קריטי - קרא בעיון:
1. כשהמשתמש נותן את כל המידע הנדרש (תאריך, שעה, שם) → קרא לכלי מיד
2. אל תגיד "אני אזמין" או "רגע אבדוק" → פשוט קרא לכלי
3. אחרי שהכלי רץ, תקבל [TOOL RESULT] → השתמש במידע הזה בתשובה שלך
4. לעולם אל תמציא אישורים - רק אשר מה שתוצאת הכלי אומרת

## מתי לקרוא לכלים:
- "להזמין שולחן להיום 20:00, שם ישראל" → יש תאריך, שעה, שם → קרא לכלי עכשיו
- "מה הסטטוס של הזמנה 12345" → יש מספר הזמנה → קרא לכלי עכשיו
- "יש לכם פיצה?" → יש שם מוצר → קרא לכלי עכשיו
- "להזמין שולחן" → חסר תאריך/שעה/שם → שאל קודם

## פורמט הכלי (בדיוק):
USE_TOOL: tool_name
PARAMETERS: {"key": "value"}

## אחרי תוצאת הכלי:
כשתראה [TOOL RESULT], השתמש במידע הזה כדי להגיב. דוגמאות:
- הכלי מחזיר "הזמנה אושרה לשעה 20:00, שולחן 5" → אמור "מעולה! שולחן 5 בשעה 20:00."
- הכלי מחזיר "פיצה במלאי, 32 יחידות" → אמור "כן, יש לנו! 32 במלאי."

## אל תעשה:
- אל תגיד "רגע אבדוק" בלי לקרוא לכלי
- אל תציג JSON למשתמש
- אל תסביר פרטים טכניים
- אל תמציא מידע שאינו בתוצאות הכלי

## שפה
- ענה תמיד בעברית
`;
}

/**
 * Base system prompt template
 * @param {Object} client - Client configuration
 * @param {Array} tools - Available tools for this client
 * @returns {String} System prompt
 */
export function getSystemPrompt(client, tools = []) {
  // Keep the base system prompt small.
  // Tools are provided separately (native tool calling) or via the Ollama tool block appended at runtime,
  // so we intentionally do NOT embed a tool list here.
  void tools;

  // Return Hebrew or English prompt based on client's language setting
  const language = client.language || 'en';
  return language === 'he' ? getHebrewPrompt(client) : getEnglishPrompt(client);
}

/**
 * Enhanced system prompt with custom client instructions
 * @param {Object} client - Client configuration with business_info
 * @param {Array} tools - Available tools
 * @returns {String} System prompt
 */
export function getEnhancedSystemPrompt(client, tools = []) {
  const basePrompt = getSystemPrompt(client, tools);

  // Add client-specific instructions from business_info if provided
  const businessInfo = client.business_info || {};
  if (businessInfo.custom_instructions) {
    return `${basePrompt}\n\n## Client-Specific Instructions\n${businessInfo.custom_instructions}`;
  }

  return basePrompt;
}

/**
 * Context-aware prompt that includes business hours, policies, etc.
 * Automatically pulls from client.business_info if available
 * @param {Object} client - Client configuration with business_info
 * @param {Array} tools - Available tools
 * @param {Object} context - Additional context (overrides business_info if provided)
 * @returns {String} System prompt
 */
export function getContextualSystemPrompt(client, tools = [], context = {}) {
  let prompt = getEnhancedSystemPrompt(client, tools);

  // Merge business_info with context (context overrides business_info)
  const businessInfo = client.business_info || {};
  const mergedContext = { ...businessInfo, ...context };

  // Add business description if provided
  if (mergedContext.about_business) {
    prompt += `\n\n## About ${client.name}\n${mergedContext.about_business}`;
  }

  // Add business hours if provided
  if (mergedContext.business_hours) {
    prompt += `\n\n## Business Hours\n${mergedContext.business_hours}`;
  }

  // Add contact information if provided
  const contactInfo = [];
  if (mergedContext.contact_phone) contactInfo.push(`Phone: ${mergedContext.contact_phone}`);
  if (mergedContext.contact_email) contactInfo.push(`Email: ${mergedContext.contact_email}`);
  if (mergedContext.contact_address) contactInfo.push(`Address: ${mergedContext.contact_address}`);
  if (contactInfo.length > 0) {
    prompt += `\n\n## Contact Information\n${contactInfo.join('\n')}`;
  }

  // Add return policy if provided
  if (mergedContext.return_policy) {
    prompt += `\n\n## Return Policy\n${mergedContext.return_policy}`;
  }

  // Add shipping policy if provided
  if (mergedContext.shipping_policy) {
    prompt += `\n\n## Shipping Policy\n${mergedContext.shipping_policy}`;
  }

  // Add payment methods if provided
  if (mergedContext.payment_methods) {
    prompt += `\n\n## Payment Methods\n${mergedContext.payment_methods}`;
  }

  // Add FAQ if provided
  if (mergedContext.faq && mergedContext.faq.length > 0) {
    prompt += `\n\n## Frequently Asked Questions\n${mergedContext.faq.map((item, i) => `${i + 1}. Q: ${item.question}\n   A: ${item.answer}`).join('\n')}`;
  }

  return prompt;
}

/**
 * Tool-specific instruction templates
 */
export const toolInstructions = {
  get_order_status: 'When a customer asks about their order, always use the get_order_status tool. Ask for their order number if they haven\'t provided it.',

  book_appointment: 'When a customer wants to schedule an appointment, reservation, or pickup, use the book_appointment tool immediately. Extract date and time from natural language (e.g., "today at 12:23 pm" = current date + "12:23"). Accept service types like "Pizza Pickup", "Table Reservation", "Delivery", etc. If customer provides name, email, phone, use them. If missing, use reasonable defaults or ask once, then proceed. DO NOT ask multiple times for the same information. DO NOT make up information that the customer did not provide.',

  check_inventory: 'When a customer asks if a product is available, use the check_inventory tool with the product name or SKU.',

  get_product_info: 'When a customer asks about product details (price, specs, availability), use the get_product_info tool to fetch live data.',

  send_email: 'When a customer requests to receive information via email or needs documentation sent, use the send_email tool.'
};

/**
 * Get conversation starter message
 * @param {Object} client - Client configuration
 * @returns {String} Greeting message
 */
export function getGreeting(client) {
  const language = client.language || 'en';
  if (language === 'he') {
    return 'שלום! איך אפשר לעזור לך היום?';
  }
  return 'Hi! How can I help you today?';
}

/**
 * Escalation message template
 * @param {string} language - Language code
 * @returns {String} Escalation message
 */
export function getEscalationMessage(language = 'en') {
  if (language === 'he') {
    return 'מצטער, אבל הבקשה הזו דורשת עזרה מנציג אנושי. אני מעביר אותך לחבר צוות שיוכל לעזור לך טוב יותר. אנא המתן רגע.';
  }
  return 'I apologize, but this request requires human assistance. Let me connect you with a team member who can better help you. Please hold for a moment.';
}

/**
 * Error handling message template
 * @param {string} language - Language code
 * @returns {String} Error message
 */
export function getErrorMessage(language = 'en') {
  if (language === 'he') {
    return 'מצטער, אני מתקשה לעבד את הבקשה הזו כרגע. אנא נסה שוב, או אם הבעיה נמשכת, אוכל לחבר אותך לנציג אנושי.';
  }
  return 'I\'m sorry, I\'m having trouble processing that request right now. Please try again, or if the issue persists, I can connect you with a human agent.';
}

// Legacy exports for backwards compatibility
export const escalationMessage = getEscalationMessage('en');
export const errorMessage = getErrorMessage('en');
