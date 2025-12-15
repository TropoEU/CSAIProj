/**
 * Messages Component
 * Displays the list of conversation messages
 */
export class MessageList {
  constructor() {
    this.element = this.create();
    this.messages = [];
  }

  /**
   * Create the messages container
   * @returns {HTMLElement}
   */
  create() {
    const container = document.createElement('div');
    container.className = 'csai-messages';
    return container;
  }

  /**
   * Add a message to the list
   * @param {Object} message - Message object
   * @param {string} message.role - 'user' or 'assistant'
   * @param {string} message.content - Message text
   * @param {Date} message.timestamp - Message timestamp
   * @param {Boolean} isEnded - Whether conversation has ended
   */
  addMessage(message, isEnded = false) {
    this.messages.push(message);

    const messageEl = this.createMessageElement(message, isEnded);
    this.element.appendChild(messageEl);

    this.scrollToBottom();
  }

  /**
   * Create a message element
   * @param {Object} message - Message object
   * @param {Boolean} isEnded - Whether conversation has ended (for styling)
   * @returns {HTMLElement}
   */
  createMessageElement(message, isEnded = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `csai-message ${message.role === 'user' ? 'user' : 'ai'}`;
    
    // Add ended class if conversation has ended
    if (isEnded || message.isEnded) {
      messageDiv.classList.add('csai-ended');
    }

    const bubble = document.createElement('div');
    bubble.className = 'csai-message-bubble';
    bubble.textContent = message.content;

    const time = document.createElement('div');
    time.className = 'csai-message-time';
    time.textContent = this.formatTime(message.timestamp);

    messageDiv.appendChild(bubble);
    messageDiv.appendChild(time);

    return messageDiv;
  }

  /**
   * Mark all messages as ended (gray them out)
   */
  markAsEnded() {
    const messages = this.element.querySelectorAll('.csai-message');
    messages.forEach(msg => {
      msg.classList.add('csai-ended');
    });
  }

  /**
   * Format timestamp to readable time
   * @param {Date|string} timestamp
   * @returns {string}
   */
  formatTime(timestamp) {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Show typing indicator
   */
  showTyping() {
    this.hideTyping(); // Remove any existing typing indicator

    const typing = document.createElement('div');
    typing.className = 'csai-message ai';
    typing.setAttribute('data-typing', 'true');

    const indicator = document.createElement('div');
    indicator.className = 'csai-typing-indicator';
    indicator.innerHTML = `
      <div class="csai-typing-dot"></div>
      <div class="csai-typing-dot"></div>
      <div class="csai-typing-dot"></div>
    `;

    typing.appendChild(indicator);
    this.element.appendChild(typing);

    this.scrollToBottom();
  }

  /**
   * Hide typing indicator
   */
  hideTyping() {
    const typing = this.element.querySelector('[data-typing="true"]');
    if (typing) {
      typing.remove();
    }
  }

  /**
   * Show an error message with retry option
   * @param {string} errorText - Error message
   * @param {Function} onRetry - Retry callback
   */
  showError(errorText, onRetry) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'csai-error-message';

    errorDiv.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
      <div>
        <div>${errorText}</div>
        ${onRetry ? '<button class="csai-retry-button">Retry</button>' : ''}
      </div>
    `;

    if (onRetry) {
      const retryBtn = errorDiv.querySelector('.csai-retry-button');
      retryBtn.addEventListener('click', () => {
        errorDiv.remove();
        onRetry();
      });
    }

    this.element.appendChild(errorDiv);
    this.scrollToBottom();
  }

  /**
   * Load multiple messages at once
   * @param {Array} messages - Array of message objects
   */
  loadMessages(messages) {
    this.clear();
    
    // Filter out system and tool messages (safety check - should never happen)
    const filteredMessages = messages.filter(msg => 
      msg.role === 'user' || msg.role === 'assistant'
    );
    
    this.messages = filteredMessages;

    filteredMessages.forEach(message => {
      const messageEl = this.createMessageElement(message);
      this.element.appendChild(messageEl);
    });

    this.scrollToBottom();
  }

  /**
   * Clear all messages
   */
  clear() {
    this.element.innerHTML = '';
    this.messages = [];
  }

  /**
   * Show empty state
   * @param {string} greeting - Greeting message
   */
  showEmptyState(greeting) {
    this.clear();

    const emptyState = document.createElement('div');
    emptyState.className = 'csai-empty-state';

    emptyState.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
      </svg>
      <div class="csai-empty-title">Start a conversation</div>
      <div class="csai-empty-subtitle">${greeting}</div>
    `;

    this.element.appendChild(emptyState);
  }

  /**
   * Scroll to the bottom of messages
   */
  scrollToBottom() {
    setTimeout(() => {
      this.element.scrollTop = this.element.scrollHeight;
    }, 0);
  }

  /**
   * Get the container element
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
    return this.messages;
  }
}
