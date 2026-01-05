import { useState, useEffect } from 'react';
import { usage } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function Usage() {
  const { t, isRTL, formatNumber, formatDate } = useLanguage();
  const [currentUsage, setCurrentUsage] = useState(null);
  const [trends, setTrends] = useState(null);
  const [toolUsage, setToolUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [trendPeriod, setTrendPeriod] = useState('30d');
  const [usagePeriod, setUsagePeriod] = useState('month');

  const fetchData = async (trendPeriodParam = trendPeriod, usagePeriodParam = usagePeriod) => {
    try {
      setLoading(true);
      const [current, trendsData, tools] = await Promise.all([
        usage.getCurrent({ period: usagePeriodParam }),
        usage.getTrends({ period: trendPeriodParam }),
        usage.getTools(),
      ]);

      setCurrentUsage(current.data);
      setTrends(trendsData.data);
      setToolUsage(tools.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch usage data:', err);
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTrendPeriodChange = (newPeriod) => {
    setTrendPeriod(newPeriod);
    fetchData(newPeriod, usagePeriod);
  };

  const handleUsagePeriodChange = (newPeriod) => {
    setUsagePeriod(newPeriod);
    fetchData(trendPeriod, newPeriod);
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

  const { usage: usageData, limits } = currentUsage || {};

  // Calculate max conversations for bar chart scaling (avoid division by zero)
  const maxConversations = trends?.daily?.length > 0
    ? Math.max(...trends.daily.map(d => d.conversations), 1)
    : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('usage.title')}</h1>
        <p className="text-gray-600 mt-1">{t('usage.subtitle')}</p>
      </div>

      {/* Period Selector for Current Usage */}
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Time Period:</label>
          <div className="flex gap-2">
            {[
              { value: 'day', label: 'Today' },
              { value: 'week', label: 'This Week' },
              { value: 'month', label: 'This Month' },
              { value: 'year', label: 'This Year' },
              { value: 'all', label: 'All Time' }
            ].map((period) => (
              <button
                key={period.value}
                onClick={() => handleUsagePeriodChange(period.value)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  usagePeriod === period.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Current Usage */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <h3 className="text-sm text-gray-600 mb-2">{t('usage.conversations')}</h3>
          <p className="text-3xl font-bold text-gray-900">{formatNumber(usageData?.conversations || 0)}</p>
          {limits?.conversations && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{t('usage.of')} {formatNumber(limits.conversations)} {t('usage.limit')}</span>
                <span>{Math.round((usageData?.conversations || 0) / limits.conversations * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full"
                  style={{ width: `${Math.min((usageData?.conversations || 0) / limits.conversations * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        <div className="card p-6">
          <h3 className="text-sm text-gray-600 mb-2">{t('usage.tokens')}</h3>
          <p className="text-3xl font-bold text-gray-900">{formatNumber(usageData?.tokens || 0)}</p>
          {limits?.tokens && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{t('usage.of')} {formatNumber(limits.tokens)} {t('usage.limit')}</span>
                <span>{Math.round((usageData?.tokens || 0) / limits.tokens * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${Math.min((usageData?.tokens || 0) / limits.tokens * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        <div className="card p-6">
          <h3 className="text-sm text-gray-600 mb-2">{t('usage.toolCalls')}</h3>
          <p className="text-3xl font-bold text-gray-900">{formatNumber(usageData?.toolCalls || 0)}</p>
          {limits?.toolCalls && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{t('usage.of')} {formatNumber(limits.toolCalls)} {t('usage.limit')}</span>
                <span>{Math.round((usageData?.toolCalls || 0) / limits.toolCalls * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${Math.min((usageData?.toolCalls || 0) / limits.toolCalls * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tool Usage Breakdown */}
      {toolUsage && toolUsage.tools && toolUsage.tools.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">{t('usage.toolBreakdown')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('usage.tool')}
                  </th>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('usage.calls')}
                  </th>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('usage.successRate')}
                  </th>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('usage.avgTime')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {toolUsage.tools.map((tool) => (
                  <tr key={tool.name} className="hover:bg-gray-50">
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {tool.name}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {formatNumber(tool.callCount)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap ${isRTL ? 'text-right' : 'text-left'}`}>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        tool.successRate >= 90
                          ? 'bg-green-100 text-green-700'
                          : tool.successRate >= 70
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {tool.successRate}%
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {formatNumber(tool.avgExecutionTime)}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Usage Trends */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">{t('usage.usageTrends30')}</h2>
          <div className="flex gap-2">
            {['7d', '14d', '30d', '60d'].map((period) => (
              <button
                key={period}
                onClick={() => handleTrendPeriodChange(period)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  trendPeriod === period
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {period.replace('d', ' days')}
              </button>
            ))}
          </div>
        </div>

        {trends && trends.daily && trends.daily.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Chart container with fixed height */}
              <div className="h-56 flex items-end gap-1">
                {trends.daily.map((day) => {
                  const barHeight = maxConversations > 0
                    ? (day.conversations / maxConversations) * 100
                    : 0;
                  return (
                    <div
                      key={day.date}
                      className="flex-1 h-full flex items-end min-w-[8px]"
                    >
                      <div
                        className="w-full rounded-t transition-all duration-200 relative group cursor-pointer"
                        style={{
                          height: `${Math.max(barHeight, 4)}%`,
                          backgroundColor: '#a78bfa'
                        }}
                        title={`${formatDate(day.date, { month: 'short', day: 'numeric' })}: ${day.conversations} conversations`}
                      >
                        {/* Tooltip on hover */}
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          {formatNumber(day.conversations)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Date labels - show every nth day to avoid overcrowding */}
              <div className="flex justify-between text-xs text-gray-500 mt-3 px-1">
                {trends.daily.filter((_, idx, arr) => {
                  const step = Math.max(1, Math.floor(arr.length / 7));
                  return idx % step === 0 || idx === arr.length - 1;
                }).map((day) => (
                  <span key={`label-${day.date}`} className="whitespace-nowrap">
                    {formatDate(day.date, { month: 'short', day: 'numeric' })}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            {t('usage.noData') || 'No data available for this period'}
          </div>
        )}
      </div>
    </div>
  );
}
