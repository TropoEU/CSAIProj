import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { conversations } from '../services/api';
import { Card, CardBody, CardHeader, Button, LoadingSpinner, Badge } from '../components/common';

export default function ConversationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const formatTokenCount = (tokens) => {
    if (!tokens || tokens === 0) return '0';
    if (tokens < 1000) return tokens.toString();
    if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`;
    return `${(tokens / 1000000).toFixed(2)}M`;
  };

  useEffect(() => {
    fetchConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Auto-refresh polling (every 5 seconds for active conversations)
  useEffect(() => {
    if (!autoRefresh || !conversation || conversation.status !== 'active') {
      return;
    }

    const interval = setInterval(() => {
      fetchConversation(true); // Silent refresh (no loading state)
    }, 5000); // 5 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, conversation?.status, id]);

  const fetchConversation = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const response = await conversations.getById(id);
      setConversation(response.data);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      if (!silent) {
        setError(err.response?.data?.error || 'Failed to load conversation');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{error || 'Conversation not found'}</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/conversations')}>
          Back to Conversations
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/conversations')}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Conversation Details</h1>
            <p className="text-gray-600 font-mono text-sm">{conversation.session_id}</p>
          </div>
        </div>

        {/* Auto-refresh toggle */}
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-gray-500">
              Updated {Math.floor((new Date() - lastRefresh) / 1000)}s ago
            </span>
          )}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            disabled={conversation.status !== 'active'}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              conversation.status !== 'active'
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : autoRefresh
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={conversation.status !== 'active' ? 'Auto-refresh only available for active conversations' : ''}
          >
            <svg className={`w-4 h-4 ${autoRefresh && conversation.status === 'active' ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            {conversation.status !== 'active' && ' (Inactive)'}
          </button>
          <button
            onClick={() => fetchConversation()}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Now
          </button>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardBody className="p-4">
            <p className="text-sm text-gray-500">Client</p>
            <p className="font-medium text-gray-900">{conversation.client_name || 'Unknown'}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-sm text-gray-500">Provider</p>
            <p className="font-medium text-gray-900">
              <Badge variant="outline" className="text-xs">
                {conversation.llm_provider || 'ollama'}
                {conversation.model_name && (
                  <span className="ml-1 text-gray-500">
                    - {conversation.model_name.length > 20 
                      ? conversation.model_name.substring(0, 17) + '...' 
                      : conversation.model_name}
                  </span>
                )}
              </Badge>
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-sm text-gray-500">Messages</p>
            <p className="font-medium text-gray-900">{conversation.messages?.length || 0}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-sm text-gray-500">Tool Calls</p>
            <p className="font-medium text-gray-900">{conversation.tool_executions?.length || 0}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-sm text-gray-500">Tokens</p>
            <p className="font-medium text-gray-900 font-mono" title="Total tokens used in this conversation">
              {conversation.tokens_total ? formatTokenCount(conversation.tokens_total) : '0'}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-sm text-gray-500">Started</p>
            <p className="font-medium text-gray-900">
              {conversation.started_at ? new Date(conversation.started_at).toLocaleString() : 'N/A'}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Messages */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Conversation Transcript</h3>
        </CardHeader>
        <CardBody className="p-0">
          <div className="divide-y divide-gray-200">
            {conversation.messages?.map((message, index) => (
              <div
                key={index}
                className={`p-4 ${message.role === 'assistant' ? 'bg-gray-50' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.role === 'user'
                        ? 'bg-primary-100 text-primary-600'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">
                        {message.role === 'user' ? 'Customer' : 'AI Assistant'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {message.timestamp ? new Date(message.timestamp).toLocaleString() : 'N/A'}
                      </span>
                      <div className="flex items-center gap-2 ml-auto">
                        {message.tokens !== undefined && message.tokens > 0 && (
                          <Badge variant="default" className="text-xs" title="Tokens used for this LLM call">
                            {formatTokenCount(message.tokens)}
                          </Badge>
                        )}
                        {message.tokens_cumulative !== undefined && message.tokens_cumulative > 0 && (
                          <Badge variant="info" className="text-xs" title="Cumulative tokens">
                            Total: {formatTokenCount(message.tokens_cumulative)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{message.content}</p>
                    {message.role === 'assistant' && message.tools_called && message.tools_called.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <span className="text-xs text-gray-500 font-medium">Tools Called: </span>
                        <span className="text-xs text-gray-600">
                          {message.tools_called.map((tool, idx) => (
                            <span key={idx}>
                              <Badge variant="info" className="text-xs mr-1">
                                {tool}
                              </Badge>
                            </span>
                          ))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {(!conversation.messages || conversation.messages.length === 0) && (
              <div className="p-8 text-center text-gray-500">
                No messages in this conversation
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Tool Executions */}
      {conversation.tool_executions?.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Tool Executions</h3>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-gray-200">
              {conversation.tool_executions.map((execution, index) => (
                <div key={index} className={`p-4 ${execution.status === 'blocked' || execution.status === 'duplicate' ? 'bg-yellow-50' : execution.status === 'failed' ? 'bg-red-50' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="info">{execution.tool_name}</Badge>
                      <Badge
                        variant={
                          execution.status === 'success'
                            ? 'success'
                            : execution.status === 'failed'
                            ? 'danger'
                            : execution.status === 'blocked'
                            ? 'warning'
                            : execution.status === 'duplicate'
                            ? 'secondary'
                            : 'default'
                        }
                      >
                        {execution.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-gray-500">
                      {execution.execution_time_ms > 0 ? `${execution.execution_time_ms}ms` : '-'}
                    </span>
                  </div>
                  {execution.error_reason && (
                    <div className="mb-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-sm text-yellow-800">
                      <span className="font-medium">Reason: </span>
                      {execution.error_reason}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Input</p>
                      <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                        {JSON.stringify(execution.input_params, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Output</p>
                      <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                        {JSON.stringify(execution.result, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
