import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import AIBehaviorSettings from '../components/AIBehaviorSettings';
import GuidedReasoningSettings from '../components/GuidedReasoningSettings';

const SETTINGS_TAB_KEY = 'admin_settings_tab';

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    // Initialize from localStorage or default to 'email'
    return localStorage.getItem(SETTINGS_TAB_KEY) || 'email';
  });
  const [message, setMessage] = useState(null);

  // Persist active tab to localStorage
  useEffect(() => {
    localStorage.setItem(SETTINGS_TAB_KEY, activeTab);
  }, [activeTab]);

  // Platform email state
  const [platformEmail, setPlatformEmail] = useState({
    configured: false,
    email: null,
    loading: true,
  });
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    const success = searchParams.get('success');
    if (success === 'platform_email_connected') {
      setMessage({ type: 'success', text: 'Platform email connected successfully!' });
      setSearchParams({});
    }
    loadPlatformEmailStatus();
  }, [searchParams, setSearchParams]);

  const loadPlatformEmailStatus = async () => {
    try {
      const response = await api.get('/email/platform/status');
      setPlatformEmail({
        configured: response.data.configured,
        email: response.data.email,
        loading: false,
      });
    } catch (error) {
      console.error('Failed to load platform email status:', error);
      setPlatformEmail({ configured: false, email: null, loading: false });
    }
  };

  const connectPlatformEmail = async () => {
    try {
      const response = await api.get('/email/platform/authorize');
      window.location.href = response.data.authUrl;
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || error.message });
    }
  };

  const disconnectPlatformEmail = async () => {
    if (!confirm('Are you sure you want to disconnect the platform email?')) return;

    setDisconnecting(true);
    try {
      await api.delete('/email/platform/disconnect');
      setMessage({ type: 'success', text: 'Platform email disconnected' });
      loadPlatformEmailStatus();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || error.message });
    } finally {
      setDisconnecting(false);
    }
  };

  const tabs = [
    { id: 'email', name: 'Platform Email' },
    { id: 'ai', name: 'AI Behavior' },
    { id: 'guided', name: 'Guided Reasoning' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Message Alert */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : message.type === 'error'
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          <div className="flex justify-between items-start">
            <p>{message.text}</p>
            <button onClick={() => setMessage(null)} className="text-gray-500 hover:text-gray-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Platform Email Tab */}
      {activeTab === 'email' && (
        <PlatformEmailSection
          platformEmail={platformEmail}
          disconnecting={disconnecting}
          onConnect={connectPlatformEmail}
          onDisconnect={disconnectPlatformEmail}
        />
      )}

      {/* AI Behavior Tab */}
      {activeTab === 'ai' && <AIBehaviorSettings onMessage={setMessage} />}

      {/* Guided Reasoning Tab */}
      {activeTab === 'guided' && <GuidedReasoningSettings onMessage={setMessage} />}
    </div>
  );
}

function PlatformEmailSection({ platformEmail, disconnecting, onConnect, onDisconnect }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Platform Email Configuration</h2>
      <p className="text-gray-600 mb-4">
        Connect a Gmail account to send automated platform emails (access codes, invoices, welcome
        emails, etc.)
      </p>

      {platformEmail.loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
          Loading...
        </div>
      ) : platformEmail.configured ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-3">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="font-medium text-green-800">Connected</p>
                <p className="text-green-700">{platformEmail.email}</p>
              </div>
            </div>
            <button
              onClick={onDisconnect}
              disabled={disconnecting}
              className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
          <p className="text-sm text-gray-500">
            You can now send access codes and welcome emails from the Clients page, and send
            invoices from the Billing page.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <svg
              className="w-6 h-6 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="font-medium text-yellow-800">Not Configured</p>
              <p className="text-yellow-700 text-sm">
                Connect a Gmail account to enable transactional emails
              </p>
            </div>
          </div>
          <button
            onClick={onConnect}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            Connect Gmail Account
          </button>
        </div>
      )}
    </div>
  );
}
