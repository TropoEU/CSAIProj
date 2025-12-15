/**
 * Customer Dashboard Controller
 * Handles API requests for customer portal
 */

import jwt from 'jsonwebtoken';
import { Client } from '../models/Client.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { ToolExecution } from '../models/ToolExecution.js';
import { Invoice } from '../models/Invoice.js';
import { ApiUsage } from '../models/ApiUsage.js';
import { db } from '../db.js';

class CustomerController {
  /**
   * Login with access code
   * POST /api/customer/auth/login
   */
  async login(req, res) {
    try {
      const { accessCode, rememberMe = false } = req.body;

      if (!accessCode) {
        return res.status(400).json({
          error: 'Access code required',
          message: 'Please provide your access code'
        });
      }

      // Find client by access code
      const client = await Client.findByAccessCode(accessCode);

      if (!client) {
        // Log failed attempt (security)
        console.warn('[CustomerAuth] Failed login attempt with code:', accessCode.substring(0, 4) + '***');

        return res.status(401).json({
          error: 'Invalid access code',
          message: 'The access code you entered is not valid'
        });
      }

      // Check if client is active
      if (client.status !== 'active') {
        return res.status(403).json({
          error: 'Account inactive',
          message: 'Your account is currently inactive. Please contact support.'
        });
      }

      // Generate JWT token
      const expiresIn = rememberMe ? '30d' : '7d';
      const token = jwt.sign(
        { clientId: client.id, type: 'customer' },
        process.env.JWT_SECRET,
        { expiresIn }
      );

      // Log successful login
      console.log(`[CustomerAuth] Client ${client.id} (${client.name}) logged in`);

      // Return token and client info
      res.json({
        token,
        client: {
          id: client.id,
          name: client.name,
          plan: client.plan_type,
          status: client.status,
          // Mask access code for security
          accessCode: accessCode.substring(0, 3) + '***' + accessCode.substring(accessCode.length - 3)
        }
      });
    } catch (error) {
      console.error('[CustomerController] Login error:', error);
      res.status(500).json({
        error: 'Login failed',
        message: 'An error occurred during login'
      });
    }
  }

  /**
   * Get dashboard overview
   * GET /api/customer/dashboard/overview
   */
  async getOverview(req, res) {
    try {
      const clientId = req.clientId;

      // Get current month usage
      const usage = await ApiUsage.getCurrentPeriodUsage(clientId);

      // Get plan limits (from PlanLimits config or database)
      const client = req.client;
      const limits = {
        conversations: client.max_conversations_per_month || null,
        tokens: client.max_tokens_per_month || null,
        toolCalls: null // Unlimited for now
      };

      // Get recent activity (last 60 days)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const recentConversations = await db.query(
        `SELECT
          c.id,
          c.session_id,
          c.started_at,
          c.ended_at,
          c.message_count,
          c.tokens_total,
          (SELECT content FROM messages WHERE conversation_id = c.id AND role = 'user' ORDER BY timestamp ASC LIMIT 1) as first_message
        FROM conversations c
        WHERE c.client_id = $1
          AND c.started_at >= $2
        ORDER BY c.started_at DESC
        LIMIT 10`,
        [clientId, sixtyDaysAgo]
      );

      // Get today's stats
      const today = new Date().toISOString().substring(0, 10); // YYYY-MM-DD
      const todayStats = await db.query(
        `SELECT
          COUNT(*) as conversation_count,
          COALESCE(SUM(tokens_total), 0) as tokens_used
        FROM conversations
        WHERE client_id = $1
          AND DATE(started_at) = $2`,
        [clientId, today]
      );

      // Get most used tool this week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const topTool = await db.query(
        `SELECT
          te.tool_name,
          COUNT(*) as call_count
        FROM tool_executions te
        JOIN conversations c ON te.conversation_id = c.id
        WHERE c.client_id = $1
          AND te.timestamp >= $2
        GROUP BY te.tool_name
        ORDER BY call_count DESC
        LIMIT 1`,
        [clientId, weekAgo]
      );

      res.json({
        account: {
          name: client.name,
          plan: client.plan_type,
          status: client.status
        },
        usage: {
          conversations: parseInt(usage?.total_conversations) || 0,
          tokens: (parseInt(usage?.total_tokens_input) || 0) + (parseInt(usage?.total_tokens_output) || 0),
          toolCalls: parseInt(usage?.total_tool_calls) || 0
        },
        limits,
        stats: {
          conversationsToday: parseInt(todayStats.rows[0]?.conversation_count) || 0,
          tokensToday: parseInt(todayStats.rows[0]?.tokens_used) || 0,
          topTool: topTool.rows[0] || null
        },
        recentConversations: recentConversations.rows.map(conv => ({
          id: conv.id,
          sessionId: conv.session_id,
          startedAt: conv.started_at,
          endedAt: conv.ended_at,
          messageCount: conv.message_count,
          tokensTotal: conv.tokens_total,
          firstMessage: conv.first_message || 'No messages',
          preview: conv.first_message ? conv.first_message.substring(0, 100) : 'No messages'
        }))
      });
    } catch (error) {
      console.error('[CustomerController] Overview error:', error);
      res.status(500).json({
        error: 'Failed to load overview',
        message: 'An error occurred while loading your dashboard'
      });
    }
  }

  /**
   * Get enabled actions (tools)
   * GET /api/customer/actions
   */
  async getActions(req, res) {
    try {
      const clientId = req.clientId;

      const result = await db.query(
        `SELECT
          t.tool_name,
          t.description,
          t.category,
          ct.enabled
        FROM client_tools ct
        JOIN tools t ON ct.tool_id = t.id
        WHERE ct.client_id = $1 AND ct.enabled = true
        ORDER BY t.category NULLS LAST, t.tool_name`,
        [clientId]
      );

      const tools = result.rows.map(tool => {
        const capabilities = this.getToolCapabilities(tool.tool_name);
        return {
          name: tool.tool_name,
          description: tool.description || 'No description available',
          category: tool.category || 'general',
          capabilities
        };
      });

      res.json({ tools });
    } catch (error) {
      console.error('[CustomerController] Actions error:', error);
      console.error('[CustomerController] Actions error details:', error.stack);
      res.status(500).json({
        error: 'Failed to load actions',
        message: 'An error occurred while loading available actions',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get tool capabilities (plain language bullet points)
   */
  getToolCapabilities(toolName) {
    const capabilities = {
      get_order_status: [
        'Get real-time tracking information',
        'View driver details and contact info',
        'See estimated delivery time',
        'Check order items and total'
      ],
      book_appointment: [
        'Schedule pickup times',
        'Book table reservations',
        'Automatic confirmation',
        'Receive booking reference number'
      ],
      check_inventory: [
        'Check product availability',
        'View real-time stock levels',
        'Get product information'
      ]
    };

    return capabilities[toolName] || ['Perform ' + toolName.replace(/_/g, ' ')];
  }

  /**
   * Get conversations with pagination and filters
   * GET /api/customer/conversations
   */
  async getConversations(req, res) {
    try {
      const clientId = req.clientId;
      const {
        page = 1,
        limit = 20,
        search = '',
        status = 'all',
        days = 60 // Default to 60 days
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Build date filter
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(days));

      // Build WHERE clause
      let whereConditions = ['c.client_id = $1', 'c.started_at >= $2'];
      const queryParams = [clientId, daysAgo];
      let paramIndex = 3;

      if (search) {
        whereConditions.push(`c.session_id ILIKE $${paramIndex}`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (status !== 'all') {
        if (status === 'active') {
          whereConditions.push('c.ended_at IS NULL');
        } else if (status === 'ended') {
          whereConditions.push('c.ended_at IS NOT NULL');
        }
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countResult = await db.query(
        `SELECT COUNT(*) as total FROM conversations c WHERE ${whereClause}`,
        queryParams
      );
      const totalConversations = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(totalConversations / parseInt(limit));

      // Get conversations
      const result = await db.query(
        `SELECT
          c.id,
          c.session_id,
          c.started_at,
          c.ended_at,
          c.message_count,
          c.tokens_total,
          c.llm_provider,
          c.model_name,
          (SELECT COUNT(*) FROM tool_executions WHERE conversation_id = c.id) as tool_call_count
        FROM conversations c
        WHERE ${whereClause}
        ORDER BY c.started_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, parseInt(limit), offset]
      );

      res.json({
        conversations: result.rows.map(conv => ({
          id: conv.id,
          sessionId: conv.session_id,
          startedAt: conv.started_at,
          endedAt: conv.ended_at,
          duration: conv.ended_at
            ? Math.floor((new Date(conv.ended_at) - new Date(conv.started_at)) / 1000)
            : null,
          messageCount: conv.message_count,
          tokensTotal: conv.tokens_total,
          toolCallCount: parseInt(conv.tool_call_count) || 0,
          status: conv.ended_at ? 'ended' : 'active',
          provider: conv.llm_provider,
          model: conv.model_name
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages,
          totalConversations
        }
      });
    } catch (error) {
      console.error('[CustomerController] Conversations error:', error);
      res.status(500).json({
        error: 'Failed to load conversations',
        message: 'An error occurred while loading your conversations'
      });
    }
  }

  /**
   * Get conversation detail
   * GET /api/customer/conversations/:id
   */
  async getConversationDetail(req, res) {
    try {
      const clientId = req.clientId;
      const conversationId = req.params.id;

      // Get conversation and verify ownership
      const conversation = await Conversation.findById(conversationId);

      if (!conversation) {
        return res.status(404).json({
          error: 'Conversation not found',
          message: 'The requested conversation could not be found'
        });
      }

      // Verify client owns this conversation
      if (conversation.client_id !== clientId) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to view this conversation'
        });
      }

      // Get messages
      const messages = await Message.getAll(conversationId);

      // Get tool executions
      const toolExecutions = await ToolExecution.getByConversation(conversationId);

      res.json({
        conversation: {
          id: conversation.id,
          sessionId: conversation.session_id,
          startedAt: conversation.started_at,
          endedAt: conversation.ended_at,
          messageCount: conversation.message_count,
          tokensTotal: conversation.tokens_total,
          provider: conversation.llm_provider,
          model: conversation.model_name,
          status: conversation.ended_at ? 'ended' : 'active'
        },
        messages: messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          tokens: msg.tokens,
          tokensCumulative: msg.tokens_cumulative,
          toolsCalled: msg.metadata ? (typeof msg.metadata === 'string' ? JSON.parse(msg.metadata).tools_called : msg.metadata.tools_called) : null
        })),
        toolExecutions: toolExecutions.map(te => ({
          id: te.id,
          toolName: te.tool_name,
          inputParams: te.parameters,
          result: te.n8n_response,
          status: te.success ? 'success' : 'error',
          executionTime: te.execution_time_ms,
          executedAt: te.timestamp
        }))
      });
    } catch (error) {
      console.error('[CustomerController] Conversation detail error:', error);
      res.status(500).json({
        error: 'Failed to load conversation',
        message: 'An error occurred while loading the conversation details'
      });
    }
  }

  /**
   * Get billing invoices
   * GET /api/customer/billing/invoices
   */
  async getInvoices(req, res) {
    try {
      const clientId = req.clientId;

      const invoices = await Invoice.findByClientId(clientId);

      res.json({
        invoices: invoices.map(inv => ({
          id: inv.id,
          invoiceNumber: `INV-${inv.id.toString().padStart(6, '0')}`, // Generate invoice number from ID
          period: inv.billing_period,
          amount: parseFloat(inv.total_cost || 0),
          status: inv.status,
          dueDate: inv.due_date,
          paidAt: inv.paid_at,
          createdAt: inv.created_at
        }))
      });
    } catch (error) {
      console.error('[CustomerController] Invoices error:', error);
      res.status(500).json({
        error: 'Failed to load invoices',
        message: 'An error occurred while loading your invoices'
      });
    }
  }

  /**
   * Get current usage
   * GET /api/customer/usage/current
   */
  async getCurrentUsage(req, res) {
    try {
      const clientId = req.clientId;
      const client = req.client;

      // Get current month usage
      const usage = await ApiUsage.getCurrentPeriodUsage(clientId);
      const currentMonth = new Date().toISOString().substring(0, 7);

      // Get limits
      const limits = {
        conversations: client.max_conversations_per_month || null,
        tokens: client.max_tokens_per_month || null,
        toolCalls: null
      };

      res.json({
        usage: {
          conversations: parseInt(usage?.total_conversations) || 0,
          tokens: (parseInt(usage?.total_tokens_input) || 0) + (parseInt(usage?.total_tokens_output) || 0),
          toolCalls: parseInt(usage?.total_tool_calls) || 0
        },
        limits,
        period: currentMonth
      });
    } catch (error) {
      console.error('[CustomerController] Current usage error:', error);
      res.status(500).json({
        error: 'Failed to load usage',
        message: 'An error occurred while loading your usage data'
      });
    }
  }

  /**
   * Get usage trends
   * GET /api/customer/usage/trends
   */
  async getUsageTrends(req, res) {
    try {
      const clientId = req.clientId;
      const { period = '30d' } = req.query;

      // Parse period (e.g., "30d" -> 30 days)
      const days = parseInt(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const result = await db.query(
        `SELECT
          DATE(started_at) as date,
          COUNT(*) as conversations,
          COALESCE(SUM(tokens_total), 0) as tokens
        FROM conversations
        WHERE client_id = $1 AND started_at >= $2
        GROUP BY DATE(started_at)
        ORDER BY date ASC`,
        [clientId, startDate]
      );

      res.json({
        daily: result.rows.map(row => ({
          date: row.date,
          conversations: parseInt(row.conversations),
          tokens: parseInt(row.tokens)
        }))
      });
    } catch (error) {
      console.error('[CustomerController] Usage trends error:', error);
      res.status(500).json({
        error: 'Failed to load trends',
        message: 'An error occurred while loading usage trends'
      });
    }
  }

  /**
   * Get tool usage breakdown
   * GET /api/customer/usage/tools
   */
  async getToolUsage(req, res) {
    try {
      const clientId = req.clientId;

      const result = await db.query(
        `SELECT
          te.tool_name,
          COUNT(*) as call_count,
          SUM(CASE WHEN te.success = true THEN 1 ELSE 0 END) as success_count,
          ROUND(AVG(te.execution_time_ms), 2) as avg_execution_time
        FROM tool_executions te
        JOIN conversations c ON te.conversation_id = c.id
        WHERE c.client_id = $1
        GROUP BY te.tool_name
        ORDER BY call_count DESC`,
        [clientId]
      );

      res.json({
        tools: result.rows.map(row => {
          const callCount = parseInt(row.call_count) || 0;
          const successCount = parseInt(row.success_count) || 0;
          const successRate = callCount > 0 
            ? Math.round((successCount / callCount) * 100) 
            : 0;
          
          return {
            name: row.tool_name,
            callCount,
            successRate,
            avgExecutionTime: parseFloat(row.avg_execution_time) || 0
          };
        })
      });
    } catch (error) {
      console.error('[CustomerController] Tool usage error:', error);
      console.error('[CustomerController] Tool usage error details:', error.stack);
      res.status(500).json({
        error: 'Failed to load tool usage',
        message: 'An error occurred while loading tool usage data',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

export default new CustomerController();
