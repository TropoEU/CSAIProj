import express from 'express';
import { HTTP_STATUS } from '../../config/constants.js';
import { Conversation } from '../../models/Conversation.js';
import { Message } from '../../models/Message.js';
import { ToolExecution } from '../../models/ToolExecution.js';
import { Client } from '../../models/Client.js';
import { db } from '../../db.js';

const router = express.Router();

/**
 * GET /admin/conversations
 * Get all conversations with pagination
 */
router.get('/', async (req, res) => {
  try {
    const { clientId, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    let query = `
      SELECT c.*, cl.name as client_name,
        COALESCE(c.llm_provider, cl.llm_provider, 'ollama') as llm_provider,
        COALESCE(c.model_name, cl.model_name) as model_name,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND (message_type IS NULL OR message_type = 'visible')) as message_count,
        (SELECT COUNT(*) FROM tool_executions WHERE conversation_id = c.id) as tool_call_count,
        CASE WHEN c.ended_at IS NULL THEN 'active' ELSE 'ended' END as status
      FROM conversations c
      LEFT JOIN clients cl ON c.client_id = cl.id
    `;
    const params = [];

    if (clientId && clientId !== 'all') {
      query += ' WHERE c.client_id = $1';
      params.push(clientId);
    }

    query +=
      ' ORDER BY c.started_at DESC LIMIT $' +
      (params.length + 1) +
      ' OFFSET $' +
      (params.length + 2);
    params.push(parseInt(limit, 10), offset);

    const result = await db.query(query, params);

    let countQuery = 'SELECT COUNT(*) FROM conversations';
    const countParams = [];
    if (clientId && clientId !== 'all') {
      countQuery += ' WHERE client_id = $1';
      countParams.push(clientId);
    }
    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count, 10);

    res.json({
      conversations: result.rows,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalCount,
      totalPages: Math.ceil(totalCount / parseInt(limit, 10)),
    });
  } catch (error) {
    console.error('[Admin] Get conversations error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get conversations' });
  }
});

/**
 * GET /admin/conversations/export
 * Export conversations as CSV or JSON
 */
router.get('/export', async (req, res) => {
  try {
    const { clientId, format = 'json' } = req.query;

    let query = `
      SELECT c.*, cl.name as client_name
      FROM conversations c
      LEFT JOIN clients cl ON c.client_id = cl.id
    `;
    const params = [];

    if (clientId && clientId !== 'all') {
      query += ' WHERE c.client_id = $1';
      params.push(clientId);
    }

    query += ' ORDER BY c.started_at DESC';

    const result = await db.query(query, params);

    if (format === 'csv') {
      const headers = 'id,session_id,client_name,started_at,ended_at\n';
      const rows = result.rows
        .map(
          (r) =>
            `${r.id},${r.session_id},${r.client_name || ''},${r.started_at},${r.ended_at || ''}`
        )
        .join('\n');
      res.set('Content-Type', 'text/csv');
      res.send(headers + rows);
    } else {
      res.json(result.rows);
    }
  } catch (error) {
    console.error('[Admin] Export conversations error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to export conversations' });
  }
});

/**
 * GET /admin/conversations/:id
 * Get conversation with messages and tool executions
 * Query params:
 *   - debug=true: Include all message types (system, tool_call, tool_result, internal)
 */
router.get('/:id', async (req, res) => {
  try {
    const { debug } = req.query;
    const includeDebug = debug === 'true';

    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Conversation not found' });
    }

    conversation.status = conversation.ended_at ? 'ended' : 'active';

    const client = await Client.findById(conversation.client_id);
    conversation.client_name = client?.name;
    conversation.llm_provider = conversation.llm_provider || client?.llm_provider || 'ollama';
    conversation.model_name = conversation.model_name || client?.model_name || null;

    // Get messages - with or without debug messages
    const messages = includeDebug
      ? await Message.getAllWithDebug(conversation.id, true)
      : await Message.getAll(conversation.id);

    // Always get full message counts for the metadata cards (regardless of debug mode)
    const allMessages = await Message.getAllWithDebug(conversation.id, true);
    conversation.visible_message_count = allMessages.filter(m => !m.message_type || m.message_type === 'visible').length;
    conversation.debug_message_count = allMessages.filter(m => m.message_type && m.message_type !== 'visible').length;

    let cumulativeTokens = 0;
    conversation.messages = messages.map((msg) => {
      cumulativeTokens += msg.tokens_used || 0;
      return {
        ...msg,
        tokens: msg.tokens_used || 0,
        tokens_cumulative: cumulativeTokens,
        timestamp: msg.timestamp || msg.created_at,
        message_type: msg.message_type || 'visible',
        metadata: msg.metadata || null,
        tool_call_id: msg.tool_call_id || null,
      };
    });

    conversation.tokens_total = cumulativeTokens;

    const toolExecutions = await ToolExecution.getByConversation(conversation.id);
    conversation.tool_executions = toolExecutions.map((exec) => ({
      id: exec.id,
      tool_name: exec.tool_name,
      input_params: exec.parameters || {},
      result: exec.n8n_response || {},
      status: exec.status || (exec.success ? 'success' : 'failed'),
      success: exec.success,
      execution_time_ms: exec.execution_time_ms,
      timestamp: exec.timestamp,
      error_reason: exec.error_reason || null,
    }));

    // Only add tools_called for non-debug view (visible messages only)
    if (!includeDebug) {
      const messagesWithTools = conversation.messages.map((msg, index) => {
        if (msg.role !== 'assistant') {
          return msg;
        }

        const prevUserMessage = conversation.messages
          .slice(0, index)
          .reverse()
          .find((m) => m.role === 'user');
        const startTime = prevUserMessage?.timestamp || conversation.started_at;

        const nextMessage = conversation.messages[index + 1];
        const endTime = nextMessage?.timestamp || new Date().toISOString();

        const toolsForThisMessage = toolExecutions
          .filter((exec) => {
            const execTime = new Date(exec.timestamp).getTime();
            const start = new Date(startTime).getTime();
            const end = new Date(endTime).getTime();
            return execTime >= start && execTime <= end;
          })
          .map((exec) => exec.tool_name);

        return {
          ...msg,
          tools_called: toolsForThisMessage.length > 0 ? toolsForThisMessage : null,
        };
      });

      conversation.messages = messagesWithTools;
    }

    res.json(conversation);
  } catch (error) {
    console.error('[Admin] Get conversation error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get conversation' });
  }
});

/**
 * GET /admin/conversations/:id/export
 * Export a single conversation as CSV or text for debugging
 * Query params:
 *   - format: 'csv' | 'text' | 'json' (default: json)
 *   - debug: 'true' to include all internal messages
 */
router.get('/:id/export', async (req, res) => {
  try {
    const { format = 'json', debug = 'true' } = req.query;
    const includeDebug = debug === 'true';

    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Conversation not found' });
    }

    const client = await Client.findById(conversation.client_id);
    conversation.client_name = client?.name;
    conversation.llm_provider = conversation.llm_provider || client?.llm_provider || 'ollama';
    conversation.model_name = conversation.model_name || client?.model_name || null;

    const messages = includeDebug
      ? await Message.getAllWithDebug(conversation.id, true)
      : await Message.getAll(conversation.id);

    const toolExecutions = await ToolExecution.getByConversation(conversation.id);

    if (format === 'text') {
      // Plain text format for easy copy/paste
      let text = includeDebug
        ? '=== CONVERSATION EXPORT (FULL DEBUG) ===\n'
        : '=== CONVERSATION EXPORT ===\n';
      text += `Session ID: ${conversation.session_id}\n`;
      text += `Client: ${conversation.client_name || 'Unknown'}\n`;
      text += `Provider: ${conversation.llm_provider} / ${conversation.model_name || 'default'}\n`;
      text += `Started: ${conversation.started_at}\n`;
      text += `Ended: ${conversation.ended_at || 'Active'}\n`;
      text += `Debug Mode: ${includeDebug ? 'ON' : 'OFF'}\n`;
      text += `\n${'='.repeat(60)}\n\n`;

      for (const msg of messages) {
        const msgType = msg.message_type || 'visible';
        const typeLabel = {
          'visible': '[VISIBLE]',
          'system': '[SYSTEM PROMPT]',
          'tool_call': '[TOOL CALL]',
          'tool_result': '[TOOL RESULT]',
          'internal': '[INTERNAL]',
          'assessment': '[REASONING]',
          'critique': '[CRITIQUE]',
        }[msgType] || `[${msgType.toUpperCase()}]`;

        const roleLabel = msg.role.toUpperCase();
        const timestamp = new Date(msg.timestamp || msg.created_at).toISOString();

        text += `--- ${roleLabel} ${typeLabel} (${timestamp}) ---\n`;

        const content = msg.content || '(no content)';

        // For exports, always include full content (including JSON)
        // Try to pretty-print JSON for readability
        let displayContent = content;
        if (content.startsWith('{') || content.startsWith('[')) {
          try {
            const parsed = JSON.parse(content);
            displayContent = JSON.stringify(parsed, null, 2);
          } catch {
            // Not valid JSON, show as-is
          }
        }

        // Include metadata if present and different from content
        if (msg.metadata) {
          const metadataStr = JSON.stringify(msg.metadata, null, 2);
          // Only show metadata if it adds information not already in content
          if (metadataStr !== displayContent && metadataStr !== '{}') {
            text += `Metadata: ${metadataStr}\n`;
          }
        }

        text += `${displayContent}\n`;
        text += `Tokens: ${msg.tokens_used || 0}\n`;
        text += '\n';
      }

      // Add tool executions section only in non-debug mode (debug mode has inline tool data)
      if (!includeDebug && toolExecutions.length > 0) {
        text += `\n${'='.repeat(60)}\n`;
        text += '=== TOOL EXECUTIONS ===\n\n';

        for (const exec of toolExecutions) {
          text += `--- ${exec.tool_name} (${exec.status || 'unknown'}) ---\n`;
          text += `Timestamp: ${new Date(exec.timestamp).toISOString()}\n`;
          text += `Execution time: ${exec.execution_time_ms || 0}ms\n`;
          if (exec.error_reason) {
            text += `Error: ${exec.error_reason}\n`;
          }
          text += `Input: ${JSON.stringify(exec.parameters || {}, null, 2)}\n`;
          text += `Output: ${JSON.stringify(exec.n8n_response || {}, null, 2)}\n`;
          text += '\n';
        }
      }

      res.set('Content-Type', 'text/plain; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="conversation-${conversation.session_id}.txt"`);
      res.send(text);

    } else if (format === 'csv') {
      // CSV format
      const headers = 'timestamp,role,message_type,content,tokens,metadata\n';
      const rows = messages.map(msg => {
        const timestamp = new Date(msg.timestamp || msg.created_at).toISOString();
        const content = (msg.content || '').replace(/"/g, '""').replace(/\n/g, '\\n');
        const metadata = msg.metadata ? JSON.stringify(msg.metadata).replace(/"/g, '""') : '';
        return `"${timestamp}","${msg.role}","${msg.message_type || 'visible'}","${content}",${msg.tokens_used || 0},"${metadata}"`;
      }).join('\n');

      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="conversation-${conversation.session_id}.csv"`);
      res.send(headers + rows);

    } else {
      // JSON format (default)
      const response = {
        conversation: {
          id: conversation.id,
          session_id: conversation.session_id,
          client_name: conversation.client_name,
          llm_provider: conversation.llm_provider,
          model_name: conversation.model_name,
          started_at: conversation.started_at,
          ended_at: conversation.ended_at,
          debug_mode: includeDebug,
        },
        messages: messages.map(msg => ({
          timestamp: msg.timestamp || msg.created_at,
          role: msg.role,
          message_type: msg.message_type || 'visible',
          content: msg.content,
          tokens: msg.tokens_used || 0,
          tool_call_id: msg.tool_call_id,
          metadata: msg.metadata,
        })),
      };

      // Only include separate tool_executions in non-debug mode (debug mode has inline tool data)
      if (!includeDebug) {
        response.tool_executions = toolExecutions.map(exec => ({
          tool_name: exec.tool_name,
          status: exec.status,
          timestamp: exec.timestamp,
          execution_time_ms: exec.execution_time_ms,
          error_reason: exec.error_reason,
          input: exec.parameters,
          output: exec.n8n_response,
        }));
      }

      res.json(response);
    }
  } catch (error) {
    console.error('[Admin] Export conversation error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to export conversation' });
  }
});

export default router;
