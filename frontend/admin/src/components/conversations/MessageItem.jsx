import { Badge } from '../common';

/**
 * Format token count for display
 */
function formatTokenCount(tokens) {
  if (!tokens || tokens === 0) return '0';
  if (tokens < 1000) return tokens.toString();
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1000000).toFixed(2)}M`;
}

/**
 * Get styling classes based on message type
 */
function getMessageTypeStyles(messageType) {
  switch (messageType) {
    case 'system':
      return 'bg-purple-50 border-l-4 border-purple-500';
    case 'tool_call':
      return 'bg-amber-50 border-l-4 border-amber-500';
    case 'tool_result':
      return 'bg-cyan-50 border-l-4 border-cyan-500';
    case 'internal':
      return 'bg-gray-100 border-l-4 border-gray-400';
    default:
      return '';
  }
}

/**
 * Get label configuration for message type
 */
function getMessageTypeLabel(messageType) {
  switch (messageType) {
    case 'system':
      return { text: 'SYSTEM PROMPT', color: 'bg-purple-100 text-purple-800' };
    case 'tool_call':
      return { text: 'TOOL CALL', color: 'bg-amber-100 text-amber-800' };
    case 'tool_result':
      return { text: 'TOOL RESULT', color: 'bg-cyan-100 text-cyan-800' };
    case 'internal':
      return { text: 'INTERNAL', color: 'bg-gray-200 text-gray-700' };
    default:
      return null;
  }
}

/**
 * Get avatar styling based on message type and role
 */
function getAvatarStyles(messageType, role) {
  if (messageType === 'system') return 'bg-purple-200 text-purple-700';
  if (messageType === 'tool_call') return 'bg-amber-200 text-amber-700';
  if (messageType === 'tool_result') return 'bg-cyan-200 text-cyan-700';
  if (role === 'user') return 'bg-primary-100 text-primary-600';
  if (role === 'tool') return 'bg-cyan-100 text-cyan-600';
  return 'bg-gray-200 text-gray-600';
}

/**
 * Get sender display name based on message type and role
 */
function getSenderName(messageType, role) {
  if (messageType === 'system') return 'System';
  if (messageType === 'tool_call') return 'AI → Tool';
  if (messageType === 'tool_result') return 'Tool → AI';
  if (role === 'user') return 'Customer';
  if (role === 'tool') return 'Tool Response';
  return 'AI Assistant';
}

// Icon components
function SystemIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ToolIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function AssistantIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

/**
 * Get the appropriate icon for a message
 */
function MessageIcon({ messageType, role }) {
  if (messageType === 'system') return <SystemIcon />;
  if (messageType === 'tool_call' || messageType === 'tool_result' || role === 'tool') {
    return <ToolIcon />;
  }
  if (role === 'user') return <UserIcon />;
  return <AssistantIcon />;
}

/**
 * Individual message item component
 */
export default function MessageItem({ message, debugMode }) {
  const messageType = message.message_type || 'visible';
  const isDebugMessage = messageType !== 'visible';
  const typeLabel = getMessageTypeLabel(messageType);

  const containerStyles = `p-4 ${
    message.role === 'assistant' && !isDebugMessage ? 'bg-gray-50' : ''
  } ${getMessageTypeStyles(messageType)}`;

  return (
    <div className={containerStyles}>
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getAvatarStyles(messageType, message.role)}`}
        >
          <MessageIcon messageType={messageType} role={message.role} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-gray-900">
              {getSenderName(messageType, message.role)}
            </span>
            {typeLabel && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${typeLabel.color}`}>
                {typeLabel.text}
              </span>
            )}
            <span className="text-xs text-gray-500">
              {message.timestamp ? new Date(message.timestamp).toLocaleString() : 'N/A'}
            </span>
            <div className="flex items-center gap-2 ml-auto">
              {message.tokens !== undefined && message.tokens > 0 && (
                <Badge variant="default" className="text-xs" title="Tokens used for this LLM call">
                  {formatTokenCount(message.tokens)}
                </Badge>
              )}
              {message.tokens_cumulative !== undefined && message.tokens_cumulative > 0 && (
                <Badge variant="info" className="text-xs" title="Cumulative tokens">
                  Total: {formatTokenCount(message.tokens_cumulative)}
                </Badge>
              )}
            </div>
          </div>

          {/* Message content */}
          {isDebugMessage ? (
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-white/50 p-2 rounded border border-gray-200 overflow-x-auto max-h-96">
              {message.content}
            </pre>
          ) : (
            <p className="text-gray-700 whitespace-pre-wrap">{message.content}</p>
          )}

          {/* Metadata for debug messages */}
          {debugMode && message.metadata && (
            <details className="mt-2">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                Show metadata
              </summary>
              <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                {JSON.stringify(message.metadata, null, 2)}
              </pre>
            </details>
          )}

          {/* Tools called badge (for non-debug view) */}
          {!debugMode && message.role === 'assistant' && message.tools_called?.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <span className="text-xs text-gray-500 font-medium">Tools Called: </span>
              <span className="text-xs text-gray-600">
                {message.tools_called.map((tool, idx) => (
                  <Badge key={idx} variant="info" className="text-xs mr-1">
                    {tool}
                  </Badge>
                ))}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
