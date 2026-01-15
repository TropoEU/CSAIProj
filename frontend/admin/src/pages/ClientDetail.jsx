/**
 * Client Detail Page
 * Shows client information, tools, widget configuration, and email channels
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { clients, tools as toolsApi, plans as plansApi, integrations } from '../services/api';
import api from '../services/api';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Select,
  Modal,
  LoadingSpinner,
  Badge,
} from '../components/common';
import EmailChannels from '../components/EmailChannels';
import { WidgetConfig, WidgetPreview, ClientTools, ClientAIBehavior } from '../components/client';

const CLIENT_TAB_KEY = 'admin_client_detail_tab';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    // URL param takes precedence, then localStorage, then default
    return searchParams.get('tab') || localStorage.getItem(CLIENT_TAB_KEY) || 'overview';
  });

  // Persist active tab to localStorage
  useEffect(() => {
    localStorage.setItem(CLIENT_TAB_KEY, activeTab);
  }, [activeTab]);
  const [client, setClient] = useState(null);
  const [clientTools, setClientTools] = useState([]);
  const [allTools, setAllTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRegeneratingKey, setIsRegeneratingKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [editApiKeyValue, setEditApiKeyValue] = useState('');
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [isRegeneratingAccessCode, setIsRegeneratingAccessCode] = useState(false);
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [widgetConfig, setWidgetConfig] = useState({
    position: 'bottom-right',
    primaryColor: '#667eea',
    backgroundColor: '#ffffff',
    headerBgColor: '#667eea',
    bodyBgColor: '#ffffff',
    footerBgColor: '#ffffff',
    aiBubbleColor: '#f3f4f6',
    userBubbleColor: '#667eea',
    headerTextColor: '#111827',
    aiTextColor: '#111827',
    userTextColor: '#ffffff',
    inputBgColor: '#f9fafb',
    inputTextColor: '#111827',
    buttonTextColor: '#ffffff',
    greeting: 'Hi! How can I help you today?',
    title: 'Chat Support',
    subtitle: 'We typically reply instantly',
  });
  const [showWidgetPreview, setShowWidgetPreview] = useState(false);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [clientIntegrations, setClientIntegrations] = useState([]);
  const [sendingEmail, setSendingEmail] = useState({ accessCode: false, welcome: false });
  const [emailMessage, setEmailMessage] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm();

  // Watch the LLM provider field for changes
  const selectedProvider = watch('llm_provider');

  // Available models per provider
  const AVAILABLE_MODELS = {
    groq: [
      { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile (Recommended)' },
      { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B Versatile' },
      { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant (Fast)' },
      { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
      { value: 'gemma2-9b-it', label: 'Gemma 2 9B' },
    ],
    claude: [
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Recommended)' },
      { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast & Cheap)' },
      { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus (Most Capable)' },
      { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
      { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
    ],
    openai: [
      { value: 'gpt-4o', label: 'GPT-4o (Recommended)' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast & Cheap)' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-4', label: 'GPT-4' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Cheapest)' },
    ],
  };

  // Auto-select default model when provider changes
  useEffect(() => {
    if (selectedProvider && selectedProvider !== 'ollama' && AVAILABLE_MODELS[selectedProvider]) {
      const currentModel = watch('model_name');
      const availableModels = AVAILABLE_MODELS[selectedProvider].map((m) => m.value);

      // If current model is not valid for this provider, set to default
      if (!availableModels.includes(currentModel)) {
        setValue('model_name', AVAILABLE_MODELS[selectedProvider][0].value);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvider, setValue, watch]);

  useEffect(() => {
    fetchClientData();
    fetchPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchPlans = async () => {
    try {
      const response = await plansApi.getAll(true); // Get active plans only
      setAvailablePlans(response.data || []);
    } catch (err) {
      console.error('Failed to load plans:', err);
      // Fallback to default plans if API fails
      setAvailablePlans([
        { id: 1, name: 'unlimited', display_name: 'Unlimited' },
        { id: 2, name: 'free', display_name: 'Free' },
        { id: 3, name: 'starter', display_name: 'Starter' },
        { id: 4, name: 'pro', display_name: 'Pro' },
        { id: 5, name: 'enterprise', display_name: 'Enterprise' },
      ]);
    }
  };

  useEffect(() => {
    if (client?.widget_config) {
      setWidgetConfig({
        position: client.widget_config.position || 'bottom-right',
        primaryColor: client.widget_config.primaryColor || '#667eea',
        backgroundColor: client.widget_config.backgroundColor || '#ffffff',
        headerBgColor:
          client.widget_config.headerBgColor || client.widget_config.primaryColor || '#667eea',
        bodyBgColor:
          client.widget_config.bodyBgColor || client.widget_config.backgroundColor || '#ffffff',
        footerBgColor:
          client.widget_config.footerBgColor || client.widget_config.backgroundColor || '#ffffff',
        aiBubbleColor: client.widget_config.aiBubbleColor || '#f3f4f6',
        userBubbleColor: client.widget_config.userBubbleColor || '#667eea',
        headerTextColor: client.widget_config.headerTextColor || '#111827',
        aiTextColor: client.widget_config.aiTextColor || '#111827',
        userTextColor: client.widget_config.userTextColor || '#ffffff',
        inputBgColor: client.widget_config.inputBgColor || '#f9fafb',
        inputTextColor: client.widget_config.inputTextColor || '#111827',
        buttonTextColor: client.widget_config.buttonTextColor || '#ffffff',
        greeting: client.widget_config.greeting || 'Hi! How can I help you today?',
        title: client.widget_config.title || 'Chat Support',
        subtitle: client.widget_config.subtitle || 'We typically reply instantly',
      });
    }
  }, [client]);

  // Reset form when edit modal opens to ensure it shows current client data
  useEffect(() => {
    if (isEditModalOpen && client) {
      reset(client);
    }
  }, [isEditModalOpen, client, reset]);

  const fetchClientData = async () => {
    try {
      const [clientRes, toolsRes, allToolsRes, integrationsRes] = await Promise.all([
        clients.getById(id),
        toolsApi.getByClient(id),
        toolsApi.getAll(),
        integrations.getByClient(id),
      ]);
      setClient(clientRes.data);
      setClientTools(toolsRes.data);
      setAllTools(allToolsRes.data);
      setClientIntegrations(integrationsRes.data || []);
      reset(clientRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load client');
    } finally {
      setLoading(false);
    }
  };

  const onUpdateClient = async (data) => {
    try {
      await clients.update(id, data);
      setIsEditModalOpen(false);
      fetchClientData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update client');
    }
  };

  const handleRegenerateApiKey = async () => {
    if (!confirm('Are you sure? The old API key will stop working immediately.')) {
      return;
    }
    setIsRegeneratingKey(true);
    try {
      await clients.regenerateApiKey(id);
      fetchClientData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to regenerate API key');
    } finally {
      setIsRegeneratingKey(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (editApiKeyValue.trim().length < 10) {
      alert('API key must be at least 10 characters');
      return;
    }
    setIsSavingApiKey(true);
    try {
      await clients.updateApiKey(id, editApiKeyValue.trim());
      fetchClientData();
      setIsEditingApiKey(false);
      setEditApiKeyValue('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update API key');
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const handleRegenerateAccessCode = async () => {
    if (
      !confirm('Are you sure? This will generate a new access code for the customer dashboard.')
    ) {
      return;
    }
    setIsRegeneratingAccessCode(true);
    try {
      await clients.regenerateAccessCode(id);
      fetchClientData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to regenerate access code');
    } finally {
      setIsRegeneratingAccessCode(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm('Are you sure you want to deactivate this client?')) {
      return;
    }
    try {
      await clients.update(id, { status: 'inactive' });
      fetchClientData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to deactivate client');
    }
  };

  const handleActivate = async () => {
    try {
      await clients.update(id, { status: 'active' });
      fetchClientData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to activate client');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const getClientEmail = () => {
    return client?.email || client?.business_info?.contact_email || null;
  };

  const sendAccessCodeEmail = async () => {
    const clientEmail = getClientEmail();
    if (!clientEmail) {
      setEmailMessage({
        type: 'error',
        text: 'No contact email set for this client. Add one in the Edit dialog.',
      });
      return;
    }

    setSendingEmail((prev) => ({ ...prev, accessCode: true }));
    try {
      await api.post('/email/platform/test', {
        to: clientEmail,
        type: 'access_code',
        clientId: client.id,
      });
      setEmailMessage({ type: 'success', text: `Access code sent to ${clientEmail}` });
    } catch (error) {
      setEmailMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to send email',
      });
    } finally {
      setSendingEmail((prev) => ({ ...prev, accessCode: false }));
    }
  };

  const sendWelcomeEmail = async () => {
    const clientEmail = getClientEmail();
    if (!clientEmail) {
      setEmailMessage({
        type: 'error',
        text: 'No contact email set for this client. Add one in the Edit dialog.',
      });
      return;
    }

    setSendingEmail((prev) => ({ ...prev, welcome: true }));
    try {
      await api.post('/email/platform/test', {
        to: clientEmail,
        type: 'welcome',
        clientId: client.id,
      });
      setEmailMessage({ type: 'success', text: `Welcome email sent to ${clientEmail}` });
    } catch (error) {
      setEmailMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to send email',
      });
    } finally {
      setSendingEmail((prev) => ({ ...prev, welcome: false }));
    }
  };

  const handleSaveWidgetConfig = async () => {
    try {
      await clients.update(id, { widget_config: widgetConfig });
      fetchClientData();
      alert('Widget configuration saved!');
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to save widget configuration';
      setError(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Client not found</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/clients')}>
          Back to Clients
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/clients')} className="p-2 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
            <p className="text-gray-600">{client.domain || 'No domain set'}</p>
          </div>
          <Badge variant={client.status === 'active' ? 'success' : 'danger'}>{client.status}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setIsEditModalOpen(true)}>
            Edit
          </Button>
          {client.status === 'active' ? (
            <Button variant="danger" onClick={handleDeactivate}>
              Deactivate
            </Button>
          ) : (
            <Button variant="success" onClick={handleActivate}>
              Activate
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <Link
            to={`/clients/${id}/business-info`}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              window.location.pathname === `/clients/${id}/business-info`
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Business Info
          </Link>
          <button
            onClick={() => setActiveTab('email')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'email'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Email Channels
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'ai'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            AI Behavior
          </button>
        </nav>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>
      )}

      {/* Email Tab Content */}
      {activeTab === 'email' && <EmailChannels clientId={id} />}

      {/* AI Behavior Tab Content */}
      {activeTab === 'ai' && client && <ClientAIBehavior clientId={id} clientName={client.name} />}

      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Quick Links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link to={`/usage?client=${id}`} className="block">
              <div className="bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg p-4 transition-colors">
                <div className="flex items-center gap-3">
                  <svg
                    className="w-6 h-6 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  <div>
                    <p className="font-semibold text-gray-900">View Usage Reports</p>
                    <p className="text-sm text-gray-600">See API consumption & costs</p>
                  </div>
                </div>
              </div>
            </Link>

            <Link to={`/billing?client=${id}`} className="block">
              <div className="bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg p-4 transition-colors">
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
                      d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  <div>
                    <p className="font-semibold text-gray-900">View Billing History</p>
                    <p className="text-sm text-gray-600">Invoices & payment status</p>
                  </div>
                </div>
              </div>
            </Link>

            <Link to={`/integrations?client=${id}`} className="block">
              <div className="bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg p-4 transition-colors">
                <div className="flex items-center gap-3">
                  <svg
                    className="w-6 h-6 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
                    />
                  </svg>
                  <div>
                    <p className="font-semibold text-gray-900">Manage Integrations</p>
                    <p className="text-sm text-gray-600">External system connections</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Client Info */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <h3 className="text-lg font-semibold">Client Information</h3>
              </CardHeader>
              <CardBody>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Business Name</dt>
                    <dd className="mt-1 text-gray-900">{client.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                    <dd className="mt-1 text-gray-900">{client.email || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Domain</dt>
                    <dd className="mt-1 text-gray-900">{client.domain || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Plan Type</dt>
                    <dd className="mt-1">
                      <Badge
                        variant={
                          client.plan_type === 'pro'
                            ? 'primary'
                            : client.plan_type === 'starter'
                              ? 'info'
                              : 'default'
                        }
                      >
                        {client.plan_type}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">LLM Provider</dt>
                    <dd className="mt-1">
                      <Badge variant="info">{client.llm_provider || 'ollama'}</Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Model Name</dt>
                    <dd className="mt-1 text-gray-900 font-mono text-sm">
                      {client.model_name || 'Default'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Language</dt>
                    <dd className="mt-1">
                      <Badge variant="info">
                        {client.language === 'he' ? 'Hebrew (עברית)' : 'English'}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Created</dt>
                    <dd className="mt-1 text-gray-900">
                      {new Date(client.created_at).toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                    <dd className="mt-1 text-gray-900">
                      {new Date(client.updated_at).toLocaleString()}
                    </dd>
                  </div>
                  {client.system_prompt && (
                    <div className="col-span-2">
                      <dt className="text-sm font-medium text-gray-500">System Prompt</dt>
                      <dd className="mt-1 text-gray-900 text-sm bg-gray-50 p-3 rounded-lg">
                        {client.system_prompt}
                      </dd>
                    </div>
                  )}
                </dl>
              </CardBody>
            </Card>

            {/* API Key */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">API Key</h3>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  {isEditingApiKey ? (
                    /* Edit Mode */
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Enter new API key
                        </label>
                        <input
                          type="text"
                          value={editApiKeyValue}
                          onChange={(e) => setEditApiKeyValue(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                          placeholder="Enter API key (min 10 characters)"
                          autoFocus
                        />
                        <p className="text-xs text-gray-500 mt-1">Must be at least 10 characters</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-1"
                          onClick={handleSaveApiKey}
                          loading={isSavingApiKey}
                          disabled={editApiKeyValue.trim().length < 10}
                        >
                          Save
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setIsEditingApiKey(false);
                            setEditApiKeyValue('');
                          }}
                          disabled={isSavingApiKey}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-mono overflow-hidden text-ellipsis">
                          {showApiKey ? client.api_key : '••••••••••••••••'}
                        </code>
                        <button
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="p-2 rounded-lg hover:bg-gray-100"
                          title={showApiKey ? 'Hide' : 'Show'}
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            {showApiKey ? (
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                              />
                            ) : (
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                            )}
                          </svg>
                        </button>
                        <button
                          onClick={() => copyToClipboard(client.api_key)}
                          className="p-2 rounded-lg hover:bg-gray-100"
                          title="Copy to clipboard"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setEditApiKeyValue(client.api_key || '');
                            setIsEditingApiKey(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1"
                          onClick={handleRegenerateApiKey}
                          loading={isRegeneratingKey}
                        >
                          Regenerate
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* Access Code for Customer Dashboard */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Customer Dashboard Access</h3>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  {emailMessage && (
                    <div
                      className={`p-3 rounded-lg text-sm ${
                        emailMessage.type === 'success'
                          ? 'bg-green-50 text-green-800 border border-green-200'
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span>{emailMessage.text}</span>
                        <button
                          onClick={() => setEmailMessage(null)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
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
                  <p className="text-sm text-gray-600">
                    Share this code with your client for customer dashboard login
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-lg font-mono font-bold text-center tracking-widest">
                      {showAccessCode ? client.access_code || 'Not generated' : '•••-•••'}
                    </code>
                    <button
                      onClick={() => setShowAccessCode(!showAccessCode)}
                      className="p-2 rounded-lg hover:bg-gray-100"
                      title={showAccessCode ? 'Hide' : 'Show'}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        {showAccessCode ? (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          />
                        ) : (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        )}
                      </svg>
                    </button>
                    <button
                      onClick={() => copyToClipboard(client.access_code)}
                      className="p-2 rounded-lg hover:bg-gray-100"
                      title="Copy to clipboard"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={sendAccessCodeEmail}
                      disabled={sendingEmail.accessCode}
                      className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 disabled:opacity-50"
                      title="Send access code via email"
                    >
                      {sendingEmail.accessCode ? (
                        <div className="w-5 h-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                      ) : (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={handleRegenerateAccessCode}
                      loading={isRegeneratingAccessCode}
                    >
                      Regenerate Code
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={sendWelcomeEmail}
                      loading={sendingEmail.welcome}
                    >
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      Welcome Email
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Widget Customization */}
          <WidgetConfig
            client={client}
            widgetConfig={widgetConfig}
            setWidgetConfig={setWidgetConfig}
            onSave={handleSaveWidgetConfig}
            showPreview={showWidgetPreview}
            onTogglePreview={() => setShowWidgetPreview(!showWidgetPreview)}
          />

          {/* Enabled Tools */}
          <ClientTools
            clientId={id}
            clientTools={clientTools}
            allTools={allTools}
            clientIntegrations={clientIntegrations}
            onRefresh={fetchClientData}
            setError={setError}
          />
        </>
      )}

      {/* Edit Client Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          if (client) {
            reset(client);
          }
          setIsEditModalOpen(false);
        }}
        title="Edit Client"
      >
        <form onSubmit={handleSubmit(onUpdateClient)} className="space-y-4">
          <Input
            label="Business Name"
            {...register('name', { required: 'Name is required' })}
            error={errors.name?.message}
          />

          <Input label="Email" type="email" {...register('email')} />

          <Input label="Domain" {...register('domain')} />

          <Select
            label="Plan Type"
            {...register('plan_type')}
            options={
              availablePlans.length > 0
                ? availablePlans.map((plan) => ({
                    value: plan.name,
                    label:
                      plan.display_name ||
                      (plan.name
                        ? plan.name.charAt(0).toUpperCase() + plan.name.slice(1)
                        : 'Unknown'),
                  }))
                : [
                    { value: 'unlimited', label: 'Unlimited' },
                    { value: 'free', label: 'Free' },
                    { value: 'starter', label: 'Starter' },
                    { value: 'pro', label: 'Pro' },
                    { value: 'enterprise', label: 'Enterprise' },
                  ]
            }
          />

          <Select
            label="LLM Provider"
            {...register('llm_provider')}
            options={[
              { value: 'ollama', label: 'Ollama (Local)' },
              { value: 'groq', label: 'Groq (Fast & Free)' },
              { value: 'claude', label: 'Claude (Anthropic)' },
              { value: 'openai', label: 'OpenAI (ChatGPT)' },
            ]}
          />

          {/* Conditional model field based on provider */}
          {selectedProvider === 'ollama' ? (
            <Input
              label="Model Name"
              {...register('model_name')}
              placeholder="e.g., hermes-2-pro-mistral-7b.q5_k_m.gguf"
            />
          ) : selectedProvider && AVAILABLE_MODELS[selectedProvider] ? (
            <Select
              label="Model Name"
              {...register('model_name')}
              options={AVAILABLE_MODELS[selectedProvider]}
            />
          ) : (
            <Input
              label="Model Name"
              {...register('model_name')}
              placeholder="Select a provider first"
              disabled
            />
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
            <textarea
              {...register('system_prompt')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows="3"
              placeholder="Custom instructions for this client's AI assistant..."
            />
          </div>

          <Select
            label="Language"
            {...register('language')}
            options={[
              { value: 'en', label: 'English' },
              { value: 'he', label: 'Hebrew (עברית)' },
            ]}
          />

          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (client) {
                  reset(client);
                }
                setIsEditModalOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Floating Widget Preview */}
      {showWidgetPreview && (
        <WidgetPreview widgetConfig={widgetConfig} onClose={() => setShowWidgetPreview(false)} />
      )}
    </div>
  );
}
