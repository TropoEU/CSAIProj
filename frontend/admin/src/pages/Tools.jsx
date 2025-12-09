import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { tools as toolsApi, analytics } from '../services/api';
import {
  Card,
  CardBody,
  CardHeader,
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
  const [selectedTool, setSelectedTool] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  const testForm = useForm();

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
      const parametersSchema = data.parametersSchema
        ? JSON.parse(data.parametersSchema)
        : {};

      await toolsApi.create({ ...data, parametersSchema });
      setIsCreateModalOpen(false);
      reset();
      fetchData();
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON in parameters schema');
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
      const response = await toolsApi.test(selectedTool.id, { params, webhookUrl: data.webhookUrl });
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
          <button onClick={() => setStatsError(null)} className="ml-2 text-yellow-500 hover:text-yellow-700">
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
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {Object.keys(tool.parameters_schema?.properties || {}).length} params
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="info">{getToolUsageCount(tool.tool_name)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openTestModal(tool)}
                      >
                        Test
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500 py-8">
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
              <h4 className={`font-medium ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                {testResult.success ? 'Success' : 'Error'}
              </h4>
              <pre className="mt-2 text-sm overflow-auto max-h-40">
                {testResult.success
                  ? JSON.stringify(testResult.data, null, 2)
                  : testResult.error}
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
    </div>
  );
}
