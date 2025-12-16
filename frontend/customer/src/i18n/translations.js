/**
 * Customer Dashboard Translations
 * Supports English (en) and Hebrew (he)
 */

export const translations = {
  en: {
    // Navigation
    nav: {
      dashboard: 'Dashboard',
      conversations: 'Conversations',
      billing: 'Billing',
      usage: 'Usage',
      settings: 'Settings',
      logout: 'Logout',
    },

    // Header
    header: {
      customerPortal: 'Customer Portal',
      lastUpdated: 'Last updated',
    },

    // Login page
    login: {
      title: 'Customer Dashboard',
      subtitle: 'Enter your access code to view your account',
      accessCode: 'Access Code',
      accessCodePlaceholder: 'Enter your 6-character code',
      loginButton: 'Access Dashboard',
      loggingIn: 'Logging in...',
      error: 'Invalid access code. Please try again.',
      contactSupport: 'Contact your provider if you need a new access code.',
    },

    // Dashboard page
    dashboard: {
      title: 'Dashboard',
      welcome: 'Welcome back',
      overview: 'Here\'s an overview of your account activity',
      accountInfo: 'Account Information',
      accountName: 'Account Name',
      conversations: 'Conversations',
      conversationsDesc: 'Total chat sessions',
      tokens: 'Tokens Used',
      tokensDesc: 'AI processing units',
      tokenLimit: 'of {limit} limit',
      toolCalls: 'Tool Calls',
      toolCallsDesc: 'Actions performed',
      plan: 'Current Plan',
      status: 'Account Status',
      active: 'Active',
      inactive: 'Inactive',
      todayActivity: 'Today\'s Activity',
      messages: 'Messages',
      recentActivity: 'Recent Activity (Last 60 Days)',
      recentConversations: 'Recent Conversations',
      viewAll: 'View All',
      noConversations: 'No conversations yet',
      noConversations60: 'No conversations in the last 60 days',
      quickActions: 'Quick Actions',
      viewConversations: 'View Conversations',
      viewBilling: 'View Billing',
      viewUsage: 'View Usage',
    },

    // Conversations page
    conversations: {
      title: 'Conversations',
      subtitle: 'View your chat history from the last 60 days',
      searchPlaceholder: 'Search conversations...',
      allStatuses: 'All Statuses',
      active: 'Active',
      ended: 'Ended',
      showing: 'Showing',
      of: 'of',
      results: 'results',
      noResults: 'No conversations found',
      noResultsDesc: 'Try adjusting your search or filter criteria',
      messages: 'messages',
      viewDetails: 'View Details',
      startedAt: 'Started',
      lastMessage: 'Last message',
    },

    // Conversation detail page
    conversationDetail: {
      title: 'Conversation',
      backToList: 'Back to conversations',
      started: 'Started',
      ended: 'Ended',
      duration: 'Duration',
      messageCount: 'Messages',
      toolCalls: 'Tool Calls',
      user: 'You',
      assistant: 'AI Assistant',
      noMessages: 'No messages in this conversation',
    },

    // Billing page
    billing: {
      title: 'Billing',
      subtitle: 'View your invoices and payment history',
      currentPlan: 'Current Plan',
      planFeatures: 'Plan Features',
      conversationsPerMonth: 'conversations/month',
      tokensPerMonth: 'tokens/month',
      invoiceHistory: 'Invoice History',
      invoice: 'Invoice',
      date: 'Date',
      amount: 'Amount',
      status: 'Status',
      actions: 'Actions',
      download: 'Download',
      paid: 'Paid',
      pending: 'Pending',
      overdue: 'Overdue',
      noInvoices: 'No invoices yet',
      noInvoicesDesc: 'Your invoices will appear here once generated',
    },

    // Usage page
    usage: {
      title: 'Usage',
      subtitle: 'Monitor your API usage and consumption',
      currentPeriod: 'Current Period',
      conversations: 'Conversations',
      tokensUsed: 'Tokens Used',
      toolCalls: 'Tool Calls',
      used: 'used',
      of: 'of',
      unlimited: 'Unlimited',
      usageTrends: 'Usage Trends',
      last7Days: 'Last 7 Days',
      last30Days: 'Last 30 Days',
      toolBreakdown: 'Tool Usage Breakdown',
      tool: 'Tool',
      calls: 'Calls',
      successRate: 'Success Rate',
      noToolUsage: 'No tool usage data available',
    },

    // Settings page
    settings: {
      title: 'Settings',
      subtitle: 'Manage your preferences',
      language: 'Language',
      languageDesc: 'Choose your preferred language for the dashboard and chat widget',
      english: 'English',
      hebrew: 'Hebrew (עברית)',
      save: 'Save Settings',
      saving: 'Saving...',
      saved: 'Settings saved successfully!',
      error: 'Failed to save settings. Please try again.',
    },

    // Common
    common: {
      loading: 'Loading...',
      error: 'An error occurred',
      retry: 'Retry',
      back: 'Back',
      save: 'Save',
      cancel: 'Cancel',
      close: 'Close',
      yes: 'Yes',
      no: 'No',
      today: 'Today',
      yesterday: 'Yesterday',
      daysAgo: 'days ago',
      hoursAgo: 'hours ago',
      minutesAgo: 'minutes ago',
      justNow: 'Just now',
    },

    // Time formatting
    time: {
      hours: 'hours',
      minutes: 'minutes',
      seconds: 'seconds',
    },
  },

  he: {
    // Navigation
    nav: {
      dashboard: 'לוח בקרה',
      conversations: 'שיחות',
      billing: 'חיוב',
      usage: 'שימוש',
      settings: 'הגדרות',
      logout: 'התנתק',
    },

    // Header
    header: {
      customerPortal: 'פורטל לקוחות',
      lastUpdated: 'עודכן לאחרונה',
    },

    // Login page
    login: {
      title: 'לוח בקרה לקוחות',
      subtitle: 'הזן את קוד הגישה שלך כדי לצפות בחשבון',
      accessCode: 'קוד גישה',
      accessCodePlaceholder: 'הזן קוד בן 6 תווים',
      loginButton: 'כניסה ללוח הבקרה',
      loggingIn: 'מתחבר...',
      error: 'קוד גישה שגוי. אנא נסה שוב.',
      contactSupport: 'פנה לספק שלך אם אתה צריך קוד גישה חדש.',
    },

    // Dashboard page
    dashboard: {
      title: 'לוח בקרה',
      welcome: 'ברוך הבא',
      overview: 'הנה סקירה של פעילות החשבון שלך',
      accountInfo: 'פרטי חשבון',
      accountName: 'שם החשבון',
      conversations: 'שיחות',
      conversationsDesc: 'סה"כ שיחות צ\'אט',
      tokens: 'טוקנים בשימוש',
      tokensDesc: 'יחידות עיבוד AI',
      tokenLimit: 'מתוך {limit} מגבלה',
      toolCalls: 'קריאות לכלים',
      toolCallsDesc: 'פעולות שבוצעו',
      plan: 'תוכנית נוכחית',
      status: 'סטטוס חשבון',
      active: 'פעיל',
      inactive: 'לא פעיל',
      todayActivity: 'פעילות היום',
      messages: 'הודעות',
      recentActivity: 'פעילות אחרונה (60 ימים אחרונים)',
      recentConversations: 'שיחות אחרונות',
      viewAll: 'צפה בהכל',
      noConversations: 'אין שיחות עדיין',
      noConversations60: 'אין שיחות ב-60 הימים האחרונים',
      quickActions: 'פעולות מהירות',
      viewConversations: 'צפה בשיחות',
      viewBilling: 'צפה בחיוב',
      viewUsage: 'צפה בשימוש',
    },

    // Conversations page
    conversations: {
      title: 'שיחות',
      subtitle: 'צפה בהיסטוריית הצ\'אט שלך מ-60 הימים האחרונים',
      searchPlaceholder: 'חפש שיחות...',
      allStatuses: 'כל הסטטוסים',
      active: 'פעיל',
      ended: 'הסתיים',
      showing: 'מציג',
      of: 'מתוך',
      results: 'תוצאות',
      noResults: 'לא נמצאו שיחות',
      noResultsDesc: 'נסה לשנות את החיפוש או הסינון',
      messages: 'הודעות',
      viewDetails: 'צפה בפרטים',
      startedAt: 'התחיל',
      lastMessage: 'הודעה אחרונה',
    },

    // Conversation detail page
    conversationDetail: {
      title: 'שיחה',
      backToList: 'חזרה לשיחות',
      started: 'התחיל',
      ended: 'הסתיים',
      duration: 'משך',
      messageCount: 'הודעות',
      toolCalls: 'קריאות לכלים',
      user: 'אתה',
      assistant: 'עוזר AI',
      noMessages: 'אין הודעות בשיחה זו',
    },

    // Billing page
    billing: {
      title: 'חיוב',
      subtitle: 'צפה בחשבוניות ובהיסטוריית התשלומים שלך',
      currentPlan: 'תוכנית נוכחית',
      planFeatures: 'תכונות התוכנית',
      conversationsPerMonth: 'שיחות/חודש',
      tokensPerMonth: 'טוקנים/חודש',
      invoiceHistory: 'היסטוריית חשבוניות',
      invoice: 'חשבונית',
      date: 'תאריך',
      amount: 'סכום',
      status: 'סטטוס',
      actions: 'פעולות',
      download: 'הורד',
      paid: 'שולם',
      pending: 'ממתין',
      overdue: 'באיחור',
      noInvoices: 'אין חשבוניות עדיין',
      noInvoicesDesc: 'החשבוניות שלך יופיעו כאן לאחר שייווצרו',
    },

    // Usage page
    usage: {
      title: 'שימוש',
      subtitle: 'עקוב אחר השימוש ב-API שלך',
      currentPeriod: 'תקופה נוכחית',
      conversations: 'שיחות',
      tokensUsed: 'טוקנים בשימוש',
      toolCalls: 'קריאות לכלים',
      used: 'בשימוש',
      of: 'מתוך',
      unlimited: 'ללא הגבלה',
      usageTrends: 'מגמות שימוש',
      last7Days: '7 ימים אחרונים',
      last30Days: '30 ימים אחרונים',
      toolBreakdown: 'פירוט שימוש בכלים',
      tool: 'כלי',
      calls: 'קריאות',
      successRate: 'אחוז הצלחה',
      noToolUsage: 'אין נתוני שימוש בכלים',
    },

    // Settings page
    settings: {
      title: 'הגדרות',
      subtitle: 'נהל את ההעדפות שלך',
      language: 'שפה',
      languageDesc: 'בחר את השפה המועדפת עליך ללוח הבקרה ולווידג\'ט הצ\'אט',
      english: 'English',
      hebrew: 'עברית',
      save: 'שמור הגדרות',
      saving: 'שומר...',
      saved: 'ההגדרות נשמרו בהצלחה!',
      error: 'שמירת ההגדרות נכשלה. אנא נסה שוב.',
    },

    // Common
    common: {
      loading: 'טוען...',
      error: 'אירעה שגיאה',
      retry: 'נסה שוב',
      back: 'חזרה',
      save: 'שמור',
      cancel: 'ביטול',
      close: 'סגור',
      yes: 'כן',
      no: 'לא',
      today: 'היום',
      yesterday: 'אתמול',
      daysAgo: 'ימים',
      hoursAgo: 'שעות',
      minutesAgo: 'דקות',
      justNow: 'עכשיו',
    },

    // Time formatting
    time: {
      hours: 'שעות',
      minutes: 'דקות',
      seconds: 'שניות',
    },
  },
};

/**
 * Get nested translation value
 * @param {Object} obj - Translation object
 * @param {string} path - Dot-separated path (e.g., 'nav.dashboard')
 * @returns {string} Translated string or path if not found
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null;
  }, obj);
}

/**
 * Get translation for a key path
 * @param {string} lang - Language code (en, he)
 * @param {string} path - Dot-separated path (e.g., 'nav.dashboard')
 * @param {string} fallback - Fallback value if key not found
 * @returns {string} Translated string
 */
export function t(lang, path, fallback = '') {
  const langTranslations = translations[lang] || translations.en;
  const value = getNestedValue(langTranslations, path);

  if (value !== null) return value;

  // Try English fallback
  const enValue = getNestedValue(translations.en, path);
  if (enValue !== null) return enValue;

  return fallback || path;
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

/**
 * Format number with locale
 * @param {number} num - Number to format
 * @param {string} lang - Language code
 * @returns {string} Formatted number
 */
export function formatNumber(num, lang) {
  const locale = lang === 'he' ? 'he-IL' : 'en-US';
  return new Intl.NumberFormat(locale).format(num);
}

/**
 * Format date with locale
 * @param {Date|string} date - Date to format
 * @param {string} lang - Language code
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date
 */
export function formatDate(date, lang, options = {}) {
  const locale = lang === 'he' ? 'he-IL' : 'en-US';
  const dateObj = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(dateObj);
}

/**
 * Format currency with locale
 * @param {number} amount - Amount to format
 * @param {string} lang - Language code
 * @param {string} currency - Currency code (default: USD)
 * @returns {string} Formatted currency
 */
export function formatCurrency(amount, lang, currency = 'USD') {
  const locale = lang === 'he' ? 'he-IL' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}
