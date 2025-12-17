import { Escalation } from '../models/Escalation.js';
import { Client } from '../models/Client.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { getEscalationMessage } from '../prompts/systemPrompt.js';
// Logger not needed - using console.log/console.error directly

/**
 * Escalation Service
 *
 * Handles human escalation requests, detection, and notifications
 */
class EscalationService {
  /**
   * Escalate a conversation to a human agent
   * @param {number} conversationId - Conversation ID
   * @param {string} reason - Escalation reason
   * @param {number} triggerMessageId - Optional message that triggered escalation
   * @returns {object} Escalation record
   */
  async escalate(conversationId, reason, triggerMessageId = null) {
    try {
      // Get conversation and client info
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const client = await Client.findById(conversation.client_id);
      if (!client) {
        throw new Error('Client not found');
      }

      // Check if already escalated
      const existingEscalation = await Escalation.hasActiveEscalation(conversationId);
      if (existingEscalation) {
        console.log(`[Escalation] Conversation ${conversationId} already escalated`);
        return await Escalation.findByConversation(conversationId);
      }

      // Get escalation config
      const escalationConfig = client.escalation_config || {};

      // Check if escalations are enabled
      if (escalationConfig.enabled === false) {
        console.log(`[Escalation] Escalations disabled for client ${client.id}`);
        return null;
      }

      // Create escalation record
      const escalation = await Escalation.create(
        conversationId,
        client.id,
        reason,
        triggerMessageId
      );

      console.log(`[Escalation] Created escalation ${escalation.id} for conversation ${conversationId}, reason: ${reason}`);

      // Send notifications
      await this.sendNotifications(escalation, client, conversation);

      // Note: Conversation status is tracked via escalations table, no need to update conversations table

      return escalation;
    } catch (error) {
      console.error(`[Escalation] Error escalating conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Send escalation notifications to configured channels
   * @param {object} escalation - Escalation record
   * @param {object} client - Client record
   * @param {object} conversation - Conversation record
   */
  async sendNotifications(escalation, client, conversation) {
    const escalationConfig = client.escalation_config || {};
    const notificationMethod = escalationConfig.notification_method || 'email';

    console.log(`[Escalation] Sending ${notificationMethod} notification for escalation ${escalation.id}`);

    try {
      if (notificationMethod === 'email' || notificationMethod === 'both') {
        await this.sendEmailNotification(escalation, client, conversation, escalationConfig);
      }

      if (notificationMethod === 'whatsapp' || notificationMethod === 'both') {
        await this.sendWhatsAppNotification(escalation, client, conversation, escalationConfig);
      }

      if (notificationMethod === 'sms') {
        await this.sendSMSNotification(escalation, client, conversation, escalationConfig);
      }
    } catch (error) {
      console.error(`[Escalation] Error sending notifications for escalation ${escalation.id}:`, error);
      // Don't throw - escalation is created even if notification fails
    }
  }

  /**
   * Send email notification (placeholder - will be implemented with Gmail integration)
   */
  async sendEmailNotification(escalation, client, conversation, config) {
    const email = config.notification_email || client.email;

    if (!email) {
      console.warn(`[Escalation] No notification email configured for client ${client.id}`);
      return;
    }

    console.log(`[Escalation] Sending email notification to ${email}`);

    // TODO: Implement actual email sending when Gmail integration is ready
    // For now, just log
    const emailContent = this.buildNotificationMessage(escalation, client, conversation);

    console.log(`[Escalation] Email notification content:`, {
      to: email,
      subject: `Customer Needs Help - ${client.name}`,
      body: emailContent
    });

    // Note: Escalation remains in 'pending' status until manually acknowledged
    // Email sending will be implemented with Gmail integration in Phase 9
  }

  /**
   * Send WhatsApp notification (placeholder - will be implemented with WhatsApp integration)
   */
  async sendWhatsAppNotification(escalation, client, conversation, config) {
    const phone = config.notification_phone;

    if (!phone) {
      console.warn(`[Escalation] No notification phone configured for client ${client.id}`);
      return;
    }

    console.log(`[Escalation] Sending WhatsApp notification to ${phone}`);

    // TODO: Implement actual WhatsApp sending when integration is ready
    const message = this.buildNotificationMessage(escalation, client, conversation, true);

    console.log(`[Escalation] WhatsApp notification content:`, {
      to: phone,
      message
    });
  }

  /**
   * Send SMS notification (placeholder - will be implemented with Twilio integration)
   */
  async sendSMSNotification(escalation, client, conversation, config) {
    const phone = config.notification_phone;

    if (!phone) {
      console.warn(`[Escalation] No notification phone configured for client ${client.id}`);
      return;
    }

    console.log(`[Escalation] Sending SMS notification to ${phone}`);

    // TODO: Implement actual SMS sending with Twilio
    const message = this.buildNotificationMessage(escalation, client, conversation, true);

    console.log(`[Escalation] SMS notification content:`, {
      to: phone,
      message
    });
  }

  /**
   * Build notification message content
   * @param {boolean} short - Whether to use short format (for SMS/WhatsApp)
   */
  buildNotificationMessage(escalation, client, conversation, short = false) {
    const reasonText = {
      user_requested: 'Customer requested human assistance',
      ai_stuck: 'AI unable to help customer',
      low_confidence: 'AI confidence too low',
      explicit_trigger: 'Explicit escalation trigger'
    };

    const reason = reasonText[escalation.reason] || 'Unknown reason';

    if (short) {
      // Short format for SMS/WhatsApp
      return `🚨 ${client.name}: ${reason}. Session: ${conversation.session_id}. View: ${process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3002'}/conversations/${conversation.id}`;
    }

    // Long format for email
    return `
Customer Support Escalation - ${client.name}

A customer conversation needs your attention.

Reason: ${reason}
Conversation ID: ${conversation.session_id}
Escalated at: ${new Date(escalation.escalated_at).toLocaleString()}
Channel: ${conversation.channel || 'widget'}

View conversation:
${process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3002'}/conversations/${conversation.id}

Please respond to the customer as soon as possible.

---
This is an automated notification from your AI Customer Service platform.
    `.trim();
  }

  /**
   * Detect if AI is stuck (repeated clarifications, similar responses)
   * @param {array} messages - Recent conversation messages
   * @returns {boolean} True if AI appears stuck
   */
  detectStuck(messages) {
    if (!messages || messages.length < 4) {
      return false;
    }

    // Look at last 6 messages (3 exchanges)
    const recentMessages = messages.slice(-6);
    const aiMessages = recentMessages.filter(m => m.role === 'assistant');

    if (aiMessages.length < 3) {
      return false;
    }

    // Check for repeated clarification patterns
    const clarificationPhrases = [
      'could you clarify',
      'can you provide more',
      'need more information',
      'could you tell me more',
      'what do you mean',
      'לתת פרטים נוספים', // Hebrew: "give more details"
      'אפשר להבהיר', // Hebrew: "could you clarify"
      'צריך יותר מידע' // Hebrew: "need more information"
    ];

    let clarificationCount = 0;
    for (const msg of aiMessages) {
      const content = msg.content.toLowerCase();
      if (clarificationPhrases.some(phrase => content.includes(phrase))) {
        clarificationCount++;
      }
    }

    // If 2+ out of last 3 AI messages are asking for clarification, consider it stuck
    return clarificationCount >= 2;
  }

  /**
   * Detect explicit escalation requests in user message
   * @param {string} message - User message content
   * @param {string} language - Language code (en, he)
   * @returns {boolean} True if user explicitly requested human help
   */
  detectExplicitRequest(message, language = 'en') {
    const lowerMessage = message.toLowerCase();

    const englishTriggers = [
      'talk to a human',
      'talk to human',
      'speak to a person',
      'speak to a human',
      'speak with a human',
      'speak with a person',
      'talk with a human',
      'talk with a person',
      'human agent',
      'real person',
      'customer service',
      'speak to someone',
      'talk to someone',
      'speak with someone',
      'talk with someone',
      'human support',
      'human help',
      'contact support',
      'need a human',
      'want a human',
      'get a human',
      'connect me to',
      'transfer me to'
    ];

    const hebrewTriggers = [
      'דבר עם אדם',
      'דבר לאדם',
      'דבר עם נציג',
      'לדבר עם אדם',
      'לדבר לאדם',
      'נציג אנושי',
      'אדם אמיתי',
      'שירות לקוחות',
      'לדבר עם מישהו',
      'דבר עם מישהו',
      'לדבר למישהו',
      'צור קשר',
      'צריך אדם',
      'רוצה אדם',
      'רוצה לדבר עם',
      'צריך לדבר עם',
      'העבר אותי ל',
      'חבר אותי ל',
      'תעביר אותי',
      'אדם בבקשה',
      'עזרה מאדם',
      'תמיכה אנושית'
    ];

    const triggers = language === 'he' ? hebrewTriggers : englishTriggers;

    return triggers.some(trigger => lowerMessage.includes(trigger));
  }

  /**
   * Auto-detect if conversation should be escalated
   * @param {number} conversationId - Conversation ID
   * @param {string} userMessage - Latest user message
   * @param {string} language - Language code
   * @returns {object|null} Escalation if created, null otherwise
   */
  async autoDetect(conversationId, userMessage, language = 'en') {
    try {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return null;
      }

      const client = await Client.findById(conversation.client_id);
      if (!client) {
        return null;
      }

      const escalationConfig = client.escalation_config || {};

      // Check if auto-detection is enabled
      if (!escalationConfig.enabled || !escalationConfig.auto_detect_stuck) {
        return null;
      }

      // Check for explicit user request
      if (this.detectExplicitRequest(userMessage, language)) {
        console.log(`[Escalation] Explicit escalation request detected in conversation ${conversationId}`);
        return await this.escalate(conversationId, 'user_requested');
      }

      // Check if AI is stuck
      const messages = await Message.getAll(conversationId);
      if (this.detectStuck(messages)) {
        console.log(`[Escalation] AI stuck detected in conversation ${conversationId}`);
        return await this.escalate(conversationId, 'ai_stuck');
      }

      return null;
    } catch (error) {
      console.error(`[Escalation] Error in auto-detect for conversation ${conversationId}:`, error);
      return null;
    }
  }

  /**
   * Resolve an escalation
   * @param {number} escalationId - Escalation ID
   * @param {string} notes - Resolution notes
   */
  async resolve(escalationId, notes = null) {
    try {
      const escalation = await Escalation.updateStatus(escalationId, 'resolved', { notes });

      // Note: Conversation status is tracked via escalations table
      if (escalation) {
        console.log(`[Escalation] Resolved escalation ${escalationId}`);
      }

      return escalation;
    } catch (error) {
      console.error(`[Escalation] Error resolving escalation ${escalationId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel an escalation
   * @param {number} escalationId - Escalation ID
   */
  async cancel(escalationId) {
    try {
      const escalation = await Escalation.updateStatus(escalationId, 'cancelled');

      // Note: Conversation status is tracked via escalations table
      if (escalation) {
        console.log(`[Escalation] Cancelled escalation ${escalationId}`);
      }

      return escalation;
    } catch (error) {
      console.error(`[Escalation] Error cancelling escalation ${escalationId}:`, error);
      throw error;
    }
  }

  /**
   * Get escalation statistics for dashboard
   */
  async getGlobalStats() {
    try {
      const query = `
        SELECT
          COUNT(*) as total_escalations,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
          COUNT(CASE WHEN status = 'acknowledged' THEN 1 END) as acknowledged_count,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
          COUNT(CASE WHEN DATE(escalated_at) = CURRENT_DATE THEN 1 END) as today_count,
          AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - escalated_at))) as avg_resolution_time_seconds
        FROM escalations
        WHERE escalated_at > NOW() - INTERVAL '30 days'
      `;

      const { db } = await import('../db.js');
      const result = await db.query(query);
      return result.rows[0];
    } catch (error) {
      console.error('[Escalation] Error getting global stats:', error);
      throw error;
    }
  }
}

export default new EscalationService();
