import { ChatWidget } from './widget.js';

/**
 * CSAI Chat Widget Entry Point
 * Auto-initializes the widget based on script tag data attributes
 */

/**
 * Get configuration from the script tag's data attributes
 * @returns {Object} Configuration object
 */
function getConfigFromScript() {
  const scripts = document.querySelectorAll('script[data-api-key]');
  const script = scripts[scripts.length - 1]; // Get the most recent script

  if (!script) {
    console.error('ChatWidget: No script tag found with data-api-key attribute');
    return null;
  }

  const config = {
    apiKey: script.getAttribute('data-api-key'),
    apiUrl: script.getAttribute('data-api-url'),
    position: script.getAttribute('data-position'),
    primaryColor: script.getAttribute('data-primary-color'),
    backgroundColor: script.getAttribute('data-background-color'),
    headerBgColor: script.getAttribute('data-header-bg-color'),
    bodyBgColor: script.getAttribute('data-body-bg-color'),
    footerBgColor: script.getAttribute('data-footer-bg-color'),
    aiBubbleColor: script.getAttribute('data-ai-bubble-color'),
    userBubbleColor: script.getAttribute('data-user-bubble-color'),
    headerTextColor: script.getAttribute('data-header-text-color'),
    aiTextColor: script.getAttribute('data-ai-text-color'),
    userTextColor: script.getAttribute('data-user-text-color'),
    inputBgColor: script.getAttribute('data-input-bg-color'),
    inputTextColor: script.getAttribute('data-input-text-color'),
    buttonTextColor: script.getAttribute('data-button-text-color'),
    greeting: script.getAttribute('data-greeting'),
    title: script.getAttribute('data-title'),
    subtitle: script.getAttribute('data-subtitle'),
  };

  // Remove null/undefined values
  Object.keys(config).forEach((key) => {
    if (config[key] === null || config[key] === undefined) {
      delete config[key];
    }
  });

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
