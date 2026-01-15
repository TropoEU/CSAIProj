/**
 * Script to fix Message.create() calls in adaptiveReasoningService.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '../services/adaptiveReasoningService.js');

let content = fs.readFileSync(filePath, 'utf8');

// Pattern 1: Store critique message
content = content.replace(
  /await Message\.create\(\{\s*conversation_id:\s*conversationId,\s*role:\s*'assistant',\s*content:\s*JSON\.stringify\(critiqueResult,\s*null,\s*2\),\s*message_type:\s*'critique',\s*metadata:\s*critiqueResult,\s*reason_code:\s*REASON_CODES\.CRITIQUE_TRIGGERED\s*\}\);/g,
  "await Message.createDebug(conversationId, 'assistant', JSON.stringify(critiqueResult, null, 2), 'critique', { metadata: critiqueResult, reasonCode: REASON_CODES.CRITIQUE_TRIGGERED });"
);

// Pattern 2: Tool execution messages
content = content.replace(
  /await Message\.create\(\{\s*conversation_id:\s*conversationId,\s*role:\s*'assistant',\s*content:\s*toolResult\.final_response,\s*message_type:\s*'visible',\s*metadata:\s*\{\s*tool_executed:\s*true,\s*tool_name:\s*finalAssessment\.tool_call,\s*tool_result:\s*toolResult\s*\},\s*reason_code:\s*REASON_CODES\.EXECUTED_SUCCESSFULLY\s*\}\);/g,
  "await Message.create(conversationId, 'assistant', toolResult.final_response, 0);"
);

// Pattern 3: ASK_USER response
content = content.replace(
  /await Message\.create\(\{\s*conversation_id:\s*conversationId,\s*role:\s*'assistant',\s*content:\s*critiqueResult\.message,\s*message_type:\s*'visible',\s*metadata:\s*\{\s*critique_decision:\s*'ASK_USER',\s*pending_intent_stored:\s*true\s*\},\s*reason_code:\s*REASON_CODES\.AWAITING_CONFIRMATION\s*\}\);/g,
  "await Message.create(conversationId, 'assistant', critiqueResult.message, 0);"
);

// Pattern 4: Error in adaptive reasoning
content = content.replace(
  /await Message\.create\(\{\s*conversation_id:\s*conversationId,\s*role:\s*'assistant',\s*content:\s*`Error in adaptive reasoning: \$\{error\.message\}`,\s*message_type:\s*'internal',\s*reason_code:\s*REASON_CODES\.CRITIQUE_FAILED\s*\}\);/g,
  "await Message.createDebug(conversationId, 'assistant', `Error in adaptive reasoning: ${error.message}`, 'internal', { reasonCode: REASON_CODES.CRITIQUE_FAILED });"
);

// Pattern 5: Confirmation messages
content = content.replace(
  /await Message\.create\(\{\s*conversation_id:\s*conversationId,\s*role:\s*'assistant',\s*content:\s*toolResult\.executed\s*\?\s*`Confirmed! \$\{toolResult\.final_response\}`\s*:\s*`I encountered an error: \$\{toolResult\.error\}`,\s*message_type:\s*'visible',\s*metadata:\s*\{\s*confirmed_action:\s*pending\.tool,\s*tool_result:\s*toolResult\s*\}\s*\}\);/g,
  "await Message.create(conversationId, 'assistant', toolResult.executed ? `Confirmed! ${toolResult.final_response}` : `I encountered an error: ${toolResult.error}`, 0);"
);

// Pattern 6: Escalate response
content = content.replace(
  /await Message\.create\(\{\s*conversation_id:\s*conversationId,\s*role:\s*'assistant',\s*content:\s*critiqueResult\.message,\s*message_type:\s*'visible',\s*metadata:\s*\{\s*critique_decision:\s*'ESCALATE'\s*\},\s*reason_code:\s*REASON_CODES\.ESCALATION_TRIGGERED\s*\}\);/g,
  "await Message.create(conversationId, 'assistant', critiqueResult.message, 0);"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Fixed all Message.create() calls');
console.log('Patterns replaced:');
console.log('  - Critique messages → createDebug()');
console.log('  - Tool execution messages → create() without reason_code');
console.log('  - ASK_USER responses → create()');
console.log('  - Error messages → createDebug()');
console.log('  - Confirmation messages → create()');
console.log('  - Escalate messages → create()');
