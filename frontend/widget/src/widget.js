import { ChatAPI } from './api.js';
import { WidgetStorage } from './storage.js';
import { ChatBubble } from './components/bubble.js';
import { ChatWindow } from './components/window.js';
import styles from './styles.css?inline';

/**
 * Main Chat Widget Class
 * Manages the entire widget lifecycle and state
 */
export class ChatWidget {
  constructor(config) {
    this.config = this.parseConfig(config);
    this.api = new ChatAPI(this.config.apiKey, this.config.apiUrl);
    this.storage = new WidgetStorage();
    this.sessionId = this.storage.getSessionId();
    this.container = null;
    this.shadowRoot = null;
    this.bubble = null;
    this.window = null;
    this.pendingMessage = null;

    this.init();
  }

  /**
   * Parse and validate configuration
   * @param {Object} config - Widget configuration
   * @returns {Object} Parsed configuration
   */
  parseConfig(config) {
    if (!config.apiKey) {
      throw new Error('ChatWidget: apiKey is required');
    }

    return {
      apiKey: config.apiKey,
      apiUrl: config.apiUrl || 'http://localhost:3000',
      position: config.position || 'bottom-right',
      primaryColor: config.primaryColor || '#0066cc',
      greeting: config.greeting || 'Hi! How can I help you today?',
      title: config.title || 'Chat Support',
      subtitle: config.subtitle || 'We typically reply instantly',
      ...config,
    };
  }

  /**
   * Initialize the widget
   */
  init() {
    this.createContainer();
    this.createShadowDOM();
    this.injectStyles();
    this.createComponents();
    this.loadHistory();
    this.attachToDOM();

    console.log('ChatWidget: Initialized', {
      sessionId: this.sessionId,
      config: this.config,
    });
  }

  /**
   * Create the main container element
   */
  createContainer() {
    this.container = document.createElement('div');
    this.container.className = `csai-widget-container position-${this.config.position}`;
  }

  /**
   * Create Shadow DOM for style encapsulation
   */
  createShadowDOM() {
    this.shadowRoot = this.container.attachShadow({ mode: 'open' });
  }

  /**
   * Inject CSS styles into Shadow DOM
   */
  injectStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = styles;

    // Apply custom primary color
    if (this.config.primaryColor) {
      styleElement.textContent += `
        :host {
          --primary-color: ${this.config.primaryColor};
          --primary-hover: ${this.adjustColor(this.config.primaryColor, -20)};
          --user-message-bg: ${this.config.primaryColor};
        }
      `;
    }

    this.shadowRoot.appendChild(styleElement);
  }

  /**
   * Adjust color brightness
   * @param {string} color - Hex color
   * @param {number} amount - Amount to adjust (-255 to 255)
   * @returns {string} Adjusted hex color
   */
  adjustColor(color, amount) {
    const clamp = (val) => Math.min(Math.max(val, 0), 255);
    const num = parseInt(color.replace('#', ''), 16);
    const r = clamp((num >> 16) + amount);
    const g = clamp(((num >> 8) & 0x00ff) + amount);
    const b = clamp((num & 0x0000ff) + amount);
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  }

  /**
   * Create widget components
   */
  createComponents() {
    // Create chat bubble
    this.bubble = new ChatBubble(() => this.toggleWindow());

    // Create chat window
    this.window = new ChatWindow(
      this.config,
      () => this.handleClose(),
      (message) => this.handleSend(message)
    );

    // Append components to shadow DOM
    this.shadowRoot.appendChild(this.bubble.getElement());
    this.shadowRoot.appendChild(this.window.getElement());

    // Initialize window
    this.window.init();
  }

  /**
   * Load conversation history
   */
  async loadHistory() {
    try {
      // First try to load from localStorage
      const cachedMessages = this.storage.getMessages();
      if (cachedMessages && cachedMessages.length > 0) {
        // Filter out system messages from cache (safety check)
        const filteredMessages = cachedMessages.filter(msg => 
          msg.role === 'user' || msg.role === 'assistant'
        );
        if (filteredMessages.length > 0) {
          this.window.loadMessages(filteredMessages);
          return;
        }
      }

      // If no cached messages, try to fetch from API
      const messages = await this.api.getHistory(this.sessionId);
      if (messages && messages.length > 0) {
        // Filter out system and tool messages (safety check)
        const filteredMessages = messages.filter(msg => 
          msg.role === 'user' || msg.role === 'assistant'
        );
        
        // Convert API format to widget format
        const formattedMessages = filteredMessages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.created_at),
        }));

        this.window.loadMessages(formattedMessages);
        this.storage.saveMessages(formattedMessages);
      } else {
        // No messages from API - show empty state with greeting
        this.window.loadMessages([]);
      }
    } catch (error) {
      console.error('ChatWidget: Failed to load history', error);
      // Show empty state if history load fails
      this.window.loadMessages([]);
    }
  }

  /**
   * Attach widget to the DOM
   */
  attachToDOM() {
    document.body.appendChild(this.container);

    // Restore widget state from storage
    const shouldBeOpen = this.storage.getWidgetState();
    if (shouldBeOpen) {
      this.window.open();
    }
  }

  /**
   * Toggle window open/closed
   */
  toggleWindow() {
    this.window.toggle();
    this.storage.setWidgetState(this.window.isOpen);

    // Clear unread count when opening
    if (this.window.isOpen) {
      this.bubble.setUnreadCount(0);
      this.storage.setUnreadCount(0);
    }
  }

  /**
   * Handle window close
   */
  handleClose() {
    this.storage.setWidgetState(false);
  }

  /**
   * Handle sending a message
   * @param {string} messageText - User's message
   */
  async handleSend(messageText) {
    // Add user message to UI
    const userMessage = {
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    this.window.addMessage(userMessage);

    // Save to storage
    const allMessages = this.window.getMessages();
    this.storage.saveMessages(allMessages);

    // Disable input and show typing
    this.window.disableInput();
    this.window.showTyping();

    // Store pending message for retry
    this.pendingMessage = messageText;

    try {
      // Send to API
      const response = await this.api.sendMessage(this.sessionId, messageText);

      // Hide typing indicator
      this.window.hideTyping();

      // Add AI response to UI
      const aiMessage = {
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
      };

      this.window.addMessage(aiMessage);

      // Save to storage
      const updatedMessages = this.window.getMessages();
      this.storage.saveMessages(updatedMessages);

      // If window is closed, increment unread count
      if (!this.window.isOpen) {
        const currentUnread = this.storage.getUnreadCount();
        const newUnread = currentUnread + 1;
        this.bubble.setUnreadCount(newUnread);
        this.storage.setUnreadCount(newUnread);
      }

      // Clear pending message
      this.pendingMessage = null;

    } catch (error) {
      console.error('ChatWidget: Failed to send message', error);

      // Hide typing indicator
      this.window.hideTyping();

      // Show error with retry option
      this.window.showError(
        'Failed to send message. Please try again.',
        () => this.retryLastMessage()
      );
    } finally {
      // Re-enable input
      this.window.enableInput();
    }
  }

  /**
   * Retry the last failed message
   */
  retryLastMessage() {
    if (this.pendingMessage) {
      this.handleSend(this.pendingMessage);
    }
  }

  /**
   * Public API: Open the widget
   */
  open() {
    if (!this.window.isOpen) {
      this.toggleWindow();
    }
  }

  /**
   * Public API: Close the widget
   */
  close() {
    if (this.window.isOpen) {
      this.toggleWindow();
    }
  }

  /**
   * Public API: Clear conversation history
   */
  clearHistory() {
    this.storage.clearAll();
    this.sessionId = this.storage.getSessionId();
    this.window.loadMessages([]);
  }

  /**
   * Public API: Destroy the widget
   */
  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
