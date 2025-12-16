import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Settings() {
  const { language, setLanguage, loading, t, isRTL } = useLanguage();
  const [selectedLang, setSelectedLang] = useState(language);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    setError(null);
    setSaved(false);

    try {
      await setLanguage(selectedLang);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(t('settings.error'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
        <p className="text-gray-600 mt-1">{t('settings.subtitle')}</p>
      </div>

      {/* Success Message */}
      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {t('settings.saved')}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Settings Card */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('settings.language')}</h2>
          <p className="text-sm text-gray-600 mt-1">{t('settings.languageDesc')}</p>
        </div>
        <div className="px-6 py-6">
          <div className="space-y-4">
            {/* English Option */}
            <label className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
              selectedLang === 'en'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                name="language"
                value="en"
                checked={selectedLang === 'en'}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500"
              />
              <div className={`${isRTL ? 'mr-3' : 'ml-3'}`}>
                <span className="block text-sm font-medium text-gray-900">
                  English
                </span>
                <span className="block text-sm text-gray-500">
                  Use English for the dashboard and chat widget
                </span>
              </div>
            </label>

            {/* Hebrew Option */}
            <label className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
              selectedLang === 'he'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                name="language"
                value="he"
                checked={selectedLang === 'he'}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500"
              />
              <div className={`${isRTL ? 'mr-3' : 'ml-3'}`}>
                <span className="block text-sm font-medium text-gray-900">
                  עברית (Hebrew)
                </span>
                <span className="block text-sm text-gray-500" dir="rtl">
                  השתמש בעברית ללוח הבקרה ולווידג'ט הצ'אט
                </span>
              </div>
            </label>
          </div>

          {/* Save Button */}
          <div className={`mt-6 ${isRTL ? 'text-left' : 'text-right'}`}>
            <button
              onClick={handleSave}
              disabled={loading || selectedLang === language}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                loading || selectedLang === language
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              {loading ? t('settings.saving') : t('settings.save')}
            </button>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <svg className={`h-5 w-5 text-blue-500 flex-shrink-0 ${isRTL ? 'ml-3' : 'mr-3'}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-blue-800">
              {language === 'he' ? 'מידע' : 'Note'}
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              {language === 'he'
                ? 'שינוי השפה ישפיע גם על ווידג\'ט הצ\'אט באתר שלך.'
                : 'Changing the language will also affect the chat widget on your website.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
