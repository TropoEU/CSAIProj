/**
 * Chat Bubble Component
 * The circular button that opens/closes the chat widget
 */
export class ChatBubble {
  constructor(onClick) {
    this.onClick = onClick;
    this.element = this.create();
    this.unreadCount = 0;
  }

  /**
   * Create the bubble element
   * @returns {HTMLElement}
   */
  create() {
    const bubble = document.createElement('button');
    bubble.className = 'csai-chat-bubble';
    bubble.setAttribute('aria-label', 'Open chat');

    bubble.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
      </svg>
    `;

    bubble.addEventListener('click', () => {
      this.onClick();
      this.toggleOpen();
    });

    return bubble;
  }

  /**
   * Toggle open state animation
   */
  toggleOpen() {
    this.element.classList.toggle('open');
  }

  /**
   * Update unread message count
   * @param {number} count - Number of unread messages
   */
  setUnreadCount(count) {
    this.unreadCount = count;

    // Remove existing badge if present
    const existingBadge = this.element.querySelector('.csai-unread-badge');
    if (existingBadge) {
      existingBadge.remove();
    }

    // Add new badge if count > 0
    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'csai-unread-badge';
      badge.textContent = count > 99 ? '99+' : count;
      this.element.appendChild(badge);
    }
  }

  /**
   * Get the bubble element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }
}
