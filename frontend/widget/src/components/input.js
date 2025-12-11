/**
 * Input Component
 * Text input area with send button
 */
export class InputArea {
  constructor(onSend, config = {}) {
    this.onSend = onSend;
    this.config = config;
    this.element = this.create();
    this.input = this.element.querySelector('.csai-input');
    this.sendButton = this.element.querySelector('.csai-send-button');
    this.applyColors();
  }

  /**
   * Create the input area element
   * @returns {HTMLElement}
   */
  create() {
    const container = document.createElement('div');
    container.className = 'csai-input-area';

    container.innerHTML = `
      <textarea
        class="csai-input"
        placeholder="Type your message..."
        rows="1"
        aria-label="Message input"
      ></textarea>
      <button class="csai-send-button" aria-label="Send message">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
      </button>
    `;

    const input = container.querySelector('.csai-input');
    const sendButton = container.querySelector('.csai-send-button');

    // Handle input changes
    input.addEventListener('input', () => {
      this.autoResize();
      this.updateSendButton();
    });

    // Handle Enter key (send on Enter, new line on Shift+Enter)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Handle send button click
    sendButton.addEventListener('click', () => {
      this.handleSend();
    });

    return container;
  }

  /**
   * Apply custom colors from config
   */
  applyColors() {
    // Apply footer background color
    if (this.config.footerBgColor) {
      this.element.style.backgroundColor = this.config.footerBgColor;
    }

    // Apply input background color
    if (this.config.inputBgColor) {
      this.input.style.backgroundColor = this.config.inputBgColor;
    }

    // Apply input text color
    if (this.config.inputTextColor) {
      this.input.style.color = this.config.inputTextColor;
    }

    // Apply button text color (to SVG fill) - ensure size is correct
    if (this.config.buttonTextColor) {
      const svg = this.sendButton.querySelector('svg');
      if (svg) {
        svg.style.fill = this.config.buttonTextColor;
        svg.style.width = '18px';
        svg.style.height = '18px';
      }
    }
  }

  /**
   * Auto-resize textarea based on content
   */
  autoResize() {
    this.input.style.height = 'auto';
    this.input.style.height = Math.min(this.input.scrollHeight, 100) + 'px';
  }

  /**
   * Update send button state based on input
   */
  updateSendButton() {
    const hasText = this.input.value.trim().length > 0;
    this.sendButton.disabled = !hasText;
  }

  /**
   * Handle send action
   */
  handleSend() {
    const message = this.input.value.trim();

    if (message && !this.sendButton.disabled) {
      this.onSend(message);
      this.clear();
    }
  }

  /**
   * Clear the input field
   */
  clear() {
    this.input.value = '';
    this.input.style.height = 'auto';
    this.updateSendButton();
    this.input.focus();
  }

  /**
   * Set the input value
   * @param {string} value - Text to set
   */
  setValue(value) {
    this.input.value = value;
    this.autoResize();
    this.updateSendButton();
  }

  /**
   * Focus the input field
   */
  focus() {
    this.input.focus();
  }

  /**
   * Disable the input
   */
  disable() {
    this.input.disabled = true;
    this.sendButton.disabled = true;
  }

  /**
   * Enable the input
   */
  enable() {
    this.input.disabled = false;
    this.updateSendButton();
  }

  /**
   * Get the container element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }
}
