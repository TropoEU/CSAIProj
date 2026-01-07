import { useState, useEffect } from 'react';
import api from '../services/api';

export default function GuidedReasoningSettings({ onMessage }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConfig = async () => {
    try {
      const response = await api.get('/admin/prompt-config/adaptive');
      setConfig(response.data);
    } catch (error) {
      console.error('Failed to load adaptive config:', error);
      onMessage?.({ type: 'error', text: 'Failed to load guided reasoning settings' });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await api.put('/admin/prompt-config/adaptive', config);
      onMessage?.({ type: 'success', text: 'Guided reasoning settings saved successfully!' });
    } catch (error) {
      onMessage?.({ type: 'error', text: error.response?.data?.error || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = async () => {
    if (!confirm('Reset guided reasoning settings to defaults? This cannot be undone.')) return;

    setSaving(true);
    try {
      const response = await api.post('/admin/prompt-config/adaptive/reset');
      setConfig(response.data.config);
      onMessage?.({ type: 'success', text: 'Guided reasoning settings reset to defaults' });
    } catch {
      onMessage?.({ type: 'error', text: 'Failed to reset settings' });
    } finally {
      setSaving(false);
    }
  };

  const previewPrompt = async () => {
    try {
      const response = await api.post('/admin/prompt-config/adaptive/preview', { config });
      setPreview(response.data.prompt);
      setShowPreview(true);
    } catch {
      onMessage?.({ type: 'error', text: 'Failed to generate preview' });
    }
  };

  // Reasoning Steps handlers
  const updateReasoningStep = (index, field, value) => {
    const newSteps = [...(config.reasoning_steps || [])];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setConfig({ ...config, reasoning_steps: newSteps });
  };

  const addReasoningStep = () => {
    setConfig({
      ...config,
      reasoning_steps: [...(config.reasoning_steps || []), { title: '', instruction: '' }]
    });
  };

  const removeReasoningStep = (index) => {
    setConfig({
      ...config,
      reasoning_steps: config.reasoning_steps.filter((_, i) => i !== index)
    });
  };

  // Context Keys handlers
  const updateContextKey = (index, field, value) => {
    const newKeys = [...(config.context_keys || [])];
    newKeys[index] = { ...newKeys[index], [field]: value };
    setConfig({ ...config, context_keys: newKeys });
  };

  const addContextKey = () => {
    setConfig({
      ...config,
      context_keys: [...(config.context_keys || []), { key: '', description: '' }]
    });
  };

  const removeContextKey = (index) => {
    setConfig({
      ...config,
      context_keys: config.context_keys.filter((_, i) => i !== index)
    });
  };

  // Tool Rules handlers
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!config) {
    return <div className="text-center p-8 text-gray-500">Failed to load guided reasoning settings</div>;
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <p className="text-sm text-purple-800">
          <strong>Guided Reasoning Mode</strong> uses a structured self-assessment approach where the AI evaluates its confidence,
          identifies missing information, and requests additional context before responding. This produces more accurate and contextual responses.
        </p>
      </div>

      {/* Intro Template */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Introduction Template</h3>
        <p className="text-sm text-gray-500 mb-4">
          The opening instruction for the AI. Use <code className="bg-gray-100 px-1 rounded">{'{client_name}'}</code> as a placeholder.
        </p>
        <textarea
          value={config.intro_template || ''}
          onChange={(e) => setConfig({ ...config, intro_template: e.target.value })}
          placeholder="You are a customer support assistant for {client_name}."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Reasoning Steps */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Reasoning Steps</h3>
            <p className="text-sm text-gray-500">Steps the AI follows internally before responding (shown in reasoning block)</p>
          </div>
          <button onClick={addReasoningStep} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100">
            <PlusIcon /> Add Step
          </button>
        </div>
        <div className="space-y-4">
          {(config.reasoning_steps || []).map((step, index) => (
            <div key={index} className="flex gap-4 items-start p-4 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-purple-100 text-purple-700 rounded-full font-medium">
                {index + 1}
              </div>
              <div className="flex-grow space-y-2">
                <input
                  type="text"
                  value={step.title}
                  onChange={(e) => updateReasoningStep(index, 'title', e.target.value)}
                  placeholder="Step title (e.g., UNDERSTAND)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <textarea
                  value={step.instruction}
                  onChange={(e) => updateReasoningStep(index, 'instruction', e.target.value)}
                  placeholder="Instructions for this step..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <button onClick={() => removeReasoningStep(index)} className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500">
                <TrashIcon />
              </button>
            </div>
          ))}
          {(config.reasoning_steps || []).length === 0 && (
            <p className="text-center text-gray-400 py-4">No reasoning steps defined. Add steps to guide the AI's thinking process.</p>
          )}
        </div>
      </div>

      {/* Context Keys */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Context Keys</h3>
            <p className="text-sm text-gray-500">Data the AI can request via <code className="bg-gray-100 px-1 rounded">needs_more_context</code></p>
          </div>
          <button onClick={addContextKey} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100">
            <PlusIcon /> Add Key
          </button>
        </div>
        <div className="space-y-3">
          {(config.context_keys || []).map((ctx, index) => (
            <div key={index} className="flex gap-3 items-center">
              <input
                type="text"
                value={ctx.key}
                onChange={(e) => updateContextKey(index, 'key', e.target.value)}
                placeholder="Key (e.g., business_hours)"
                className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500"
              />
              <input
                type="text"
                value={ctx.description}
                onChange={(e) => updateContextKey(index, 'description', e.target.value)}
                placeholder="Description shown to AI..."
                className="flex-grow px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              />
              <button onClick={() => removeContextKey(index)} className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500">
                <CloseIcon />
              </button>
            </div>
          ))}
          {(config.context_keys || []).length === 0 && (
            <p className="text-center text-gray-400 py-4">No context keys defined. Add keys to allow AI to request specific business data.</p>
          )}
        </div>
      </div>

      {/* Tool Rules */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Tool Usage Rules</h3>
            <p className="text-sm text-gray-500">Guidelines for when and how the AI should use tools</p>
          </div>
          <button onClick={addToolRule} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100">
            <PlusIcon /> Add Rule
          </button>
        </div>
        <div className="space-y-2">
          {(config.tool_rules || []).map((rule, index) => (
            <div key={index} className="flex gap-2 items-center">
              <span className="flex-shrink-0 text-gray-400 w-6">{index + 1}.</span>
              <input
                type="text"
                value={rule}
                onChange={(e) => updateToolRule(index, e.target.value)}
                placeholder="Enter a tool usage rule..."
                className="flex-grow px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              />
              <button onClick={() => removeToolRule(index)} className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500">
                <CloseIcon />
              </button>
            </div>
          ))}
          {(config.tool_rules || []).length === 0 && (
            <p className="text-center text-gray-400 py-4">No tool rules defined. Add rules to guide tool usage.</p>
          )}
        </div>
      </div>

      {/* Assessment Fields Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Assessment Fields</h3>
        <p className="text-sm text-gray-500 mb-4">
          The AI includes these fields in its self-assessment block (not editable):
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { field: 'confidence', desc: '1-10 confidence score' },
            { field: 'tool_call', desc: 'Tool to execute (if any)' },
            { field: 'tool_params', desc: 'Parameters for the tool' },
            { field: 'missing_params', desc: 'Required params not provided' },
            { field: 'is_destructive', desc: 'Action is irreversible' },
            { field: 'needs_confirmation', desc: 'Requires user confirmation' },
            { field: 'needs_more_context', desc: 'Context keys to fetch' },
          ].map(({ field, desc }) => (
            <div key={field} className="p-3 bg-gray-50 rounded-lg">
              <code className="text-sm font-mono text-purple-600">{field}</code>
              <p className="text-xs text-gray-500 mt-1">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <button onClick={resetConfig} disabled={saving} className="px-4 py-2 text-gray-600 hover:text-gray-800">
          Reset to Defaults
        </button>
        <div className="flex gap-3">
          <button onClick={previewPrompt} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            Preview Prompt
          </button>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
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
              <h3 className="text-lg font-medium">Generated Guided Reasoning Prompt Preview</h3>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600">
                <CloseIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono bg-gray-50 p-4 rounded-lg">
                {preview}
              </pre>
            </div>
            <div className="p-4 border-t">
              <button onClick={() => setShowPreview(false)} className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple inline icons to avoid dependencies
function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function CloseIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
