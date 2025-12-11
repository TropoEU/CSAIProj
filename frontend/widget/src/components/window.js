import { MessageList } from './messages.js';
import { InputArea } from './input.js';

/**
 * Chat Window Component
 * The main chat interface with header, messages, and input
 */
export class ChatWindow {
  constructor(config, onClose, onSend) {
    this.config = config;
    this.onClose = onClose;
    this.onSend = onSend;
    this.element = this.create();
    this.messageList = new MessageList();
    this.inputArea = new InputArea((message) => this.handleSend(message), config);
    this.isOpen = false;
  }

  /**
   * Create the window element
   * @returns {HTMLElement}
   */
  create() {
    const window = document.createElement('div');
    window.className = 'csai-chat-window csai-hidden';

    const header = this.createHeader();
    window.appendChild(header);

    return window;
  }

  /**
   * Create the window header
   * @returns {HTMLElement}
   */
  createHeader() {
    const header = document.createElement('div');
    header.className = 'csai-window-header';

    const title = this.config.title || 'Chat Support';
    const subtitle = this.config.subtitle || 'We typically reply instantly';

    // Apply header text color if configured
    if (this.config.headerTextColor) {
      header.style.color = this.config.headerTextColor;
    }

    header.innerHTML = `
      <div>
        <div class="csai-header-title">${title}</div>
        <div class="csai-header-subtitle">${subtitle}</div>
      </div>
      <div class="csai-header-actions">
        <button class="csai-header-button csai-close-button" aria-label="Close">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
    `;

    // Apply header background color if configured
    if (this.config.headerBgColor) {
      header.style.backgroundColor = this.config.headerBgColor;
    }

    // Apply button text color to close button (should match send button icon color)
    if (this.config.buttonTextColor) {
      const closeButton = header.querySelector('.csai-close-button svg');
      if (closeButton) {
        closeButton.style.fill = this.config.buttonTextColor;
      }
    }

    // Close button
    const closeBtn = header.querySelector('.csai-close-button');
    closeBtn.addEventListener('click', () => {
      this.close();
      if (this.onClose) {
        this.onClose();
      }
    });

    return header;
  }

  /**
   * Initialize the window with messages and input
   */
  init() {
    this.element.appendChild(this.messageList.getElement());
    this.element.appendChild(this.inputArea.getElement());

    // Show greeting message if no messages
    if (this.messageList.getMessages().length === 0) {
      const greeting = this.config.greeting || 'Hi! How can I help you today?';
      this.messageList.showEmptyState(greeting);
    }
  }

  /**
   * Handle message send
   * @param {string} message - User message
   */
  handleSend(message) {
    if (this.onSend) {
      this.onSend(message);
    }
  }

  /**
   * Open the window
   */
  open() {
    this.element.classList.remove('csai-hidden');
    this.isOpen = true;
    this.inputArea.focus();
  }

  /**
   * Close the window
   */
  close() {
    this.element.classList.add('csai-hidden');
    this.isOpen = false;
  }

  /**
   * Toggle window open/closed
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Add a message to the window
   * @param {Object} message - Message object
   */
  addMessage(message) {
    // If showing empty state, clear it first
    const emptyState = this.element.querySelector('.csai-empty-state');
    if (emptyState) {
      emptyState.remove();
    }

    this.messageList.addMessage(message);
  }

  /**
   * Load messages into the window
   * @param {Array} messages - Array of message objects
   */
  loadMessages(messages) {
    if (messages && messages.length > 0) {
      this.messageList.loadMessages(messages);
    } else {
      const greeting = this.config.greeting || 'Hi! How can I help you today?';
      this.messageList.showEmptyState(greeting);
    }
  }

  /**
   * Show typing indicator
   */
  showTyping() {
    this.messageList.showTyping();
  }

  /**
   * Hide typing indicator
   */
  hideTyping() {
    this.messageList.hideTyping();
  }

  /**
   * Show error message
   * @param {string} message - Error message
   * @param {Function} onRetry - Retry callback
   */
  showError(message, onRetry) {
    this.messageList.showError(message, onRetry);
  }

  /**
   * Disable input
   */
  disableInput() {
    this.inputArea.disable();
  }

  /**
   * Enable input
   */
  enableInput() {
    this.inputArea.enable();
  }

  /**
   * Get the window element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }

  /**
   * Get all messages
   * @returns {Array}
   */
  getMessages() {
    return this.messageList.getMessages();
  }
}
