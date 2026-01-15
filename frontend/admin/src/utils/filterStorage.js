/**
 * Filter Storage Utility
 *
 * Manages persistent filter state across admin panel pages using localStorage
 */

const STORAGE_PREFIX = 'admin_filter_';

/**
 * Save filter state for a specific page
 * @param {string} pageKey - Unique identifier for the page (e.g., 'conversations', 'integrations')
 * @param {object} filterState - Filter state object
 */
export const saveFilterState = (pageKey, filterState) => {
  try {
    const key = `${STORAGE_PREFIX}${pageKey}`;
    localStorage.setItem(key, JSON.stringify(filterState));
  } catch (error) {
    console.error('Failed to save filter state:', error);
  }
};

/**
 * Load filter state for a specific page
 * @param {string} pageKey - Unique identifier for the page
 * @param {object} defaultState - Default filter state if none exists
 * @returns {object} Filter state object
 */
export const loadFilterState = (pageKey, defaultState = {}) => {
  try {
    const key = `${STORAGE_PREFIX}${pageKey}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load filter state:', error);
  }
  return defaultState;
};

/**
 * Clear filter state for a specific page
 * @param {string} pageKey - Unique identifier for the page
 */
export const clearFilterState = (pageKey) => {
  try {
    const key = `${STORAGE_PREFIX}${pageKey}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear filter state:', error);
  }
};

/**
 * Clear all filter states
 */
export const clearAllFilters = () => {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Failed to clear all filters:', error);
  }
};

/**
 * Page keys for consistency
 */
export const PAGE_KEYS = {
  CONVERSATIONS: 'conversations',
  INTEGRATIONS: 'integrations',
  USAGE_REPORTS: 'usage_reports',
  BILLING: 'billing',
  TOOLS: 'tools',
  TEST_CHAT: 'test_chat',
};
