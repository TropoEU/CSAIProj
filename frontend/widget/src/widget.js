import { ChatAPI } from './api.js';
import { WidgetStorage } from './storage.js';
import { ChatBubble } from './components/bubble.js';
import { ChatWindow } from './components/window.js';
import { isRTL, getTranslations } from './i18n/translations.js';
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
    this.endedSessionId = null; // Track ended session ID to clear on next message
    this.language = 'en'; // Default language
    this.translations = getTranslations('en');

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
      // API URL priority: config.apiUrl (from data attribute) > VITE_API_URL (build time) > localhost (dev)
      apiUrl: config.apiUrl || import.meta.env.VITE_API_URL || 'http://localhost:3000',
      position: config.position || 'bottom-right',
      primaryColor: config.primaryColor || '#667eea',
      backgroundColor: config.backgroundColor || '#ffffff',
      headerBgColor: config.headerBgColor || config.primaryColor || '#667eea',
      bodyBgColor: config.bodyBgColor || config.backgroundColor || '#ffffff',
      footerBgColor: config.footerBgColor || config.backgroundColor || '#ffffff',
      aiBubbleColor: config.aiBubbleColor || '#f3f4f6',
      userBubbleColor: config.userBubbleColor || '#667eea',
      headerTextColor: config.headerTextColor || '#111827',
      aiTextColor: config.aiTextColor || '#111827',
      userTextColor: config.userTextColor || '#ffffff',
      inputBgColor: config.inputBgColor || '#f9fafb',
      inputTextColor: config.inputTextColor || '#111827',
      buttonTextColor: config.buttonTextColor || '#ffffff',
      greeting: config.greeting || 'Hi! How can I help you today?',
      title: config.title || 'Chat Support',
      subtitle: config.subtitle || 'We typically reply instantly',
      ...config,
    };
  }

  /**
   * Initialize the widget
   */
  async init() {
    // Fetch server config to get language preference
    await this.loadServerConfig();

    this.createContainer();
    this.createShadowDOM();
    this.injectStyles();
    this.createComponents();
    this.loadHistory();
    this.attachToDOM();

    console.log('ChatWidget: Initialized', {
      sessionId: this.sessionId,
      config: this.config,
      language: this.language,
    });
  }

  /**
   * Load configuration from server (including language preference)
   */
  async loadServerConfig() {
    try {
      const serverConfig = await this.api.getConfig();

      // Set language from server
      if (serverConfig.language) {
        this.language = serverConfig.language;
        this.translations = getTranslations(this.language);

        // Update config with translated defaults if not already set
        if (!this.config.title || this.config.title === 'Chat Support') {
          this.config.title = this.translations.title;
        }
        if (!this.config.subtitle || this.config.subtitle === 'We typically reply instantly') {
          this.config.subtitle = this.translations.subtitle;
        }
        if (!this.config.greeting || this.config.greeting === 'Hi! How can I help you today?') {
          this.config.greeting = this.translations.greeting;
        }
      }

      console.log('ChatWidget: Loaded server config', { language: this.language });
    } catch (error) {
      console.warn('ChatWidget: Could not load server config, using defaults', error);
    }
  }

  /**
   * Create the main container element
   */
  createContainer() {
    this.container = document.createElement('div');
    const rtlClass = isRTL(this.language) ? ' rtl' : '';
    this.container.className = `csai-widget-container position-${this.config.position}${rtlClass}`;
    // Ensure container is fixed and doesn't scroll with page
    this.container.style.position = 'fixed';
    this.container.style.zIndex = '999999';

    // Set direction attribute for RTL support
    if (isRTL(this.language)) {
      this.container.setAttribute('dir', 'rtl');
    }

    // Explicitly set positioning to ensure it works (CSS classes should handle this, but this is a fallback)
    const position = this.config.position || 'bottom-right';
    if (position.includes('bottom')) {
      this.container.style.bottom = '20px';
      this.container.style.top = 'auto';
    } else {
      this.container.style.top = '20px';
      this.container.style.bottom = 'auto';
    }
    if (position.includes('right')) {
      this.container.style.right = '20px';
      this.container.style.left = 'auto';
    } else {
      this.container.style.left = '20px';
      this.container.style.right = 'auto';
    }
  }

  /**
   * Create Shadow DOM for style encapsulation
   */
  createShadowDOM() {
    this.shadowRoot = this.container.attachShadow({ mode: 'open', delegatesFocus: true });
  }

  /**
   * Inject CSS styles into Shadow DOM
   */
  injectStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = styles;

    // Apply all custom colors as CSS variables
    styleElement.textContent += `
      :host {
        --primary-color: ${this.config.primaryColor};
        --primary-hover: ${this.adjustColor(this.config.primaryColor, -20)};
        --background: ${this.config.bodyBgColor};
        --header-bg: ${this.config.headerBgColor};
        --footer-bg: ${this.config.footerBgColor};
        --user-message-bg: ${this.config.userBubbleColor};
        --user-message-text: ${this.config.userTextColor};
        --ai-message-bg: ${this.config.aiBubbleColor};
        --ai-message-text: ${this.config.aiTextColor};
      }
    `;

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
    // Add language and translations to config for components
    const componentConfig = {
      ...this.config,
      language: this.language,
      translations: this.translations,
      isRTL: isRTL(this.language)
    };

    // Create chat bubble
    this.bubble = new ChatBubble(() => this.toggleWindow(), componentConfig);

    // Create chat window
    this.window = new ChatWindow(
      componentConfig,
      () => this.handleClose(),
      (message) => this.handleSend(message),
      () => this.handleEndConversation()
    );

    // Append components to shadow DOM
    this.shadowRoot.appendChild(this.bubble.getElement());
    this.shadowRoot.appendChild(this.window.getElement());

    // Initialize window
    this.window.init();

    // Show bubble when window is closed, hide when open
    this.updateBubbleVisibility();
  }

  /**
   * Start a new conversation session
   * Clears old session data and generates a new session ID
   */
  startNewSession() {
    console.log('ChatWidget: Starting new conversation session');
    // Generate new session ID
    this.sessionId = this.storage.generateSessionId();
    this.storage.set('sessionId', this.sessionId);
    // Clear cached messages
    this.storage.saveMessages([]);
    // Clear window messages
    this.window.loadMessages([]);
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
          // Still check with API to see if conversation ended
          // (but don't wait for it - show cached messages immediately)
          this.checkConversationStatus();
          return;
        }
      }

      // If no cached messages, try to fetch from API
      const historyData = await this.api.getHistory(this.sessionId);
      
      // Check if conversation has ended
      if (historyData.conversationEnded) {
        console.log('ChatWidget: Previous conversation has ended, starting new session');
        this.startNewSession();
        // Show empty state with greeting for new conversation
        this.window.loadMessages([]);
        return;
      }

      const messages = historyData.messages || [];
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
   * Check conversation status (if it has ended)
   * Called asynchronously to verify cached messages are still valid
   */
  async checkConversationStatus() {
    try {
      const historyData = await this.api.getHistory(this.sessionId);
      if (historyData.conversationEnded) {
        console.log('ChatWidget: Conversation has ended, starting new session');
        this.startNewSession();
      }
    } catch (error) {
      // Silently fail - this is just a background check
      console.debug('ChatWidget: Failed to check conversation status', error);
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
    this.updateBubbleVisibility();
  }

  /**
   * Toggle window open/closed
   */
  toggleWindow() {
    this.window.toggle();
    this.storage.setWidgetState(this.window.isOpen);
    this.updateBubbleVisibility();

    // Clear unread count when opening
    if (this.window.isOpen) {
      this.bubble.setUnreadCount(0);
      this.storage.setUnreadCount(0);
    }
  }

  /**
   * Update bubble visibility based on window state
   */
  updateBubbleVisibility() {
    if (this.bubble && this.window) {
      // Show bubble when window is closed, hide when open
      if (this.window.isOpen) {
        this.bubble.getElement().style.display = 'none';
      } else {
        this.bubble.getElement().style.display = 'flex';
      }
    }
  }

  /**
   * Handle window close
   */
  handleClose() {
    this.storage.setWidgetState(false);
    this.updateBubbleVisibility();
  }

  /**
   * Mark conversation as ended visually
   */
  markConversationEnded() {
    // Mark all existing messages as ended (gray them out)
    this.window.markConversationEnded();
    // Don't clear messages - just mark them as ended
  }

  /**
   * Handle ending conversation
   */
  async handleEndConversation() {
    try {
      await this.api.endSession(this.sessionId);
      console.log('ChatWidget: Conversation ended successfully');
      
      // Mark conversation as ended visually
      this.markConversationEnded();
      
      // Start a new session for future messages (but don't clear current messages)
      const oldSessionId = this.sessionId;
      this.sessionId = this.storage.generateSessionId();
      this.storage.set('sessionId', this.sessionId);
      this.endedSessionId = oldSessionId;
      
      // Show a message to the user
      const endMessage = {
        role: 'assistant',
        content: this.translations.conversationEnded || 'Conversation ended. How can I help you today?',
        timestamp: new Date(),
      };
      this.window.addMessage(endMessage);
      this.storage.saveMessages(this.window.getMessages());
    } catch (error) {
      console.error('ChatWidget: Failed to end conversation', error);
      // Still mark as ended and start new session even if API call fails
      this.markConversationEnded();
      const oldSessionId = this.sessionId;
      this.sessionId = this.storage.generateSessionId();
      this.storage.set('sessionId', this.sessionId);
      this.endedSessionId = oldSessionId;
    }
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

      // Check if conversation was ended automatically
      if (response.conversationEnded) {
        console.log('ChatWidget: Conversation ended automatically by AI');
        // Mark conversation as ended visually (gray out old messages)
        this.markConversationEnded();
        // Start a new session for future messages (but don't clear current messages)
        // Only clear when user sends a new message
        const oldSessionId = this.sessionId;
        this.sessionId = this.storage.generateSessionId();
        this.storage.set('sessionId', this.sessionId);
        // Store old session ID so we can clear it when user sends next message
        this.endedSessionId = oldSessionId;
      }

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

      // Check if error indicates conversation ended (e.g., 404 or specific error message)
      // If so, start a new session and retry
      const errorMessage = error.message?.toLowerCase() || '';
      if (errorMessage.includes('conversation ended') || errorMessage.includes('not found') || errorMessage.includes('404')) {
        console.log('ChatWidget: Conversation appears to have ended, starting new session and retrying');
        this.startNewSession();
        // Retry sending the message with new session
        try {
          const retryResponse = await this.api.sendMessage(this.sessionId, messageText);
          const aiMessage = {
            role: 'assistant',
            content: retryResponse.response,
            timestamp: new Date(),
          };
          this.window.addMessage(aiMessage);
          const updatedMessages = this.window.getMessages();
          this.storage.saveMessages(updatedMessages);
          this.pendingMessage = null;
          return;
        } catch (retryError) {
          console.error('ChatWidget: Retry after new session also failed', retryError);
        }
      }

      // Show error with retry option
      const errorMsg = this.translations.errorSend || 'Failed to send message. Please try again.';
      this.window.showError(
        errorMsg,
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
    this.startNewSession();
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
