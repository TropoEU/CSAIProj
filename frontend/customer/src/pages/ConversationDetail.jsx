import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { conversations } from '../services/api';

export default function ConversationDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchConversation = async () => {
      try {
        const response = await conversations.getById(id);
        setData(response.data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch conversation:', err);
        setError(err.response?.data?.message || 'Failed to load conversation');
      } finally {
        setLoading(false);
      }
    };

    fetchConversation();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/conversations" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
          ← Back to Conversations
        </Link>
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  const { conversation, messages, toolExecutions } = data || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to="/conversations" className="text-primary-600 hover:text-primary-700 text-sm font-medium mb-4 inline-block">
          ← Back to Conversations
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Conversation Details</h1>
      </div>

      {/* Conversation Info */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Session ID</p>
            <p className="text-sm font-mono text-gray-900">{conversation?.sessionId}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <span className={`inline-block px-2 py-1 text-xs rounded-full ${
              conversation?.endedAt
                ? 'bg-gray-200 text-gray-700'
                : 'bg-green-100 text-green-700'
            }`}>
              {conversation?.endedAt ? 'Ended' : 'Active'}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-600">Started</p>
            <p className="text-sm text-gray-900">
              {conversation?.startedAt ? new Date(conversation.startedAt).toLocaleString() : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Ended</p>
            <p className="text-sm text-gray-900">
              {conversation?.endedAt ? new Date(conversation.endedAt).toLocaleString() : 'Still active'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Messages</p>
            <p className="text-sm text-gray-900">{conversation?.messageCount || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Tokens</p>
            <p className="text-sm text-gray-900">{(conversation?.tokensTotal || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">LLM Provider</p>
            <p className="text-sm text-gray-900 capitalize">{conversation?.provider || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Model</p>
            <p className="text-sm text-gray-900">{conversation?.model || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Messages</h2>
        <div className="space-y-4">
          {messages && messages.length > 0 ? (
            messages.map((msg, idx) => (
              <div
                key={msg.id}
                className={`p-4 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-primary-50 border border-primary-200'
                    : msg.role === 'assistant'
                    ? 'bg-gray-50 border border-gray-200'
                    : 'bg-yellow-50 border border-yellow-200'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-medium uppercase text-gray-600">
                    {msg.role}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{msg.content}</p>
                {msg.tokens > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    Tokens: {msg.tokens} | Cumulative: {msg.tokensCumulative}
                  </div>
                )}
                {msg.toolsCalled && msg.toolsCalled.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-gray-600 mb-1">Tools Called:</p>
                    <div className="flex flex-wrap gap-1">
                      {msg.toolsCalled.map((tool, i) => (
                        <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 py-8">No messages</p>
          )}
        </div>
      </div>

      {/* Tool Executions */}
      {toolExecutions && toolExecutions.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Tool Executions</h2>
          <div className="space-y-4">
            {toolExecutions.map((te) => (
              <div key={te.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900">{te.toolName}</p>
                    <p className="text-xs text-gray-500">{new Date(te.executedAt).toLocaleString()}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    te.status === 'success'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {te.status}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">Input:</p>
                    <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                      {JSON.stringify(te.inputParams, null, 2)}
                    </pre>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">Result:</p>
                    <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-x-auto max-h-40">
                      {JSON.stringify(te.result, null, 2)}
                    </pre>
                  </div>

                  {te.executionTime && (
                    <p className="text-xs text-gray-500">
                      Execution time: {te.executionTime}ms
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
