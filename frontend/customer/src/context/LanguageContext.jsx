/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  t,
  isRTL,
  formatNumber,
  formatDate,
  formatCurrency,
  getTranslations,
} from '../i18n/translations';
import { useAuth } from './AuthContext';
import { settings } from '../services/api';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const { client, isAuthenticated } = useAuth();
  const [language, setLanguageState] = useState('en');
  const [loading, setLoading] = useState(false);

  // Initialize language from client settings
  useEffect(() => {
    if (client?.language) {
      setLanguageState(client.language);
    }
  }, [client]);

  // Apply RTL direction to document when language changes
  useEffect(() => {
    if (isRTL(language)) {
      document.documentElement.setAttribute('dir', 'rtl');
      document.documentElement.setAttribute('lang', 'he');
      document.body.classList.add('rtl');
    } else {
      document.documentElement.setAttribute('dir', 'ltr');
      document.documentElement.setAttribute('lang', 'en');
      document.body.classList.remove('rtl');
    }
  }, [language]);

  // Update language preference on server
  const setLanguage = useCallback(
    async (newLang) => {
      if (newLang === language) return;

      setLoading(true);
      try {
        if (isAuthenticated) {
          await settings.update({ language: newLang });
        }
        setLanguageState(newLang);
      } catch (error) {
        console.error('Failed to save language preference:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [language, isAuthenticated]
  );

  // Translation helper
  const translate = useCallback(
    (path, fallback) => {
      return t(language, path, fallback);
    },
    [language]
  );

  // Format helpers
  const fmtNumber = useCallback((num) => formatNumber(num, language), [language]);
  const fmtDate = useCallback((date, options) => formatDate(date, language, options), [language]);
  const fmtCurrency = useCallback(
    (amount, currency) => formatCurrency(amount, language, currency),
    [language]
  );

  const value = {
    language,
    setLanguage,
    loading,
    isRTL: isRTL(language),
    t: translate,
    translations: getTranslations(language),
    formatNumber: fmtNumber,
    formatDate: fmtDate,
    formatCurrency: fmtCurrency,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export default LanguageContext;
