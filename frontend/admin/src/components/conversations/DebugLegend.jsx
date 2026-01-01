/**
 * Debug mode legend showing message type color coding
 */
export default function DebugLegend() {
  const legendItems = [
    { color: 'bg-purple-500', label: 'System Prompt' },
    { color: 'bg-amber-500', label: 'Tool Call' },
    { color: 'bg-cyan-500', label: 'Tool Result' },
    { color: 'bg-gray-400', label: 'Internal' },
    { color: 'bg-white border border-gray-300', label: 'User/Assistant (visible)' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
      <span className="text-sm font-medium text-purple-800">Debug View Legend:</span>
      {legendItems.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className={`w-3 h-3 ${item.color} rounded`}></div>
          <span className="text-xs text-gray-600">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
