import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { aiBehavior } from '../services/api';

export default function AIBehaviorSettings({ onMessage }) {
  const { t, isRTL } = useLanguage();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [hasCustomConfig, setHasCustomConfig] = useState(false);
  const [customizedFields, setCustomizedFields] = useState([]);

  const loadConfig = useCallback(async () => {
    try {
      const response = await aiBehavior.get();
      setConfig(response.data);
      setHasCustomConfig(response.data.hasCustomConfig);
      setCustomizedFields(response.data.customizedFields || []);
    } catch (_error) {
      console.error('Failed to load AI behavior config:', _error);
      onMessage?.({ type: 'error', text: t('aiBehavior.saveError') });
    } finally {
      setLoading(false);
    }
  }, [onMessage, t]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Helper to check if a field is customized
  const isCustomized = (field) => customizedFields.includes(field);

  const saveConfig = async () => {
    setSaving(true);
    try {
      await aiBehavior.update(config);
      // Reload to get updated customizedFields from server
      await loadConfig();
      onMessage?.({ type: 'success', text: t('aiBehavior.saveSuccess') });
    } catch (error) {
      onMessage?.({ type: 'error', text: error.response?.data?.error || t('aiBehavior.saveError') });
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = async () => {
    if (!confirm(t('aiBehavior.resetConfirm'))) return;

    setSaving(true);
    const previousCustomizedFields = customizedFields;
    try {
      // Clear customization state FIRST for immediate UI feedback
      setHasCustomConfig(false);
      setCustomizedFields([]);
      const response = await aiBehavior.reset();
      setConfig(response.data.config);
      onMessage?.({ type: 'success', text: t('aiBehavior.resetSuccess') });
    } catch {
      // Revert on error
      setHasCustomConfig(true);
      setCustomizedFields(previousCustomizedFields);
      onMessage?.({ type: 'error', text: t('aiBehavior.resetError') });
    } finally {
      setSaving(false);
    }
  };

  const previewPrompt = async () => {
    try {
      const response = await aiBehavior.preview(config);
      setPreview(response.data.prompt);
      setShowPreview(true);
    } catch {
      onMessage?.({ type: 'error', text: t('aiBehavior.previewError') });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!config) {
    return <div className="text-center p-8 text-gray-500">{t('common.error')}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Status Badge */}
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
        hasCustomConfig
          ? 'bg-primary-100 text-primary-700'
          : 'bg-green-100 text-green-700'
      }`}>
        <div className={`w-2 h-2 rounded-full ${hasCustomConfig ? 'bg-primary-500' : 'bg-green-500'}`}></div>
        {hasCustomConfig ? t('aiBehavior.hasCustomizations') : t('aiBehavior.usingDefaults')}
      </div>

      {/* Guided Reasoning Toggle */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              {t('aiBehavior.guidedReasoning')}
              {isCustomized('reasoning_enabled') && <CustomizedBadge />}
            </h3>
            <p className="text-sm text-gray-500">{t('aiBehavior.guidedReasoningDesc')}</p>
          </div>
          <button
            onClick={() => setConfig({ ...config, reasoning_enabled: !config.reasoning_enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              config.reasoning_enabled ? 'bg-primary-600' : 'bg-gray-200'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              config.reasoning_enabled ? (isRTL ? '-translate-x-6' : 'translate-x-6') : (isRTL ? '-translate-x-1' : 'translate-x-1')
            }`} />
          </button>
        </div>
      </div>

      {/* Reasoning Steps */}
      {config.reasoning_enabled && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                {t('aiBehavior.reasoningSteps')}
                {isCustomized('reasoning_steps') && <CustomizedBadge />}
              </h3>
              <p className="text-sm text-gray-500">{t('aiBehavior.reasoningStepsDesc')}</p>
            </div>
            <button
              onClick={addReasoningStep}
              className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100"
            >
              <PlusIcon /> {t('aiBehavior.addStep')}
            </button>
          </div>
          <div className="space-y-4">
            {(config.reasoning_steps || []).map((step, index) => (
              <div key={index} className={`flex gap-4 items-start p-4 bg-gray-50 rounded-lg ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-primary-100 text-primary-700 rounded-full font-medium">
                  {index + 1}
                </div>
                <div className="flex-grow space-y-2">
                  <input
                    type="text"
                    value={step.title}
                    onChange={(e) => updateReasoningStep(index, 'title', e.target.value)}
                    placeholder={t('aiBehavior.stepTitle')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    dir={isRTL ? 'rtl' : 'ltr'}
                  />
                  <textarea
                    value={step.instruction}
                    onChange={(e) => updateReasoningStep(index, 'instruction', e.target.value)}
                    placeholder={t('aiBehavior.stepInstruction')}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    dir={isRTL ? 'rtl' : 'ltr'}
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
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          {t('aiBehavior.responseStyle')}
          {isCustomized('response_style') && <CustomizedBadge />}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('aiBehavior.tone')}</label>
            <select
              value={config.response_style?.tone || 'friendly'}
              onChange={(e) => updateResponseStyle('tone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              <option value="friendly">{t('aiBehavior.toneOptions.friendly')}</option>
              <option value="professional">{t('aiBehavior.toneOptions.professional')}</option>
              <option value="casual">{t('aiBehavior.toneOptions.casual')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('aiBehavior.maxSentences')}</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('aiBehavior.formality')}</label>
            <select
              value={config.response_style?.formality || 'casual'}
              onChange={(e) => updateResponseStyle('formality', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              <option value="casual">{t('aiBehavior.formalityOptions.casual')}</option>
              <option value="neutral">{t('aiBehavior.formalityOptions.neutral')}</option>
              <option value="formal">{t('aiBehavior.formalityOptions.formal')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tool Usage Rules */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              {t('aiBehavior.toolRules')}
              {isCustomized('tool_rules') && <CustomizedBadge />}
            </h3>
            <p className="text-sm text-gray-500">{t('aiBehavior.toolRulesDesc')}</p>
          </div>
          <button
            onClick={addToolRule}
            className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100"
          >
            <PlusIcon /> {t('aiBehavior.addRule')}
          </button>
        </div>
        <div className="space-y-2">
          {(config.tool_rules || []).map((rule, index) => (
            <div key={index} className={`flex gap-2 items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className={`flex-shrink-0 text-gray-400 w-6 ${isRTL ? 'text-right' : ''}`}>{index + 1}.</span>
              <input
                type="text"
                value={rule}
                onChange={(e) => updateToolRule(index, e.target.value)}
                placeholder={t('aiBehavior.rulePlaceholder')}
                className="flex-grow px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                dir={isRTL ? 'rtl' : 'ltr'}
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
        <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center gap-2">
          {t('aiBehavior.customInstructions')}
          {isCustomized('custom_instructions') && <CustomizedBadge />}
        </h3>
        <p className="text-sm text-gray-500 mb-4">{t('aiBehavior.customInstructionsDesc')}</p>
        <textarea
          value={config.custom_instructions || ''}
          onChange={(e) => setConfig({ ...config, custom_instructions: e.target.value })}
          placeholder={t('aiBehavior.customInstructionsPlaceholder')}
          rows={4}
          maxLength={2000}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          dir={isRTL ? 'rtl' : 'ltr'}
        />
        <p className="text-xs text-gray-400 mt-1">
          {(config.custom_instructions || '').length} / 2000
        </p>
      </div>

      {/* Action Buttons */}
      <div className={`flex justify-between items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
        <button
          onClick={resetConfig}
          disabled={saving || !hasCustomConfig}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('aiBehavior.resetToDefaults')}
        </button>
        <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <button
            onClick={previewPrompt}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {t('aiBehavior.previewPrompt')}
          </button>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? t('settings.saving') : t('aiBehavior.saveChanges')}
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
            <div className={`flex items-center justify-between p-4 border-b ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-lg font-medium">{t('aiBehavior.previewPrompt')}</h3>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600">
                <CloseIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono bg-gray-50 p-4 rounded-lg" dir="ltr">
                {preview}
              </pre>
            </div>
            <div className="p-4 border-t">
              <button
                onClick={() => setShowPreview(false)}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Customized indicator badge
function CustomizedBadge() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800" title="This setting differs from platform defaults">
      Modified
    </span>
  );
}

// Simple inline icons
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
