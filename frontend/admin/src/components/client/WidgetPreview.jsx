/**
 * Widget Preview Component
 * Displays a floating preview of the chat widget with the current configuration
 */
export default function WidgetPreview({ widgetConfig, onClose }) {
  return (
    <div
      className="fixed z-50 shadow-2xl"
      style={{
        [widgetConfig.position.includes('bottom') ? 'bottom' : 'top']: '20px',
        [widgetConfig.position.includes('right') ? 'right' : 'left']: '20px',
        position: 'fixed',
      }}
    >
      <div
        className="rounded-lg shadow-xl overflow-hidden flex flex-col"
        style={{
          width: '400px',
          height: '600px',
          backgroundColor: widgetConfig.bodyBgColor
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 flex-shrink-0"
          style={{
            backgroundColor: widgetConfig.headerBgColor,
            color: widgetConfig.headerTextColor
          }}
        >
          <div>
            <h3
              className="font-semibold text-base"
              style={{ color: widgetConfig.headerTextColor }}
            >
              {widgetConfig.title}
            </h3>
            <p
              className="text-xs mt-0.5"
              style={{ color: widgetConfig.headerTextColor, opacity: 0.9 }}
            >
              {widgetConfig.subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded flex items-center justify-center hover:opacity-80 transition-opacity"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{ fill: widgetConfig.buttonTextColor }}>
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {/* Messages Area */}
        <div
          className="p-5 overflow-y-auto flex-1"
          style={{
            backgroundColor: widgetConfig.bodyBgColor
          }}
        >
          {/* AI Greeting Message */}
          <div className="mb-3 flex flex-col items-start">
            <div
              className="inline-block rounded-lg px-3.5 py-2.5 max-w-[80%]"
              style={{
                backgroundColor: widgetConfig.aiBubbleColor,
                color: widgetConfig.aiTextColor,
                borderBottomLeftRadius: '4px'
              }}
            >
              <p className="text-sm whitespace-pre-wrap">{widgetConfig.greeting}</p>
            </div>
            <div className="text-xs mt-1 px-1" style={{ color: '#666' }}>
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
          </div>

          {/* Sample User Message */}
          <div className="mb-3 flex flex-col items-end">
            <div
              className="inline-block rounded-lg px-3.5 py-2.5 max-w-[80%]"
              style={{
                backgroundColor: widgetConfig.userBubbleColor,
                color: widgetConfig.userTextColor,
                borderBottomRightRadius: '4px'
              }}
            >
              <p className="text-sm">Hello! I need help with my order.</p>
            </div>
            <div className="text-xs mt-1 px-1" style={{ color: '#666' }}>
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
          </div>

          {/* Sample AI Response */}
          <div className="mb-3 flex flex-col items-start">
            <div
              className="inline-block rounded-lg px-3.5 py-2.5 max-w-[80%]"
              style={{
                backgroundColor: widgetConfig.aiBubbleColor,
                color: widgetConfig.aiTextColor,
                borderBottomLeftRadius: '4px'
              }}
            >
              <p className="text-sm">I'd be happy to help you with your order! Could you please provide your order number?</p>
            </div>
            <div className="text-xs mt-1 px-1" style={{ color: '#666' }}>
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div
          className="p-4 border-t flex-shrink-0"
          style={{
            backgroundColor: widgetConfig.footerBgColor,
            borderColor: '#e0e0e0'
          }}
        >
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Type your message..."
              className="flex-1 px-4 py-2.5 rounded-full text-sm border focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{
                backgroundColor: widgetConfig.inputBgColor,
                color: widgetConfig.inputTextColor,
                borderColor: '#e0e0e0'
              }}
              disabled
            />
            <button
              className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-90 transition-opacity flex-shrink-0"
              style={{
                backgroundColor: widgetConfig.primaryColor,
              }}
              disabled
            >
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ fill: widgetConfig.buttonTextColor, width: '18px', height: '18px' }}>
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Preview Label */}
      <div className="absolute -top-8 left-0 right-0 text-center">
        <span className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full shadow-lg">
          Live Preview
        </span>
      </div>
    </div>
  );
}
