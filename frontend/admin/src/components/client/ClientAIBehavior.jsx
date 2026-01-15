import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

/**
 * Per-client AI behavior settings component
 * Allows customizing AI behavior for a specific client (overrides platform defaults)
 */
export default function ClientAIBehavior({ clientId, clientName }) {
  const [config, setConfig] = useState(null); // Display config (merged)
  const [platformDefaults, setPlatformDefaults] = useState(null); // Platform defaults
  const [originalOverrides, setOriginalOverrides] = useState(null); // Original client overrides
  const [hasCustomConfig, setHasCustomConfig] = useState(false);
  const [customizedFields, setCustomizedFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      // Load client config (effective + overrides)
      const clientResponse = await api.get(`/admin/clients/${clientId}/prompt-config`);

      // Load platform defaults separately
      const defaultsResponse = await api.get('/admin/prompt-config');

      setConfig(clientResponse.data.effective);
      setPlatformDefaults(defaultsResponse.data);
      setOriginalOverrides(JSON.parse(JSON.stringify(clientResponse.data.overrides || {}))); // Deep copy
      setHasCustomConfig(clientResponse.data.hasCustomConfig);
      setCustomizedFields(clientResponse.data.customizedFields || []);
      setHasUnsavedChanges(false); // Reset on load
    } catch (error) {
      console.error('Failed to load client prompt config:', error);
      setMessage({ type: 'error', text: 'Failed to load AI behavior settings' });
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Track changes to config
  useEffect(() => {
    if (!config || !platformDefaults || !originalOverrides) return;

    // Compare current config with original overrides to detect unsaved changes
    const currentOverrides = computeOverrides(config, platformDefaults);
    const hasChanges = JSON.stringify(currentOverrides) !== JSON.stringify(originalOverrides);
    setHasUnsavedChanges(hasChanges);
  }, [config, platformDefaults, originalOverrides]);

  // Helper function to compute which fields differ from platform defaults
  const computeOverrides = (currentConfig, defaults) => {
    if (!currentConfig || !defaults) return {};

    const overrides = {};
    const fields = [
      'reasoning_enabled',
      'reasoning_steps',
      'response_style',
      'tool_rules',
      'custom_instructions',
    ];

    fields.forEach((field) => {
      const currentValue = currentConfig[field];
      const defaultValue = defaults[field];

      // Deep comparison for objects/arrays
      if (JSON.stringify(currentValue) !== JSON.stringify(defaultValue)) {
        overrides[field] = currentValue;
      }
    });

    return overrides;
  };

  // Helper to check if a field is customized
  const isCustomized = (field) => customizedFields.includes(field);

  const saveConfig = async () => {
    setSaving(true);
    try {
      // Only send fields that differ from platform defaults
      const overridesToSave = computeOverrides(config, platformDefaults);

      await api.put(`/admin/clients/${clientId}/prompt-config`, overridesToSave);

      // Update original overrides to match what we just saved
      setOriginalOverrides(JSON.parse(JSON.stringify(overridesToSave)));

      // Reload to get updated customizedFields from server
      await loadConfig();
      setMessage({ type: 'success', text: 'AI behavior settings saved!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    if (
      !confirm('Reset to platform defaults? This will remove all custom settings for this client.')
    )
      return;

    setSaving(true);
    try {
      await api.delete(`/admin/clients/${clientId}/prompt-config`);
      // Explicitly clear customization state first, then reload config
      setHasCustomConfig(false);
      setCustomizedFields([]);
      await loadConfig();
      setMessage({ type: 'success', text: 'Reset to platform defaults' });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: 'Failed to reset settings' });
    } finally {
      setSaving(false);
    }
  };

  const previewPrompt = async () => {
    try {
      const response = await api.post(`/admin/clients/${clientId}/prompt-config/preview`, {
        config,
      });
      setPreview(response.data.prompt);
      setShowPreview(true);
    } catch {
      setMessage({ type: 'error', text: 'Failed to generate preview' });
    }
  };

  const updateReasoningStep = (index, field, value) => {
    const newSteps = [...(config.reasoning_steps || [])];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setConfig({ ...config, reasoning_steps: newSteps });
  };

  const addReasoningStep = () => {
    setConfig({
      ...config,
      reasoning_steps: [...(config.reasoning_steps || []), { title: '', instruction: '' }],
    });
  };

  const removeReasoningStep = (index) => {
    setConfig({
      ...config,
      reasoning_steps: config.reasoning_steps.filter((_, i) => i !== index),
    });
  };

  const updateToolRule = (index, value) => {
    const newRules = [...(config.tool_rules || [])];
    newRules[index] = value;
    setConfig({ ...config, tool_rules: newRules });
  };

  const addToolRule = () => {
    setConfig({ ...config, tool_rules: [...(config.tool_rules || []), ''] });
  };

  const removeToolRule = (index) => {
    setConfig({ ...config, tool_rules: config.tool_rules.filter((_, i) => i !== index) });
  };

  const updateResponseStyle = (field, value) => {
    setConfig({
      ...config,
      response_style: { ...config.response_style, [field]: value },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!config) {
    return <div className="text-center p-8 text-gray-500">Failed to load AI behavior settings</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">AI Behavior for {clientName}</h3>
          <p className="text-sm text-gray-500">
            {hasCustomConfig
              ? 'Using custom settings for this client'
              : 'Using platform default settings'}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            hasCustomConfig ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-700'
          }`}
        >
          {hasCustomConfig ? 'Custom' : 'Default'}
        </span>
      </div>

      {/* Message Alert */}
      {message && (
        <div
          className={`p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Guided Reasoning Toggle */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              Guided Reasoning
              {isCustomized('reasoning_enabled') && <ModifiedBadge />}
            </h4>
            <p className="text-sm text-gray-500">Enable step-by-step reasoning before responses</p>
          </div>
          <button
            onClick={() => setConfig({ ...config, reasoning_enabled: !config.reasoning_enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              config.reasoning_enabled ? 'bg-primary-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                config.reasoning_enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Reasoning Steps */}
      {config.reasoning_enabled && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              Reasoning Steps
              {isCustomized('reasoning_steps') && <ModifiedBadge />}
            </h4>
            <button
              onClick={addReasoningStep}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              + Add Step
            </button>
          </div>
          <div className="space-y-3">
            {(config.reasoning_steps || []).map((step, index) => (
              <div key={index} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                  {index + 1}
                </span>
                <div className="flex-grow space-y-2">
                  <input
                    type="text"
                    value={step.title}
                    onChange={(e) => updateReasoningStep(index, 'title', e.target.value)}
                    placeholder="Step title"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-primary-500"
                  />
                  <textarea
                    value={step.instruction}
                    onChange={(e) => updateReasoningStep(index, 'instruction', e.target.value)}
                    placeholder="Instructions..."
                    rows={2}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <button
                  onClick={() => removeReasoningStep(index)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Response Style */}
      <div className="bg-white rounded-lg border p-4">
        <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
          Response Style
          {isCustomized('response_style') && <ModifiedBadge />}
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Tone</label>
            <select
              value={config.response_style?.tone || 'friendly'}
              onChange={(e) => updateResponseStyle('tone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
            >
              <option value="friendly">Friendly</option>
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Max Sentences</label>
            <input
              type="number"
              min={1}
              max={10}
              value={config.response_style?.max_sentences || 2}
              onChange={(e) => updateResponseStyle('max_sentences', parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Formality</label>
            <select
              value={config.response_style?.formality || 'casual'}
              onChange={(e) => updateResponseStyle('formality', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
            >
              <option value="casual">Casual</option>
              <option value="neutral">Neutral</option>
              <option value="formal">Formal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tool Usage Rules */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-gray-900 flex items-center gap-2">
            Tool Usage Rules
            {isCustomized('tool_rules') && <ModifiedBadge />}
          </h4>
          <button onClick={addToolRule} className="text-sm text-primary-600 hover:text-primary-700">
            + Add Rule
          </button>
        </div>
        <div className="space-y-2">
          {(config.tool_rules || []).map((rule, index) => (
            <div key={index} className="flex gap-2 items-center">
              <span className="text-gray-400 w-5">{index + 1}.</span>
              <input
                type="text"
                value={rule}
                onChange={(e) => updateToolRule(index, e.target.value)}
                placeholder="Enter a rule..."
                className="flex-grow px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-primary-500"
              />
              <button
                onClick={() => removeToolRule(index)}
                className="text-gray-400 hover:text-red-500"
              >
                <CloseIcon />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Instructions */}
      <div className="bg-white rounded-lg border p-4">
        <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
          Custom Instructions
          {isCustomized('custom_instructions') && <ModifiedBadge />}
        </h4>
        <textarea
          value={config.custom_instructions || ''}
          onChange={(e) => setConfig({ ...config, custom_instructions: e.target.value })}
          placeholder="Additional instructions specific to this client..."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-4 border-t">
        <button
          onClick={resetToDefaults}
          disabled={saving || !hasCustomConfig}
          className="text-gray-600 hover:text-gray-800 disabled:opacity-50"
        >
          Reset to Platform Defaults
        </button>
        <div className="flex gap-3">
          <button
            onClick={previewPrompt}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Preview Prompt
          </button>
          <button
            onClick={saveConfig}
            disabled={saving || !hasUnsavedChanges}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={!hasUnsavedChanges ? 'No changes to save' : ''}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium">Generated System Prompt for {clientName}</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <CloseIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono bg-gray-50 p-4 rounded-lg">
                {preview}
              </pre>
            </div>
            <div className="p-4 border-t">
              <button
                onClick={() => setShowPreview(false)}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModifiedBadge() {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800"
      title="This setting differs from platform defaults"
    >
      Modified
    </span>
  );
}

function TrashIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function CloseIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
