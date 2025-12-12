/**
 * System Prompts for AI Customer Service Agent
 *
 * These prompts define the AI's personality, behavior, and instructions
 */

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

  return `You are a friendly customer support person for ${client.name}. Keep it SHORT.

## TOOL CALLING
When user wants to book/reserve/check something:
1. Check if you have ALL required info (date, time, AND customer's real name)
2. If missing info, ask: "What date/time?" or "What name should I put the reservation under?"
3. Once you have everything, call the tool:
   USE_TOOL: tool_name
   PARAMETERS: {"date": "2025-12-12", "time": "20:00", "customerName": "John Smith"}
4. NEVER make up a name - always ask the customer for their actual name
5. NEVER say "booked" or "reserved" unless you actually called the tool and got a response

## Behavior
- Be brief - 1-2 sentences max
- Skip optional fields (email, phone) - don't ask for them
- Convert "today"/"tomorrow" to YYYY-MM-DD format
`;
}

/**
 * Enhanced system prompt with custom client instructions
 * @param {Object} client - Client configuration with custom_instructions
 * @param {Array} tools - Available tools
 * @returns {String} System prompt
 */
export function getEnhancedSystemPrompt(client, tools = []) {
  const basePrompt = getSystemPrompt(client, tools);

  // Add client-specific instructions if provided
  if (client.custom_instructions) {
    return `${basePrompt}\n\n## Client-Specific Instructions\n${client.custom_instructions}`;
  }

  return basePrompt;
}

/**
 * Context-aware prompt that includes business hours, policies, etc.
 * @param {Object} client - Client configuration
 * @param {Array} tools - Available tools
 * @param {Object} context - Additional context (business hours, policies, etc.)
 * @returns {String} System prompt
 */
export function getContextualSystemPrompt(client, tools = [], context = {}) {
  let prompt = getEnhancedSystemPrompt(client, tools);

  // Add business hours if provided
  if (context.businessHours) {
    prompt += `\n\n## Business Hours\n${context.businessHours}`;
  }

  // Add return policy if provided
  if (context.returnPolicy) {
    prompt += `\n\n## Return Policy\n${context.returnPolicy}`;
  }

  // Add shipping policy if provided
  if (context.shippingPolicy) {
    prompt += `\n\n## Shipping Policy\n${context.shippingPolicy}`;
  }

  // Add FAQ if provided
  if (context.faq && context.faq.length > 0) {
    prompt += `\n\n## Frequently Asked Questions\n${context.faq.map((item, i) => `${i + 1}. Q: ${item.question}\n   A: ${item.answer}`).join('\n')}`;
  }

  return prompt;
}

/**
 * Tool-specific instruction templates
 */
export const toolInstructions = {
  get_order_status: `When a customer asks about their order, always use the get_order_status tool. Ask for their order number if they haven't provided it.`,

  book_appointment: `When a customer wants to schedule an appointment, reservation, or pickup, use the book_appointment tool immediately. Extract date and time from natural language (e.g., "today at 12:23 pm" = current date + "12:23"). Accept service types like "Pizza Pickup", "Table Reservation", "Delivery", etc. If customer provides name, email, phone, use them. If missing, use reasonable defaults or ask once, then proceed. DO NOT ask multiple times for the same information.`,

  check_inventory: `When a customer asks if a product is available, use the check_inventory tool with the product name or SKU.`,

  get_product_info: `When a customer asks about product details (price, specs, availability), use the get_product_info tool to fetch live data.`,

  send_email: `When a customer requests to receive information via email or needs documentation sent, use the send_email tool.`
};

/**
 * Get conversation starter message
 * @param {Object} client - Client configuration
 * @returns {String} Greeting message
 */
export function getGreeting(client) {
  const businessName = client.name;
  return `Hi! 👋 How can I help you today?`;
}

/**
 * Escalation message template
 */
export const escalationMessage = `I apologize, but this request requires human assistance. Let me connect you with a team member who can better help you. Please hold for a moment.`;

/**
 * Error handling message template
 */
export const errorMessage = `I'm sorry, I'm having trouble processing that request right now. Please try again, or if the issue persists, I can connect you with a human agent.`;
