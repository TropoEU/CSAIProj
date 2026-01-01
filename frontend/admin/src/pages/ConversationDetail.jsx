import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { conversations } from '../services/api';
import { Card, CardBody, CardHeader, Button, LoadingSpinner, Badge } from '../components/common';
import ExportBar from '../components/conversations/ExportBar';
import DebugLegend from '../components/conversations/DebugLegend';
import MessageItem from '../components/conversations/MessageItem';
import ToolExecutionItem from '../components/conversations/ToolExecutionItem';

/**
 * Format token count for display
 */
function formatTokenCount(tokens) {
  if (!tokens || tokens === 0) return '0';
  if (tokens < 1000) return tokens.toString();
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1000000).toFixed(2)}M`;
}

/**
 * Conversation detail page with debug mode and export functionality
 */
export default function ConversationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [debugMode, setDebugMode] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, debugMode]);

  // Auto-refresh polling (every 5 seconds for active conversations)
  useEffect(() => {
    if (!autoRefresh || !conversation || conversation.status !== 'active') {
      return;
    }

    const interval = setInterval(() => {
      fetchConversation(true);
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, conversation?.status, id, debugMode]);

  const fetchConversation = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await conversations.getById(id, debugMode);
      setConversation(response.data);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      if (!silent) {
        setError(err.response?.data?.error || 'Failed to load conversation');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      // Pass debugMode to include/exclude debug messages
      const response = await conversations.exportSingle(id, format, debugMode);

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `conversation-${conversation.session_id}.json`);
      } else {
        const extension = format === 'text' ? 'txt' : 'csv';
        downloadBlob(response.data, `conversation-${conversation.session_id}.${extension}`);
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export conversation');
    } finally {
      setExporting(false);
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    try {
      // Pass debugMode to include/exclude debug messages
      const response = await conversations.exportSingle(id, 'text', debugMode);
      const text = await response.data.text();
      await navigator.clipboard.writeText(text);
      alert('Conversation copied to clipboard!');
    } catch (err) {
      console.error('Copy failed:', err);
      alert('Failed to copy to clipboard');
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
      <ConversationHeader
        conversation={conversation}
        debugMode={debugMode}
        setDebugMode={setDebugMode}
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
        lastRefresh={lastRefresh}
        onRefresh={() => fetchConversation()}
        onBack={() => navigate('/conversations')}
      />

      {/* Metadata Cards */}
      <MetadataCards conversation={conversation} formatTokenCount={formatTokenCount} />

      {/* Export Buttons */}
      <ExportBar onCopy={copyToClipboard} onExport={handleExport} exporting={exporting} />

      {/* Debug Mode Legend */}
      {debugMode && <DebugLegend />}

      {/* Messages */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">
            {debugMode ? 'Full Conversation Transcript (Debug)' : 'Conversation Transcript'}
          </h3>
        </CardHeader>
        <CardBody className="p-0">
          <div className="divide-y divide-gray-200">
            {conversation.messages?.map((message, index) => (
              <MessageItem key={index} message={message} debugMode={debugMode} />
            ))}

            {(!conversation.messages || conversation.messages.length === 0) && (
              <div className="p-8 text-center text-gray-500">
                No messages in this conversation
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Tool Executions - only show in normal view (debug mode shows inline) */}
      {!debugMode && conversation.tool_executions?.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Tool Executions</h3>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-gray-200">
              {conversation.tool_executions.map((execution, index) => (
                <ToolExecutionItem key={index} execution={execution} />
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/**
 * Header with navigation and controls
 */
function ConversationHeader({
  conversation,
  debugMode,
  setDebugMode,
  autoRefresh,
  setAutoRefresh,
  lastRefresh,
  onRefresh,
  onBack,
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conversation Details</h1>
          <p className="text-gray-600 font-mono text-sm">{conversation.session_id}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {lastRefresh && (
          <span className="text-xs text-gray-500">
            Updated {Math.floor((new Date() - lastRefresh) / 1000)}s ago
          </span>
        )}

        <DebugToggle debugMode={debugMode} setDebugMode={setDebugMode} />
        <AutoRefreshToggle
          autoRefresh={autoRefresh}
          setAutoRefresh={setAutoRefresh}
          isActive={conversation.status === 'active'}
        />
        <RefreshButton onRefresh={onRefresh} />
      </div>
    </div>
  );
}

/**
 * Debug mode toggle button
 */
function DebugToggle({ debugMode, setDebugMode }) {
  return (
    <button
      onClick={() => setDebugMode(!debugMode)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        debugMode
          ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
      {debugMode ? 'Debug ON' : 'Debug OFF'}
    </button>
  );
}

/**
 * Auto-refresh toggle button
 */
function AutoRefreshToggle({ autoRefresh, setAutoRefresh, isActive }) {
  return (
    <button
      onClick={() => setAutoRefresh(!autoRefresh)}
      disabled={!isActive}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        !isActive
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : autoRefresh
          ? 'bg-green-100 text-green-700 hover:bg-green-200'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
      title={!isActive ? 'Auto-refresh only available for active conversations' : ''}
    >
      <svg
        className={`w-4 h-4 ${autoRefresh && isActive ? 'animate-spin' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {autoRefresh ? 'Auto ON' : 'Auto OFF'}
    </button>
  );
}

/**
 * Refresh button
 */
function RefreshButton({ onRefresh }) {
  return (
    <button
      onClick={onRefresh}
      className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      Refresh
    </button>
  );
}

/**
 * Metadata cards grid
 */
function MetadataCards({ conversation, formatTokenCount }) {
  const cards = [
    { label: 'Client', value: conversation.client_name || 'Unknown' },
    {
      label: 'Provider',
      value: (
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
      ),
    },
    { label: 'Messages', value: conversation.messages?.length || 0 },
    { label: 'Tool Calls', value: conversation.tool_executions?.length || 0 },
    {
      label: 'Tokens',
      value: (
        <span className="font-mono" title="Total tokens used in this conversation">
          {conversation.tokens_total ? formatTokenCount(conversation.tokens_total) : '0'}
        </span>
      ),
    },
    {
      label: 'Started',
      value: conversation.started_at
        ? new Date(conversation.started_at).toLocaleString()
        : 'N/A',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
      {cards.map((card, index) => (
        <Card key={index}>
          <CardBody className="p-4">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="font-medium text-gray-900">{card.value}</p>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
