import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { clients, tools as toolsApi } from '../services/api';
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

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [clientTools, setClientTools] = useState([]);
  const [allTools, setAllTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);
  const [isRegeneratingKey, setIsRegeneratingKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  const toolForm = useForm();

  useEffect(() => {
    fetchClientData();
  }, [id]);

  const fetchClientData = async () => {
    try {
      const [clientRes, toolsRes, allToolsRes] = await Promise.all([
        clients.getById(id),
        toolsApi.getByClient(id),
        toolsApi.getAll(),
      ]);
      setClient(clientRes.data);
      setClientTools(toolsRes.data);
      setAllTools(allToolsRes.data);
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
      await toolsApi.enableForClient(id, data);
      setIsToolModalOpen(false);
      toolForm.reset();
      fetchClientData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to enable tool');
    }
  };

  const handleDisableTool = async (toolId) => {
    if (!confirm('Are you sure you want to disable this tool?')) {
      return;
    }
    try {
      await toolsApi.disableForClient(id, toolId);
      fetchClientData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disable tool');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
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

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

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
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="mt-1 text-gray-900">
                  {new Date(client.created_at).toLocaleString()}
                </dd>
              </div>
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
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-mono overflow-hidden text-ellipsis">
                  {showApiKey ? client.api_key : '••••••••••••••••'}
                </code>
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="p-2 rounded-lg hover:bg-gray-100"
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
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={handleRegenerateApiKey}
                loading={isRegeneratingKey}
              >
                Regenerate API Key
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDisableTool(tool.id)}
                      >
                        Disable
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                    No tools enabled for this client
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Edit Client Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Client"
      >
        <form onSubmit={handleSubmit(onUpdateClient)} className="space-y-4">
          <Input
            label="Business Name"
            {...register('name', { required: 'Name is required' })}
            error={errors.name?.message}
          />

          <Input label="Domain" {...register('domain')} />

          <Select
            label="Plan Type"
            {...register('plan_type')}
            options={[
              { value: 'free', label: 'Free' },
              { value: 'starter', label: 'Starter' },
              { value: 'pro', label: 'Pro' },
            ]}
          />

          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)}>
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
        }}
        title="Enable Tool"
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
          />

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
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={toolForm.formState.isSubmitting}>
              Enable Tool
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
