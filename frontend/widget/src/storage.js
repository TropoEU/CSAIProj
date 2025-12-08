/**
 * Storage wrapper for managing widget state in localStorage
 * Handles session persistence, message history, and widget state
 */
export class WidgetStorage {
  constructor(prefix = 'csai_widget') {
    this.prefix = prefix;
    this.isAvailable = this.checkAvailability();
  }

  /**
   * Check if localStorage is available
   * @returns {boolean}
   */
  checkAvailability() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      console.warn('WidgetStorage: localStorage is not available', e);
      return false;
    }
  }

  /**
   * Generate a unique session ID
   * @returns {string}
   */
  generateSessionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `session_${timestamp}_${random}`;
  }

  /**
   * Get or create a session ID
   * @returns {string}
   */
  getSessionId() {
    let sessionId = this.get('sessionId');
    if (!sessionId) {
      sessionId = this.generateSessionId();
      this.set('sessionId', sessionId);
    }
    return sessionId;
  }

  /**
   * Get a value from localStorage
   * @param {string} key - Storage key
   * @returns {any} Parsed value or null
   */
  get(key) {
    if (!this.isAvailable) return null;

    try {
      const fullKey = `${this.prefix}_${key}`;
      const value = localStorage.getItem(fullKey);
      return value ? JSON.parse(value) : null;
    } catch (e) {
      console.error(`WidgetStorage: Failed to get ${key}`, e);
      return null;
    }
  }

  /**
   * Set a value in localStorage
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   */
  set(key, value) {
    if (!this.isAvailable) return;

    try {
      const fullKey = `${this.prefix}_${key}`;
      localStorage.setItem(fullKey, JSON.stringify(value));
    } catch (e) {
      console.error(`WidgetStorage: Failed to set ${key}`, e);
    }
  }

  /**
   * Remove a value from localStorage
   * @param {string} key - Storage key
   */
  remove(key) {
    if (!this.isAvailable) return;

    try {
      const fullKey = `${this.prefix}_${key}`;
      localStorage.removeItem(fullKey);
    } catch (e) {
      console.error(`WidgetStorage: Failed to remove ${key}`, e);
    }
  }

  /**
   * Save conversation messages (keep last 20)
   * @param {Array} messages - Array of message objects
   */
  saveMessages(messages) {
    const recentMessages = messages.slice(-20);
    this.set('messages', recentMessages);
  }

  /**
   * Get saved conversation messages
   * @returns {Array} Array of message objects
   */
  getMessages() {
    return this.get('messages') || [];
  }

  /**
   * Save widget state (open/closed)
   * @param {boolean} isOpen - Whether widget is open
   */
  setWidgetState(isOpen) {
    this.set('widgetOpen', isOpen);
  }

  /**
   * Get widget state
   * @returns {boolean} Whether widget should be open
   */
  getWidgetState() {
    return this.get('widgetOpen') || false;
  }

  /**
   * Save unread message count
   * @param {number} count - Number of unread messages
   */
  setUnreadCount(count) {
    this.set('unreadCount', count);
  }

  /**
   * Get unread message count
   * @returns {number}
   */
  getUnreadCount() {
    return this.get('unreadCount') || 0;
  }

  /**
   * Clear all widget data
   */
  clearAll() {
    if (!this.isAvailable) return;

    const keys = ['sessionId', 'messages', 'widgetOpen', 'unreadCount'];
    keys.forEach(key => this.remove(key));
  }
}
