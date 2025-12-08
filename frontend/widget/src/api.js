/**
 * API Client for CSAI Chat Widget
 * Handles all communication with the backend API
 */
export class ChatAPI {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Send a message to the AI and get a response
   * @param {string} sessionId - Unique session identifier
   * @param {string} message - User's message
   * @returns {Promise<Object>} Response with AI message and metadata
   */
  async sendMessage(sessionId, message) {
    try {
      const response = await fetch(`${this.baseUrl}/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          sessionId,
          message,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('ChatAPI: Failed to send message', error);
      throw error;
    }
  }

  /**
   * Get conversation history for a session
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Array>} Array of messages
   */
  async getHistory(sessionId) {
    try {
      const response = await fetch(`${this.baseUrl}/chat/history/${sessionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.messages || [];
    } catch (error) {
      console.error('ChatAPI: Failed to get history', error);
      throw error;
    }
  }

  /**
   * End a conversation session
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object>} Confirmation response
   */
  async endSession(sessionId) {
    try {
      const response = await fetch(`${this.baseUrl}/chat/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          sessionId,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('ChatAPI: Failed to end session', error);
      throw error;
    }
  }
}
