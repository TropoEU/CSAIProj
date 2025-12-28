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
      escalations: 'Escalations',
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
      subtitle: 'View and manage all your customer conversations',
      searchPlaceholder: 'Search conversations...',
      search: 'Search',
      timePeriod: 'Time Period',
      last7Days: 'Last 7 days',
      last30Days: 'Last 30 days',
      last60Days: 'Last 60 days',
      last90Days: 'Last 90 days',
      lastYear: 'Last year',
      status: 'Status',
      all: 'All',
      allStatuses: 'All Statuses',
      active: 'Active',
      ended: 'Ended',
      updating: 'Updating...',
      showing: 'Showing',
      of: 'of',
      results: 'results',
      noResults: 'No conversations found',
      noResultsDesc: 'Try adjusting your filters',
      messages: 'messages',
      tokens: 'Tokens',
      toolCalls: 'Tool Calls',
      provider: 'Provider',
      session: 'Session',
      viewDetails: 'View Details',
      startedAt: 'Started',
      lastMessage: 'Last message',
      page: 'Page',
      total: 'total',
      previous: 'Previous',
      next: 'Next',
    },

    // Conversation detail page
    conversationDetail: {
      title: 'Conversation Details',
      backToConversations: 'Back to Conversations',
      backToList: 'Back to conversations',
      information: 'Information',
      sessionId: 'Session ID',
      status: 'Status',
      started: 'Started',
      ended: 'Ended',
      stillActive: 'Still active',
      duration: 'Duration',
      messageCount: 'Messages',
      totalTokens: 'Total Tokens',
      model: 'Model',
      tokens: 'Tokens',
      cumulative: 'Cumulative',
      toolCalls: 'Tool Calls',
      toolsCalled: 'Tools Called',
      toolExecutions: 'Tool Executions',
      user: 'User',
      assistant: 'AI Assistant',
      noMessages: 'No messages in this conversation',
      success: 'Success',
      failed: 'Failed',
      input: 'Input',
      result: 'Result',
      executionTime: 'Execution time',
    },

    // Billing page
    billing: {
      title: 'Billing',
      subtitle: 'View and manage your invoices',
      currentPlan: 'Current Plan',
      planFeatures: 'Plan Features',
      conversationsPerMonth: 'conversations/month',
      tokensPerMonth: 'tokens/month',
      invoiceHistory: 'Invoice History',
      invoiceNumber: 'Invoice #',
      period: 'Period',
      invoice: 'Invoice',
      date: 'Date',
      dueDate: 'Due Date',
      amount: 'Amount',
      status: 'Status',
      actions: 'Actions',
      view: 'View',
      download: 'Download',
      paid: 'Paid',
      pending: 'Pending',
      overdue: 'Overdue',
      cancelled: 'Cancelled',
      noInvoices: 'No invoices yet',
      noInvoicesDesc: 'Your invoices will appear here',
      downloadError: 'Failed to download invoice. Please try again.',
    },

    // Usage page
    usage: {
      title: 'Usage',
      subtitle: 'Monitor your platform usage and limits',
      currentPeriod: 'Current Period',
      conversations: 'Conversations',
      tokens: 'Tokens',
      tokensUsed: 'Tokens Used',
      toolCalls: 'Tool Calls',
      used: 'used',
      of: 'of',
      limit: 'limit',
      unlimited: 'Unlimited',
      usageTrends: 'Usage Trends',
      usageTrends30: 'Usage Trends (Last 30 Days)',
      last7Days: 'Last 7 Days',
      last30Days: 'Last 30 Days',
      toolBreakdown: 'Tool Usage Breakdown',
      tool: 'Tool',
      calls: 'Calls',
      successRate: 'Success Rate',
      avgTime: 'Avg Time',
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

    // Escalations page
    escalations: {
      title: 'Escalations',
      subtitle: 'Conversations that need your attention',
      detailTitle: 'Escalation Details',
      pending: 'Pending',
      acknowledged: 'Acknowledged',
      resolved: 'Resolved',
      cancelled: 'Cancelled',
      all: 'All',
      filterByStatus: 'Filter by status',
      avgResolutionTime: 'Avg Resolution',
      session: 'Session',
      escalatedAt: 'Escalated',
      acknowledgedAt: 'Acknowledged',
      resolvedAt: 'Resolved',
      statusPending: 'Pending',
      statusAcknowledged: 'Acknowledged',
      statusResolved: 'Resolved',
      statusCancelled: 'Cancelled',
      reasonUserRequested: 'User Requested',
      reasonAiStuck: 'AI Stuck',
      reasonLowConfidence: 'Low Confidence',
      reasonExplicitTrigger: 'Explicit Trigger',
      noResults: 'No escalations found',
      noResultsDesc: 'Great! No conversations need your attention right now.',
      notFound: 'Escalation not found',
      backToList: 'Back to Escalations',
      info: 'Escalation Info',
      status: 'Status',
      reason: 'Reason',
      customerInfo: 'Customer Contact',
      noContactInfo: 'No contact information available',
      conversationInfo: 'Conversation',
      messages: 'Messages',
      started: 'Started',
      ended: 'Ended',
      viewFullConversation: 'View Full Conversation',
      triggerMessage: 'Trigger Message',
      recentMessages: 'Recent Messages',
      last10Messages: 'Last 10 messages from this conversation',
      noMessages: 'No messages available',
      customer: 'Customer',
      ai: 'AI Assistant',
      resolutionNotes: 'Resolution Notes',
      acknowledge: 'Acknowledge',
      resolve: 'Resolve',
      resolveEscalation: 'Resolve Escalation',
      resolveDescription: 'Add notes about how this escalation was resolved (optional):',
      notesPlaceholder: 'e.g., Contacted customer directly and resolved their issue...',
      markResolved: 'Mark as Resolved',
      acknowledgeFailed: 'Failed to acknowledge escalation',
      resolveFailed: 'Failed to resolve escalation',
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
      escalations: 'הסלמות',
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
      subtitle: 'צפה ונהל את כל שיחות הלקוחות שלך',
      searchPlaceholder: 'חפש שיחות...',
      search: 'חיפוש',
      timePeriod: 'תקופה',
      last7Days: '7 ימים אחרונים',
      last30Days: '30 ימים אחרונים',
      last60Days: '60 ימים אחרונים',
      last90Days: '90 ימים אחרונים',
      lastYear: 'שנה אחרונה',
      status: 'סטטוס',
      all: 'הכל',
      allStatuses: 'כל הסטטוסים',
      active: 'פעיל',
      ended: 'הסתיים',
      updating: 'מעדכן...',
      showing: 'מציג',
      of: 'מתוך',
      results: 'תוצאות',
      noResults: 'לא נמצאו שיחות',
      noResultsDesc: 'נסה לשנות את הסינון',
      messages: 'הודעות',
      tokens: 'טוקנים',
      toolCalls: 'קריאות לכלים',
      provider: 'ספק',
      session: 'סשן',
      viewDetails: 'צפה בפרטים',
      startedAt: 'התחיל',
      lastMessage: 'הודעה אחרונה',
      page: 'עמוד',
      total: 'סה"כ',
      previous: 'הקודם',
      next: 'הבא',
    },

    // Conversation detail page
    conversationDetail: {
      title: 'פרטי שיחה',
      backToConversations: 'חזרה לשיחות',
      backToList: 'חזרה לשיחות',
      information: 'מידע',
      sessionId: 'מזהה סשן',
      status: 'סטטוס',
      started: 'התחיל',
      ended: 'הסתיים',
      stillActive: 'עדיין פעיל',
      duration: 'משך',
      messageCount: 'הודעות',
      totalTokens: 'סה"כ טוקנים',
      model: 'מודל',
      tokens: 'טוקנים',
      cumulative: 'מצטבר',
      toolCalls: 'קריאות לכלים',
      toolsCalled: 'כלים שהופעלו',
      toolExecutions: 'הפעלות כלים',
      user: 'משתמש',
      assistant: 'עוזר AI',
      noMessages: 'אין הודעות בשיחה זו',
      success: 'הצלחה',
      failed: 'נכשל',
      input: 'קלט',
      result: 'תוצאה',
      executionTime: 'זמן ביצוע',
    },

    // Billing page
    billing: {
      title: 'חיוב',
      subtitle: 'צפה ונהל את החשבוניות שלך',
      currentPlan: 'תוכנית נוכחית',
      planFeatures: 'תכונות התוכנית',
      conversationsPerMonth: 'שיחות/חודש',
      tokensPerMonth: 'טוקנים/חודש',
      invoiceHistory: 'היסטוריית חשבוניות',
      invoiceNumber: 'חשבונית #',
      period: 'תקופה',
      invoice: 'חשבונית',
      date: 'תאריך',
      dueDate: 'תאריך לתשלום',
      amount: 'סכום',
      status: 'סטטוס',
      actions: 'פעולות',
      view: 'צפייה',
      download: 'הורד',
      paid: 'שולם',
      pending: 'ממתין',
      overdue: 'באיחור',
      cancelled: 'בוטל',
      noInvoices: 'אין חשבוניות עדיין',
      noInvoicesDesc: 'החשבוניות שלך יופיעו כאן',
      downloadError: 'הורדת החשבונית נכשלה. אנא נסה שוב.',
    },

    // Usage page
    usage: {
      title: 'שימוש',
      subtitle: 'עקוב אחר השימוש והמגבלות שלך',
      currentPeriod: 'תקופה נוכחית',
      conversations: 'שיחות',
      tokens: 'טוקנים',
      tokensUsed: 'טוקנים בשימוש',
      toolCalls: 'קריאות לכלים',
      used: 'בשימוש',
      of: 'מתוך',
      limit: 'מגבלה',
      unlimited: 'ללא הגבלה',
      usageTrends: 'מגמות שימוש',
      usageTrends30: 'מגמות שימוש (30 ימים אחרונים)',
      last7Days: '7 ימים אחרונים',
      last30Days: '30 ימים אחרונים',
      toolBreakdown: 'פירוט שימוש בכלים',
      tool: 'כלי',
      calls: 'קריאות',
      successRate: 'אחוז הצלחה',
      avgTime: 'זמן ממוצע',
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

    // Escalations page
    escalations: {
      title: 'הסלמות',
      subtitle: 'שיחות שדורשות את תשומת לבך',
      detailTitle: 'פרטי הסלמה',
      pending: 'ממתין',
      acknowledged: 'אושר',
      resolved: 'נפתר',
      cancelled: 'בוטל',
      all: 'הכל',
      filterByStatus: 'סנן לפי סטטוס',
      avgResolutionTime: 'זמן פתרון ממוצע',
      session: 'סשן',
      escalatedAt: 'הועבר',
      acknowledgedAt: 'אושר',
      resolvedAt: 'נפתר',
      statusPending: 'ממתין',
      statusAcknowledged: 'אושר',
      statusResolved: 'נפתר',
      statusCancelled: 'בוטל',
      reasonUserRequested: 'בקשת משתמש',
      reasonAiStuck: 'AI תקוע',
      reasonLowConfidence: 'ביטחון נמוך',
      reasonExplicitTrigger: 'טריגר מפורש',
      noResults: 'לא נמצאו הסלמות',
      noResultsDesc: 'מעולה! אין שיחות שדורשות את תשומת לבך כרגע.',
      notFound: 'הסלמה לא נמצאה',
      backToList: 'חזרה להסלמות',
      info: 'פרטי הסלמה',
      status: 'סטטוס',
      reason: 'סיבה',
      customerInfo: 'פרטי קשר',
      noContactInfo: 'אין פרטי קשר זמינים',
      conversationInfo: 'שיחה',
      messages: 'הודעות',
      started: 'התחיל',
      ended: 'הסתיים',
      viewFullConversation: 'צפה בשיחה המלאה',
      triggerMessage: 'הודעה שהפעילה',
      recentMessages: 'הודעות אחרונות',
      last10Messages: '10 ההודעות האחרונות מהשיחה',
      noMessages: 'אין הודעות זמינות',
      customer: 'לקוח',
      ai: 'עוזר AI',
      resolutionNotes: 'הערות פתרון',
      acknowledge: 'אשר',
      resolve: 'פתור',
      resolveEscalation: 'פתור הסלמה',
      resolveDescription: 'הוסף הערות לגבי איך ההסלמה נפתרה (אופציונלי):',
      notesPlaceholder: 'לדוגמה: יצרתי קשר ישיר עם הלקוח ופתרתי את הבעיה...',
      markResolved: 'סמן כנפתר',
      acknowledgeFailed: 'אישור ההסלמה נכשל',
      resolveFailed: 'פתרון ההסלמה נכשל',
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
