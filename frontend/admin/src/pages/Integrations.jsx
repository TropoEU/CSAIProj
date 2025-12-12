import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { integrations, clients } from '../services/api';
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

// Auth methods for API integrations
const AUTH_METHODS = [
  { value: 'bearer', label: 'Bearer Token (Authorization: Bearer {apiKey})' },
  { value: 'api_key', label: 'API Key Header (X-API-Key: {apiKey})' },
  { value: 'basic', label: 'Basic Auth (apiKey:apiSecret)' },
  { value: 'custom', label: 'Custom (use headers in config)' },
  { value: 'none', label: 'No Authentication' },
];

export default function Integrations() {
  const [searchParams] = useSearchParams();
  const [clientList, setClientList] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [integrationList, setIntegrationList] = useState([]);
  const [integrationTypes, setIntegrationTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm();

  useEffect(() => {
    fetchClients();
    fetchIntegrationTypes();
  }, []);

  const fetchIntegrationTypes = async () => {
    try {
      const response = await integrations.getTypes();
      console.log('Integration types response:', response);
      const types = response.data || response || [];
      setIntegrationTypes(Array.isArray(types) ? types : []);
    } catch (err) {
      console.error('Failed to load integration types:', err);
      // Fallback types if API fails
      setIntegrationTypes([
        { type: 'inventory_api', name: 'Inventory API', description: 'Product stock and availability' },
        { type: 'order_api', name: 'Order API', description: 'Order status and management' },
        { type: 'customer_api', name: 'Customer API', description: 'Customer data and profiles' },
        { type: 'booking_api', name: 'Booking API', description: 'Appointments and reservations' },
        { type: 'custom_api', name: 'Custom API', description: 'Any custom REST API' },
      ]);
    }
  };

  useEffect(() => {
    if (selectedClient) {
      fetchIntegrations(selectedClient);
    }
  }, [selectedClient]);

  const fetchClients = async () => {
    try {
      const response = await clients.getAll();
      setClientList(response.data);

      // Check if client ID is in query params
      const clientIdFromQuery = searchParams.get('client');
      if (clientIdFromQuery && response.data.some(c => c.id === parseInt(clientIdFromQuery))) {
        setSelectedClient(parseInt(clientIdFromQuery));
      } else if (response.data.length > 0) {
        setSelectedClient(response.data[0].id);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const fetchIntegrations = async (clientId) => {
    setLoading(true);
    setTestResult(null); // Clear test result when fetching to show actual status
    try {
      const response = await integrations.getByClient(clientId);
      setIntegrationList(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      if (editingIntegration) {
        await integrations.update(editingIntegration.id, data);
      } else {
        await integrations.create(selectedClient, data);
      }
      setIsModalOpen(false);
      setEditingIntegration(null);
      reset();
      fetchIntegrations(selectedClient);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save integration');
    }
  };

  const handleEdit = (integration) => {
    setEditingIntegration(integration);
    setValue('integrationType', integration.integration_type);
    setValue('name', integration.name);
    setValue('apiUrl', integration.connection_config?.api_url || '');
    setValue('apiKey', ''); // Don't show existing API key
    setValue('apiSecret', '');
    setValue('authMethod', integration.connection_config?.auth_method || 'bearer');

    // Extract extra config (everything except standard fields)
    const { name, api_url, api_key, api_secret, auth_method, headers, ...extraConfig } = integration.connection_config || {};
    setValue('config', Object.keys(extraConfig).length > 0 ? JSON.stringify(extraConfig, null, 2) : '');
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this integration?')) {
      return;
    }
    try {
      await integrations.delete(id);
      fetchIntegrations(selectedClient);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete integration');
    }
  };

  const handleToggle = async (id) => {
    try {
      await integrations.toggle(id);
      setTestResult(null); // Clear test result to show actual status after toggle
      fetchIntegrations(selectedClient);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to toggle integration');
    }
  };

  const handleTest = async (id) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const response = await integrations.test(id);
      setTestResult({ id, success: true, message: response.data.message || 'Connection successful' });
    } catch (err) {
      setTestResult({
        id,
        success: false,
        message: err.response?.data?.error || 'Connection failed',
      });
    } finally {
      setTestingId(null);
    }
  };

  const openCreateModal = () => {
    setEditingIntegration(null);
    reset({
      authMethod: 'bearer' // Set default auth method
    });
    setIsModalOpen(true);
  };

  if (loading && clientList.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
          <p className="text-gray-600 mt-1">Manage external service connections</p>
        </div>
        <Button onClick={openCreateModal} disabled={!selectedClient}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Integration
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500">
            Dismiss
          </button>
        </div>
      )}

      {/* Client Selector */}
      <Card>
        <CardBody className="p-4">
          <Select
            label="Select Client"
            value={selectedClient || ''}
            onChange={(e) => setSelectedClient(e.target.value)}
            options={[
              { value: '', label: 'Choose a client...' },
              ...clientList.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </CardBody>
      </Card>

      {/* Integrations Table */}
      {selectedClient && (
        <Card>
          <CardBody className="p-0">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>Name</TableHeader>
                    <TableHeader>Type</TableHeader>
                    <TableHeader>API URL</TableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader>Last Tested</TableHeader>
                    <TableHeader>Actions</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {integrationList.length > 0 ? (
                    integrationList.map((integration) => (
                      <TableRow key={integration.id}>
                        <TableCell className="font-medium text-gray-900">
                          {integration.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="info">
                            {integrationTypes.find((t) => t.type === integration.integration_type)?.name ||
                              integration.integration_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-500 max-w-xs truncate">
                          {integration.connection_config?.api_url ? (
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {integration.connection_config.api_url}
                            </code>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {testResult?.id === integration.id ? (
                            <Badge variant={testResult.success ? 'success' : 'danger'}>
                              {testResult.success ? 'Connected' : 'Failed'}
                            </Badge>
                          ) : (
                            <Badge
                              variant={
                                integration.status === 'active' ? 'success' :
                                integration.status === 'not_configured' ? 'warning' :
                                'warning'
                              }
                            >
                              {integration.status === 'active' ? 'Active' :
                               integration.status === 'not_configured' ? 'Not Configured' :
                               integration.status === 'inactive' ? 'Inactive' :
                               'Unknown'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {integration.last_tested_at
                            ? new Date(integration.last_tested_at).toLocaleString()
                            : 'Never'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTest(integration.id)}
                              loading={testingId === integration.id}
                            >
                              Test
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(integration)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={integration.status === 'active' ? 'text-orange-600 hover:text-orange-700 hover:bg-orange-50' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}
                              onClick={() => handleToggle(integration.id)}
                            >
                              {integration.status === 'active' ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(integration.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                        No integrations configured for this client
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingIntegration(null);
          reset();
        }}
        title={editingIntegration ? 'Edit Integration' : 'Add Integration'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select
            label="Integration Type"
            {...register('integrationType', { required: 'Type is required' })}
            error={errors.integrationType?.message}
            options={[
              { value: '', label: 'Select type...' },
              ...integrationTypes.map((type) => ({
                value: type.type,
                label: `${type.name} - ${type.description}`
              }))
            ]}
          />

          <Input
            label="Name"
            {...register('name', { required: 'Name is required' })}
            error={errors.name?.message}
            placeholder="e.g., Bob's Inventory System"
          />

          <Input
            label="API URL"
            {...register('apiUrl')}
            placeholder="https://api.example.com"
          />
          <p className="text-xs text-gray-500 -mt-3">
            Base URL for the client's API. Tools will use this to make requests.
          </p>

          <Input
            label="API Key"
            type="password"
            {...register('apiKey')}
            placeholder={editingIntegration ? '(leave blank to keep current)' : 'Enter API key'}
          />

          <Input
            label="API Secret (optional)"
            type="password"
            {...register('apiSecret')}
            placeholder={editingIntegration ? '(leave blank to keep current)' : 'Enter API secret if required'}
          />

          <Select
            label="Authentication Method"
            {...register('authMethod')}
            options={AUTH_METHODS}
          />


          <div>
            <label className="label">Additional Config (JSON, optional)</label>
            <textarea
              {...register('config')}
              className="input font-mono text-sm min-h-[80px]"
              placeholder='{"custom_field": "value"}'
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsModalOpen(false);
                setEditingIntegration(null);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {editingIntegration ? 'Save Changes' : 'Add Integration'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
