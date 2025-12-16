import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboard } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function Dashboard() {
  const { t, isRTL, formatNumber, formatDate } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    try {
      const response = await dashboard.getOverview();
      setData(response.data);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      if (isRefresh) {
        // Show refreshing indicator for at least 500ms
        setTimeout(() => setRefreshing(false), 500);
      }
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh every 30 seconds for live updates
    const interval = setInterval(() => {
      fetchData(true); // Pass true to show refresh indicator
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
        {error}
      </div>
    );
  }

  const { account, usage, limits, stats, recentConversations } = data || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('dashboard.title')}</h1>
          <p className="text-gray-600 mt-1">
            {t('dashboard.welcome')}! {t('dashboard.overview')}
          </p>
        </div>
        <div className={isRTL ? 'text-left' : 'text-right'}>
          <div className="flex items-center gap-2 justify-end">
            {refreshing && (
              <span className="flex items-center gap-1 text-xs text-primary-600">
                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('common.loading')}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">{t('header.lastUpdated')}</p>
          <p className="text-sm text-gray-700 font-medium">
            {lastUpdate.toLocaleTimeString(isRTL ? 'he-IL' : 'en-US')}
          </p>
        </div>
      </div>

      {/* Account Overview */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">{t('dashboard.accountInfo') || 'Account Information'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">{t('dashboard.accountName') || 'Account Name'}</p>
            <p className="text-lg font-medium text-gray-900">{account?.name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">{t('dashboard.plan')}</p>
            <p className="text-lg font-medium">
              <span className="inline-block px-3 py-1 rounded-full bg-primary-100 text-primary-700 capitalize">
                {account?.plan || 'N/A'}
              </span>
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">{t('dashboard.status')}</p>
            <p className="text-lg font-medium">
              <span className={`inline-block px-3 py-1 rounded-full ${
                account?.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              } capitalize`}>
                {account?.status === 'active' ? t('dashboard.active') : t('dashboard.inactive')}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Usage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('dashboard.conversations')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {formatNumber(usage?.conversations || 0)}
              </p>
              {limits?.conversations && (
                <p className="text-xs text-gray-500 mt-1">
                  {t('usage.of')} {formatNumber(limits.conversations)}
                </p>
              )}
            </div>
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('dashboard.tokens')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {formatNumber(usage?.tokens || 0)}
              </p>
              {limits?.tokens && (
                <p className="text-xs text-gray-500 mt-1">
                  {t('usage.of')} {formatNumber(limits.tokens)}
                </p>
              )}
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('dashboard.toolCalls')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {formatNumber(usage?.toolCalls || 0)}
              </p>
              {limits?.toolCalls && (
                <p className="text-xs text-gray-500 mt-1">
                  {t('usage.of')} {formatNumber(limits.toolCalls)}
                </p>
              )}
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Activity */}
      {stats && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">{t('dashboard.todayActivity')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">{t('dashboard.conversations')}</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.conversationsToday || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('dashboard.messages')}</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.messagesToday || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('dashboard.tokens')}</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.tokensToday || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('dashboard.toolCalls')}</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.toolCallsToday || 0)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Conversations (Last 60 Days) */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t('dashboard.recentActivity')}</h2>
          <Link to="/conversations" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            {t('dashboard.viewAll')} {isRTL ? '←' : '→'}
          </Link>
        </div>

        {recentConversations && recentConversations.length > 0 ? (
          <div className="space-y-3">
            {recentConversations.map((conv) => (
              <Link
                key={conv.id}
                to={`/conversations/${conv.id}`}
                className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">
                      {conv.firstMessage || t('conversations.noResults')}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>{formatDate(conv.startedAt)}</span>
                      <span>{formatNumber(conv.messageCount)} {t('conversations.messages')}</span>
                      <span>{formatNumber(conv.tokensTotal)} {t('dashboard.tokens').toLowerCase()}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    conv.endedAt
                      ? 'bg-gray-200 text-gray-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {conv.endedAt ? t('conversations.ended') : t('conversations.active')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p>{t('dashboard.noConversations60')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
