import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export default function Header({ onMenuClick }) {
  const { client, logout } = useAuth();
  const { t, isRTL } = useLanguage();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-xl font-semibold text-gray-800">{t('header.customerPortal')}</h1>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 flex items-center">
            <span className="font-medium">{client?.name}</span>
            <span className={`text-xs px-2 py-1 rounded-full bg-primary-100 text-primary-700 ${isRTL ? 'mr-2' : 'ml-2'}`}>
              {client?.plan}
            </span>
          </span>
          <button
            onClick={logout}
            className="btn btn-secondary text-sm"
          >
            {t('nav.logout')}
          </button>
        </div>
      </div>
    </header>
  );
}
