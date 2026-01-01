-- UP
-- Add prompt_config column to clients table for customizable AI behavior
-- This allows per-client customization of the AI's reasoning process, response style, and rules

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS prompt_config JSONB DEFAULT '{}'::jsonb;

-- Add comment explaining the schema
COMMENT ON COLUMN clients.prompt_config IS 'AI prompt configuration. Schema:
{
  "reasoning_enabled": boolean,           // Enable/disable guided reasoning (default: true)
  "reasoning_steps": [                    // Custom reasoning steps (optional override)
    {"title": "UNDERSTAND", "instruction": "What is the customer asking?"},
    {"title": "CHECK CONTEXT", "instruction": "Do I have the answer?"},
    {"title": "DECIDE", "instruction": "Respond, use tool, or ask?"},
    {"title": "RESPOND", "instruction": "Keep it brief and helpful"}
  ],
  "response_style": {
    "tone": "friendly",                   // friendly, professional, casual
    "max_sentences": 2,                   // Max sentences per response
    "formality": "casual"                 // casual, neutral, formal
  },
  "tool_rules": [                         // Custom tool usage rules
    "Only call tools when you need external data",
    "Never use placeholder values"
  ],
  "custom_instructions": "...",           // Additional free-form instructions
  "greeting_enabled": true,               // Let AI generate greetings
  "greeting_message": null                // Override with specific greeting if set
}';

-- Insert default prompt config into platform_config for platform-wide defaults
INSERT INTO platform_config (key, value)
VALUES (
  'default_prompt_config',
  '{
    "reasoning_enabled": true,
    "reasoning_steps": [
      {"title": "UNDERSTAND", "instruction": "What is the customer actually asking for? Is this a question, request, complaint, or action?"},
      {"title": "CHECK CONTEXT", "instruction": "Review the conversation history and business information. If the answer is in context, do NOT call a tool."},
      {"title": "DECIDE", "instruction": "If you can answer from context, respond directly. If you need external data, use a tool. If missing required info, ask ONE clear question."},
      {"title": "RESPOND", "instruction": "Keep responses to 1-2 sentences. Be friendly but concise. Never show JSON or technical details."}
    ],
    "response_style": {
      "tone": "friendly",
      "max_sentences": 2,
      "formality": "casual"
    },
    "tool_rules": [
      "Only call a tool when you need data you do not have",
      "Never make up information - use a tool or ask the user",
      "Never repeat a tool call with the same parameters",
      "One tool per response maximum",
      "Never use placeholder values - ask for real data first"
    ],
    "custom_instructions": null,
    "greeting_enabled": true,
    "greeting_message": null
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;

-- DOWN
-- DELETE FROM platform_config WHERE key = 'default_prompt_config';
-- ALTER TABLE clients DROP COLUMN IF EXISTS prompt_config;
