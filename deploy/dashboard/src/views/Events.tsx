import { useState } from 'react';
import { Card } from '../components/Card';
import { usePolling } from '../hooks/usePolling';
import { api } from '../api/client';

export function Events() {
  const [limit, setLimit] = useState(100);
  const { data: events, loading, error } = usePolling(
    () => api.events.list({ limit }),
    10000
  );

  if (loading && !events) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading events...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-danger">Error loading events: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-gray-900">Events</h1>
          <p className="text-gray-600 mt-1">System audit trail and activity log</p>
        </div>
        <select
          value={limit}
          onChange={(e) => setLimit(parseInt(e.target.value, 10))}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
        >
          <option value="50">Last 50</option>
          <option value="100">Last 100</option>
          <option value="200">Last 200</option>
          <option value="500">Last 500</option>
        </select>
      </div>

      <Card>
        {events && events.length > 0 ? (
          <div className="space-y-1">
            {events.map((event) => (
              <div
                key={event.id}
                className="py-3 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-accent">
                        {event.type}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(event.created_at).toLocaleString()}
                      </span>
                    </div>
                    {(event.agent_name || event.mission_name) && (
                      <div className="text-sm text-gray-600 mt-1">
                        {event.agent_name && `Agent: ${event.agent_name}`}
                        {event.agent_name && event.mission_name && ' • '}
                        {event.mission_name && `Mission: ${event.mission_name}`}
                      </div>
                    )}
                    {Object.keys(event.data).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                          View data
                        </summary>
                        <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                          {JSON.stringify(event.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📜</div>
            <div className="text-gray-900 font-medium mb-2">No events yet</div>
            <div className="text-sm text-gray-600">
              Events will appear here as the system runs
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
