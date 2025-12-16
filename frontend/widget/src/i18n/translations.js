/**
 * Widget Translations
 * Supports English (en) and Hebrew (he)
 */

export const translations = {
  en: {
    // Chat window
    title: 'Chat Support',
    subtitle: 'We typically reply instantly',
    greeting: 'Hi! How can I help you today?',

    // Input area
    inputPlaceholder: 'Type a message...',
    sendButton: 'Send',

    // Empty state
    emptyTitle: 'Start a conversation',
    emptySubtitle: 'Send a message to begin',

    // Actions
    endConversation: 'End Conversation',
    endConversationConfirm: 'Are you sure you want to end this conversation? You can start a new one anytime.',
    conversationEnded: 'Conversation ended. How can I help you today?',

    // Errors
    errorSend: 'Failed to send message. Please try again.',
    errorRetry: 'Retry',

    // Time labels
    justNow: 'Just now',
    minutesAgo: 'min ago',
    hoursAgo: 'hr ago',
    today: 'Today',
    yesterday: 'Yesterday',

    // Accessibility
    closeButton: 'Close',
    openChat: 'Open chat',
    typing: 'Typing...'
  },

  he: {
    // Chat window
    title: 'צ\'אט תמיכה',
    subtitle: 'אנחנו בדרך כלל עונים מיד',
    greeting: 'שלום! איך אפשר לעזור לך היום?',

    // Input area
    inputPlaceholder: 'כתוב הודעה...',
    sendButton: 'שלח',

    // Empty state
    emptyTitle: 'התחל שיחה',
    emptySubtitle: 'שלח הודעה כדי להתחיל',

    // Actions
    endConversation: 'סיים שיחה',
    endConversationConfirm: 'האם אתה בטוח שברצונך לסיים את השיחה? תוכל להתחיל שיחה חדשה בכל עת.',
    conversationEnded: 'השיחה הסתיימה. איך אפשר לעזור לך היום?',

    // Errors
    errorSend: 'שליחת ההודעה נכשלה. אנא נסה שוב.',
    errorRetry: 'נסה שוב',

    // Time labels
    justNow: 'עכשיו',
    minutesAgo: 'דקות',
    hoursAgo: 'שעות',
    today: 'היום',
    yesterday: 'אתמול',

    // Accessibility
    closeButton: 'סגור',
    openChat: 'פתח צ\'אט',
    typing: 'מקליד...'
  }
};

/**
 * Get translation for a key
 * @param {string} lang - Language code (en, he)
 * @param {string} key - Translation key
 * @param {string} fallback - Fallback value if key not found
 * @returns {string} Translated string
 */
export function t(lang, key, fallback = '') {
  const langTranslations = translations[lang] || translations.en;
  return langTranslations[key] || translations.en[key] || fallback || key;
}

/**
 * Check if language is RTL
 * @param {string} lang - Language code
 * @returns {boolean}
 */
export function isRTL(lang) {
  return lang === 'he';
}

/**
 * Get all translations for a language
 * @param {string} lang - Language code
 * @returns {Object} Translation object
 */
export function getTranslations(lang) {
  return translations[lang] || translations.en;
}
