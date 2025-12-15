import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { conversations } from '../services/api';

export default function Conversations() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [page, setPage] = useState(1);
  const [days, setDays] = useState(60);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const fetchConversations = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    try {
      const response = await conversations.getAll({
        page,
        limit: 20,
        days,
        search,
        status,
      });
      setData(response.data);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
      setError(err.response?.data?.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
      if (isRefresh) {
        setTimeout(() => setRefreshing(false), 500);
      }
    }
  };

  useEffect(() => {
    fetchConversations();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchConversations(true); // Pass true to show refresh indicator
    }, 30000);

    return () => clearInterval(interval);
  }, [page, days, search, status]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchConversations();
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

  const { conversations: convList, pagination } = data || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Conversations</h1>
          <p className="text-gray-600 mt-1">
            View and manage all your customer conversations
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end">
            {refreshing && (
              <span className="flex items-center gap-1 text-xs text-primary-600">
                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Updating...
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">Last updated</p>
          <p className="text-sm text-gray-700 font-medium">
            {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="label">Search</label>
            <form onSubmit={handleSearch}>
              <input
                type="text"
                className="input"
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </form>
          </div>
          <div>
            <label className="label">Time Period</label>
            <select
              className="input"
              value={days}
              onChange={(e) => {
                setDays(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="60">Last 60 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="ended">Ended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Conversations List */}
      <div className="card">
        {convList && convList.length > 0 ? (
          <>
            <div className="divide-y divide-gray-200">
              {convList.map((conv) => (
                <Link
                  key={conv.id}
                  to={`/conversations/${conv.id}`}
                  className="block p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          conv.endedAt
                            ? 'bg-gray-200 text-gray-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {conv.endedAt ? 'Ended' : 'Active'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(conv.startedAt).toLocaleString()}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 mb-3">
                        Session: <span className="font-mono text-xs">{conv.sessionId}</span>
                      </p>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Messages</p>
                          <p className="font-medium text-gray-900">{conv.messageCount}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Tokens</p>
                          <p className="font-medium text-gray-900">{conv.tokensTotal.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Tool Calls</p>
                          <p className="font-medium text-gray-900">{conv.toolCallCount || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Provider</p>
                          <p className="font-medium text-gray-900 capitalize">
                            {conv.provider || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="p-6 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.totalConversations} total)
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="btn btn-secondary"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={page === pagination.totalPages}
                      className="btn btn-secondary"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-lg font-medium">No conversations found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
