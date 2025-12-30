import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usage, clients as clientsApi } from '../services/api';
import { loadFilterState, saveFilterState, PAGE_KEYS } from '../utils/filterStorage';

export default function UsageReports() {
  const [searchParams] = useSearchParams();

  // Load filter state from localStorage
  const initialFilters = loadFilterState(PAGE_KEYS.USAGE_REPORTS, {
    selectedClient: null,
    period: 'month',
  });

  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(initialFilters.selectedClient);
  const [period, setPeriod] = useState(initialFilters.period);
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Save filter state when it changes
  useEffect(() => {
    saveFilterState(PAGE_KEYS.USAGE_REPORTS, {
      selectedClient,
      period,
    });
  }, [selectedClient, period]);

  // Fetch clients on mount
  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch usage data when client or period changes
  useEffect(() => {
    if (selectedClient !== null) {
      fetchUsageData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient, period]);

  // Auto-refresh polling (every 5 seconds when client is selected)
  useEffect(() => {
    if (!autoRefresh || selectedClient === null) {
      return;
    }

    const interval = setInterval(() => {
      fetchUsageData(true); // Silent refresh (no loading state)
    }, 5000); // 5 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, selectedClient, period]);

  const fetchClients = async () => {
    try {
      const response = await clientsApi.getAll();
      const clientData = response.data || [];
      setClients(clientData);

      // Check if client ID is in query params
      const clientIdFromQuery = searchParams.get('client');
      if (clientIdFromQuery && clientData.some(c => c.id === parseInt(clientIdFromQuery))) {
        setSelectedClient(parseInt(clientIdFromQuery));
      } else if (selectedClient === null) {
        // Only set default if no filter was loaded from localStorage
        setSelectedClient('all');
      }
    } catch (err) {
      setError('Failed to load clients');
      console.error('Error fetching clients:', err);
    }
  };

  const fetchUsageData = async (silent = false) => {
    if (selectedClient === null) return;

    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      if (selectedClient === 'all') {
        // Fetch aggregated data for all clients
        const [summaryData, historyData] = await Promise.all([
          usage.getAllClientsSummary(period),
          usage.getAllClientsHistory('messages', 12),
        ]);
        setSummary(summaryData);
        setHistory(historyData);
      } else {
        const [summaryData, historyData] = await Promise.all([
          usage.getSummary(selectedClient, period),
          usage.getHistory(selectedClient, 'messages', 12),
        ]);
        setSummary(summaryData);
        setHistory(historyData);
      }
      setLastRefresh(new Date());
    } catch (err) {
      if (!silent) {
        setError('Failed to load usage data');
      }
      console.error('Error fetching usage:', err);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const handleExport = async () => {
    if (!selectedClient) return;

    try {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      const endDate = now;

      const csvData = await usage.exportCSV(selectedClient, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);

      // Create download link
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `usage-${selectedClient}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export data');
      console.error('Error exporting:', err);
    }
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    return new Intl.NumberFormat().format(num);
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getSelectedClientInfo = () => {
    if (selectedClient === 'all') {
      return {
        name: 'All Clients',
        plan_type: 'Platform-Wide',
        domain: `${clients.length} clients`,
        status: 'active'
      };
    }
    return clients.find((c) => c.id === selectedClient);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Usage Reports</h1>
        <div className="flex items-center gap-3">
          {lastRefresh && selectedClient !== null && (
            <span className="text-xs text-gray-500">
              Updated {Math.floor((new Date() - lastRefresh) / 1000)}s ago
            </span>
          )}
          {selectedClient !== null && (
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                autoRefresh
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <svg className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </button>
          )}
          <button
            onClick={() => fetchUsageData()}
            disabled={selectedClient === null}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Now
          </button>
          <button
            onClick={handleExport}
            disabled={!selectedClient}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Client Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Client
            </label>
            <select
              value={selectedClient || ''}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedClient(val === 'all' ? 'all' : parseInt(val));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Clients (Platform-Wide)</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.plan_type})
                </option>
              ))}
            </select>
          </div>

          {/* Period Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Period
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Time</option>
              <option value="day">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
          </div>
        </div>

        {/* Client Info */}
        {getSelectedClientInfo() && (
          <div className="mt-4 p-4 bg-gray-50 rounded-md">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Client:</span>
                {selectedClient === 'all' ? (
                  <span className="ml-2 font-semibold">{getSelectedClientInfo().name}</span>
                ) : (
                  <Link
                    to={`/clients/${getSelectedClientInfo().id}`}
                    className="ml-2 font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    {getSelectedClientInfo().name}
                  </Link>
                )}
              </div>
              <div>
                <span className="text-gray-600">Plan:</span>
                <span className="ml-2 font-semibold capitalize">{getSelectedClientInfo().plan_type}</span>
              </div>
              <div>
                <span className="text-gray-600">Domain:</span>
                <span className="ml-2 font-semibold">{getSelectedClientInfo().domain}</span>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>
                <span className={`ml-2 font-semibold ${getSelectedClientInfo().status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                  {getSelectedClientInfo().status}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading usage data...</p>
        </div>
      )}

      {/* Usage Summary Cards */}
      {!loading && summary && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Conversations</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatNumber(summary.conversations)}
                  </p>
                </div>
                <div className="bg-blue-100 rounded-full p-3">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Messages</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatNumber(summary.messages)}
                  </p>
                </div>
                <div className="bg-green-100 rounded-full p-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tokens</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatNumber(summary.tokens.total)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    In: {formatNumber(summary.tokens.input)} | Out: {formatNumber(summary.tokens.output)}
                  </p>
                </div>
                <div className="bg-purple-100 rounded-full p-3">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tool Calls</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatNumber(summary.toolCalls)}
                  </p>
                </div>
                <div className="bg-yellow-100 rounded-full p-3">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Estimated Cost</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatCurrency(summary.cost)}
                  </p>
                </div>
                <div className="bg-red-100 rounded-full p-3">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Stats */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-600">Active Days This Period</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{summary.activeDays}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Messages per Conversation</p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {summary.conversations > 0 ? Math.round(summary.messages / summary.conversations) : 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Tokens per Message</p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {summary.messages > 0 ? Math.round(summary.tokens.total / summary.messages) : 0}
                </p>
              </div>
            </div>
          </div>

          {/* Usage History Chart */}
          {history.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Message Usage History (Last 12 Months)</h2>
              <div className="space-y-3">
                {history.map((item, index) => (
                  <div key={index} className="flex items-center">
                    <div className="w-24 text-sm text-gray-600">{item.period}</div>
                    <div className="flex-1 mx-4">
                      <div className="bg-gray-200 rounded-full h-6 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full flex items-center justify-end px-2 text-white text-xs font-medium"
                          style={{
                            width: `${Math.min(100, (item.value / Math.max(...history.map(h => h.value))) * 100)}%`,
                          }}
                        >
                          {item.value > 0 && formatNumber(item.value)}
                        </div>
                      </div>
                    </div>
                    <div className="w-24 text-sm text-gray-900 font-medium text-right">
                      {formatNumber(item.value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* No Data State */}
      {!loading && !summary && selectedClient && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-600">No usage data available for this client in the selected period.</p>
        </div>
      )}
    </div>
  );
}
