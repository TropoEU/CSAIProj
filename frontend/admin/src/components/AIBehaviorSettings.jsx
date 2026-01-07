import { useState, useEffect } from 'react';
import api from '../services/api';

export default function AIBehaviorSettings({ onMessage }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConfig = async () => {
    try {
      const response = await api.get('/admin/prompt-config');
      setConfig(response.data);
    } catch (error) {
      console.error('Failed to load prompt config:', error);
      onMessage?.({ type: 'error', text: 'Failed to load AI behavior settings' });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await api.put('/admin/prompt-config', config);
      onMessage?.({ type: 'success', text: 'AI behavior settings saved successfully!' });
    } catch (error) {
      onMessage?.({ type: 'error', text: error.response?.data?.error || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = async () => {
    if (!confirm('Reset AI behavior settings to defaults? This cannot be undone.')) return;

    setSaving(true);
    try {
      const response = await api.post('/admin/prompt-config/reset');
      setConfig(response.data.config);
      onMessage?.({ type: 'success', text: 'AI behavior settings reset to defaults' });
    } catch {
      onMessage?.({ type: 'error', text: 'Failed to reset settings' });
    } finally {
      setSaving(false);
    }
  };

  const previewPrompt = async () => {
    try {
      const response = await api.post('/admin/prompt-config/preview', { config });
      setPreview(response.data.prompt);
      setShowPreview(true);
    } catch {
      onMessage?.({ type: 'error', text: 'Failed to generate preview' });
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
      reasoning_steps: [...(config.reasoning_steps || []), { title: '', instruction: '' }]
    });
  };

  const removeReasoningStep = (index) => {
    setConfig({
      ...config,
      reasoning_steps: config.reasoning_steps.filter((_, i) => i !== index)
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
      response_style: { ...config.response_style, [field]: value }
    });
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Tone Instructions handlers
  const updateToneInstruction = (tone, value) => {
    setConfig({
      ...config,
      tone_instructions: { ...(config.tone_instructions || {}), [tone]: value }
    });
  };

  // Formality Instructions handlers
  const updateFormalityInstruction = (formality, value) => {
    setConfig({
      ...config,
      formality_instructions: { ...(config.formality_instructions || {}), [formality]: value }
    });
  };

  // Tool Instructions handlers
  const updateToolInstruction = (toolName, value) => {
    setConfig({
      ...config,
      tool_instructions: { ...(config.tool_instructions || {}), [toolName]: value }
    });
  };

  const addToolInstruction = () => {
    const newKey = `new_tool_${Date.now()}`;
    setConfig({
      ...config,
      tool_instructions: { ...(config.tool_instructions || {}), [newKey]: '' }
    });
  };

  const removeToolInstruction = (toolName) => {
    const newInstructions = { ...(config.tool_instructions || {}) };
    delete newInstructions[toolName];
    setConfig({ ...config, tool_instructions: newInstructions });
  };

  const renameToolInstruction = (oldKey, newKey) => {
    if (oldKey === newKey) return;
    const instructions = config.tool_instructions || {};
    const value = instructions[oldKey];
    const newInstructions = { ...instructions };
    delete newInstructions[oldKey];
    newInstructions[newKey] = value;
    setConfig({ ...config, tool_instructions: newInstructions });
  };

  // Language Names handlers
  const updateLanguageName = (code, value) => {
    setConfig({
      ...config,
      language_names: { ...(config.language_names || {}), [code]: value }
    });
  };

  const addLanguage = () => {
    const newCode = `xx`;
    setConfig({
      ...config,
      language_names: { ...(config.language_names || {}), [newCode]: 'New Language' }
    });
  };

  const removeLanguage = (code) => {
    const newNames = { ...(config.language_names || {}) };
    delete newNames[code];
    setConfig({ ...config, language_names: newNames });
  };

  const renameLanguageCode = (oldCode, newCode) => {
    if (oldCode === newCode) return;
    const names = config.language_names || {};
    const value = names[oldCode];
    const newNames = { ...names };
    delete newNames[oldCode];
    newNames[newCode] = value;
    setConfig({ ...config, language_names: newNames });
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
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          These settings configure the <strong>Standard Mode</strong> AI behavior. For advanced guided reasoning with self-assessment, see the <strong>Guided Reasoning</strong> tab.
        </p>
      </div>

      {/* Guided Reasoning Toggle */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Guided Reasoning</h3>
            <p className="text-sm text-gray-500">Enable step-by-step reasoning process before responses</p>
          </div>
          <button
            onClick={() => setConfig({ ...config, reasoning_enabled: !config.reasoning_enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              config.reasoning_enabled ? 'bg-primary-600' : 'bg-gray-200'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              config.reasoning_enabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {/* Reasoning Steps */}
      {config.reasoning_enabled && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Reasoning Steps</h3>
              <p className="text-sm text-gray-500">Define the steps the AI follows before responding</p>
            </div>
            <button onClick={addReasoningStep} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100">
              <PlusIcon /> Add Step
            </button>
          </div>
          <div className="space-y-4">
            {(config.reasoning_steps || []).map((step, index) => (
              <div key={index} className="flex gap-4 items-start p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-primary-100 text-primary-700 rounded-full font-medium">
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
          </div>
        </div>
      )}

      {/* Response Style */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Response Style</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
            <select
              value={config.response_style?.tone || 'friendly'}
              onChange={(e) => updateResponseStyle('tone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="friendly">Friendly</option>
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Sentences</label>
            <input
              type="number"
              min={1}
              max={10}
              value={config.response_style?.max_sentences || 2}
              onChange={(e) => updateResponseStyle('max_sentences', parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Formality</label>
            <select
              value={config.response_style?.formality || 'casual'}
              onChange={(e) => updateResponseStyle('formality', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="casual">Casual</option>
              <option value="neutral">Neutral</option>
              <option value="formal">Formal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tool Usage Rules */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Tool Usage Rules</h3>
            <p className="text-sm text-gray-500">Guidelines for when the AI should use tools</p>
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
        </div>
      </div>

      {/* Custom Instructions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Custom Instructions</h3>
        <p className="text-sm text-gray-500 mb-4">Additional free-form instructions for the AI</p>
        <textarea
          value={config.custom_instructions || ''}
          onChange={(e) => setConfig({ ...config, custom_instructions: e.target.value })}
          placeholder="Add any custom instructions here..."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
        />
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
          placeholder="You are a friendly customer support assistant for {client_name}."
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* System Messages */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">System Messages</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Escalation Message</label>
            <p className="text-xs text-gray-500 mb-2">Shown when conversation is escalated to human support</p>
            <textarea
              value={config.escalation_message || ''}
              onChange={(e) => setConfig({ ...config, escalation_message: e.target.value })}
              placeholder="I apologize, but this request requires human assistance..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Error Message</label>
            <p className="text-xs text-gray-500 mb-2">Shown when AI fails to process a request</p>
            <textarea
              value={config.error_message || ''}
              onChange={(e) => setConfig({ ...config, error_message: e.target.value })}
              placeholder="I'm sorry, I'm having trouble processing that request..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Advanced Settings (Collapsible) */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <button
          onClick={() => toggleSection('advanced')}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50"
        >
          <div>
            <h3 className="text-lg font-medium text-gray-900">Advanced Settings</h3>
            <p className="text-sm text-gray-500">Tone instructions, formality, language names, tool instructions</p>
          </div>
          <ChevronIcon expanded={expandedSections.advanced} />
        </button>

        {expandedSections.advanced && (
          <div className="px-6 pb-6 space-y-6 border-t border-gray-100 pt-4">
            {/* Tone Instructions */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-3">Tone Instructions</h4>
              <p className="text-sm text-gray-500 mb-3">Instructions for each tone option</p>
              <div className="space-y-3">
                {['friendly', 'professional', 'casual'].map((tone) => (
                  <div key={tone} className="flex gap-3 items-start">
                    <label className="w-28 text-sm font-medium text-gray-600 pt-2 capitalize">{tone}</label>
                    <input
                      type="text"
                      value={(config.tone_instructions || {})[tone] || ''}
                      onChange={(e) => updateToneInstruction(tone, e.target.value)}
                      placeholder={`Instructions for ${tone} tone...`}
                      className="flex-grow px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Formality Instructions */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-3">Formality Instructions</h4>
              <p className="text-sm text-gray-500 mb-3">Instructions for each formality level</p>
              <div className="space-y-3">
                {['casual', 'neutral', 'formal'].map((formality) => (
                  <div key={formality} className="flex gap-3 items-start">
                    <label className="w-28 text-sm font-medium text-gray-600 pt-2 capitalize">{formality}</label>
                    <input
                      type="text"
                      value={(config.formality_instructions || {})[formality] || ''}
                      onChange={(e) => updateFormalityInstruction(formality, e.target.value)}
                      placeholder={`Instructions for ${formality} formality...`}
                      className="flex-grow px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Language Names */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-md font-medium text-gray-800">Language Names</h4>
                  <p className="text-sm text-gray-500">Display names for language codes</p>
                </div>
                <button onClick={addLanguage} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100">
                  <PlusIcon /> Add
                </button>
              </div>
              <div className="space-y-2">
                {Object.entries(config.language_names || {}).map(([code, name]) => (
                  <div key={code} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => renameLanguageCode(code, e.target.value)}
                      className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500"
                      placeholder="en"
                    />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => updateLanguageName(code, e.target.value)}
                      className="flex-grow px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                      placeholder="Language name..."
                    />
                    <button onClick={() => removeLanguage(code)} className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500">
                      <CloseIcon />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Tool-Specific Instructions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-md font-medium text-gray-800">Tool-Specific Instructions</h4>
                  <p className="text-sm text-gray-500">Custom instructions for each tool</p>
                </div>
                <button onClick={addToolInstruction} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100">
                  <PlusIcon /> Add
                </button>
              </div>
              <div className="space-y-3">
                {Object.entries(config.tool_instructions || {}).map(([toolName, instruction]) => (
                  <div key={toolName} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex gap-2 items-center mb-2">
                      <input
                        type="text"
                        value={toolName}
                        onChange={(e) => renameToolInstruction(toolName, e.target.value)}
                        className="w-48 px-2 py-1 border border-gray-300 rounded text-sm font-mono focus:ring-2 focus:ring-primary-500"
                        placeholder="tool_name"
                      />
                      <button onClick={() => removeToolInstruction(toolName)} className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500">
                        <CloseIcon />
                      </button>
                    </div>
                    <textarea
                      value={instruction}
                      onChange={(e) => updateToolInstruction(toolName, e.target.value)}
                      placeholder="Instructions for this tool..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                ))}
                {Object.keys(config.tool_instructions || {}).length === 0 && (
                  <p className="text-center text-gray-400 py-4">No tool-specific instructions. Tools will use default behavior.</p>
                )}
              </div>
            </div>

            {/* Tool Format & Result Instructions */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-3">Tool Format Settings</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tool Format Template</label>
                  <p className="text-xs text-gray-500 mb-2">Format for tool calls (for models without native function calling)</p>
                  <textarea
                    value={config.tool_format_template || ''}
                    onChange={(e) => setConfig({ ...config, tool_format_template: e.target.value })}
                    placeholder='USE_TOOL: tool_name\nPARAMETERS: {"key": "value"}'
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tool Result Instruction</label>
                  <p className="text-xs text-gray-500 mb-2">How AI should handle tool results</p>
                  <textarea
                    value={config.tool_result_instruction || ''}
                    onChange={(e) => setConfig({ ...config, tool_result_instruction: e.target.value })}
                    placeholder="Summarize the result naturally for the customer..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            {/* Language Instruction Template */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-2">Language Instruction Template</h4>
              <p className="text-sm text-gray-500 mb-3">
                Template for non-English language instructions. Use <code className="bg-gray-100 px-1 rounded">{'{language_name}'}</code> as placeholder.
              </p>
              <textarea
                value={config.language_instruction_template || ''}
                onChange={(e) => setConfig({ ...config, language_instruction_template: e.target.value })}
                placeholder="You MUST respond in {language_name}..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        )}
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
              <h3 className="text-lg font-medium">Generated System Prompt Preview</h3>
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

function ChevronIcon({ expanded }) {
  return (
    <svg className={`w-5 h-5 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
