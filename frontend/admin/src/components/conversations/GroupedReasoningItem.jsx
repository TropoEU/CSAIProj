import { Badge } from '../common';
import { formatGroupedReasoning } from '../../utils/messageGrouping';

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
 * Brain icon for reasoning
 */
function BrainIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

/**
 * Critique icon
 */
function CritiqueIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/**
 * Grouped reasoning item - displays combined reasoning steps
 */
export function GroupedReasoningItem({ group, debugMode }) {
  const formattedContent = formatGroupedReasoning(group);
  const messageCount = group.messages?.length || 0;

  return (
    <div className="p-4 bg-indigo-50 border-l-4 border-indigo-500">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-indigo-200 text-indigo-700">
          <BrainIcon />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-gray-900">AI Reasoning</span>
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-indigo-100 text-indigo-800">
              REASONING
            </span>
            {messageCount > 1 && (
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
                {messageCount} steps
              </span>
            )}
            <span className="text-xs text-gray-500">
              {group.timestamp ? new Date(group.timestamp).toLocaleString() : 'N/A'}
            </span>
            <div className="flex items-center gap-2 ml-auto">
              {group.tokens > 0 && (
                <Badge variant="default" className="text-xs" title="Tokens used for reasoning">
                  {formatTokenCount(group.tokens)}
                </Badge>
              )}
              {group.tokens_cumulative > 0 && (
                <Badge variant="info" className="text-xs" title="Cumulative tokens">
                  Total: {formatTokenCount(group.tokens_cumulative)}
                </Badge>
              )}
            </div>
          </div>

          {/* Formatted reasoning content */}
          {formattedContent ? (
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-white/50 p-2 rounded border border-gray-200 overflow-x-auto">
              {formattedContent}
            </pre>
          ) : (
            <p className="text-sm text-gray-500 italic">No reasoning summary available</p>
          )}

          {/* Expandable raw data for debugging */}
          {debugMode && group.messages && group.messages.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                Show {group.messages.length} raw message{group.messages.length > 1 ? 's' : ''}
              </summary>
              <div className="mt-1 space-y-2 max-h-64 overflow-y-auto">
                {group.messages.map((msg, idx) => (
                  <div key={idx} className="text-xs bg-gray-100 p-2 rounded">
                    <span className={`font-medium ${
                      msg.message_type === 'assessment' ? 'text-indigo-600' : 'text-gray-600'
                    }`}>
                      [{msg.message_type}]:
                    </span>
                    <pre className="mt-1 overflow-auto max-h-24 whitespace-pre-wrap">{msg.content}</pre>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Standalone critique item - displays actual critique when triggered
 */
export function StandaloneCritiqueItem({ item, debugMode }) {
  const msg = item.message;
  const content = msg.content || '';

  // Try to parse critique JSON for better display
  let parsedCritique = null;
  try {
    parsedCritique = JSON.parse(content);
  } catch {
    // Not JSON, display as-is
  }

  return (
    <div className="p-4 bg-orange-50 border-l-4 border-orange-500">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-orange-200 text-orange-700">
          <CritiqueIcon />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-gray-900">AI Critique</span>
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800">
              CRITIQUE
            </span>
            {parsedCritique?.decision && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                parsedCritique.decision === 'PROCEED' ? 'bg-green-100 text-green-800' :
                parsedCritique.decision === 'ESCALATE' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {parsedCritique.decision}
              </span>
            )}
            <span className="text-xs text-gray-500">
              {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'N/A'}
            </span>
            <div className="flex items-center gap-2 ml-auto">
              {item.tokens > 0 && (
                <Badge variant="default" className="text-xs" title="Tokens used for critique">
                  {formatTokenCount(item.tokens)}
                </Badge>
              )}
              {item.tokens_cumulative > 0 && (
                <Badge variant="info" className="text-xs" title="Cumulative tokens">
                  Total: {formatTokenCount(item.tokens_cumulative)}
                </Badge>
              )}
            </div>
          </div>

          {/* Critique content - formatted if JSON */}
          {parsedCritique ? (
            <div className="text-sm bg-white/50 p-2 rounded border border-gray-200 space-y-1">
              <div>
                <span className="font-medium text-gray-600">Decision:</span>{' '}
                <span className={`font-medium ${
                  parsedCritique.decision === 'PROCEED' ? 'text-green-700' :
                  parsedCritique.decision === 'ESCALATE' ? 'text-red-700' :
                  'text-yellow-700'
                }`}>{parsedCritique.decision}</span>
              </div>
              {parsedCritique.reasoning && (
                <div>
                  <span className="font-medium text-gray-600">Reasoning:</span>{' '}
                  <span className="text-gray-700">{parsedCritique.reasoning}</span>
                </div>
              )}
              {parsedCritique.message && (
                <div>
                  <span className="font-medium text-gray-600">Message:</span>{' '}
                  <span className="text-gray-700">{parsedCritique.message}</span>
                </div>
              )}
            </div>
          ) : (
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-white/50 p-2 rounded border border-gray-200 overflow-x-auto">
              {content}
            </pre>
          )}

          {/* Metadata */}
          {debugMode && msg.metadata && (
            <details className="mt-2">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                Show metadata
              </summary>
              <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                {JSON.stringify(msg.metadata, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

export default GroupedReasoningItem;
