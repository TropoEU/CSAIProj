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

  useEffect(() => {
    fetchConversation();
  }, [id]);

  const fetchConversation = async () => {
    try {
      const response = await conversations.getById(id);
      setConversation(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load conversation');
    } finally {
      setLoading(false);
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

      {/* Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardBody className="p-4">
            <p className="text-sm text-gray-500">Client</p>
            <p className="font-medium text-gray-900">{conversation.client_name || 'Unknown'}</p>
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
            <p className="text-sm text-gray-500">Started</p>
            <p className="font-medium text-gray-900">
              {new Date(conversation.created_at).toLocaleString()}
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
                        {new Date(message.created_at).toLocaleTimeString()}
                      </span>
                      {message.tokens && (
                        <Badge variant="default" className="text-xs">
                          {message.tokens} tokens
                        </Badge>
                      )}
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{message.content}</p>
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
                <div key={index} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="info">{execution.tool_name}</Badge>
                      <Badge
                        variant={
                          execution.status === 'success'
                            ? 'success'
                            : execution.status === 'error'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {execution.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-gray-500">
                      {execution.execution_time_ms}ms
                    </span>
                  </div>
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
