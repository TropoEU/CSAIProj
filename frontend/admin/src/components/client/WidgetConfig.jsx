/**
 * Widget Configuration Component
 * Handles widget customization form and embed code generation
 */
import { useState } from 'react';
import { Card, CardBody, CardHeader, Button } from '../common';

export default function WidgetConfig({
  client,
  widgetConfig,
  setWidgetConfig,
  onSave,
  showPreview,
  onTogglePreview,
}) {
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const getWidgetEmbedCode = () => {
    const widgetUrl = import.meta.env.VITE_WIDGET_URL || 'http://localhost:3001/widget.js';
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    return `<!-- AI Chat Widget -->
<script
  src="${widgetUrl}"
  data-api-key="${client?.api_key || 'YOUR_API_KEY'}"
  data-api-url="${apiUrl}"
  data-position="${widgetConfig.position}"
  data-primary-color="${widgetConfig.primaryColor}"
  data-background-color="${widgetConfig.backgroundColor}"
  data-header-bg-color="${widgetConfig.headerBgColor}"
  data-body-bg-color="${widgetConfig.bodyBgColor}"
  data-footer-bg-color="${widgetConfig.footerBgColor}"
  data-ai-bubble-color="${widgetConfig.aiBubbleColor}"
  data-user-bubble-color="${widgetConfig.userBubbleColor}"
  data-header-text-color="${widgetConfig.headerTextColor}"
  data-ai-text-color="${widgetConfig.aiTextColor}"
  data-user-text-color="${widgetConfig.userTextColor}"
  data-input-bg-color="${widgetConfig.inputBgColor}"
  data-input-text-color="${widgetConfig.inputTextColor}"
  data-button-text-color="${widgetConfig.buttonTextColor}"
  data-greeting="${widgetConfig.greeting}"
  data-title="${widgetConfig.title}"
  data-subtitle="${widgetConfig.subtitle}"
></script>`;
  };

  const handleCopyEmbedCode = () => {
    navigator.clipboard.writeText(getWidgetEmbedCode());
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Widget Customization</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={onTogglePreview}>
            {showPreview ? 'Hide' : 'Show'} Preview
          </Button>
          <Button size="sm" onClick={onSave}>
            Save Configuration
          </Button>
        </div>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Widget Configuration Form */}
          <div className="space-y-6">
            {/* Basic Settings */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Basic Settings</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Widget Position
                  </label>
                  <select
                    value={widgetConfig.position}
                    onChange={(e) => setWidgetConfig({ ...widgetConfig, position: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="top-right">Top Right</option>
                    <option value="top-left">Top Left</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chat Title</label>
                  <input
                    type="text"
                    value={widgetConfig.title}
                    onChange={(e) => setWidgetConfig({ ...widgetConfig, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                    placeholder="Chat Support"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chat Subtitle
                  </label>
                  <input
                    type="text"
                    value={widgetConfig.subtitle}
                    onChange={(e) => setWidgetConfig({ ...widgetConfig, subtitle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                    placeholder="We typically reply instantly"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Greeting Message
                  </label>
                  <textarea
                    value={widgetConfig.greeting}
                    onChange={(e) => setWidgetConfig({ ...widgetConfig, greeting: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                    rows="2"
                    placeholder="Hi! How can I help you today?"
                  />
                </div>
              </div>
            </div>

            {/* Color Settings */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Color Customization</h4>
              <div className="space-y-3">
                <ColorInput
                  label="Primary Color"
                  value={widgetConfig.primaryColor}
                  onChange={(val) => setWidgetConfig({ ...widgetConfig, primaryColor: val })}
                />

                <ColorInput
                  label="Background"
                  value={widgetConfig.backgroundColor}
                  onChange={(val) => {
                    setWidgetConfig({
                      ...widgetConfig,
                      backgroundColor: val,
                      bodyBgColor:
                        widgetConfig.bodyBgColor === widgetConfig.backgroundColor
                          ? val
                          : widgetConfig.bodyBgColor,
                      footerBgColor:
                        widgetConfig.footerBgColor === widgetConfig.backgroundColor
                          ? val
                          : widgetConfig.footerBgColor,
                    });
                  }}
                />

                <div className="grid grid-cols-2 gap-3">
                  <ColorInput
                    label="Header Background"
                    value={widgetConfig.headerBgColor}
                    onChange={(val) => setWidgetConfig({ ...widgetConfig, headerBgColor: val })}
                  />
                  <ColorInput
                    label="Body Background"
                    value={widgetConfig.bodyBgColor}
                    onChange={(val) => setWidgetConfig({ ...widgetConfig, bodyBgColor: val })}
                  />
                </div>

                <ColorInput
                  label="Footer Background"
                  value={widgetConfig.footerBgColor}
                  onChange={(val) => setWidgetConfig({ ...widgetConfig, footerBgColor: val })}
                />

                <div className="grid grid-cols-2 gap-3">
                  <ColorInput
                    label="AI Bubble"
                    value={widgetConfig.aiBubbleColor}
                    onChange={(val) => setWidgetConfig({ ...widgetConfig, aiBubbleColor: val })}
                  />
                  <ColorInput
                    label="User Bubble"
                    value={widgetConfig.userBubbleColor}
                    onChange={(val) => setWidgetConfig({ ...widgetConfig, userBubbleColor: val })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <ColorInput
                    label="Header Text"
                    value={widgetConfig.headerTextColor}
                    onChange={(val) => setWidgetConfig({ ...widgetConfig, headerTextColor: val })}
                  />
                  <ColorInput
                    label="AI Text"
                    value={widgetConfig.aiTextColor}
                    onChange={(val) => setWidgetConfig({ ...widgetConfig, aiTextColor: val })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <ColorInput
                    label="User Text"
                    value={widgetConfig.userTextColor}
                    onChange={(val) => setWidgetConfig({ ...widgetConfig, userTextColor: val })}
                  />
                  <ColorInput
                    label="Button Text"
                    value={widgetConfig.buttonTextColor}
                    onChange={(val) => setWidgetConfig({ ...widgetConfig, buttonTextColor: val })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <ColorInput
                    label="Input Background"
                    value={widgetConfig.inputBgColor}
                    onChange={(val) => setWidgetConfig({ ...widgetConfig, inputBgColor: val })}
                  />
                  <ColorInput
                    label="Input Text"
                    value={widgetConfig.inputTextColor}
                    onChange={(val) => setWidgetConfig({ ...widgetConfig, inputTextColor: val })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Embed Code */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Embed Code</label>
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto font-mono">
                  {getWidgetEmbedCode()}
                </pre>
                <button
                  onClick={handleCopyEmbedCode}
                  className="absolute top-2 right-2 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedEmbed ? (
                    <svg
                      className="w-4 h-4 text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4 text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">How to Install</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Copy the embed code above</li>
                <li>Paste it before the closing &lt;/body&gt; tag in your website</li>
                <li>The chat widget will appear automatically on your site</li>
                <li>Customize appearance and behavior using the form on the left</li>
              </ol>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                <strong>Tip:</strong> Click "Show Preview" to see a floating widget preview that
                appears like it would on your client's website!
              </p>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * Color Input Component - Combines color picker with text input
 */
function ColorInput({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 rounded border border-gray-300"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
        />
      </div>
    </div>
  );
}
