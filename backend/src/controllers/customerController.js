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
import { Escalation } from '../models/Escalation.js';
import { db } from '../db.js';
import { safeJsonParse, safeJsonGet } from '../utils/jsonUtils.js';
import promptService from '../services/promptService.js';
import { refreshCachedConfig } from '../prompts/systemPrompt.js';
import { RedisCache } from '../services/redisCache.js';
import { RATE_LIMITS, LIMITS, HTTP_STATUS } from '../config/constants.js';
import { createLogger } from '../utils/logger.js';
import { UsageTracker } from '../services/usageTracker.js';

const log = createLogger('CustomerController');

class CustomerController {
  /**
   * Login with access code
   * POST /api/customer/auth/login
   */
  async login(req, res) {
    try {
      const { accessCode, rememberMe = false } = req.body;

      if (!accessCode) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Access code required',
          message: 'Please provide your access code'
        });
      }

      // Find client by access code
      const client = await Client.findByAccessCode(accessCode);

      if (!client) {
        // Log failed attempt (security)
        console.warn('[CustomerAuth] Failed login attempt with code:', accessCode.substring(0, 4) + '***');

        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          error: 'Invalid access code',
          message: 'The access code you entered is not valid'
        });
      }

      // Check if client is active
      if (client.status !== 'active') {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
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
          language: client.language || 'en',
          // Mask access code for security
          accessCode: accessCode.substring(0, 3) + '***' + accessCode.substring(accessCode.length - 3)
        }
      });
    } catch (error) {
      console.error('[CustomerController] Login error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
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
          status: client.status,
          language: client.language || 'en'
        },
        usage: {
          conversations: parseInt(usage?.total_conversations, 10) || 0,
          tokens: (parseInt(usage?.total_tokens_input, 10) || 0) + (parseInt(usage?.total_tokens_output, 10) || 0),
          toolCalls: parseInt(usage?.total_tool_calls, 10) || 0
        },
        limits,
        stats: {
          conversationsToday: parseInt(todayStats.rows[0]?.conversation_count, 10) || 0,
          tokensToday: parseInt(todayStats.rows[0]?.tokens_used, 10) || 0,
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
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
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
          t.capabilities,
          ct.enabled
        FROM client_tools ct
        JOIN tools t ON ct.tool_id = t.id
        WHERE ct.client_id = $1 AND ct.enabled = true
        ORDER BY t.category NULLS LAST, t.tool_name`,
        [clientId]
      );

      const tools = result.rows.map(tool => {
        const capabilities = this.getToolCapabilities(tool.tool_name, tool.capabilities);
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
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to load actions',
        message: 'An error occurred while loading available actions',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get tool capabilities (plain language bullet points)
   * @param {string} toolName - Tool name
   * @param {Array|null} dbCapabilities - Capabilities from database (optional)
   * @returns {Array} Array of capability strings
   */
  getToolCapabilities(toolName, dbCapabilities = null) {
    // If capabilities exist in database, use them
    if (dbCapabilities && Array.isArray(dbCapabilities) && dbCapabilities.length > 0) {
      return dbCapabilities;
    }
    
    // Fallback to hardcoded capabilities for backward compatibility
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

      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

      // Build date filter
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(days, 10));

      // Build WHERE clause
      const whereConditions = ['c.client_id = $1', 'c.started_at >= $2'];
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
      const totalConversations = parseInt(countResult.rows[0].total, 10);
      const totalPages = Math.ceil(totalConversations / parseInt(limit, 10));

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
        [...queryParams, parseInt(limit, 10), offset]
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
          toolCallCount: parseInt(conv.tool_call_count, 10) || 0,
          status: conv.ended_at ? 'ended' : 'active',
          provider: conv.llm_provider,
          model: conv.model_name
        })),
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages,
          totalConversations
        }
      });
    } catch (error) {
      console.error('[CustomerController] Conversations error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
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
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          error: 'Conversation not found',
          message: 'The requested conversation could not be found'
        });
      }

      // Verify client owns this conversation
      if (conversation.client_id !== clientId) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
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
          toolsCalled: safeJsonGet(msg.metadata, 'tools_called', null)
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
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
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
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to load invoices',
        message: 'An error occurred while loading your invoices'
      });
    }
  }

  /**
   * Get current usage
   * GET /api/customer/usage/current
   * Query params: period (day, week, month, year, all)
   *
   * BUG FIX: Previously used ApiUsage.getCurrentPeriodUsage which had incorrect
   * date filtering logic. Now using UsageTracker.getUsageSummary with explicit
   * period parameter for accurate rolling time window calculations (e.g., "month"
   * means last 30 days, not calendar month).
   */
  async getCurrentUsage(req, res) {
    try {
      const clientId = req.clientId;
      const client = req.client;
      const { period = 'month' } = req.query;

      // Get usage for the specified period using UsageTracker
      // Note: 'month' period uses rolling 30-day window (not calendar month)
      const summary = await UsageTracker.getUsageSummary(clientId, period);

      // Get limits
      const limits = {
        conversations: client.max_conversations_per_month || null,
        tokens: client.max_tokens_per_month || null,
        toolCalls: null
      };

      res.json({
        usage: {
          conversations: summary.conversations,
          tokens: summary.tokens.total,
          toolCalls: summary.toolCalls
        },
        limits,
        period
      });
    } catch (error) {
      console.error('[CustomerController] Current usage error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
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
      const days = parseInt(period, 10);
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
          conversations: parseInt(row.conversations, 10),
          tokens: parseInt(row.tokens, 10)
        }))
      });
    } catch (error) {
      console.error('[CustomerController] Usage trends error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
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
          const callCount = parseInt(row.call_count, 10) || 0;
          const successCount = parseInt(row.success_count, 10) || 0;
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
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to load tool usage',
        message: 'An error occurred while loading tool usage data',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get current settings
   * GET /api/customer/settings
   */
  async getSettings(req, res) {
    try {
      const client = req.client;

      res.json({
        language: client.language || 'en',
        name: client.name,
        email: client.email
      });
    } catch (error) {
      console.error('[CustomerController] Get settings error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to load settings',
        message: 'An error occurred while loading your settings'
      });
    }
  }

  /**
   * Update settings
   * PUT /api/customer/settings
   */
  async updateSettings(req, res) {
    try {
      const clientId = req.clientId;

      // Rate limiting for settings updates
      const rateLimit = await RedisCache.checkRateLimit(clientId, RATE_LIMITS.CUSTOMER_DASHBOARD);
      if (!rateLimit.allowed) {
        log.warn('Rate limit exceeded for customer settings update', { clientId });
        return res.status(HTTP_STATUS.RATE_LIMIT_EXCEEDED).json({
          error: 'Rate limit exceeded',
          retryAfter: rateLimit.resetIn
        });
      }

      const { language } = req.body;

      // Validate language
      const validLanguages = ['en', 'he'];
      if (language && !validLanguages.includes(language)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Invalid language',
          message: 'Language must be one of: ' + validLanguages.join(', ')
        });
      }

      // Build update object
      const updates = {};
      if (language) updates.language = language;

      if (Object.keys(updates).length === 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'No updates provided',
          message: 'Please provide at least one field to update'
        });
      }

      // Update client
      const updatedClient = await Client.update(clientId, updates);

      // Update stored client info in request for future middleware
      req.client = updatedClient;

      res.json({
        success: true,
        settings: {
          language: updatedClient.language || 'en'
        }
      });
    } catch (error) {
      console.error('[CustomerController] Update settings error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to update settings',
        message: 'An error occurred while updating your settings'
      });
    }
  }

  // ==================== AI Behavior / Prompt Config ====================

  /**
   * Get AI behavior config for this client
   * Returns merged config (client overrides + platform defaults)
   * GET /api/customer/ai-behavior
   */
  async getAIBehavior(req, res) {
    try {
      const client = req.client;
      const config = await promptService.getClientConfig(client);
      const defaults = await promptService.getDefaultConfig();
      const clientOverrides = client.prompt_config || {};

      // Determine which fields are customized (differ from platform defaults)
      const customizedFields = [];
      if ('reasoning_enabled' in clientOverrides) customizedFields.push('reasoning_enabled');
      if ('reasoning_steps' in clientOverrides) customizedFields.push('reasoning_steps');
      if ('response_style' in clientOverrides) customizedFields.push('response_style');
      if ('tool_rules' in clientOverrides) customizedFields.push('tool_rules');
      if ('custom_instructions' in clientOverrides && clientOverrides.custom_instructions) {
        customizedFields.push('custom_instructions');
      }

      // Return the merged config - client can only see/edit certain fields
      res.json({
        reasoning_enabled: config.reasoning_enabled,
        reasoning_steps: config.reasoning_steps || [],
        response_style: config.response_style || {},
        tool_rules: config.tool_rules || [],
        custom_instructions: config.custom_instructions || null,
        // Let client know if they have customizations
        hasCustomConfig: Object.keys(clientOverrides).length > 0,
        // Which specific fields are customized
        customizedFields,
        // Platform defaults for comparison
        defaults: {
          reasoning_enabled: defaults.reasoning_enabled,
          reasoning_steps: defaults.reasoning_steps || [],
          response_style: defaults.response_style || {},
          tool_rules: defaults.tool_rules || [],
        }
      });
    } catch (error) {
      console.error('[CustomerController] Get AI behavior error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to load AI behavior settings',
        message: 'An error occurred while loading your AI settings'
      });
    }
  }

  /**
   * Update AI behavior config for this client
   * PUT /api/customer/ai-behavior
   */
  async updateAIBehavior(req, res) {
    try {
      const clientId = req.clientId;

      // Rate limiting for AI behavior updates
      const rateLimit = await RedisCache.checkRateLimit(clientId, RATE_LIMITS.CUSTOMER_DASHBOARD);
      if (!rateLimit.allowed) {
        log.warn('Rate limit exceeded for customer AI behavior update', { clientId });
        return res.status(HTTP_STATUS.RATE_LIMIT_EXCEEDED).json({
          error: 'Rate limit exceeded',
          retryAfter: rateLimit.resetIn
        });
      }

      const {
        reasoning_enabled,
        reasoning_steps,
        response_style,
        tool_rules,
        custom_instructions
      } = req.body;

      // Validate total payload size to prevent DoS attacks
      const payloadSize = JSON.stringify(req.body).length;
      if (payloadSize > LIMITS.MAX_PAYLOAD_SIZE) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Payload too large',
          message: `Request body exceeds maximum size of ${LIMITS.MAX_PAYLOAD_SIZE} bytes`
        });
      }

      // Helper function to check object depth
      const MAX_RECURSION_DEPTH = 10; // Maximum recursion depth for safety
      const getObjectDepth = (obj, currentDepth = 0) => {
        if (currentDepth > MAX_RECURSION_DEPTH) return currentDepth; // Early exit if too deep
        if (obj === null || typeof obj !== 'object') return currentDepth;
        const depths = Object.values(obj).map(value =>
          getObjectDepth(value, currentDepth + 1)
        );
        return depths.length > 0 ? Math.max(...depths) : currentDepth;
      };

      // Validate object depth for nested objects
      const MAX_OBJECT_DEPTH = 5;
      if (response_style && getObjectDepth(response_style) > MAX_OBJECT_DEPTH) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Invalid response_style',
          message: `Object nesting depth exceeds maximum of ${MAX_OBJECT_DEPTH} levels`
        });
      }

      // Build the config update - only include fields that were provided
      const configUpdate = {};

      if (reasoning_enabled !== undefined) {
        configUpdate.reasoning_enabled = Boolean(reasoning_enabled);
      }

      if (reasoning_steps !== undefined) {
        // Validate reasoning_steps structure
        if (!Array.isArray(reasoning_steps)) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            error: 'Invalid reasoning_steps',
            message: 'Reasoning steps must be an array'
          });
        }

        // Limit array length to prevent abuse
        const MAX_REASONING_STEPS = 20;
        if (reasoning_steps.length > MAX_REASONING_STEPS) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            error: 'Invalid reasoning_steps',
            message: `Maximum ${MAX_REASONING_STEPS} reasoning steps allowed`
          });
        }

        configUpdate.reasoning_steps = reasoning_steps.map(step => ({
          title: String(step.title || '').substring(0, 50),
          instruction: String(step.instruction || '').substring(0, 500)
        }));
      }

      if (response_style !== undefined) {
        // Validate response_style
        const validTones = ['friendly', 'professional', 'casual'];
        const validFormality = ['casual', 'neutral', 'formal'];

        configUpdate.response_style = {};
        if (response_style.tone && validTones.includes(response_style.tone)) {
          configUpdate.response_style.tone = response_style.tone;
        }
        if (response_style.formality && validFormality.includes(response_style.formality)) {
          configUpdate.response_style.formality = response_style.formality;
        }
        if (response_style.max_sentences !== undefined) {
          const maxSentences = parseInt(response_style.max_sentences, 10);
          if (maxSentences >= 1 && maxSentences <= 10) {
            configUpdate.response_style.max_sentences = maxSentences;
          }
        }
      }

      if (tool_rules !== undefined) {
        if (!Array.isArray(tool_rules)) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            error: 'Invalid tool_rules',
            message: 'Tool rules must be an array'
          });
        }
        // Limit to 10 rules, max 200 chars each
        configUpdate.tool_rules = tool_rules
          .slice(0, 10)
          .map(rule => String(rule).substring(0, 200));
      }

      if (custom_instructions !== undefined) {
        // Limit to 2000 characters
        configUpdate.custom_instructions = custom_instructions
          ? String(custom_instructions).substring(0, 2000)
          : null;
      }

      // Update client's prompt_config
      const currentConfig = req.client.prompt_config || {};
      const newConfig = { ...currentConfig, ...configUpdate };

      await Client.updatePromptConfig(clientId, newConfig);

      // Refresh cached config so new conversations use the updated settings
      await refreshCachedConfig();

      console.log(`[CustomerController] Client ${clientId} updated AI behavior config`);

      res.json({
        success: true,
        message: 'AI behavior settings updated successfully'
      });
    } catch (error) {
      console.error('[CustomerController] Update AI behavior error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to update AI behavior settings',
        message: 'An error occurred while saving your AI settings'
      });
    }
  }

  /**
   * Preview the generated system prompt
   * POST /api/customer/ai-behavior/preview
   */
  async previewAIBehavior(req, res) {
    try {
      const client = req.client;

      // Rate limiting for AI behavior preview
      const rateLimit = await RedisCache.checkRateLimit(client.id, RATE_LIMITS.CUSTOMER_DASHBOARD);
      if (!rateLimit.allowed) {
        log.warn('Rate limit exceeded for customer AI behavior preview', { clientId: client.id });
        return res.status(HTTP_STATUS.RATE_LIMIT_EXCEEDED).json({
          error: 'Rate limit exceeded',
          retryAfter: rateLimit.resetIn
        });
      }

      const { config } = req.body;

      // Use provided config or get current config
      const previewConfig = config || await promptService.getClientConfig(client);
      const prompt = await promptService.buildSystemPrompt(client, previewConfig);

      res.json({ prompt });
    } catch (error) {
      log.error('Preview AI behavior error', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to generate preview',
        message: 'An error occurred while generating the prompt preview'
      });
    }
  }

  /**
   * Reset AI behavior to platform defaults
   * DELETE /api/customer/ai-behavior
   */
  async resetAIBehavior(req, res) {
    try {
      const clientId = req.clientId;

      // Rate limiting for AI behavior reset
      const rateLimit = await RedisCache.checkRateLimit(clientId, RATE_LIMITS.CUSTOMER_DASHBOARD);
      if (!rateLimit.allowed) {
        log.warn('Rate limit exceeded for customer AI behavior reset', { clientId });
        return res.status(HTTP_STATUS.RATE_LIMIT_EXCEEDED).json({
          error: 'Rate limit exceeded',
          retryAfter: rateLimit.resetIn
        });
      }

      // Clear the client's prompt_config
      await Client.updatePromptConfig(clientId, {});

      // Refresh cached config so new conversations use the defaults
      await refreshCachedConfig();

      log.info('Client reset AI behavior to defaults', { clientId });

      // Get the default config to return
      const defaultConfig = await promptService.getDefaultConfig();

      res.json({
        success: true,
        message: 'AI behavior settings reset to defaults',
        config: {
          reasoning_enabled: defaultConfig.reasoning_enabled,
          reasoning_steps: defaultConfig.reasoning_steps || [],
          response_style: defaultConfig.response_style || {},
          tool_rules: defaultConfig.tool_rules || [],
          custom_instructions: null
        }
      });
    } catch (error) {
      log.error('Reset AI behavior error', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to reset AI behavior settings',
        message: 'An error occurred while resetting your AI settings'
      });
    }
  }

  // ==================== Escalations ====================

  /**
   * Get escalations for this client
   * GET /api/customer/escalations
   */
  async getEscalations(req, res) {
    try {
      const clientId = req.clientId;
      const { status, limit = 50, offset = 0 } = req.query;

      // Parse limit and offset to integers (like admin route does)
      const escalations = await Escalation.getByClient(clientId, { 
        status, 
        limit: parseInt(limit, 10), 
        offset: parseInt(offset, 10) 
      });

      // Get pending count for notification badge
      const pendingCount = escalations.filter(e => e.status === 'pending').length;

      res.json({
        escalations: escalations.map(e => ({
          id: e.id,
          conversationId: e.conversation_id,
          sessionId: e.session_id,
          reason: e.reason,
          status: e.status,
          escalatedAt: e.escalated_at,
          acknowledgedAt: e.acknowledged_at,
          resolvedAt: e.resolved_at,
          assignedTo: e.assigned_to,
          notes: e.notes
        })),
        pendingCount
      });
    } catch (error) {
      console.error('[CustomerController] Get escalations error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to load escalations',
        message: 'An error occurred while loading escalations'
      });
    }
  }

  /**
   * Get escalation detail with customer contact info
   * GET /api/customer/escalations/:id
   */
  async getEscalationDetail(req, res) {
    try {
      const clientId = req.clientId;
      const escalationId = req.params.id;

      // Get escalation and verify ownership
      const escalation = await Escalation.findById(escalationId);

      if (!escalation) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          error: 'Escalation not found',
          message: 'The requested escalation could not be found'
        });
      }

      if (escalation.client_id !== clientId) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          error: 'Access denied',
          message: 'You do not have permission to view this escalation'
        });
      }

      // Get conversation details
      const conversation = await Conversation.findById(escalation.conversation_id);

      // Get messages to find customer info
      const messages = await Message.getAll(escalation.conversation_id);

      // Extract customer contact info from various sources
      const customerInfo = this.extractCustomerInfo(conversation, messages);

      // Get the trigger message if available
      let triggerMessage = null;
      if (escalation.trigger_message_id) {
        const triggerMsg = messages.find(m => m.id === escalation.trigger_message_id);
        if (triggerMsg) {
          triggerMessage = {
            content: triggerMsg.content,
            timestamp: triggerMsg.timestamp,
            role: triggerMsg.role
          };
        }
      }

      // Get recent messages for context (last 10)
      const recentMessages = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp
      }));

      res.json({
        escalation: {
          id: escalation.id,
          conversationId: escalation.conversation_id,
          reason: escalation.reason,
          status: escalation.status,
          escalatedAt: escalation.escalated_at,
          acknowledgedAt: escalation.acknowledged_at,
          resolvedAt: escalation.resolved_at,
          assignedTo: escalation.assigned_to,
          notes: escalation.notes
        },
        conversation: {
          id: conversation.id,
          sessionId: conversation.session_id,
          channel: conversation.channel,
          startedAt: conversation.started_at,
          endedAt: conversation.ended_at,
          messageCount: conversation.message_count
        },
        customerInfo,
        triggerMessage,
        recentMessages
      });
    } catch (error) {
      console.error('[CustomerController] Get escalation detail error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to load escalation',
        message: 'An error occurred while loading the escalation details'
      });
    }
  }

  /**
   * Extract customer contact info from conversation and messages
   * @private
   */
  extractCustomerInfo(conversation, messages) {
    const info = {
      email: null,
      phone: null,
      name: null,
      channel: conversation?.channel || 'widget',
      identifier: conversation?.user_identifier || null
    };

    // Extract from channel metadata (email channel has sender info)
    if (conversation?.channel_metadata) {
      const metadata = safeJsonParse(conversation.channel_metadata, null);
      if (metadata) {
        if (metadata.senderEmail) info.email = metadata.senderEmail;
        if (metadata.senderName) info.name = metadata.senderName;
        if (metadata.senderPhone) info.phone = metadata.senderPhone;
        if (metadata.from) info.email = metadata.from;
      }
    }

    // Look through messages for contact info (from tool calls like book_appointment)
    for (const msg of messages) {
      if (msg.metadata) {
        const metadata = safeJsonParse(msg.metadata, null);
        if (!metadata) continue;

        // Check tool calls for customer info
        if (metadata.tool_calls) {
          for (const toolCall of metadata.tool_calls) {
            const args = toolCall.arguments || toolCall.input || {};
            if (args.email && !info.email) info.email = args.email;
            if (args.phone && !info.phone) info.phone = args.phone;
            if (args.name && !info.name) info.name = args.name;
            if (args.customerName && !info.name) info.name = args.customerName;
            if (args.customer_name && !info.name) info.name = args.customer_name;
          }
        }
      }

      // Check channel_metadata on messages too
      if (msg.channel_metadata) {
        const metadata = safeJsonParse(msg.channel_metadata, null);
        if (!metadata) continue;

        if (metadata.from && !info.email) info.email = metadata.from;
        if (metadata.senderEmail && !info.email) info.email = metadata.senderEmail;
      }
    }

    return info;
  }

  /**
   * Acknowledge an escalation
   * POST /api/customer/escalations/:id/acknowledge
   */
  async acknowledgeEscalation(req, res) {
    try {
      const clientId = req.clientId;

      // Rate limiting for escalation actions
      const rateLimit = await RedisCache.checkRateLimit(clientId, RATE_LIMITS.CUSTOMER_DASHBOARD);
      if (!rateLimit.allowed) {
        log.warn('Rate limit exceeded for escalation acknowledge', { clientId });
        return res.status(HTTP_STATUS.RATE_LIMIT_EXCEEDED).json({
          error: 'Rate limit exceeded',
          retryAfter: rateLimit.resetIn
        });
      }

      const escalationId = req.params.id;

      // Verify ownership
      const escalation = await Escalation.findById(escalationId);
      if (!escalation) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Escalation not found' });
      }
      if (escalation.client_id !== clientId) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Access denied' });
      }
      if (escalation.status !== 'pending') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Escalation is not pending' });
      }

      const updated = await Escalation.updateStatus(escalationId, 'acknowledged');

      res.json({
        success: true,
        escalation: {
          id: updated.id,
          status: updated.status,
          acknowledgedAt: updated.acknowledged_at
        }
      });
    } catch (error) {
      console.error('[CustomerController] Acknowledge escalation error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to acknowledge escalation',
        message: 'An error occurred while acknowledging the escalation'
      });
    }
  }

  /**
   * Resolve an escalation
   * POST /api/customer/escalations/:id/resolve
   */
  async resolveEscalation(req, res) {
    try {
      const clientId = req.clientId;

      // Rate limiting for escalation actions
      const rateLimit = await RedisCache.checkRateLimit(clientId, RATE_LIMITS.CUSTOMER_DASHBOARD);
      if (!rateLimit.allowed) {
        log.warn('Rate limit exceeded for escalation resolve', { clientId });
        return res.status(HTTP_STATUS.RATE_LIMIT_EXCEEDED).json({
          error: 'Rate limit exceeded',
          retryAfter: rateLimit.resetIn
        });
      }

      const escalationId = req.params.id;
      const { notes } = req.body;

      // Verify ownership
      const escalation = await Escalation.findById(escalationId);
      if (!escalation) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Escalation not found' });
      }
      if (escalation.client_id !== clientId) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Access denied' });
      }
      if (escalation.status === 'resolved' || escalation.status === 'cancelled') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Escalation is already resolved or cancelled' });
      }

      const updated = await Escalation.updateStatus(escalationId, 'resolved', { notes });

      res.json({
        success: true,
        escalation: {
          id: updated.id,
          status: updated.status,
          resolvedAt: updated.resolved_at,
          notes: updated.notes
        }
      });
    } catch (error) {
      console.error('[CustomerController] Resolve escalation error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to resolve escalation',
        message: 'An error occurred while resolving the escalation'
      });
    }
  }

  /**
   * Get escalation stats summary
   * GET /api/customer/escalations/stats
   */
  async getEscalationStats(req, res) {
    try {
      const clientId = req.clientId;
      const stats = await Escalation.getStats(clientId);

      res.json({
        total: parseInt(stats.total_escalations, 10) || 0,
        pending: parseInt(stats.pending_count, 10) || 0,
        acknowledged: parseInt(stats.acknowledged_count, 10) || 0,
        resolved: parseInt(stats.resolved_count, 10) || 0,
        byReason: {
          userRequested: parseInt(stats.user_requested_count, 10) || 0,
          aiStuck: parseInt(stats.ai_stuck_count, 10) || 0,
          lowConfidence: parseInt(stats.low_confidence_count, 10) || 0
        },
        avgResolutionTimeMinutes: stats.avg_resolution_time_seconds
          ? Math.round(parseFloat(stats.avg_resolution_time_seconds) / 60)
          : null
      });
    } catch (error) {
      console.error('[CustomerController] Escalation stats error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to load escalation stats',
        message: 'An error occurred while loading escalation statistics'
      });
    }
  }

  /**
   * Cancel an escalation
   * POST /api/customer/escalations/:id/cancel
   */
  async cancelEscalation(req, res) {
    try {
      const clientId = req.clientId;

      // Rate limiting for escalation actions
      const rateLimit = await RedisCache.checkRateLimit(clientId, RATE_LIMITS.CUSTOMER_DASHBOARD);
      if (!rateLimit.allowed) {
        log.warn('Rate limit exceeded for escalation cancel', { clientId });
        return res.status(HTTP_STATUS.RATE_LIMIT_EXCEEDED).json({
          error: 'Rate limit exceeded',
          retryAfter: rateLimit.resetIn
        });
      }

      const escalationId = parseInt(req.params.id, 10);

      // Verify escalation belongs to this client
      const escalation = await Escalation.findById(escalationId);

      if (!escalation) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          error: 'Escalation not found',
          message: 'The requested escalation does not exist'
        });
      }

      if (escalation.client_id !== clientId) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          error: 'Access denied',
          message: 'You do not have permission to cancel this escalation'
        });
      }

      if (escalation.status === 'resolved' || escalation.status === 'cancelled') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Invalid action',
          message: `Cannot cancel an escalation that is already ${escalation.status}`
        });
      }

      // Update status to cancelled
      const updated = await Escalation.updateStatus(escalationId, 'cancelled', {
        notes: req.body.notes || 'Cancelled by customer'
      });

      console.log(`[CustomerController] Escalation ${escalationId} cancelled by client ${clientId}`);

      res.json({
        success: true,
        escalation: updated
      });
    } catch (error) {
      console.error('[CustomerController] Cancel escalation error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to cancel escalation',
        message: 'An error occurred while cancelling the escalation'
      });
    }
  }
}

export default new CustomerController();
