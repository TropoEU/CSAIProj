import express from 'express';
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
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
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
    res.status(500).json({ error: 'Failed to get conversations' });
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
    res.status(500).json({ error: 'Failed to export conversations' });
  }
});

/**
 * GET /admin/conversations/:id
 * Get conversation with messages and tool executions
 */
router.get('/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    conversation.status = conversation.ended_at ? 'ended' : 'active';

    const client = await Client.findById(conversation.client_id);
    conversation.client_name = client?.name;
    conversation.llm_provider = conversation.llm_provider || client?.llm_provider || 'ollama';
    conversation.model_name = conversation.model_name || client?.model_name || null;

    const messages = await Message.getAll(conversation.id);
    let cumulativeTokens = 0;
    conversation.messages = messages.map((msg) => {
      cumulativeTokens += msg.tokens_used || 0;
      return {
        ...msg,
        tokens: msg.tokens_used || 0,
        tokens_cumulative: cumulativeTokens,
        timestamp: msg.timestamp || msg.created_at,
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

    res.json(conversation);
  } catch (error) {
    console.error('[Admin] Get conversation error:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

export default router;
