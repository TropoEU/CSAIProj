import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { conversations } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function ConversationDetail() {
  const { id } = useParams();
  const { t, isRTL, formatNumber, formatDate } = useLanguage();
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
        <Link to="/conversations" className="text-primary-600 hover:text-primary-700 text-sm font-medium inline-flex items-center gap-1">
          {isRTL ? '→' : '←'} {t('conversationDetail.backToConversations')}
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
        <Link to="/conversations" className="text-primary-600 hover:text-primary-700 text-sm font-medium mb-4 inline-flex items-center gap-1">
          {isRTL ? '→' : '←'} {t('conversationDetail.backToConversations')}
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">{t('conversationDetail.title')}</h1>
      </div>

      {/* Conversation Info */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">{t('conversationDetail.information')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">{t('conversationDetail.sessionId')}</p>
            <p className="text-sm font-mono text-gray-900">{conversation?.sessionId}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">{t('conversationDetail.status')}</p>
            <span className={`inline-block px-2 py-1 text-xs rounded-full ${
              conversation?.endedAt
                ? 'bg-gray-200 text-gray-700'
                : 'bg-green-100 text-green-700'
            }`}>
              {conversation?.endedAt ? t('conversations.ended') : t('conversations.active')}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-600">{t('conversationDetail.started')}</p>
            <p className="text-sm text-gray-900">
              {conversation?.startedAt ? formatDate(conversation.startedAt, { hour: 'numeric', minute: 'numeric' }) : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">{t('conversationDetail.ended')}</p>
            <p className="text-sm text-gray-900">
              {conversation?.endedAt ? formatDate(conversation.endedAt, { hour: 'numeric', minute: 'numeric' }) : t('conversationDetail.stillActive')}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">{t('conversations.messages')}</p>
            <p className="text-sm text-gray-900">{formatNumber(conversation?.messageCount || 0)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">{t('conversationDetail.totalTokens')}</p>
            <p className="text-sm text-gray-900">{formatNumber(conversation?.tokensTotal || 0)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">{t('conversations.provider')}</p>
            <p className="text-sm text-gray-900 capitalize">{conversation?.provider || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">{t('conversationDetail.model')}</p>
            <p className="text-sm text-gray-900">{conversation?.model || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">{t('conversations.messages')}</h2>
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
                    {msg.role === 'user' ? t('conversationDetail.user') : msg.role === 'assistant' ? t('conversationDetail.assistant') : msg.role}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDate(msg.timestamp, { hour: 'numeric', minute: 'numeric', second: 'numeric' })}
                  </span>
                </div>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{msg.content}</p>
                {msg.tokens > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    {t('conversationDetail.tokens')}: {formatNumber(msg.tokens)} | {t('conversationDetail.cumulative')}: {formatNumber(msg.tokensCumulative)}
                  </div>
                )}
                {msg.toolsCalled && msg.toolsCalled.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-gray-600 mb-1">{t('conversationDetail.toolsCalled')}:</p>
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
            <p className="text-center text-gray-500 py-8">{t('conversationDetail.noMessages')}</p>
          )}
        </div>
      </div>

      {/* Tool Executions */}
      {toolExecutions && toolExecutions.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">{t('conversationDetail.toolExecutions')}</h2>
          <div className="space-y-4">
            {toolExecutions.map((te) => (
              <div key={te.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900">{te.toolName}</p>
                    <p className="text-xs text-gray-500">{formatDate(te.executedAt, { hour: 'numeric', minute: 'numeric' })}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    te.status === 'success'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {te.status === 'success' ? t('conversationDetail.success') : t('conversationDetail.failed')}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">{t('conversationDetail.input')}:</p>
                    <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-x-auto" dir="ltr">
                      {JSON.stringify(te.inputParams, null, 2)}
                    </pre>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">{t('conversationDetail.result')}:</p>
                    <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-x-auto max-h-40" dir="ltr">
                      {JSON.stringify(te.result, null, 2)}
                    </pre>
                  </div>

                  {te.executionTime && (
                    <p className="text-xs text-gray-500">
                      {t('conversationDetail.executionTime')}: {formatNumber(te.executionTime)}ms
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
