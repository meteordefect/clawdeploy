import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { usePolling } from '../hooks/usePolling';
import { api } from '../api/client';

export function Agents() {
  const { data: agents, loading, error } = usePolling(() => api.agents.list(), 5000);

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleString();
  };

  if (loading && !agents) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading agents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-danger">Error loading agents: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-gray-900">Agents</h1>
          <p className="text-gray-600 mt-1">Registered OpenClaw instances</p>
        </div>
      </div>

      {agents && agents.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900">{agent.name}</h3>
                    {agent.description && (
                      <p className="text-sm text-gray-600 mt-1">{agent.description}</p>
                    )}
                  </div>
                  <StatusBadge status={agent.status} />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Last Heartbeat</div>
                    <div className="font-medium text-gray-900">
                      {formatTimestamp(agent.last_heartbeat)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Version</div>
                    <div className="font-medium text-gray-900">
                      {agent.openclaw_version || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">IP Address</div>
                    <div className="font-medium text-gray-900">
                      {agent.ip_address || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Agent ID</div>
                    <div className="font-mono text-xs text-gray-600">
                      {agent.id.slice(0, 8)}...
                    </div>
                  </div>
                </div>

                {Object.keys(agent.health).length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Health Data</div>
                    <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(agent.health, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🤖</div>
            <div className="text-gray-900 font-medium mb-2">No agents registered yet</div>
            <div className="text-sm text-gray-600">
              Agents will appear here once they register with the control plane
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
