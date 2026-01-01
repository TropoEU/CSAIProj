import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { plans } from '../services/api';
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

export default function Plans() {
  const [plansList, setPlansList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState(null);

  const createForm = useForm({
    defaultValues: {
      name: '',
      displayName: '',
      description: '',
      conversationsPerMonth: '',
      messagesPerMonth: '',
      tokensPerMonth: '',
      toolCallsPerMonth: '',
      integrationsEnabled: '',
      costLimitUsd: '',
      baseCost: '0',
      usageMultiplier: '0',
      isActive: true,
      sortOrder: 0,
      features: {
        llmProvider: 'ollama',
        customBranding: false,
        prioritySupport: false,
        advancedAnalytics: false,
        apiAccess: true,
        whiteLabel: false,
      },
    },
  });

  const editForm = useForm();

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await plans.getAll();
      setPlansList(response.data || []);
    } catch (err) {
      setError('Failed to load plans');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async (data) => {
    try {
      // Convert empty strings to null for limits
      const planData = {
        ...data,
        conversationsPerMonth: data.conversationsPerMonth === '' ? null : parseInt(data.conversationsPerMonth),
        messagesPerMonth: data.messagesPerMonth === '' ? null : parseInt(data.messagesPerMonth),
        tokensPerMonth: data.tokensPerMonth === '' ? null : parseInt(data.tokensPerMonth),
        toolCallsPerMonth: data.toolCallsPerMonth === '' ? null : parseInt(data.toolCallsPerMonth),
        integrationsEnabled: data.integrationsEnabled === '' ? null : parseInt(data.integrationsEnabled),
        costLimitUsd: data.costLimitUsd === '' ? null : parseFloat(data.costLimitUsd),
        baseCost: parseFloat(data.baseCost) || 0,
        usageMultiplier: parseFloat(data.usageMultiplier) || 0,
        sortOrder: parseInt(data.sortOrder) || 0,
      };

      await plans.create(planData);
      setSuccess('Plan created successfully');
      setIsCreateModalOpen(false);
      createForm.reset();
      fetchPlans();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create plan');
    }
  };

  const handleEditPlan = (plan) => {
    setEditingPlan(plan);
    editForm.reset({
      name: plan.name,
      displayName: plan.display_name,
      description: plan.description || '',
      conversationsPerMonth: plan.conversations_per_month ?? '',
      messagesPerMonth: plan.messages_per_month ?? '',
      tokensPerMonth: plan.tokens_per_month ?? '',
      toolCallsPerMonth: plan.tool_calls_per_month ?? '',
      integrationsEnabled: plan.integrations_enabled ?? '',
      costLimitUsd: plan.cost_limit_usd ?? '',
      baseCost: plan.base_cost || '0',
      usageMultiplier: plan.usage_multiplier || '0',
      isActive: plan.is_active,
      sortOrder: plan.sort_order || 0,
      features: plan.features || {},
    });
    setIsEditModalOpen(true);
  };

  const handleUpdatePlan = async (data) => {
    try {
      const planData = {
        ...data,
        conversationsPerMonth: data.conversationsPerMonth === '' ? null : parseInt(data.conversationsPerMonth),
        messagesPerMonth: data.messagesPerMonth === '' ? null : parseInt(data.messagesPerMonth),
        tokensPerMonth: data.tokensPerMonth === '' ? null : parseInt(data.tokensPerMonth),
        toolCallsPerMonth: data.toolCallsPerMonth === '' ? null : parseInt(data.toolCallsPerMonth),
        integrationsEnabled: data.integrationsEnabled === '' ? null : parseInt(data.integrationsEnabled),
        costLimitUsd: data.costLimitUsd === '' ? null : parseFloat(data.costLimitUsd),
        baseCost: parseFloat(data.baseCost) || 0,
        usageMultiplier: parseFloat(data.usageMultiplier) || 0,
        sortOrder: parseInt(data.sortOrder) || 0,
      };

      await plans.update(editingPlan.id, planData);
      setSuccess('Plan updated successfully');
      setIsEditModalOpen(false);
      setEditingPlan(null);
      fetchPlans();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update plan');
    }
  };

  const handleDeletePlan = async () => {
    try {
      await plans.delete(deletingPlan.id);
      setSuccess('Plan deleted successfully');
      setIsDeleteModalOpen(false);
      setDeletingPlan(null);
      fetchPlans();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete plan');
    }
  };

  const handleSetDefault = async (plan) => {
    try {
      await plans.setDefault(plan.id);
      setSuccess(`${plan.display_name} is now the default plan`);
      fetchPlans();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set default plan');
    }
  };

  const formatLimit = (value) => {
    if (value === null || value === undefined) return <span className="text-green-600 font-medium">Unlimited</span>;
    if (typeof value === 'number') {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
      return value.toLocaleString();
    }
    return value;
  };

  const PlanForm = ({ form, onSubmit, submitLabel }) => (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <h4 className="font-semibold text-gray-900 border-b pb-2">Basic Information</h4>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Plan Name (slug)"
            placeholder="e.g., starter"
            {...form.register('name', { required: 'Name is required' })}
            error={form.formState.errors.name?.message}
          />
          <Input
            label="Display Name"
            placeholder="e.g., Starter Plan"
            {...form.register('displayName', { required: 'Display name is required' })}
            error={form.formState.errors.displayName?.message}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            {...form.register('description')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows="2"
            placeholder="Brief description of this plan..."
          />
        </div>
      </div>

      {/* Limits */}
      <div className="space-y-4">
        <h4 className="font-semibold text-gray-900 border-b pb-2">
          Monthly Limits
          <span className="ml-2 text-sm font-normal text-gray-500">(leave empty for unlimited)</span>
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Conversations/Month"
            type="number"
            placeholder="Unlimited"
            {...form.register('conversationsPerMonth')}
          />
          <Input
            label="Messages/Month"
            type="number"
            placeholder="Unlimited"
            {...form.register('messagesPerMonth')}
          />
          <Input
            label="Tokens/Month"
            type="number"
            placeholder="Unlimited"
            {...form.register('tokensPerMonth')}
          />
          <Input
            label="Tool Calls/Month"
            type="number"
            placeholder="Unlimited"
            {...form.register('toolCallsPerMonth')}
          />
          <Input
            label="Integrations Enabled"
            type="number"
            placeholder="Unlimited"
            {...form.register('integrationsEnabled')}
          />
          <Input
            label="Cost Limit (USD)"
            type="number"
            step="0.01"
            placeholder="Unlimited"
            {...form.register('costLimitUsd')}
          />
        </div>
      </div>

      {/* Pricing */}
      <div className="space-y-4">
        <h4 className="font-semibold text-gray-900 border-b pb-2">Pricing</h4>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Base Cost ($/month)"
            type="number"
            step="0.01"
            {...form.register('baseCost')}
          />
          <Input
            label="Usage Multiplier ($/token over limit)"
            type="number"
            step="0.00000001"
            {...form.register('usageMultiplier')}
          />
        </div>
      </div>

      {/* Features */}
      <div className="space-y-4">
        <h4 className="font-semibold text-gray-900 border-b pb-2">Features</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">LLM Provider</label>
            <select
              {...form.register('features.llmProvider')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="ollama">Ollama (Local)</option>
              <option value="claude-3-haiku">Claude 3 Haiku</option>
              <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
              <option value="gpt-4o">GPT-4o</option>
            </select>
          </div>
          <Input
            label="Sort Order"
            type="number"
            {...form.register('sortOrder')}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {['customBranding', 'prioritySupport', 'advancedAnalytics', 'apiAccess', 'whiteLabel'].map((feature) => (
            <label key={feature} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...form.register(`features.${feature}`)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">
                {feature.replace(/([A-Z])/g, ' $1').trim()}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="space-y-4">
        <h4 className="font-semibold text-gray-900 border-b pb-2">Status</h4>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            {...form.register('isActive')}
            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-700">Plan is Active</span>
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setIsCreateModalOpen(false);
            setIsEditModalOpen(false);
          }}
        >
          Cancel
        </Button>
        <Button type="submit" loading={form.formState.isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plans</h1>
          <p className="text-gray-600">Manage subscription plans and their limits</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Plan
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="float-right">&times;</button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      <Card>
        <CardBody className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Plan</TableHeader>
                <TableHeader>Limits</TableHeader>
                <TableHeader>Pricing</TableHeader>
                <TableHeader>Clients</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {plansList.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{plan.display_name}</span>
                        {plan.is_default && (
                          <Badge variant="primary" size="sm">Default</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{plan.name}</div>
                      {plan.description && (
                        <div className="text-xs text-gray-400 mt-1">{plan.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs space-y-0.5">
                      <div>Messages: {formatLimit(plan.messages_per_month)}</div>
                      <div>Tokens: {formatLimit(plan.tokens_per_month)}</div>
                      <div>Tools: {formatLimit(plan.tool_calls_per_month)}</div>
                      <div>Integrations: {formatLimit(plan.integrations_enabled)}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">${parseFloat(plan.base_cost || 0).toFixed(2)}/mo</div>
                      {plan.usage_multiplier > 0 && (
                        <div className="text-xs text-gray-500">
                          +${plan.usage_multiplier}/token over
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{plan.clients_count || 0}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={plan.is_active ? 'success' : 'default'}>
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditPlan(plan)}
                      >
                        Edit
                      </Button>
                      {!plan.is_default && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(plan)}
                          >
                            Set Default
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setDeletingPlan(plan);
                              setIsDeleteModalOpen(true);
                            }}
                            disabled={plan.clients_count > 0}
                            title={plan.clients_count > 0 ? 'Cannot delete plan with active clients' : ''}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Plan"
        size="lg"
      >
        <PlanForm form={createForm} onSubmit={handleCreatePlan} submitLabel="Create Plan" />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingPlan(null);
        }}
        title={`Edit Plan: ${editingPlan?.display_name}`}
        size="lg"
      >
        <PlanForm form={editForm} onSubmit={handleUpdatePlan} submitLabel="Save Changes" />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingPlan(null);
        }}
        title="Delete Plan"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete the plan <strong>{deletingPlan?.display_name}</strong>?
          </p>
          <p className="text-sm text-red-600">
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setDeletingPlan(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeletePlan}
            >
              Delete Plan
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

