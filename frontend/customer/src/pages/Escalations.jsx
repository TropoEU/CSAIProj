import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { escalations } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function Escalations() {
  const { t, isRTL, formatDate } = useLanguage();
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchEscalations = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    try {
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const [escResponse, statsResponse] = await Promise.all([
        escalations.getAll(params),
        escalations.getStats()
      ]);
      setData(escResponse.data);
      setStats(statsResponse.data);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to fetch escalations:', err);
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
      if (isRefresh) {
        setTimeout(() => setRefreshing(false), 500);
      }
    }
  }, [statusFilter, t]);

  useEffect(() => {
    fetchEscalations();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchEscalations(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchEscalations]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'acknowledged':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getReasonLabel = (reason) => {
    const labels = {
      user_requested: t('escalations.reasonUserRequested'),
      ai_stuck: t('escalations.reasonAiStuck'),
      low_confidence: t('escalations.reasonLowConfidence'),
      explicit_trigger: t('escalations.reasonExplicitTrigger'),
    };
    return labels[reason] || reason;
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: t('escalations.statusPending'),
      acknowledged: t('escalations.statusAcknowledged'),
      resolved: t('escalations.statusResolved'),
      cancelled: t('escalations.statusCancelled'),
    };
    return labels[status] || status;
  };

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

  const { escalations: escList } = data || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('escalations.title')}</h1>
          <p className="text-gray-600 mt-1">
            {t('escalations.subtitle')}
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
                {t('conversations.updating')}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">{t('header.lastUpdated')}</p>
          <p className="text-sm text-gray-700 font-medium">
            {lastUpdate.toLocaleTimeString(isRTL ? 'he-IL' : 'en-US')}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                <p className="text-xs text-gray-500">{t('escalations.pending')}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.acknowledged}</p>
                <p className="text-xs text-gray-500">{t('escalations.acknowledged')}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.resolved}</p>
                <p className="text-xs text-gray-500">{t('escalations.resolved')}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.avgResolutionTimeMinutes ? `${stats.avgResolutionTimeMinutes}m` : '-'}
                </p>
                <p className="text-xs text-gray-500">{t('escalations.avgResolutionTime')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <label className="label">{t('escalations.filterByStatus')}</label>
          <select
            className="input w-48"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">{t('escalations.all')}</option>
            <option value="pending">{t('escalations.statusPending')}</option>
            <option value="acknowledged">{t('escalations.statusAcknowledged')}</option>
            <option value="resolved">{t('escalations.statusResolved')}</option>
            <option value="cancelled">{t('escalations.statusCancelled')}</option>
          </select>
        </div>
      </div>

      {/* Escalations List */}
      <div className="card">
        {escList && escList.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {escList.map((esc) => (
              <Link
                key={esc.id}
                to={`/escalations/${esc.id}`}
                className="block p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(esc.status)}`}>
                        {getStatusLabel(esc.status)}
                      </span>
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                        {getReasonLabel(esc.reason)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(esc.escalatedAt, { hour: 'numeric', minute: 'numeric' })}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mb-3">
                      {t('escalations.session')}: <span className="font-mono text-xs">{esc.sessionId}</span>
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">{t('escalations.escalatedAt')}</p>
                        <p className="font-medium text-gray-900">
                          {formatDate(esc.escalatedAt)}
                        </p>
                      </div>
                      {esc.acknowledgedAt && (
                        <div>
                          <p className="text-gray-500">{t('escalations.acknowledgedAt')}</p>
                          <p className="font-medium text-gray-900">
                            {formatDate(esc.acknowledgedAt)}
                          </p>
                        </div>
                      )}
                      {esc.resolvedAt && (
                        <div>
                          <p className="text-gray-500">{t('escalations.resolvedAt')}</p>
                          <p className="font-medium text-gray-900">
                            {formatDate(esc.resolvedAt)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <svg className={`w-5 h-5 text-gray-400 ${isRTL ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg font-medium">{t('escalations.noResults')}</p>
            <p className="text-sm mt-1">{t('escalations.noResultsDesc')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
