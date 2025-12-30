/**
 * TODO: REFACTOR - This component is too large (2000+ lines) and should be split
 *
 * Recommended extraction into separate components:
 * 1. ClientOverviewTab - Basic client info, stats, API key management
 * 2. ClientToolsTab - Tool configuration and management
 * 3. ClientIntegrationsTab - Integration setup and testing
 * 4. ClientWidgetConfigTab - Widget customization settings
 * 5. ClientBusinessInfoTab - Business information editor
 * 6. ClientEscalationsTab - Escalation settings and history
 *
 * Each tab component should:
 * - Receive client data and handlers as props
 * - Manage its own modal state
 * - Be independently testable
 *
 * This refactor will improve:
 * - Code maintainability and readability
 * - Testing isolation
 * - Bundle splitting (lazy load tabs)
 * - Developer experience (easier to find code)
 */
import { useState, useEffect, useRef } from 'react';
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
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '../components/common';
import EmailChannels from '../components/EmailChannels';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [client, setClient] = useState(null);
  const [clientTools, setClientTools] = useState([]);
  const [allTools, setAllTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);
  const [isEditToolModalOpen, setIsEditToolModalOpen] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [isRegeneratingKey, setIsRegeneratingKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [editApiKeyValue, setEditApiKeyValue] = useState('');
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [isRegeneratingAccessCode, setIsRegeneratingAccessCode] = useState(false);
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [isTestToolModalOpen, setIsTestToolModalOpen] = useState(false);
  const [testingTool, setTestingTool] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [isTestingTool, setIsTestingTool] = useState(false);
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
    subtitle: 'We typically reply instantly'
  });
  const [showWidgetPreview, setShowWidgetPreview] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [clientIntegrations, setClientIntegrations] = useState([]);
  const [selectedToolForEnable, setSelectedToolForEnable] = useState(null);
  const [integrationMapping, setIntegrationMapping] = useState({});
  const [sendingEmail, setSendingEmail] = useState({ accessCode: false, welcome: false });
  const [emailMessage, setEmailMessage] = useState(null);
  const previewRef = useRef(null);

  const testToolForm = useForm();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm();

  const toolForm = useForm();
  const editToolForm = useForm();

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
      const availableModels = AVAILABLE_MODELS[selectedProvider].map(m => m.value);

      // If current model is not valid for this provider, set to default
      if (!availableModels.includes(currentModel)) {
        setValue('model_name', AVAILABLE_MODELS[selectedProvider][0].value);
      }
    }
  }, [selectedProvider, setValue, watch]);

  useEffect(() => {
    fetchClientData();
    fetchPlans();
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
        headerBgColor: client.widget_config.headerBgColor || client.widget_config.primaryColor || '#667eea',
        bodyBgColor: client.widget_config.bodyBgColor || client.widget_config.backgroundColor || '#ffffff',
        footerBgColor: client.widget_config.footerBgColor || client.widget_config.backgroundColor || '#ffffff',
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
        subtitle: client.widget_config.subtitle || 'We typically reply instantly'
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
    if (!confirm('Are you sure? This will generate a new access code for the customer dashboard.')) {
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

  const handleEnableTool = async (data) => {
    try {
      // Include integration mapping if tool requires integrations
      const payload = {
        ...data,
        integrationMapping: integrationMapping
      };
      await toolsApi.enableForClient(id, payload);
      setIsToolModalOpen(false);
      toolForm.reset();
      setSelectedToolForEnable(null);
      setIntegrationMapping({});
      fetchClientData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to enable tool');
    }
  };

  const handleEditTool = (tool) => {
    setEditingTool(tool);
    editToolForm.reset({
      webhookUrl: tool.n8n_webhook_url || '',
    });
    // Load current integration mapping
    setIntegrationMapping(tool.integration_mapping || {});
    setIsEditToolModalOpen(true);
  };

  const handleUpdateTool = async (data) => {
    try {
      await toolsApi.updateForClient(id, editingTool.tool_id, {
        webhookUrl: data.webhookUrl,
        integrationMapping: integrationMapping
      });
      setIsEditToolModalOpen(false);
      setEditingTool(null);
      setIntegrationMapping({});
      editToolForm.reset();
      fetchClientData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update tool');
    }
  };

  const handleRemoveTool = async (toolId) => {
    if (!confirm('Are you sure you want to remove this tool from this client?')) {
      return;
    }
    try {
      await toolsApi.disableForClient(id, toolId);
      fetchClientData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove tool');
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
      setEmailMessage({ type: 'error', text: 'No contact email set for this client. Add one in the Edit dialog.' });
      return;
    }

    setSendingEmail(prev => ({ ...prev, accessCode: true }));
    try {
      await api.post('/email/platform/test', {
        to: clientEmail,
        type: 'access_code',
        clientId: client.id,
      });
      setEmailMessage({ type: 'success', text: `Access code sent to ${clientEmail}` });
    } catch (error) {
      setEmailMessage({ type: 'error', text: error.response?.data?.error || 'Failed to send email' });
    } finally {
      setSendingEmail(prev => ({ ...prev, accessCode: false }));
    }
  };

  const sendWelcomeEmail = async () => {
    const clientEmail = getClientEmail();
    if (!clientEmail) {
      setEmailMessage({ type: 'error', text: 'No contact email set for this client. Add one in the Edit dialog.' });
      return;
    }

    setSendingEmail(prev => ({ ...prev, welcome: true }));
    try {
      await api.post('/email/platform/test', {
        to: clientEmail,
        type: 'welcome',
        clientId: client.id,
      });
      setEmailMessage({ type: 'success', text: `Welcome email sent to ${clientEmail}` });
    } catch (error) {
      setEmailMessage({ type: 'error', text: error.response?.data?.error || 'Failed to send email' });
    } finally {
      setSendingEmail(prev => ({ ...prev, welcome: false }));
    }
  };

  const handleToggleToolEnabled = async (toolId, currentEnabledStatus) => {
    try {
      await toolsApi.updateForClient(id, toolId, {
        enabled: !currentEnabledStatus,
      });
      fetchClientData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to toggle tool');
    }
  };

  const handleTestTool = (tool) => {
    setTestingTool(tool);
    setTestResult(null);
    testToolForm.reset();
    setIsTestToolModalOpen(true);
  };

  const onTestTool = async (data) => {
    setIsTestingTool(true);
    setTestResult(null);
    try {
      const response = await toolsApi.testTool(id, testingTool.tool_id, data);
      setTestResult({ success: true, message: 'Tool test successful!', data: response.data });
    } catch (err) {
      setTestResult({
        success: false,
        message: err.response?.data?.error || 'Tool test failed',
      });
    } finally {
      setIsTestingTool(false);
    }
  };

  const handleSaveWidgetConfig = async () => {
    try {
      console.log('Saving widget config:', widgetConfig);
      const response = await clients.update(id, { widget_config: widgetConfig });
      console.log('Save response:', response);
      fetchClientData();
      alert('Widget configuration saved!');
    } catch (err) {
      console.error('Save widget config error:', err);
      console.error('Error response:', err.response);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to save widget configuration';
      setError(errorMessage);
      alert(`Error: ${errorMessage}`);
    }
  };

  const getWidgetEmbedCode = () => {
    // Use environment variables for URLs, with sensible defaults for local dev
    const widgetUrl = import.meta.env.VITE_WIDGET_URL || 'http://localhost:3001/widget.js';
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    return `<!-- AI Chat Widget -->
<script
  src="${widgetUrl}"
  data-api-key="${client?.api_key || 'YOUR_API_KEY'}"
  data-api-url="${apiUrl}"
  data-position="${widgetConfig.position}"
  data-primary-color="${widgetConfig.primaryColor}"
  data-background-color="${widgetConfig.backgroundColor}"
  data-header-bg-color="${widgetConfig.headerBgColor}"
  data-body-bg-color="${widgetConfig.bodyBgColor}"
  data-footer-bg-color="${widgetConfig.footerBgColor}"
  data-ai-bubble-color="${widgetConfig.aiBubbleColor}"
  data-user-bubble-color="${widgetConfig.userBubbleColor}"
  data-header-text-color="${widgetConfig.headerTextColor}"
  data-ai-text-color="${widgetConfig.aiTextColor}"
  data-user-text-color="${widgetConfig.userTextColor}"
  data-input-bg-color="${widgetConfig.inputBgColor}"
  data-input-text-color="${widgetConfig.inputTextColor}"
  data-button-text-color="${widgetConfig.buttonTextColor}"
  data-greeting="${widgetConfig.greeting}"
  data-title="${widgetConfig.title}"
  data-subtitle="${widgetConfig.subtitle}"
></script>`;
  };

  const handleCopyEmbedCode = () => {
    copyToClipboard(getWidgetEmbedCode());
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
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

  const enabledToolIds = clientTools.map((t) => t.tool_id);
  const availableTools = allTools.filter((t) => !enabledToolIds.includes(t.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/clients')}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
            <p className="text-gray-600">{client.domain || 'No domain set'}</p>
          </div>
          <Badge variant={client.status === 'active' ? 'success' : 'danger'}>
            {client.status}
          </Badge>
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email Channels
          </button>
        </nav>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Email Tab Content */}
      {activeTab === 'email' && (
        <EmailChannels clientId={id} />
      )}

      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        <>
      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to={`/usage?client=${id}`} className="block">
          <div className="bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg p-4 transition-colors">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
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
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
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
                  <Badge variant="info">
                    {client.llm_provider || 'ollama'}
                  </Badge>
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
                    <p className="text-xs text-gray-500 mt-1">
                      Must be at least 10 characters
                    </p>
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
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {showApiKey ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        )}
                      </svg>
                    </button>
                    <button
                      onClick={() => copyToClipboard(client.api_key)}
                      className="p-2 rounded-lg hover:bg-gray-100"
                      title="Copy to clipboard"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
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
                <div className={`p-3 rounded-lg text-sm ${
                  emailMessage.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  <div className="flex justify-between items-start">
                    <span>{emailMessage.text}</span>
                    <button onClick={() => setEmailMessage(null)} className="text-gray-500 hover:text-gray-700">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showAccessCode ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    )}
                  </svg>
                </button>
                <button
                  onClick={() => copyToClipboard(client.access_code)}
                  className="p-2 rounded-lg hover:bg-gray-100"
                  title="Copy to clipboard"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
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
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Welcome Email
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Widget Customization */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Widget Customization</h3>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowWidgetPreview(!showWidgetPreview)}
            >
              {showWidgetPreview ? 'Hide' : 'Show'} Preview
            </Button>
            <Button size="sm" onClick={handleSaveWidgetConfig}>
              Save Configuration
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Widget Configuration Form */}
            <div className="space-y-6">
              {/* Basic Settings */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Basic Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Widget Position
                    </label>
                    <select
                      value={widgetConfig.position}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, position: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                    >
                      <option value="bottom-right">Bottom Right</option>
                      <option value="bottom-left">Bottom Left</option>
                      <option value="top-right">Top Right</option>
                      <option value="top-left">Top Left</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Chat Title
                    </label>
                    <input
                      type="text"
                      value={widgetConfig.title}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                      placeholder="Chat Support"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Chat Subtitle
                    </label>
                    <input
                      type="text"
                      value={widgetConfig.subtitle}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, subtitle: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                      placeholder="We typically reply instantly"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Greeting Message
                    </label>
                    <textarea
                      value={widgetConfig.greeting}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, greeting: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                      rows="2"
                      placeholder="Hi! How can I help you today?"
                    />
                  </div>
                </div>
              </div>

              {/* Color Settings */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Color Customization</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Primary Color
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={widgetConfig.primaryColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, primaryColor: e.target.value })}
                          className="h-9 w-12 rounded border border-gray-300"
                        />
                        <input
                          type="text"
                          value={widgetConfig.primaryColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, primaryColor: e.target.value })}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Background
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={widgetConfig.backgroundColor}
                          onChange={(e) => {
                            const bg = e.target.value;
                            setWidgetConfig({ 
                              ...widgetConfig, 
                              backgroundColor: bg,
                              bodyBgColor: widgetConfig.bodyBgColor === widgetConfig.backgroundColor ? bg : widgetConfig.bodyBgColor,
                              footerBgColor: widgetConfig.footerBgColor === widgetConfig.backgroundColor ? bg : widgetConfig.footerBgColor
                            });
                          }}
                          className="h-9 w-12 rounded border border-gray-300"
                        />
                        <input
                          type="text"
                          value={widgetConfig.backgroundColor}
                          onChange={(e) => {
                            const bg = e.target.value;
                            setWidgetConfig({ 
                              ...widgetConfig, 
                              backgroundColor: bg,
                              bodyBgColor: widgetConfig.bodyBgColor === widgetConfig.backgroundColor ? bg : widgetConfig.bodyBgColor,
                              footerBgColor: widgetConfig.footerBgColor === widgetConfig.backgroundColor ? bg : widgetConfig.footerBgColor
                            });
                          }}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Header Background
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={widgetConfig.headerBgColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, headerBgColor: e.target.value })}
                          className="h-9 w-12 rounded border border-gray-300"
                        />
                        <input
                          type="text"
                          value={widgetConfig.headerBgColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, headerBgColor: e.target.value })}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Body Background
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={widgetConfig.bodyBgColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, bodyBgColor: e.target.value })}
                          className="h-9 w-12 rounded border border-gray-300"
                        />
                        <input
                          type="text"
                          value={widgetConfig.bodyBgColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, bodyBgColor: e.target.value })}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Footer Background
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={widgetConfig.footerBgColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, footerBgColor: e.target.value })}
                          className="h-9 w-12 rounded border border-gray-300"
                        />
                        <input
                          type="text"
                          value={widgetConfig.footerBgColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, footerBgColor: e.target.value })}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        AI Bubble
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={widgetConfig.aiBubbleColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, aiBubbleColor: e.target.value })}
                          className="h-9 w-12 rounded border border-gray-300"
                        />
                        <input
                          type="text"
                          value={widgetConfig.aiBubbleColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, aiBubbleColor: e.target.value })}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        User Bubble
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={widgetConfig.userBubbleColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, userBubbleColor: e.target.value })}
                          className="h-9 w-12 rounded border border-gray-300"
                        />
                        <input
                          type="text"
                          value={widgetConfig.userBubbleColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, userBubbleColor: e.target.value })}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Header Text
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={widgetConfig.headerTextColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, headerTextColor: e.target.value })}
                          className="h-9 w-12 rounded border border-gray-300"
                        />
                        <input
                          type="text"
                          value={widgetConfig.headerTextColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, headerTextColor: e.target.value })}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        AI Text
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={widgetConfig.aiTextColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, aiTextColor: e.target.value })}
                          className="h-9 w-12 rounded border border-gray-300"
                        />
                        <input
                          type="text"
                          value={widgetConfig.aiTextColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, aiTextColor: e.target.value })}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        User Text
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={widgetConfig.userTextColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, userTextColor: e.target.value })}
                          className="h-9 w-12 rounded border border-gray-300"
                        />
                        <input
                          type="text"
                          value={widgetConfig.userTextColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, userTextColor: e.target.value })}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Button Text
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={widgetConfig.buttonTextColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, buttonTextColor: e.target.value })}
                          className="h-9 w-12 rounded border border-gray-300"
                        />
                        <input
                          type="text"
                          value={widgetConfig.buttonTextColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, buttonTextColor: e.target.value })}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Input Background
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={widgetConfig.inputBgColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, inputBgColor: e.target.value })}
                          className="h-9 w-12 rounded border border-gray-300"
                        />
                        <input
                          type="text"
                          value={widgetConfig.inputBgColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, inputBgColor: e.target.value })}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Input Text
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={widgetConfig.inputTextColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, inputTextColor: e.target.value })}
                          className="h-9 w-12 rounded border border-gray-300"
                        />
                        <input
                          type="text"
                          value={widgetConfig.inputTextColor}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, inputTextColor: e.target.value })}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Embed Code */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Embed Code
                </label>
                <div className="relative">
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto font-mono">
                    {getWidgetEmbedCode()}
                  </pre>
                  <button
                    onClick={handleCopyEmbedCode}
                    className="absolute top-2 right-2 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedEmbed ? (
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">How to Install</h4>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Copy the embed code above</li>
                  <li>Paste it before the closing &lt;/body&gt; tag in your website</li>
                  <li>The chat widget will appear automatically on your site</li>
                  <li>Customize appearance and behavior using the form on the left</li>
                </ol>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  💡 <strong>Tip:</strong> Click "Show Preview" to see a floating widget preview that appears like it would on your client's website!
                </p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Enabled Tools */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Enabled Tools</h3>
          <Button size="sm" onClick={() => setIsToolModalOpen(true)} disabled={availableTools.length === 0}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Tool
          </Button>
        </CardHeader>
        <CardBody className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Tool Name</TableHeader>
                <TableHeader>Description</TableHeader>
                <TableHeader>Webhook URL</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {clientTools.length > 0 ? (
                clientTools.map((tool) => (
                  <TableRow key={tool.id}>
                    <TableCell className="font-medium text-gray-900">
                      {tool.tool_name}
                    </TableCell>
                    <TableCell className="text-gray-500 max-w-xs truncate">
                      {tool.description}
                    </TableCell>
                    <TableCell className="text-gray-500 max-w-xs truncate font-mono text-xs">
                      {tool.n8n_webhook_url || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tool.enabled ? 'success' : 'default'}>
                        {tool.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleToolEnabled(tool.tool_id, tool.enabled)}
                        >
                          {tool.enabled ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTestTool(tool)}
                        >
                          Test
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTool(tool)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleRemoveTool(tool.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                    No tools enabled for this client
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
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

          <Input
            label="Email"
            type="email"
            {...register('email')}
          />

          <Input label="Domain" {...register('domain')} />

          <Select
            label="Plan Type"
            {...register('plan_type')}
            options={availablePlans.length > 0 
              ? availablePlans.map(plan => ({
                  value: plan.name,
                  label: plan.display_name || (plan.name ? plan.name.charAt(0).toUpperCase() + plan.name.slice(1) : 'Unknown'),
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              System Prompt
            </label>
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

      {/* Add Tool Modal */}
      <Modal
        isOpen={isToolModalOpen}
        onClose={() => {
          setIsToolModalOpen(false);
          toolForm.reset();
          setSelectedToolForEnable(null);
          setIntegrationMapping({});
        }}
        title="Enable Tool"
        size="lg"
      >
        <form onSubmit={toolForm.handleSubmit(handleEnableTool)} className="space-y-4">
          <Select
            label="Select Tool"
            {...toolForm.register('toolId', { required: 'Please select a tool' })}
            error={toolForm.formState.errors.toolId?.message}
            options={[
              { value: '', label: 'Choose a tool...' },
              ...availableTools.map((tool) => ({
                value: tool.id,
                label: tool.tool_name,
              })),
            ]}
            onChange={(e) => {
              const tool = allTools.find(t => t.id === parseInt(e.target.value));
              setSelectedToolForEnable(tool);
              setIntegrationMapping({});
            }}
          />

          {/* Show required integrations if tool has any */}
          {selectedToolForEnable?.required_integrations && selectedToolForEnable.required_integrations.length > 0 && (
            <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50">
              <h4 className="font-medium text-indigo-900 mb-3">Required Integrations</h4>
              <p className="text-sm text-indigo-700 mb-4">
                This tool needs the following integrations. Map each to your client's configured integrations:
              </p>
              <div className="space-y-3">
                {selectedToolForEnable.required_integrations.map((reqInt, idx) => (
                  <div key={idx} className="bg-white p-3 rounded border border-indigo-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">
                        {reqInt.name || reqInt.key}
                        {reqInt.required && <span className="text-red-500 ml-1">*</span>}
                      </span>
                      {!reqInt.required && (
                        <span className="text-xs text-gray-500">Optional</span>
                      )}
                    </div>
                    {reqInt.description && (
                      <p className="text-xs text-gray-600 mb-2">{reqInt.description}</p>
                    )}
                    <Select
                      label=""
                      value={integrationMapping[reqInt.key] || ''}
                      onChange={(e) => setIntegrationMapping({
                        ...integrationMapping,
                        [reqInt.key]: e.target.value ? parseInt(e.target.value) : null
                      })}
                      options={[
                        { value: '', label: reqInt.required ? 'Select integration...' : 'None (skip this integration)' },
                        ...clientIntegrations
                          .filter(int => int.status === 'active')
                          .map(int => ({
                            value: int.id,
                            label: `${int.name} (${int.integration_type})`
                          }))
                      ]}
                    />
                    {reqInt.required && !integrationMapping[reqInt.key] && (
                      <p className="text-xs text-red-600 mt-1">
                        This integration is required. {clientIntegrations.length === 0 ? 'Please add an integration for this client first.' : 'Please select an integration.'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {clientIntegrations.length === 0 && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800">
                    This client has no integrations configured. Add integrations on the{' '}
                    <Link to={`/integrations?client=${id}`} className="underline font-medium">
                      Integrations page
                    </Link>
                    {' '}before enabling this tool.
                  </p>
                </div>
              )}
            </div>
          )}

          <Input
            label="Webhook URL"
            {...toolForm.register('webhookUrl', { required: 'Webhook URL is required' })}
            error={toolForm.formState.errors.webhookUrl?.message}
            placeholder="http://localhost:5678/webhook/tool_name"
          />

          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsToolModalOpen(false);
                toolForm.reset();
                setSelectedToolForEnable(null);
                setIntegrationMapping({});
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={toolForm.formState.isSubmitting}
              disabled={
                selectedToolForEnable?.required_integrations?.some(
                  reqInt => reqInt.required && !integrationMapping[reqInt.key]
                )
              }
            >
              Enable Tool
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Tool Modal */}
      <Modal
        isOpen={isEditToolModalOpen}
        onClose={() => {
          setIsEditToolModalOpen(false);
          setEditingTool(null);
          setIntegrationMapping({});
          editToolForm.reset();
        }}
        title="Edit Tool Configuration"
        size="lg"
      >
        {editingTool && (
          <form onSubmit={editToolForm.handleSubmit(handleUpdateTool)} className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-gray-900">{editingTool.tool_name}</p>
              <p className="text-xs text-gray-600 mt-1">{editingTool.description}</p>
            </div>

            {/* Integration Mapping Section - Always visible */}
            <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50">
              <h4 className="font-medium text-indigo-900 mb-2">Integration Mapping</h4>
              <p className="text-xs text-indigo-700 mb-3">
                Connect this tool to your client's integrations. The tool will use these APIs when executed.
              </p>

              {(!editingTool.required_integrations || editingTool.required_integrations.length === 0) ? (
                <div className="bg-white p-3 rounded border border-indigo-200">
                  <p className="text-sm text-gray-500 italic">
                    This tool has no required integrations defined.
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    To add integration requirements, edit the generic tool in the Tools page.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {editingTool.required_integrations.map((reqInt, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border border-indigo-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">
                          {reqInt.name || reqInt.key}
                          {reqInt.required && <span className="text-red-500 ml-1">*</span>}
                        </span>
                        <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded">
                          key: {reqInt.key}
                        </span>
                      </div>
                      {reqInt.description && (
                        <p className="text-xs text-gray-600 mb-2">{reqInt.description}</p>
                      )}
                      <Select
                        label=""
                        value={integrationMapping[reqInt.key] || ''}
                        onChange={(e) => setIntegrationMapping({
                          ...integrationMapping,
                          [reqInt.key]: e.target.value ? parseInt(e.target.value) : null
                        })}
                        options={[
                          { value: '', label: reqInt.required ? 'Select an integration...' : 'None (optional)' },
                          ...clientIntegrations
                            .filter(int => int.status === 'active')
                            .map(int => ({
                              value: int.id,
                              label: `${int.name} (type: ${int.integration_type})`
                            }))
                        ]}
                      />
                      {reqInt.required && !integrationMapping[reqInt.key] && (
                        <p className="text-xs text-amber-600 mt-1">
                          This integration is required for the tool to work
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {clientIntegrations.filter(int => int.status === 'active').length === 0 && (
                <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                  No active integrations found. Create integrations in the Integrations page first.
                </div>
              )}
            </div>

            <Input
              label="Webhook URL"
              {...editToolForm.register('webhookUrl', { required: 'Webhook URL is required' })}
              error={editToolForm.formState.errors.webhookUrl?.message}
              placeholder="http://localhost:5678/webhook/tool_name"
            />

            <div className="flex justify-end gap-3 mt-6">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsEditToolModalOpen(false);
                  setEditingTool(null);
                  setIntegrationMapping({});
                  editToolForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={editToolForm.formState.isSubmitting}
                disabled={
                  editingTool?.required_integrations?.some(
                    reqInt => reqInt.required && !integrationMapping[reqInt.key]
                  )
                }
              >
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Test Tool Modal */}
      <Modal
        isOpen={isTestToolModalOpen}
        onClose={() => {
          setIsTestToolModalOpen(false);
          setTestingTool(null);
          setTestResult(null);
          testToolForm.reset();
        }}
        title="Test Tool"
      >
        {testingTool && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-gray-900">{testingTool.tool_name}</p>
              <p className="text-xs text-gray-600 mt-1">{testingTool.description}</p>
              <p className="text-xs text-gray-500 mt-1 font-mono">{testingTool.n8n_webhook_url}</p>
            </div>

            {testResult && (
              <div
                className={`p-4 rounded-lg ${
                  testResult.success
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    testResult.success ? 'text-green-800' : 'text-red-800'
                  }`}
                >
                  {testResult.success ? '✓ Test Successful' : '✗ Test Failed'}
                </p>
                <p
                  className={`text-sm mt-1 ${
                    testResult.success ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {testResult.message}
                </p>
                {testResult.data && (
                  <pre className="mt-2 text-xs bg-white p-2 rounded overflow-x-auto">
                    {JSON.stringify(testResult.data, null, 2)}
                  </pre>
                )}
              </div>
            )}

            <form onSubmit={testToolForm.handleSubmit(onTestTool)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Test Parameters (JSON)
                </label>
                <textarea
                  {...testToolForm.register('parameters')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                  rows="6"
                  placeholder='{"orderNumber": "12345"}'
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter test parameters in JSON format based on the tool's parameter schema
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsTestToolModalOpen(false);
                    setTestingTool(null);
                    setTestResult(null);
                    testToolForm.reset();
                  }}
                >
                  Close
                </Button>
                <Button type="submit" loading={isTestingTool}>
                  Run Test
                </Button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* Floating Widget Preview */}
      {showWidgetPreview && (
        <div
          className="fixed z-50 shadow-2xl"
          style={{
            [widgetConfig.position.includes('bottom') ? 'bottom' : 'top']: '20px',
            [widgetConfig.position.includes('right') ? 'right' : 'left']: '20px',
            position: 'fixed',
          }}
        >
          <div
            className="rounded-lg shadow-xl overflow-hidden flex flex-col"
            style={{
              width: '400px',
              height: '600px',
              backgroundColor: widgetConfig.bodyBgColor
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between p-4 flex-shrink-0"
              style={{ 
                backgroundColor: widgetConfig.headerBgColor,
                color: widgetConfig.headerTextColor
              }}
            >
              <div>
                <h3
                  className="font-semibold text-base"
                  style={{ color: widgetConfig.headerTextColor }}
                >
                  {widgetConfig.title}
                </h3>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: widgetConfig.headerTextColor, opacity: 0.9 }}
                >
                  {widgetConfig.subtitle}
                </p>
              </div>
              <button
                onClick={() => setShowWidgetPreview(false)}
                className="w-8 h-8 rounded flex items-center justify-center hover:opacity-80 transition-opacity"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                }}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{ fill: widgetConfig.buttonTextColor }}>
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>

            {/* Messages Area */}
            <div
              className="p-5 overflow-y-auto flex-1"
              style={{
                backgroundColor: widgetConfig.bodyBgColor
              }}
            >
              {/* AI Greeting Message */}
              <div className="mb-3 flex flex-col items-start">
                <div
                  className="inline-block rounded-lg px-3.5 py-2.5 max-w-[80%]"
                  style={{
                    backgroundColor: widgetConfig.aiBubbleColor,
                    color: widgetConfig.aiTextColor,
                    borderBottomLeftRadius: '4px'
                  }}
                >
                  <p className="text-sm whitespace-pre-wrap">{widgetConfig.greeting}</p>
                </div>
                <div className="text-xs mt-1 px-1" style={{ color: '#666' }}>
                  {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </div>
              </div>

              {/* Sample User Message */}
              <div className="mb-3 flex flex-col items-end">
                <div
                  className="inline-block rounded-lg px-3.5 py-2.5 max-w-[80%]"
                  style={{
                    backgroundColor: widgetConfig.userBubbleColor,
                    color: widgetConfig.userTextColor,
                    borderBottomRightRadius: '4px'
                  }}
                >
                  <p className="text-sm">Hello! I need help with my order.</p>
                </div>
                <div className="text-xs mt-1 px-1" style={{ color: '#666' }}>
                  {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </div>
              </div>

              {/* Sample AI Response */}
              <div className="mb-3 flex flex-col items-start">
                <div
                  className="inline-block rounded-lg px-3.5 py-2.5 max-w-[80%]"
                  style={{
                    backgroundColor: widgetConfig.aiBubbleColor,
                    color: widgetConfig.aiTextColor,
                    borderBottomLeftRadius: '4px'
                  }}
                >
                  <p className="text-sm">I'd be happy to help you with your order! Could you please provide your order number?</p>
                </div>
                <div className="text-xs mt-1 px-1" style={{ color: '#666' }}>
                  {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </div>
              </div>
            </div>

            {/* Input Area */}
            <div
              className="p-4 border-t flex-shrink-0"
              style={{ 
                backgroundColor: widgetConfig.footerBgColor,
                borderColor: '#e0e0e0'
              }}
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2.5 rounded-full text-sm border focus:outline-none focus:ring-2 focus:ring-opacity-50"
                  style={{
                    backgroundColor: widgetConfig.inputBgColor,
                    color: widgetConfig.inputTextColor,
                    borderColor: '#e0e0e0'
                  }}
                  disabled
                />
                <button
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-90 transition-opacity flex-shrink-0"
                  style={{
                    backgroundColor: widgetConfig.primaryColor,
                  }}
                  disabled
                >
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ fill: widgetConfig.buttonTextColor, width: '18px', height: '18px' }}>
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Preview Label */}
          <div className="absolute -top-8 left-0 right-0 text-center">
            <span className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full shadow-lg">
              Live Preview
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
