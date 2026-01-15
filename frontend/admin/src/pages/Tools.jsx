import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { tools as toolsApi, analytics } from '../services/api';
import {
  Card,
  CardBody,
  Button,
  Input,
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

export default function Tools() {
  const [tools, setTools] = useState([]);
  const [toolStats, setToolStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [editingTool, setEditingTool] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  const testForm = useForm();
  const editForm = useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setStatsError(null);

    // Fetch tools - this is critical, so we show error if it fails
    try {
      const toolsRes = await toolsApi.getAll();
      setTools(toolsRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load tools');
    }

    // Fetch stats - this is optional, so we don't block the UI if it fails
    try {
      const statsRes = await analytics.getToolStats();
      setToolStats(statsRes.data || []);
    } catch (err) {
      // Stats are optional, so we just log the error but don't block the UI
      setStatsError(err.response?.data?.error || 'Failed to get tool stats');
      setToolStats([]); // Set empty array so usage counts show 0
      console.warn('Failed to load tool stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const onCreateTool = async (data) => {
    try {
      // Parse parameters schema JSON
      const parametersSchema = data.parametersSchema ? JSON.parse(data.parametersSchema) : {};

      // Parse capabilities from newline-separated string to array
      const capabilities = data.capabilities
        ? data.capabilities
            .split('\n')
            .map((c) => c.trim())
            .filter((c) => c.length > 0)
        : null;

      // Parse required integrations JSON
      const requiredIntegrations = data.requiredIntegrations
        ? JSON.parse(data.requiredIntegrations)
        : [];

      await toolsApi.create({ ...data, parametersSchema, capabilities, requiredIntegrations });
      setIsCreateModalOpen(false);
      reset();
      fetchData();
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON in parameters schema or required integrations');
      } else {
        setError(err.response?.data?.error || 'Failed to create tool');
      }
    }
  };

  const handleTestTool = async (data) => {
    setIsTesting(true);
    setTestResult(null);
    try {
      // Parse test parameters JSON
      const params = data.params ? JSON.parse(data.params) : {};
      const response = await toolsApi.test(selectedTool.id, {
        params,
        webhookUrl: data.webhookUrl,
      });
      setTestResult({ success: true, data: response.data });
    } catch (err) {
      if (err instanceof SyntaxError) {
        setTestResult({ success: false, error: 'Invalid JSON in parameters' });
      } else {
        setTestResult({
          success: false,
          error: err.response?.data?.error || 'Test failed',
        });
      }
    } finally {
      setIsTesting(false);
    }
  };

  const openTestModal = (tool) => {
    setSelectedTool(tool);
    setTestResult(null);
    testForm.reset();
    setIsTestModalOpen(true);
  };

  const handleEdit = (tool) => {
    setEditingTool(tool);
    editForm.reset({
      toolName: tool.tool_name,
      description: tool.description,
      requiredIntegrations: JSON.stringify(tool.required_integrations || [], null, 2),
      parametersSchema: JSON.stringify(tool.parameters_schema || {}, null, 2),
      capabilities: Array.isArray(tool.capabilities) ? tool.capabilities.join('\n') : '',
      isDestructive: tool.is_destructive || false,
      requiresConfirmation: tool.requires_confirmation || false,
      maxConfidence: tool.max_confidence ?? 7,
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (data) => {
    try {
      const parametersSchema = data.parametersSchema ? JSON.parse(data.parametersSchema) : {};
      // Parse capabilities from newline-separated string to array
      const capabilities = data.capabilities
        ? data.capabilities
            .split('\n')
            .map((c) => c.trim())
            .filter((c) => c.length > 0)
        : null;
      // Parse required integrations JSON
      const requiredIntegrations = data.requiredIntegrations
        ? JSON.parse(data.requiredIntegrations)
        : [];

      await toolsApi.update(editingTool.id, {
        toolName: data.toolName,
        description: data.description,
        requiredIntegrations,
        parametersSchema,
        capabilities,
        isDestructive: data.isDestructive || false,
        requiresConfirmation: data.requiresConfirmation || false,
        maxConfidence: data.maxConfidence ?? 7,
      });
      setIsEditModalOpen(false);
      setEditingTool(null);
      editForm.reset();
      fetchData();
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON in parameters schema or required integrations');
      } else {
        setError(err.response?.data?.error || 'Failed to update tool');
      }
    }
  };

  const handleDelete = async (toolId, toolName) => {
    if (!confirm(`Delete tool "${toolName}"? This cannot be undone.`)) {
      return;
    }
    try {
      await toolsApi.delete(toolId);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete tool');
    }
  };

  const getToolUsageCount = (toolName) => {
    const stat = toolStats.find((s) => s.tool_name === toolName);
    return stat?.count || 0;
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
          <h1 className="text-2xl font-bold text-gray-900">Tools</h1>
          <p className="text-gray-600 mt-1">Manage AI tool definitions and test integrations</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Tool
        </Button>
      </div>

      {/* How it works */}
      <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
        <h3 className="font-semibold text-purple-900 mb-2">Generic Tools</h3>
        <div className="text-sm text-purple-800 space-y-1">
          <p>
            <strong>Tools are templates</strong> that define what actions the AI can perform (check
            orders, book appointments, etc.)
          </p>
          <p>
            <strong>Required Integrations</strong> specify what TYPE of API the tool needs (e.g.,
            "order_api") - NOT specific client APIs
          </p>
          <p>
            <strong>Client Setup:</strong> Each client enables tools and maps them to THEIR specific
            integrations in their Client page
          </p>
        </div>
        <p className="text-xs text-purple-600 mt-2">
          One tool + different client integrations = same functionality for all clients
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">
            Dismiss
          </button>
        </div>
      )}

      {statsError && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg">
          {statsError}
          <button
            onClick={() => setStatsError(null)}
            className="ml-2 text-yellow-500 hover:text-yellow-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tools Table */}
      <Card>
        <CardBody className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Tool Name</TableHeader>
                <TableHeader>Description</TableHeader>
                <TableHeader>Required Integrations</TableHeader>
                <TableHeader>Parameters</TableHeader>
                <TableHeader>Usage (Today)</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {tools.length > 0 ? (
                tools.map((tool) => (
                  <TableRow key={tool.id}>
                    <TableCell className="font-medium text-gray-900 font-mono">
                      {tool.tool_name}
                    </TableCell>
                    <TableCell className="text-gray-500 max-w-xs truncate">
                      {tool.description}
                    </TableCell>
                    <TableCell>
                      {tool.required_integrations && tool.required_integrations.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {tool.required_integrations.map((int, idx) => (
                            <Badge
                              key={idx}
                              variant={int.required ? 'primary' : 'info'}
                              title={int.description || int.name}
                            >
                              {int.key}
                              {int.required ? '*' : ''}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {tool.parameters_schema?.properties ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.keys(tool.parameters_schema.properties).map((param) => (
                            <code key={param} className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {param}
                            </code>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No parameters</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="info">{getToolUsageCount(tool.tool_name)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openTestModal(tool)}>
                          Test
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(tool)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(tool.id, tool.tool_name)}
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
                    No tools found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Create Tool Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          reset();
        }}
        title="Add New Tool"
        size="lg"
      >
        <form onSubmit={handleSubmit(onCreateTool)} className="space-y-4">
          <Input
            label="Tool Name"
            {...register('toolName', {
              required: 'Tool name is required',
              pattern: {
                value: /^[a-z_]+$/,
                message: 'Only lowercase letters and underscores allowed',
              },
            })}
            error={errors.toolName?.message}
            placeholder="e.g., get_order_status"
          />

          <div>
            <label className="label">Description</label>
            <textarea
              {...register('description', { required: 'Description is required' })}
              className="input min-h-[80px]"
              placeholder="Describe what this tool does..."
            />
            {errors.description && (
              <p className="text-sm text-red-600 mt-1">{errors.description.message}</p>
            )}
          </div>

          <div>
            <label className="label">Capabilities (one per line)</label>
            <textarea
              {...register('capabilities')}
              className="input min-h-[120px]"
              placeholder="Get real-time tracking information&#10;View driver details and contact info&#10;See estimated delivery time"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter one capability per line. These will be shown as bullet points in the customer
              dashboard.
            </p>
          </div>

          <div>
            <label className="label">Required Integrations (JSON Array)</label>
            <textarea
              {...register('requiredIntegrations')}
              className="input font-mono text-sm min-h-[140px]"
              placeholder={`[
  {
    "key": "order_api",
    "name": "Order Management API",
    "required": true,
    "description": "Fetches order details and status"
  },
  {
    "key": "email_api",
    "name": "Email Service",
    "required": false,
    "description": "Sends notification emails"
  }
]`}
            />
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
              <p className="font-medium text-blue-900 mb-2">📘 How this works:</p>
              <ul className="space-y-1 text-blue-800">
                <li>
                  <strong>"key"</strong>: A unique identifier (e.g., "order_api") - clients will map
                  this to their actual integration
                </li>
                <li>
                  <strong>"name"</strong>: Human-readable name shown in the admin UI
                </li>
                <li>
                  <strong>"required"</strong>: true = must be configured, false = optional
                </li>
                <li>
                  <strong>"description"</strong>: Explains what this integration is used for
                </li>
              </ul>
              <p className="mt-2 text-blue-700">
                💡 The "key" should match the{' '}
                <code className="bg-blue-100 px-1 rounded">integration_type</code> of client
                integrations (e.g., if key is "order_api", clients need an integration with type
                "order_api")
              </p>
            </div>
          </div>

          <div>
            <label className="label">Parameters Schema (JSON)</label>
            <textarea
              {...register('parametersSchema')}
              className="input font-mono text-sm min-h-[120px]"
              placeholder={`{
  "type": "object",
  "properties": {
    "orderId": {
      "type": "string",
      "description": "The order ID to look up"
    }
  },
  "required": ["orderId"]
}`}
            />
          </div>

          {/* Risk Settings */}
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium text-gray-900 mb-3">Risk Settings</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isDestructive"
                  {...register('isDestructive')}
                  className="h-4 w-4 text-primary-600 rounded border-gray-300"
                />
                <label htmlFor="isDestructive" className="text-sm text-gray-700">
                  <span className="font-medium">Destructive</span>
                  <p className="text-xs text-gray-500">
                    Triggers critique step (cancel, delete, refund)
                  </p>
                </label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="requiresConfirmation"
                  {...register('requiresConfirmation')}
                  className="h-4 w-4 text-primary-600 rounded border-gray-300"
                />
                <label htmlFor="requiresConfirmation" className="text-sm text-gray-700">
                  <span className="font-medium">Requires Confirmation</span>
                  <p className="text-xs text-gray-500">Always ask user to confirm</p>
                </label>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Max Confidence (1-10)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  defaultValue={7}
                  {...register('maxConfidence', { valueAsNumber: true })}
                  className="input mt-1 w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Caps AI confidence for this tool</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsCreateModalOpen(false);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Create Tool
            </Button>
          </div>
        </form>
      </Modal>

      {/* Test Tool Modal */}
      <Modal
        isOpen={isTestModalOpen}
        onClose={() => {
          setIsTestModalOpen(false);
          setTestResult(null);
        }}
        title={`Test Tool: ${selectedTool?.tool_name}`}
        size="lg"
      >
        <form onSubmit={testForm.handleSubmit(handleTestTool)} className="space-y-4">
          <Input
            label="Webhook URL"
            {...testForm.register('webhookUrl', { required: 'Webhook URL is required' })}
            error={testForm.formState.errors.webhookUrl?.message}
            placeholder="http://localhost:5678/webhook/tool_name"
          />

          <div>
            <label className="label">Parameters (JSON)</label>
            <textarea
              {...testForm.register('params')}
              className="input font-mono text-sm min-h-[100px]"
              placeholder={`{
  "orderId": "12345"
}`}
            />
          </div>

          {testResult && (
            <div
              className={`p-4 rounded-lg ${
                testResult.success
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <h4
                className={`font-medium ${testResult.success ? 'text-green-700' : 'text-red-700'}`}
              >
                {testResult.success ? 'Success' : 'Error'}
              </h4>
              <pre className="mt-2 text-sm overflow-auto max-h-40">
                {testResult.success ? JSON.stringify(testResult.data, null, 2) : testResult.error}
              </pre>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsTestModalOpen(false);
                setTestResult(null);
              }}
            >
              Close
            </Button>
            <Button type="submit" loading={isTesting}>
              Run Test
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Tool Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingTool(null);
          editForm.reset();
        }}
        title={`Edit Tool: ${editingTool?.tool_name || ''}`}
        size="lg"
      >
        <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
          <Input
            label="Tool Name"
            {...editForm.register('toolName', {
              required: 'Tool name is required',
              pattern: {
                value: /^[a-z_]+$/,
                message: 'Only lowercase letters and underscores allowed',
              },
            })}
            error={editForm.formState.errors.toolName?.message}
            placeholder="e.g., get_order_status"
          />

          <div>
            <label className="label">Description</label>
            <textarea
              {...editForm.register('description', { required: 'Description is required' })}
              className="input min-h-[80px]"
              placeholder="Describe what this tool does..."
            />
            {editForm.formState.errors.description && (
              <p className="text-sm text-red-600 mt-1">
                {editForm.formState.errors.description.message}
              </p>
            )}
          </div>

          <div>
            <label className="label">Capabilities (one per line)</label>
            <textarea
              {...editForm.register('capabilities')}
              className="input min-h-[120px]"
              placeholder="Get real-time tracking information&#10;View driver details and contact info&#10;See estimated delivery time"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter one capability per line. These will be shown as bullet points in the customer
              dashboard.
            </p>
          </div>

          <div>
            <label className="label">Required Integrations (JSON Array)</label>
            <textarea
              {...editForm.register('requiredIntegrations')}
              className="input font-mono text-sm min-h-[140px]"
              placeholder={`[
  {
    "key": "order_api",
    "name": "Order Management API",
    "required": true,
    "description": "Fetches order details"
  }
]`}
            />
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
              <p className="font-medium text-blue-900 mb-2">📘 How this works:</p>
              <ul className="space-y-1 text-blue-800">
                <li>
                  <strong>"key"</strong>: Unique ID (e.g., "order_api") - must match client
                  integration's <code className="bg-blue-100 px-1">integration_type</code>
                </li>
                <li>
                  <strong>"name"</strong>: Display name for admin UI
                </li>
                <li>
                  <strong>"required"</strong>: true = mandatory, false = optional
                </li>
              </ul>
            </div>
          </div>

          <div>
            <label className="label">Parameters Schema (JSON)</label>
            <textarea
              {...editForm.register('parametersSchema')}
              className="input font-mono text-sm min-h-[120px]"
              placeholder={`{
  "type": "object",
  "properties": {
    "orderId": {
      "type": "string",
      "description": "The order ID to look up"
    }
  },
  "required": ["orderId"]
}`}
            />
          </div>

          {/* Risk Settings */}
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium text-gray-900 mb-3">Risk Settings</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="editIsDestructive"
                  {...editForm.register('isDestructive')}
                  className="h-4 w-4 text-primary-600 rounded border-gray-300"
                />
                <label htmlFor="editIsDestructive" className="text-sm text-gray-700">
                  <span className="font-medium">Destructive</span>
                  <p className="text-xs text-gray-500">
                    Triggers critique step (cancel, delete, refund)
                  </p>
                </label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="editRequiresConfirmation"
                  {...editForm.register('requiresConfirmation')}
                  className="h-4 w-4 text-primary-600 rounded border-gray-300"
                />
                <label htmlFor="editRequiresConfirmation" className="text-sm text-gray-700">
                  <span className="font-medium">Requires Confirmation</span>
                  <p className="text-xs text-gray-500">Always ask user to confirm</p>
                </label>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Max Confidence (1-10)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  {...editForm.register('maxConfidence', { valueAsNumber: true })}
                  className="input mt-1 w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Caps AI confidence for this tool</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingTool(null);
                editForm.reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={editForm.formState.isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
