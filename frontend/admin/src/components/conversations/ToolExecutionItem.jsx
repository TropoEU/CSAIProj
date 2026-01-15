import { Badge } from '../common';

/**
 * Get background color based on execution status
 */
function getStatusBackground(status) {
  if (status === 'blocked' || status === 'duplicate') return 'bg-yellow-50';
  if (status === 'failed') return 'bg-red-50';
  return '';
}

/**
 * Get badge variant based on execution status
 */
function getStatusVariant(status) {
  switch (status) {
    case 'success':
      return 'success';
    case 'failed':
      return 'danger';
    case 'blocked':
      return 'warning';
    case 'duplicate':
      return 'secondary';
    default:
      return 'default';
  }
}

/**
 * Individual tool execution item component
 */
export default function ToolExecutionItem({ execution }) {
  return (
    <div className={`p-4 ${getStatusBackground(execution.status)}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge variant="info">{execution.tool_name}</Badge>
          <Badge variant={getStatusVariant(execution.status)}>{execution.status}</Badge>
        </div>
        <span className="text-xs text-gray-500">
          {execution.execution_time_ms > 0 ? `${execution.execution_time_ms}ms` : '-'}
        </span>
      </div>

      {/* Error reason if present */}
      {execution.error_reason && (
        <div className="mb-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-sm text-yellow-800">
          <span className="font-medium">Reason: </span>
          {execution.error_reason}
        </div>
      )}

      {/* Input/Output */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Input</p>
          <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
            {JSON.stringify(execution.input_params, null, 2)}
          </pre>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Output</p>
          <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
            {JSON.stringify(execution.result, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
