import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { escalations } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function EscalationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, isRTL, formatDate } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);

  const fetchEscalation = async () => {
    try {
      const response = await escalations.getById(id);
      setData(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch escalation:', err);
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEscalation();
  }, [id]);

  const handleAcknowledge = async () => {
    try {
      setIsAcknowledging(true);
      await escalations.acknowledge(id);
      await fetchEscalation();
    } catch (err) {
      console.error('Failed to acknowledge:', err);
      alert(t('escalations.acknowledgeFailed'));
    } finally {
      setIsAcknowledging(false);
    }
  };

  const handleResolve = async () => {
    try {
      setIsResolving(true);
      await escalations.resolve(id, resolveNotes);
      setShowResolveModal(false);
      await fetchEscalation();
    } catch (err) {
      console.error('Failed to resolve:', err);
      alert(t('escalations.resolveFailed'));
    } finally {
      setIsResolving(false);
    }
  };

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

  const getChannelIcon = (channel) => {
    switch (channel) {
      case 'email':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'whatsapp':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{error || t('escalations.notFound')}</p>
        <button
          onClick={() => navigate('/escalations')}
          className="btn btn-secondary mt-4"
        >
          {t('escalations.backToList')}
        </button>
      </div>
    );
  }

  const { escalation, conversation, customerInfo, triggerMessage, recentMessages } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/escalations')}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <svg className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('escalations.detailTitle')}</h1>
            <p className="text-gray-600 text-sm">ID: {escalation.id}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {escalation.status === 'pending' && (
            <button
              onClick={handleAcknowledge}
              disabled={isAcknowledging}
              className="btn btn-secondary"
            >
              {isAcknowledging ? t('common.loading') : t('escalations.acknowledge')}
            </button>
          )}
          {(escalation.status === 'pending' || escalation.status === 'acknowledged') && (
            <button
              onClick={() => setShowResolveModal(true)}
              className="btn btn-primary"
            >
              {t('escalations.resolve')}
            </button>
          )}
        </div>
      </div>

      {/* Status & Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Escalation Info */}
        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-4">{t('escalations.info')}</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('escalations.status')}</span>
              <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(escalation.status)}`}>
                {getStatusLabel(escalation.status)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('escalations.reason')}</span>
              <span className="text-sm font-medium">{getReasonLabel(escalation.reason)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('escalations.escalatedAt')}</span>
              <span className="text-sm">{formatDate(escalation.escalatedAt, { hour: 'numeric', minute: 'numeric' })}</span>
            </div>
            {escalation.acknowledgedAt && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{t('escalations.acknowledgedAt')}</span>
                <span className="text-sm">{formatDate(escalation.acknowledgedAt, { hour: 'numeric', minute: 'numeric' })}</span>
              </div>
            )}
            {escalation.resolvedAt && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{t('escalations.resolvedAt')}</span>
                <span className="text-sm">{formatDate(escalation.resolvedAt, { hour: 'numeric', minute: 'numeric' })}</span>
              </div>
            )}
          </div>
        </div>

        {/* Customer Contact Info */}
        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-4">{t('escalations.customerInfo')}</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {getChannelIcon(customerInfo.channel)}
              <span className="text-sm font-medium capitalize">{customerInfo.channel}</span>
            </div>
            {customerInfo.name && (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-sm">{customerInfo.name}</span>
              </div>
            )}
            {customerInfo.email && (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <a href={`mailto:${customerInfo.email}`} className="text-sm text-primary-600 hover:underline">
                  {customerInfo.email}
                </a>
              </div>
            )}
            {customerInfo.phone && (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <a href={`tel:${customerInfo.phone}`} className="text-sm text-primary-600 hover:underline">
                  {customerInfo.phone}
                </a>
              </div>
            )}
            {!customerInfo.name && !customerInfo.email && !customerInfo.phone && (
              <p className="text-sm text-gray-500 italic">{t('escalations.noContactInfo')}</p>
            )}
          </div>
        </div>

        {/* Conversation Info */}
        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-4">{t('escalations.conversationInfo')}</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('escalations.messages')}</span>
              <span className="text-sm font-medium">{conversation.messageCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('escalations.started')}</span>
              <span className="text-sm">{formatDate(conversation.startedAt, { hour: 'numeric', minute: 'numeric' })}</span>
            </div>
            {conversation.endedAt && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{t('escalations.ended')}</span>
                <span className="text-sm">{formatDate(conversation.endedAt, { hour: 'numeric', minute: 'numeric' })}</span>
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <Link
              to={`/conversations/${conversation.id}`}
              className="btn btn-secondary w-full"
            >
              {t('escalations.viewFullConversation')}
            </Link>
          </div>
        </div>
      </div>

      {/* Trigger Message */}
      {triggerMessage && (
        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-4">{t('escalations.triggerMessage')}</h3>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{triggerMessage.content}</p>
            <p className="text-xs text-gray-500 mt-2">
              {formatDate(triggerMessage.timestamp, { hour: 'numeric', minute: 'numeric' })}
            </p>
          </div>
        </div>
      )}

      {/* Recent Messages */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold">{t('escalations.recentMessages')}</h3>
          <p className="text-sm text-gray-500">{t('escalations.last10Messages')}</p>
        </div>
        <div className="divide-y divide-gray-200">
          {recentMessages && recentMessages.length > 0 ? (
            recentMessages.map((msg, index) => (
              <div
                key={index}
                className={`p-4 ${msg.role === 'assistant' ? 'bg-gray-50' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.role === 'user'
                        ? 'bg-primary-100 text-primary-600'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 text-sm">
                        {msg.role === 'user' ? t('escalations.customer') : t('escalations.ai')}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(msg.timestamp, { hour: 'numeric', minute: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">
              {t('escalations.noMessages')}
            </div>
          )}
        </div>
      </div>

      {/* Resolution Notes */}
      {escalation.notes && (
        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-4">{t('escalations.resolutionNotes')}</h3>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{escalation.notes}</p>
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">{t('escalations.resolveEscalation')}</h3>
            <p className="text-sm text-gray-600 mb-4">{t('escalations.resolveDescription')}</p>
            <textarea
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              rows={4}
              placeholder={t('escalations.notesPlaceholder')}
              className="input w-full mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowResolveModal(false)}
                disabled={isResolving}
                className="btn btn-secondary"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleResolve}
                disabled={isResolving}
                className="btn btn-primary"
              >
                {isResolving ? t('common.loading') : t('escalations.markResolved')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
