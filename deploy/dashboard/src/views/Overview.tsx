import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { usePolling } from '../hooks/usePolling';
import { api } from '../api/client';

export function Overview() {
  const { data: agents } = usePolling(() => api.agents.list(), 5000);
  const { data: missions } = usePolling(() => api.missions.list(), 5000);
  const { data: events } = usePolling(() => api.events.list({ limit: 10 }), 10000);
  const { data: health } = usePolling(() => api.health(), 30000);

  const stats = {
    agents: {
      total: agents?.length || 0,
      online: agents?.filter((a) => a.status === 'online').length || 0,
    },
    missions: {
      total: missions?.length || 0,
      active: missions?.filter((m) => m.status === 'active').length || 0,
      completed: missions?.filter((m) => m.status === 'completed').length || 0,
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-gray-900">Overview</h1>
        <p className="text-gray-600 mt-1">System status and recent activity</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="text-sm text-gray-600">Total Agents</div>
          <div className="text-3xl font-bold text-accent mt-2">{stats.agents.total}</div>
          <div className="text-sm text-success mt-1">{stats.agents.online} online</div>
        </Card>

        <Card>
          <div className="text-sm text-gray-600">Total Missions</div>
          <div className="text-3xl font-bold text-accent mt-2">{stats.missions.total}</div>
          <div className="text-sm text-blue-600 mt-1">{stats.missions.active} active</div>
        </Card>

        <Card>
          <div className="text-sm text-gray-600">Completed Missions</div>
          <div className="text-3xl font-bold text-success mt-2">{stats.missions.completed}</div>
        </Card>

        <Card>
          <div className="text-sm text-gray-600">System Health</div>
          <div className="mt-2">
            <StatusBadge status={health?.status === 'ok' ? 'online' : 'offline'} />
          </div>
          <div className="text-xs text-gray-500 mt-1">DB: {health?.db || 'unknown'}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Agents">
          {agents && agents.length > 0 ? (
            <div className="space-y-3">
              {agents.slice(0, 5).map((agent) => (
                <div key={agent.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="font-medium text-gray-900">{agent.name}</div>
                    <div className="text-xs text-gray-500">{agent.openclaw_version || 'Unknown version'}</div>
                  </div>
                  <StatusBadge status={agent.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">No agents registered</div>
          )}
        </Card>

        <Card title="Recent Events">
          {events && events.length > 0 ? (
            <div className="space-y-2">
              {events.map((event) => (
                <div key={event.id} className="py-2 border-b border-gray-100 last:border-0">
                  <div className="text-sm font-medium text-gray-900">{event.type}</div>
                  <div className="text-xs text-gray-500">
                    {event.agent_name && `Agent: ${event.agent_name}`}
                    {event.mission_name && ` • Mission: ${event.mission_name}`}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(event.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">No recent events</div>
          )}
        </Card>
      </div>
    </div>
  );
}
