import { useState, useEffect } from 'react';
import { email } from '../services/api';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Badge,
  Modal,
  Input,
  LoadingSpinner,
} from './common';

export default function EmailChannels({ clientId }) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [testEmail, setTestEmail] = useState({ to: '', subject: '', body: '' });
  const [testResult, setTestResult] = useState(null);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isTesting, setIsTesting] = useState(null);
  const [channelSettings, setChannelSettings] = useState({
    signature: '',
    auto_reply: true,
    monitoring_enabled: true,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    if (clientId) {
      fetchChannels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // Check for OAuth success/error in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const errorMsg = params.get('error');

    if (success === 'connected') {
      // Clear the URL params and refresh channels
      window.history.replaceState({}, '', window.location.pathname);
      fetchChannels();
    } else if (errorMsg) {
      setError(`Gmail connection failed: ${errorMsg}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const response = await email.getChannels(clientId);
      setChannels(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load email channels');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGmail = async () => {
    try {
      setIsConnecting(true);
      const response = await email.getAuthUrl(clientId);
      // Redirect to Google OAuth
      window.location.href = response.data.authUrl;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to initiate Gmail connection');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (channelId) => {
    if (!confirm('Are you sure you want to disconnect this email channel? The AI will no longer monitor this inbox.')) {
      return;
    }

    try {
      await email.disconnectChannel(channelId);
      fetchChannels();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disconnect email channel');
    }
  };

  const handleTestConnection = async (channelId) => {
    try {
      setIsTesting(channelId);
      const response = await email.testConnection(channelId);
      if (response.data.success) {
        alert(`Connection successful!\nEmail: ${response.data.email}\nTotal Messages: ${response.data.messagesTotal}`);
      } else {
        alert(`Connection failed: ${response.data.error}`);
      }
      fetchChannels();
    } catch (err) {
      alert(`Connection test failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setIsTesting(null);
    }
  };

  const handleOpenTestModal = (channel) => {
    setSelectedChannel(channel);
    setTestEmail({ to: '', subject: 'Test Email from AI Platform', body: 'This is a test email.' });
    setTestResult(null);
    setIsTestModalOpen(true);
  };

  const handleSendTestEmail = async () => {
    if (!testEmail.to || !testEmail.subject || !testEmail.body) {
      alert('Please fill in all fields');
      return;
    }

    try {
      setIsSendingTest(true);
      await email.sendTestEmail(selectedChannel.id, testEmail);
      setTestResult({ success: true, message: 'Test email sent successfully!' });
    } catch (err) {
      setTestResult({ success: false, message: err.response?.data?.error || 'Failed to send test email' });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleOpenSettingsModal = (channel) => {
    setSelectedChannel(channel);
    setChannelSettings({
      signature: channel.settings?.signature || '',
      auto_reply: channel.settings?.auto_reply !== false,
      monitoring_enabled: channel.settings?.monitoring_enabled !== false,
    });
    setIsSettingsModalOpen(true);
  };

  const handleSaveSettings = async () => {
    try {
      setIsSavingSettings(true);
      await email.updateChannel(selectedChannel.id, channelSettings);
      setIsSettingsModalOpen(false);
      fetchChannels();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'error':
        return <Badge variant="danger">Error</Badge>;
      case 'authenticating':
        return <Badge variant="warning">Authenticating</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Email Channels</h3>
          <p className="text-sm text-gray-500 mt-1">
            Connect Gmail accounts for AI-powered email support
          </p>
        </div>
        <Button onClick={handleConnectGmail} loading={isConnecting}>
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
          </svg>
          Connect Gmail
        </Button>
      </CardHeader>
      <CardBody>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 font-bold">&times;</button>
          </div>
        )}

        {channels.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500 mb-4">No email channels connected</p>
            <p className="text-sm text-gray-400">
              Connect a Gmail account to allow the AI to monitor and respond to customer emails
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{channel.email_address}</span>
                        {getStatusBadge(channel.status)}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {channel.channel_type === 'gmail' ? 'Gmail' : channel.channel_type}
                        {channel.last_checked_at && (
                          <span className="ml-2">
                            &bull; Last checked: {new Date(channel.last_checked_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {channel.last_error && (
                        <div className="text-sm text-red-600 mt-1">
                          Error: {channel.last_error}
                        </div>
                      )}
                      {channel.settings?.monitoring_enabled === false && (
                        <div className="text-sm text-yellow-600 mt-1">
                          Monitoring disabled
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTestConnection(channel.id)}
                      loading={isTesting === channel.id}
                    >
                      Test
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenTestModal(channel)}
                    >
                      Send Test
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenSettingsModal(channel)}
                    >
                      Settings
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDisconnect(channel.id)}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">How Email Channels Work</h4>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>The AI monitors connected Gmail accounts for new messages</li>
            <li>When a customer emails, the AI generates and sends a response</li>
            <li>All email conversations are logged and visible in the Conversations page</li>
            <li>Email threads are maintained for context-aware responses</li>
          </ul>
        </div>
      </CardBody>

      {/* Send Test Email Modal */}
      <Modal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        title="Send Test Email"
      >
        <div className="space-y-4">
          {testResult && (
            <div
              className={`p-3 rounded-lg ${
                testResult.success
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}
            >
              {testResult.message}
            </div>
          )}

          <Input
            label="To"
            type="email"
            value={testEmail.to}
            onChange={(e) => setTestEmail({ ...testEmail, to: e.target.value })}
            placeholder="recipient@example.com"
          />

          <Input
            label="Subject"
            value={testEmail.subject}
            onChange={(e) => setTestEmail({ ...testEmail, subject: e.target.value })}
            placeholder="Test Email Subject"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Body
            </label>
            <textarea
              value={testEmail.body}
              onChange={(e) => setTestEmail({ ...testEmail, body: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows="4"
              placeholder="Email body..."
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsTestModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendTestEmail} loading={isSendingTest}>
              Send Test Email
            </Button>
          </div>
        </div>
      </Modal>

      {/* Channel Settings Modal */}
      <Modal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        title="Email Channel Settings"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Signature
            </label>
            <textarea
              value={channelSettings.signature}
              onChange={(e) => setChannelSettings({ ...channelSettings, signature: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows="3"
              placeholder="Your email signature..."
            />
            <p className="text-xs text-gray-500 mt-1">
              This signature will be appended to all AI-generated email responses
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="auto_reply"
              checked={channelSettings.auto_reply}
              onChange={(e) => setChannelSettings({ ...channelSettings, auto_reply: e.target.checked })}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <label htmlFor="auto_reply" className="text-sm text-gray-700">
              Enable auto-reply (AI automatically responds to incoming emails)
            </label>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="monitoring_enabled"
              checked={channelSettings.monitoring_enabled}
              onChange={(e) => setChannelSettings({ ...channelSettings, monitoring_enabled: e.target.checked })}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <label htmlFor="monitoring_enabled" className="text-sm text-gray-700">
              Enable inbox monitoring (check for new emails periodically)
            </label>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setIsSettingsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} loading={isSavingSettings}>
              Save Settings
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
