import { useState, useEffect, useRef } from 'react';
import { clients, testChat } from '../services/api';
import { loadFilterState, saveFilterState, PAGE_KEYS } from '../utils/filterStorage';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Select,
  LoadingSpinner,
  Badge,
} from '../components/common';

export default function TestChat() {
  // Load filter state from localStorage
  const initialFilters = loadFilterState(PAGE_KEYS.TEST_CHAT, {
    selectedClient: null,
  });

  const [clientList, setClientList] = useState([]);
  const [selectedClient, setSelectedClient] = useState(initialFilters.selectedClient);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState([]);
  const messagesEndRef = useRef(null);

  // Save filter state when it changes
  useEffect(() => {
    saveFilterState(PAGE_KEYS.TEST_CHAT, {
      selectedClient,
    });
  }, [selectedClient]);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchClients = async () => {
    try {
      const response = await clients.getAll();
      setClientList(response.data.filter((c) => c.status === 'active'));
    } catch (err) {
      console.error('Failed to load clients:', err);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const generateSessionId = () => {
    return 'test_' + Date.now() + '_' + Math.random().toString(36).substring(7);
  };

  const handleStartChat = () => {
    if (!selectedClient) return;
    setSessionId(generateSessionId());
    setMessages([]);
    setDebugInfo([]);
  };

  const handleEndChat = () => {
    setSessionId(null);
    setMessages([]);
    setDebugInfo([]);
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !sessionId || sending) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setSending(true);

    // Add user message
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);

    try {
      const response = await testChat.sendMessage(selectedClient, userMessage, sessionId);
      const data = response.data;

      // Add assistant message
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.message,
          toolCalls: data.toolCalls,
          tokens: data.tokensUsed,
        },
      ]);

      // Add debug info
      if (debugMode) {
        setDebugInfo((prev) => [
          ...prev,
          {
            timestamp: new Date().toISOString(),
            request: { message: userMessage, sessionId },
            response: data,
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'system',
          content: `Error: ${err.response?.data?.error || 'Failed to send message'}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getClientName = () => {
    const client = clientList.find((c) => c.id === parseInt(selectedClient));
    return client?.name || 'Unknown Client';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Test Chat</h1>
          <p className="text-gray-600 mt-1">Test the AI as a customer would experience it</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Debug Mode
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Panel */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Select
                  value={selectedClient || ''}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  options={[
                    { value: '', label: 'Select a client...' },
                    ...clientList.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                  className="w-48"
                  disabled={!!sessionId}
                />
                {sessionId && <Badge variant="success">Active: {getClientName()}</Badge>}
              </div>
              <div className="flex gap-2">
                {!sessionId ? (
                  <Button size="sm" onClick={handleStartChat} disabled={!selectedClient}>
                    Start Chat
                  </Button>
                ) : (
                  <Button size="sm" variant="danger" onClick={handleEndChat}>
                    End Chat
                  </Button>
                )}
              </div>
            </CardHeader>

            {/* Messages Area */}
            <CardBody className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {!sessionId ? (
                <div className="h-full flex items-center justify-center text-gray-500">
                  Select a client and click "Start Chat" to begin testing
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500">
                  Send a message to start the conversation
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-2 ${
                          msg.role === 'user'
                            ? 'bg-primary-600 text-white'
                            : msg.role === 'system'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-white border border-gray-200'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        {msg.toolCalls?.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-xs text-gray-500 mb-1">Tools used:</p>
                            <div className="flex flex-wrap gap-1">
                              {msg.toolCalls.map((tool, i) => (
                                <Badge key={i} variant="info" className="text-xs">
                                  {tool.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {msg.tokens && debugMode && (
                          <p className="text-xs text-gray-400 mt-1">{msg.tokens} tokens</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {sending && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </CardBody>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={sessionId ? 'Type a message...' : 'Start a chat first'}
                  disabled={!sessionId || sending}
                  className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100"
                  rows={2}
                />
                <Button
                  onClick={handleSend}
                  disabled={!sessionId || !inputValue.trim() || sending}
                  loading={sending}
                >
                  Send
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Debug Panel */}
        {debugMode && (
          <div className="lg:col-span-1">
            <Card className="h-[600px] flex flex-col">
              <CardHeader>
                <h3 className="font-semibold">Debug Info</h3>
              </CardHeader>
              <CardBody className="flex-1 overflow-y-auto p-4 bg-gray-900">
                {debugInfo.length === 0 ? (
                  <p className="text-gray-500 text-center">
                    Debug info will appear here when messages are sent
                  </p>
                ) : (
                  <div className="space-y-4">
                    {debugInfo.map((info, index) => (
                      <div key={index} className="text-xs">
                        <p className="text-gray-500 mb-1">{info.timestamp}</p>
                        <pre className="text-green-400 bg-gray-800 p-2 rounded overflow-auto">
                          {JSON.stringify(info, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
