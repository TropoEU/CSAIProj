/**
 * Client Tools Component
 * Manages enabled tools for a client including add, edit, test, and remove functionality
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Select,
  Modal,
  Badge,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '../common';
import { tools as toolsApi } from '../../services/api';

export default function ClientTools({
  clientId,
  clientTools,
  allTools,
  clientIntegrations,
  onRefresh,
  setError,
}) {
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);
  const [isEditToolModalOpen, setIsEditToolModalOpen] = useState(false);
  const [isTestToolModalOpen, setIsTestToolModalOpen] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [testingTool, setTestingTool] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [isTestingTool, setIsTestingTool] = useState(false);
  const [selectedToolForEnable, setSelectedToolForEnable] = useState(null);
  const [integrationMapping, setIntegrationMapping] = useState({});

  const toolForm = useForm();
  const editToolForm = useForm();
  const testToolForm = useForm();

  const enabledToolIds = clientTools.map((t) => t.tool_id);
  const availableTools = allTools.filter((t) => !enabledToolIds.includes(t.id));

  const handleEnableTool = async (data) => {
    try {
      const payload = {
        ...data,
        integrationMapping: integrationMapping
      };
      await toolsApi.enableForClient(clientId, payload);
      setIsToolModalOpen(false);
      toolForm.reset();
      setSelectedToolForEnable(null);
      setIntegrationMapping({});
      onRefresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to enable tool');
    }
  };

  const handleEditTool = (tool) => {
    setEditingTool(tool);
    editToolForm.reset({
      webhookUrl: tool.n8n_webhook_url || '',
    });
    setIntegrationMapping(tool.integration_mapping || {});
    setIsEditToolModalOpen(true);
  };

  const handleUpdateTool = async (data) => {
    try {
      await toolsApi.updateForClient(clientId, editingTool.tool_id, {
        webhookUrl: data.webhookUrl,
        integrationMapping: integrationMapping
      });
      setIsEditToolModalOpen(false);
      setEditingTool(null);
      setIntegrationMapping({});
      editToolForm.reset();
      onRefresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update tool');
    }
  };

  const handleRemoveTool = async (toolId) => {
    if (!confirm('Are you sure you want to remove this tool from this client?')) {
      return;
    }
    try {
      await toolsApi.disableForClient(clientId, toolId);
      onRefresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove tool');
    }
  };

  const handleToggleToolEnabled = async (toolId, currentEnabledStatus) => {
    try {
      await toolsApi.updateForClient(clientId, toolId, {
        enabled: !currentEnabledStatus,
      });
      onRefresh();
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
      const response = await toolsApi.testTool(clientId, testingTool.tool_id, data);
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

  return (
    <>
      {/* Tools Table */}
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
              // Update react-hook-form value
              toolForm.setValue('toolId', e.target.value);
              // Update local state for integration mapping UI
              const tool = allTools.find(t => t.id === parseInt(e.target.value, 10));
              setSelectedToolForEnable(tool);
              setIntegrationMapping({});
            }}
          />

          {/* Show required integrations if tool has any */}
          {selectedToolForEnable?.required_integrations && selectedToolForEnable.required_integrations.length > 0 && (
            <IntegrationMappingSection
              requiredIntegrations={selectedToolForEnable.required_integrations}
              clientIntegrations={clientIntegrations}
              integrationMapping={integrationMapping}
              setIntegrationMapping={setIntegrationMapping}
              clientId={clientId}
            />
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

            {/* Integration Mapping Section */}
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
                          [reqInt.key]: e.target.value ? parseInt(e.target.value, 10) : null
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
    </>
  );
}

/**
 * Integration Mapping Section - Used in Add Tool modal
 */
function IntegrationMappingSection({
  requiredIntegrations,
  clientIntegrations,
  integrationMapping,
  setIntegrationMapping,
  clientId,
}) {
  return (
    <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50">
      <h4 className="font-medium text-indigo-900 mb-3">Required Integrations</h4>
      <p className="text-sm text-indigo-700 mb-4">
        This tool needs the following integrations. Map each to your client's configured integrations:
      </p>
      <div className="space-y-3">
        {requiredIntegrations.map((reqInt, idx) => (
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
                [reqInt.key]: e.target.value ? parseInt(e.target.value, 10) : null
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
            <Link to={`/integrations?client=${clientId}`} className="underline font-medium">
              Integrations page
            </Link>
            {' '}before enabling this tool.
          </p>
        </div>
      )}
    </div>
  );
}
