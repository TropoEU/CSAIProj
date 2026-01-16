import { ChatWidget } from './widget.js';

/**
 * CSAI Chat Widget Entry Point
 * Auto-initializes the widget based on script tag data attributes
 *
 * MINIMAL EMBED CODE (Recommended):
 * <script src="..." data-api-key="YOUR_KEY"></script>
 *
 * All styling configuration is fetched from the server.
 * You can optionally override specific settings with data attributes.
 */

/**
 * Get configuration from the script tag's data attributes
 * Tracks which attributes were explicitly provided vs not set
 * @returns {Object} Configuration object with explicit overrides marked
 */
function getConfigFromScript() {
  const scripts = document.querySelectorAll('script[data-api-key]');
  const script = scripts[scripts.length - 1]; // Get the most recent script

  if (!script) {
    console.error('ChatWidget: No script tag found with data-api-key attribute');
    return null;
  }

  // Map of attribute names to config keys
  const attributeMap = {
    'data-api-key': 'apiKey',
    'data-api-url': 'apiUrl',
    'data-position': 'position',
    'data-primary-color': 'primaryColor',
    'data-background-color': 'backgroundColor',
    'data-header-bg-color': 'headerBgColor',
    'data-body-bg-color': 'bodyBgColor',
    'data-footer-bg-color': 'footerBgColor',
    'data-ai-bubble-color': 'aiBubbleColor',
    'data-user-bubble-color': 'userBubbleColor',
    'data-header-text-color': 'headerTextColor',
    'data-ai-text-color': 'aiTextColor',
    'data-user-text-color': 'userTextColor',
    'data-input-bg-color': 'inputBgColor',
    'data-input-text-color': 'inputTextColor',
    'data-button-text-color': 'buttonTextColor',
    'data-greeting': 'greeting',
    'data-title': 'title',
    'data-subtitle': 'subtitle',
  };

  const config = {};
  const explicitOverrides = new Set();

  // Read all data attributes
  for (const [attr, key] of Object.entries(attributeMap)) {
    const value = script.getAttribute(attr);
    if (value !== null && value !== undefined) {
      config[key] = value;
      // Mark as explicit override (except apiKey and apiUrl which are always needed)
      if (key !== 'apiKey' && key !== 'apiUrl') {
        explicitOverrides.add(key);
      }
    }
  }

  // Store which overrides were explicitly provided
  config._explicitOverrides = explicitOverrides;

  return config;
}

/**
 * Initialize the widget when DOM is ready
 */
function initWidget() {
  const config = getConfigFromScript();

  if (!config) {
    console.error('ChatWidget: Failed to get configuration from script tag');
    return;
  }

  if (!config.apiKey) {
    console.error('ChatWidget: data-api-key attribute is required');
    return;
  }

  try {
    const widget = new ChatWidget(config);

    // Expose widget instance globally for manual control
    window.CSAIWidget = widget;

    console.log('ChatWidget: Successfully initialized');
  } catch (error) {
    console.error('ChatWidget: Initialization failed', error);
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWidget);
} else {
  // DOM is already ready
  initWidget();
}

// Export for manual initialization
export { ChatWidget };
