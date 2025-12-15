import { useState, useEffect } from 'react';
import { usage } from '../services/api';

export default function Usage() {
  const [currentUsage, setCurrentUsage] = useState(null);
  const [trends, setTrends] = useState(null);
  const [toolUsage, setToolUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [current, trendsData, tools] = await Promise.all([
          usage.getCurrent(),
          usage.getTrends({ period: '30d' }),
          usage.getTools(),
        ]);

        setCurrentUsage(current.data);
        setTrends(trendsData.data);
        setToolUsage(tools.data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch usage data:', err);
        setError(err.response?.data?.message || 'Failed to load usage data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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

  const { usage: usageData, limits } = currentUsage || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Usage</h1>
        <p className="text-gray-600 mt-1">Monitor your platform usage and limits</p>
      </div>

      {/* Current Usage */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <h3 className="text-sm text-gray-600 mb-2">Conversations</h3>
          <p className="text-3xl font-bold text-gray-900">{usageData?.conversations || 0}</p>
          {limits?.conversations && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>of {limits.conversations} limit</span>
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
          <h3 className="text-sm text-gray-600 mb-2">Tokens</h3>
          <p className="text-3xl font-bold text-gray-900">{(usageData?.tokens || 0).toLocaleString()}</p>
          {limits?.tokens && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>of {limits.tokens.toLocaleString()} limit</span>
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
          <h3 className="text-sm text-gray-600 mb-2">Tool Calls</h3>
          <p className="text-3xl font-bold text-gray-900">{usageData?.toolCalls || 0}</p>
          {limits?.toolCalls && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>of {limits.toolCalls} limit</span>
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
          <h2 className="text-lg font-semibold mb-4">Tool Usage Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tool
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Calls
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Success Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {toolUsage.tools.map((tool) => (
                  <tr key={tool.toolName} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {tool.toolName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {tool.callCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {tool.avgExecutionTime}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Usage Trends */}
      {trends && trends.daily && trends.daily.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Usage Trends (Last 30 Days)</h2>
          <div className="h-64 flex items-end justify-between gap-2">
            {trends.daily.map((day, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center">
                <div className="w-full bg-primary-200 rounded-t relative" style={{ height: `${(day.conversations / Math.max(...trends.daily.map(d => d.conversations))) * 100}%` }}>
                  <div className="absolute -top-6 left-0 right-0 text-center text-xs text-gray-600">
                    {day.conversations}
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1 rotate-45 origin-left">
                  {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
